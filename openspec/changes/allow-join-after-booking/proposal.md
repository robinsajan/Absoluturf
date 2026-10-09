## Why

Currently, once an admin confirms a turf booking (status = "Turf Confirmed"), the voting/join system locks completely — no new players can join even if the match has empty slots. This is inflexible because players often decide to join late, after the booking is confirmed. The only way to join after booking is through the substitute/waiting list, which is unintuitive when slots are still open.

## What Changes

- Remove "Turf Confirmed" from the list of statuses that block voting/joining
- Players can vote Yes (join the playing list) or No anytime after booking as long as:
  - The match hasn't passed kickoff time
  - The playing list isn't full (max_players not reached)
- The frontend "Vote to Play" buttons remain visible after booking until the match is full or past
- The substitute waiting list still works for when the match IS full

## Capabilities

### New Capabilities
- *(None – modifies existing match voting behavior)*

### Modified Capabilities
- *(None – no existing specs in `openspec/specs/` to reference; this changes the match voting rule)*

## Impact

- **Backend:** `routes/matches.py` — remove 'Turf Confirmed' from the vote locking check (line 337)
- **Frontend:** `matches/page.tsx` — add 'Turf Confirmed' to the `canVote` status list (line 270); update the fallback message when voting is locked
