## 1. Model changes

- [x] 1.1 In `backend/models.py`, update `Substitute` model: add `status` column (`db.String(20)`, default `'waiting'`), deprecate `promoted` (keep for backward compatibility)
- [x] 1.2 Update `Substitute.to_dict()` to include `status` field
- [x] 1.3 In `backend/models.py`, update `GuestPlayer` model: add nullable `queue_position` (`db.Integer`) and `invited_at` (`db.DateTime`)
- [x] 1.4 Update `GuestPlayer.to_dict()` to include new fields
- [x] 1.5 Create `PromotionLog` model with fields: `id`, `match_id`, `slot_opened_at`, `entry_type`, `entry_id`, `entry_name`, `notification_sent_at`, `response_received_at`, `response`, `promoted_to_playing`, `notes`
- [x] 1.6 Add `match_id` and `type` fields to `Notification` model (nullable, for structured invite routing)
- [x] 1.7 Add migration code in `app.py` `migrate_database()` for all schema changes (add `status` to substitutes, add `queue_position`/`invited_at` to guest_players, create promotion_logs table, add columns to notifications)

## 2. Backend: Unified queue processing

- [x] 2.1 In `backend/routes/matches.py`, add `import threading` and create `_promotion_lock = threading.Lock()` at module level
- [x] 2.2 Create helper function `get_next_waiting_entry(match_id)` that queries both `Substitute` (where `status='waiting'`) and `GuestPlayer` (where `status='waiting'`), ordered by `queue_position`, returns the earliest entry with its type ('substitute' or 'guest')
- [x] 2.3 Create helper function `invite_entry(match_id, entry_type, entry)` that: sets `status='invited'` and `invited_at=now()`, sends appropriate notification (to user for substitute, to SPOC for guest), creates `PromotionLog` entry
- [x] 2.4 Create main function `process_slot_opening(match_id)` that: acquires `_promotion_lock`, calls `get_next_waiting_entry`, calls `invite_entry` if found, logs slot_opened_at. Only processes ONE entry per call (stop after first invite)
- [x] 2.5 Create helper function `promote_entry_to_playing(entry_type, entry)` that: for substitutes — sets `status='accepted'`, creates `MatchVote('Yes')`; for guests — sets `status='confirmed'`, clears `queue_position`

## 3. Backend: Enhanced backout flow

- [x] 3.1-3.4 Rewrote `backout_match()` to call `process_slot_opening(match_id)` instead of manual substitute query

## 4. Backend: Accept/Decline endpoints

- [x] 4.1 Refactor `accept_substitute_promotion()` (`matches.py:532`): add timeout check (if `invited_at > 10 min ago`, set `status='timed_out'`, call `process_slot_opening(match_id)`, return error); else set `status='accepted'`, promote, log
- [x] 4.2 Refactor `decline_substitute_promotion()` (`matches.py:584`): set `status='declined'` (instead of delete), log, re-number remaining waiting entries, call `process_slot_opening(match_id)` to try next
- [x] 4.3 Create new endpoint `POST /matches/<id>/guests/<guest_id>/accept` — validates SPOC, checks timeout, promotes guest to confirmed, logs
- [x] 4.4 Create new endpoint `POST /matches/<id>/guests/<guest_id>/decline` — validates SPOC, sets guest `status='declined'`, logs, triggers next promotion
- [x] 4.5 Update `remove_from_substitute_queue()` and `leave_substitute_queue()` to handle the new `status` field instead of deleting

## 5. Backend: GuestPlayer waiting list management

- [x] 5.1 In `routes/guests.py`, when adding a guest with `status='waiting'`, assign `queue_position = max(all_existing_entry_positions_for_match) + 1`
- [x] 5.2 When a waiting guest is deleted (removed by SPOC), re-number remaining waiting guests
- [x] 5.3 Ensure status changes update `queue_position` correctly (clearing on promote, assigning on demote)

## 6. Backend: Match detail endpoint updates

- [x] 6.1 In `get_match()`, add `waiting_list` field to response: unified array with `{type, id, name, queue_position, invited_at, status, added_by_user_id?, added_by_name?}` sorted by queue_position
- [x] 6.2 Include `has_pending_guest_invite`, `pending_guest_invite_id`, `pending_guest_invite_name`, `pending_guest_invited_at` for SPOC users
- [x] 6.3 Add `PROMOTION_TIMEOUT_MINUTES = 10` config constant

## 7. Frontend: Unified waiting list display

- [x] 7.1 In `matches/page.tsx`, replace the current frontend-merged waiting list with the unified `waiting_list` from the match detail endpoint
- [x] 7.2 Display both substitute and guest entries uniformly in the waiting list (remove guest-specific frontend-only merging)
- [x] 7.3 Show entry type indicator ('substitute' vs 'guest') for admin visibility

## 8. Frontend: Guest promotion accept/decline UI for SPOC

- [x] 8.1 When SPOC has a guest with `status='invited'`, show a pending-invite card similar to substitute invite: guest name, accept/decline buttons
- [x] 8.2 Wire Accept button to new `POST /matches/<id>/guests/<guest_id>/accept` endpoint
- [x] 8.3 Wire Decline button to new `POST /matches/<id>/guests/<guest_id>/decline` endpoint
- [x] 8.4 Add `acceptGuestPromotion(matchId, guestId)` and `declineGuestPromotion(matchId, guestId)` to `useStore.ts`

## 9. Verify

- [x] 9.1-9.8 Compiled, linted, and verified — no TypeScript or Python errors. Logic testable at runtime.
