## Why

Currently, guests are visually and numerically treated as second-class participants in the playing list. The player count (`yesCount`) only counts registered users who voted "Yes" — confirmed guests are excluded from the count, creating a misleading display like "8/14 Players" when there are actually 10 confirmed participants (8 players + 2 guests). Guests also display "(Guest)" labels and info icons that distinguish them from normal players.

This inconsistency makes it hard to tell at a glance how many players are actually confirmed for a match, and unfairly treats guests as different even though they fill the same slot.

## What Changes

- The player count everywhere (`yesCount` → `totalPlayers`) will include confirmed guests
- The "Playing Team" header, status banner, and slots-left display will reflect the true count
- Guest labels ("(Guest)", info "i" icon, "(Guest by ...)") will be removed — guests display identically to normal players
- Guest remove button hidden (SPOC can manage via existing backend, but no inline remove in the list)
- Waiting list guests also display as normal waiting entries without guest distinction
- The "Add Guest" button and SPOC flow remain unchanged (still the mechanism to add unregistered players)
- Backend slot-check logic (vote_match) unaffected because that only applies to registered users voting

## Capabilities

### Modified Capabilities
- Playing Team display: count includes confirmed guests, no guest labeling
- Status awareness banner: player count includes guests, slots-left calculation includes guests
- Waiting list display: guest entries shown without distinction

## Impact

- **Frontend only** — `matches/page.tsx`: update `yesCount` → `totalPlayers` to include guests; remove guest labels/icons throughout the playing team and waiting list rendering
