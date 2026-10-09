## 1. Backend: Remove Turf Confirmed from vote lock

- [x] 1.1 In `backend/routes/matches.py`, remove `'Turf Confirmed'` from the status check at line 337 so voting is allowed after booking

## 2. Frontend: Show vote buttons after booking

- [x] 2.1 In `frontend/src/app/matches/page.tsx`, add `'Turf Confirmed'` to the `canVote` status array so Playing/Out buttons show after booking
- [x] 2.2 Verify the fallback locked message no longer appears for Turf Confirmed matches with open slots

## 3. Verify

- [x] 3.1 Confirm a user can vote Yes on a Turf Confirmed match with open slots
- [x] 3.2 Confirm the full check still prevents joining when max_players is reached
- [x] 3.3 Confirm voting is still blocked for Completed, Cancelled, and past matches
