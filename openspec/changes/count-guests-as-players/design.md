## Context

The match detail view (`matches/page.tsx`) currently tracks two separate groups of confirmed participants:

- **Voted "Yes" players** — stored in `MatchVote` table, accessible via `currentMatch.votes`
- **Confirmed guests** — stored in `GuestPlayer` table, fetched separately into `guests` state

The playing team display in the Playing Team card at line 723 shows `Playing Team ({yesCount}/{currentMatch.max_players})`, but `yesCount` (line 268) only counts `currentMatch.votes` with `vote === 'Yes'`. Guests are visually merged into the list with special labels but excluded from the count.

This creates a gap: if 8 players voted Yes and 2 guests are confirmed, the header shows "8/14 Players" when there are actually 10 participants.

## Goals / Non-Goals

**Goals:**
- Introduce `totalPlayers = yesCount + confirmedGuestsCount` and use it for all player count displays
- Remove "(Guest)" labels, info "i" icons, and "(Guest by ...)" text from the playing team and waiting list
- Keep the merged chronological sort order for playing team
- Keep the "Add Guest" button and SPOC flow intact
- Keep guest remove capability (but hide the inline remove X button — SPOC manages via backend)

**Non-Goals:**
- Backend changes — the `vote_match` endpoint only handles registered users; slot availability for match display uses the frontend count
- Payment flow changes — SPOC pays for their guests already (splits logic in backend)
- Changing how the substitute queue works
- Database migrations

## Decisions

1. **Derive `totalPlayers` once** — Compute `const confirmedGuestsCount = guests.filter(g => g.status === 'confirmed').length; const totalPlayers = yesCount + confirmedGuestsCount;` at the top of the detail view block and replace all `yesCount` references that represent player count
2. **Replace header count** — Line 723 `Playing Team ({yesCount}/...)` → `Playing Team ({totalPlayers}/...)`
3. **Replace status banner count** — Line 393 `{yesCount} / {currentMatch.max_players}` → `{totalPlayers} / {currentMatch.max_players}`
4. **Replace slots-left calculation** — Line 442 `{currentMatch.max_players - yesCount}` → `{currentMatch.max_players - totalPlayers}`
5. **Replace `isFull` check** — Line 269 `yesCount >= max_players` → `totalPlayers >= max_players`
6. **Replace empty state check** — Line 813 `yesCount === 0` → `totalPlayers === 0`
7. **Remove guest labels from Playing Team** — Lines 749-762 (Guest label + info icon + SPOC info toggle + "Added by" text)
8. **Remove guest remove button** — Lines 770-778 (the X button for guests added by current user)
9. **Remove guest distinction in Waiting List** — Lines 846-856 (waiting guest label + info icon)
10. **Normalize display** — Guest players no longer get `_isGuest` treatment; they render as any other player in both lists

## Risks / Trade-offs

- **Risk: SPOC can't remove guest from UI** → Mitigation: SPOC can still call the remove guest API endpoint directly. The inline X button was convenience-only. If needed, can be re-added in a future change.
- **Trade-off: Frontend-only change** — No backend modifications needed because the backend's slot checks for *voting* only concern registered users. The "fullness" display on the frontend must match the real count to avoid confusing admins.
- **Risk: Guests don't have payment_verified or has_paid fields** → In the playing team, the payment status column displays "Confirmed" (no payment badge) for guests since they don't have `MatchVote` records. This is the existing behavior. The guest payment is handled through the SPOC's splits.
