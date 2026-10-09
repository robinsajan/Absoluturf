## Why

Currently, when a player backs out of a match, the system invites the next substitute from the queue — but only for registered users. Guests in the waiting list are never promoted. The system also **deletes** declining substitutes from the queue, losing all audit history. There's no timeout mechanism for unanswered invitations, no support for promoting waiting guests via their SPOC, and no audit trail tracking the promotion lifecycle.

This creates several problems:
- Waiting guests are effectively stuck — they can never fill an open slot
- No audit trail for who was invited, when, and how they responded
- SPOCs have no way to accept a slot on behalf of their guest
- No timeout means invitations stay pending indefinitely

## What Changes

- **Unified waiting list** — Both `Substitute` (registered users) and `GuestPlayer` (`status='waiting'`) entries are processed in strict FIFO order when a slot opens
- **Substitute status model** — Replace `promoted` bool with a `status` enum (`pending` / `accepted` / `declined` / `timed_out`). Declining no longer deletes the record
- **Guest promotion** — When a waiting guest is next in line, the SPOC who added them receives a notification and can accept/decline on their behalf
- **10-minute timeout** — Invitations auto-expire; accept endpoint checks `invited_at` age. Frontend shows remaining time
- **Audit trail** — New `PromotionLog` model records every step: slot opened, who was approached, notification sent, response received, promotion result
- **Concurrency safety** — A processing lock prevents race conditions when multiple slots open simultaneously

## Capabilities

### New Capabilities
- Guest promotion from waiting list via SPOC accept/decline
- Unified FIFO queue across registered users and guests
- Promotion audit trail with full lifecycle logging
- Invitation timeout (10 min auto-decline)

### Modified Capabilities
- Backout flow now checks both substitutes AND waiting guests
- Substitute decline no longer deletes the record (preserves history)
- `Substitute` model: `promoted` bool → `status` enum
- `GuestPlayer` model: adds `queue_position` and `invited_at` for waiting entries
- Match detail endpoint returns unified waiting list entries

## Impact

- **Backend models** — `Substitute` (add `status` enum, deprecate `promoted`), `GuestPlayer` (add nullable `queue_position`, `invited_at`), new `PromotionLog` model
- **Backend routes** — `matches.py` (backout flow: check unified queue, sequential processing lock); new guest accept/decline endpoints
- **Backend notifications** — Add `match_id` and `type` fields to `Notification` for structured invites
- **Frontend** — `matches/page.tsx`: waiting list display uses unified backend data; guest promotion accept/decline UI for SPOCs; timeout countdown display
- **Database migration** — Schema changes for all three models
