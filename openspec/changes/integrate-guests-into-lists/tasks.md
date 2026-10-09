## 1. Remove Separate Guests Section

- [x] 1.1 Remove the "Guests" heading, guest count badge, and guest-only section from the Playing Team card in `matches/page.tsx`
- [x] 1.2 Remove the guest count from the status awareness banner guest line (keep total player count)

## 2. Merge Confirmed Guests into Playing Team List

- [x] 2.1 In the Playing Team rendering section, merge `currentMatch.votes.filter(v => v.vote === 'Yes')` with `guests.filter(g => g.status === 'confirmed')` into a single sorted array by `created_at`
- [x] 2.2 Render each confirmed guest with a "(Guest)" label after their name and an info icon showing "Added by {SPOC name}" on click

## 3. Merge Waiting Guests into Waiting List

- [x] 3.1 In the Waiting List rendering section, merge `currentMatch.substitutes` with `guests.filter(g => g.status === 'waiting')` into a single sorted array by `created_at`
- [x] 3.2 Render each waiting guest with a "(Guest by {SPOC name})" label and an info icon

## 4. Update Add Guest Flow for Full Match

- [x] 4.1 In the Add Guest form, when `yesCount + confirmedGuests >= max_players`, hide the "Playing" status toggle and show a text hint that only Waiting is available
- [x] 4.2 Auto-set `guestStatus` to `'waiting'` when playing list is full

## 5. Verify

- [x] 5.1 Confirm no separate "Guests" heading appears in the detail view
- [x] 5.2 Confirm confirmed guests render inline in Playing Team with "(Guest)" label and info icon
- [x] 5.3 Confirm waiting guests render inline in Waiting List with "(Guest by ...)" label
- [x] 5.4 Confirm Add Guest only shows "Waiting" when playing list is full
