## 1. Frontend: Lift guest count to component scope

- [x] 1.1 After line 268 (`const yesCount = ...`), add:
      ```ts
      const confirmedGuestsCount = guests.filter(g => g.status === 'confirmed').length;
      const totalPlayers = yesCount + confirmedGuestsCount;
      ```
- [x] 1.2 Change `isFull` on line 269 from `yesCount >= currentMatch.max_players` to `totalPlayers >= currentMatch.max_players`

## 2. Frontend: Replace player count references

- [x] 2.1 Line 393: `{yesCount} / {currentMatch.max_players} Players` → `{totalPlayers} / {currentMatch.max_players} Players`
- [x] 2.2 Line 434: `{yesCount}/{currentMatch.max_players}` → `{totalPlayers}/{currentMatch.max_players}`
- [x] 2.3 Line 442: `{currentMatch.max_players - yesCount}` → `{currentMatch.max_players - totalPlayers}`
- [x] 2.4 Line 723: `({yesCount}/{currentMatch.max_players})` → `({totalPlayers}/{currentMatch.max_players})`
- [x] 2.5 Line 813: `{yesCount === 0}` → `{totalPlayers === 0}`

## 3. Frontend: Remove guest labels/distinctions from Playing Team

- [x] 3.1 Lines 749-762: Remove the `{isGuest && (...)}` block containing `(Guest)` label, info "i" button, and "Added by" text
- [x] 3.2 Lines 770-778: Remove the `{isGuest ? (...)}` branch for the remove (X) button — guests render in the same payment-status column as normal players
- [x] 3.3 Clean up unused `isGuest` variable on line 739 and `isShowingSpoc` on line 740

## 4. Frontend: Remove guest distinctions from Waiting List

- [x] 4.1 Lines 846-856: Remove the `{isGuest ? (...)}` branch containing `(Guest by ...)` label and info "i" icon — render guests as normal waiting entries
- [x] 4.2 Clean up unused `isGuest` variable on line 840 and `isShowingSpoc` on line 841

## 5. Verify

- [x] 5.1 Load a match with confirmed guests — confirm the Playing Team header count includes them
- [x] 5.2 Confirm guest players appear without "(Guest)" label or info icon
- [x] 5.3 Confirm waiting list guests appear without "(Guest by ...)" label
- [x] 5.4 Confirm the "Add Guest" button still works and the slot limit enforcement still works
- [x] 5.5 Confirm matches with zero confirmed guests still display correctly
