## Context

The current promotion system has two separate queues:
- **Substitute** table — registered users who joined via the "Join Waiting List" button (max 3). Has `queue_position`, `promoted` bool, `invited_at` timestamp.
- **GuestPlayer** table — unregistered guests added by a SPOC. Has `status` ('confirmed' or 'waiting') but **no** `queue_position` or `invited_at`.

When a player backs out (`backout_match` in `matches.py:408`), the code only queries the `Substitute` table. Waiting guests are completely invisible to the promotion logic. Additionally, when a substitute declines, the record is **deleted** (`matches.py:584-633`), losing all history.

## Goals / Non-Goals

**Goals:**
- Process both substitutes and waiting guests in a single FIFO queue
- Track full lifecycle per entry (invited, accepted, declined, timed out) without deleting records
- SPOC receives and can respond to guest promotion invitations
- 10-minute timeout auto-declines unanswered invitations
- Full audit trail for every slot-opening event
- Concurrency-safe: only one promotion process active at a time

**Non-Goals:**
- Changing the max 3 substitute limit (stays)
- Introducing a background job scheduler (timeout checked on accept, not async)
- Changing the Add Guest flow
- Payment flow changes during promotion

## Design Decisions

### 1. Substitute model migration: `promoted` → `status` enum

**Current:**
```python
promoted = db.Column(db.Boolean, default=False)
invited_at = db.Column(db.DateTime, nullable=True)
```

**New:**
```python
status = db.Column(db.String(20), default='waiting')
# Values: 'waiting' (in queue, not invited), 
#         'invited' (notified, awaiting response),
#         'accepted' (promoted to playing list),
#         'declined' (explicitly refused),
#         'timed_out' (didn't respond in time)
invited_at = db.Column(db.DateTime, nullable=True)
```

**Migration**: Add `status` column, set `status='accepted'` where `promoted=True`, `status='invited'` where `invited_at IS NOT NULL` and `promoted=False`, `status='waiting'` otherwise. Keep `promoted` column as deprecated (drop in future migration).

### 2. GuestPlayer model: add queue fields

```python
# New nullable fields
queue_position = db.Column(db.Integer, nullable=True)  # Only for status='waiting' guests
invited_at = db.Column(db.DateTime, nullable=True)
```

When a guest is added with `status='waiting'`, assign next `queue_position`. Clear `queue_position` when promoted or removed.

### 3. Unified FIFO ordering

When a slot opens, query both tables and pick the entry with the lowest ordering value:

```python
# Get next substitute
next_sub = Substitute.query.filter_by(
    match_id=match_id, status='waiting'
).order_by(Substitute.queue_position.asc()).first()

# Get next waiting guest  
next_guest = GuestPlayer.query.filter_by(
    match_id=match_id, status='waiting'
).order_by(GuestPlayer.queue_position.asc()).first()

# Pick whichever has lower position
if next_sub and next_guest:
    if next_sub.queue_position <= next_guest.queue_position:
        entry = ('sub', next_sub)
    else:
        entry = ('guest', next_guest)
elif next_sub:
    entry = ('sub', next_sub)
elif next_guest:
    entry = ('guest', next_guest)
else:
    entry = None
```

New guests added to the waiting list get `queue_position = max(existing_subs_count, existing_waiting_guests_count) + 1` to maintain consistent ordering.

### 4. Notify + invite flow

**For substitutes (existing, enhanced):**
1. Set `status='invited'`, `invited_at = now`
2. Send notification to the user
3. Frontend shows accept/decline buttons with timer

**For guests (new):**
1. Set `status='invited'` on GuestPlayer, `invited_at = now`
2. Send notification to the SPOC (`added_by_user_id`)
3. Frontend shows guest-accept/guest-decline UI for the SPOC

### 5. Accept/Decline endpoints

**Substitute accept** (existing, need to check timeout):
- If `invited_at` > 10 min ago → set `status='timed_out'`, return error, then auto-approach next entry
- Else set `status='accepted'`, create `MatchVote('Yes')`, notify admins

**Guest accept (new)** `POST /matches/<id>/guests/<guest_id>/accept`:
- Only the SPOC (`added_by_user_id`) can accept
- If `invited_at` > 10 min ago → same timeout handling
- Set guest `status='confirmed'`, clear `queue_position`
- Log promotion to `PromotionLog`

**Guest decline (new)** `POST /matches/<id>/guests/<guest_id>/decline`:
- Only the SPOC can decline
- Set guest `status='declined'`
- Approach next entry in queue

### 6. Timeout handling

The 10-minute timeout is enforced **at the accept endpoint** by checking `invited_at`:
```python
if entry.invited_at and (datetime.utcnow() - entry.invited_at).total_seconds() > 600:
    entry.status = 'timed_out'
    db.session.commit()
    # Immediately try the next entry
    return process_next_waiting_entry(match_id)
```

No background job needed. The frontend can show a countdown using the `invited_at` timestamp.

### 7. Concurrency lock

Add a module-level lock in `matches.py`:
```python
import threading
_promotion_lock = threading.Lock()
```

The backout flow acquires this lock before querying/updating the queue:
```python
with _promotion_lock:
    # Unified queue processing logic
```

This prevents two simultaneous backouts from both inviting the same person. For production, this could be upgraded to a database-level advisory lock.

### 8. PromotionLog model

```python
class PromotionLog(db.Model):
    __tablename__ = 'promotion_logs'
    
    id = db.Column(db.Integer, primary_key=True)
    match_id = db.Column(db.Integer, db.ForeignKey('matches.id'), nullable=False)
    slot_opened_at = db.Column(db.DateTime, nullable=False)
    entry_type = db.Column(db.String(20), nullable=False)  # 'substitute', 'guest'
    entry_id = db.Column(db.Integer, nullable=False)  # Substitute.id or GuestPlayer.id
    entry_name = db.Column(db.String(100), nullable=True)
    notification_sent_at = db.Column(db.DateTime, nullable=True)
    response_received_at = db.Column(db.DateTime, nullable=True)
    response = db.Column(db.String(20), nullable=True)  # 'accepted', 'declined', 'timed_out'
    promoted_to_playing = db.Column(db.Boolean, default=False)
    notes = db.Column(db.Text, nullable=True)
```

### 9. Frontend changes

- **Waiting list display** — Use unified data from backend (merged substitutes + waiting guests with queue_position). Already does this but with synthetic guest positions; move this to backend
- **SPOC invite UI** — When a SPOC has a guest with `status='invited'`, show accept/decline buttons with the guest's name and a 10-min countdown
- **Timeout countdown** — Display remaining time on pending invitations using `invited_at + 10min - now`
- **Match detail endpoint** — Returns unified waiting list with `entry_type` ('substitute'/'guest') so frontend knows how to render

### 10. Promotion processing architecture

The `process_slot_opening(match_id)` function encapsulates the entire promotion flow:

```
process_slot_opening(match_id):
  with _promotion_lock:
    slot_opened_at = now()
    
    loop:
      entry = get_next_waiting_entry(match_id)  # unified FIFO
      if not entry:
        log NoEntry slot_opened_at
        break  # no one to promote

      if entry.type == 'substitute':
        entry.status = 'invited'
        entry.invited_at = now()
        send_notification(entry.user_id, ...)
      elif entry.type == 'guest':
        entry.status = 'invited'  
        entry.invited_at = now()
        send_notification(entry.added_by_user_id, guest_name=entry.name, ...)
      
      log Invited entry, slot_opened_at, notification_sent_at
      break  # only invite one person per slot

    db.session.commit()
```

The accept/decline endpoints call back into this function when declining or when timeout occurs:

```
accept_entry(match_id, entry_type, entry_id):
  entry = find_entry(entry_type, entry_id)
  
  if entry.invited_at and age > 600:
    entry.status = 'timed_out'
    log TimedOut
    process_slot_opening(match_id)  # try next
    return error_to_user
  
  entry.status = 'accepted'
  promote_to_playing_list(entry)
  log Accepted
  return success

decline_entry(match_id, entry_type, entry_id):
  entry = find_entry(entry_type, entry_id)
  entry.status = 'declined'
  log Declined
  db.session.commit()
  process_slot_opening(match_id)  # try next immediately
  return success
```

## Migration Strategy

1. Add `status` column to `Substitute` (nullable, then backfill)
   - `promoted=True` → `status='accepted'`
   - `invited_at IS NOT NULL AND promoted=False` → `status='invited'`
   - Else → `status='waiting'`
2. Add `queue_position` and `invited_at` to `GuestPlayer` (nullable)
3. Create `PromotionLog` table
4. Add `match_id` and `type` to `Notification` (nullable, backfill)
5. Deploy new code (backward compatible since old fields remain)

## Risks / Trade-offs

- **Risk: Thread lock not sufficient for multi-process deployment** → Mitigation: Start with Python `threading.Lock()`; document that production should upgrade to DB-level lock (PostgreSQL advisory lock or Redis lock)
- **Risk: Existing declines lose audit trail** → Mitigation: Current declines delete the record. No migration for old data; new records will be preserved
- **Trade-off: 10-min timeout checked on accept, not async** → Simpler to implement, no cron/worker needed. Slight delay in processing if the invited person never responds, but next slot opening will trigger timeout check
- **Risk: Unified queue_position collision** → Mitigation: separate sequences for each match; new entries always take `max(all_existing_positions) + 1`
