## 1. Backend: Model & Migration

- [x] 1.1 Add `GuestPlayer` model to `backend/models.py` with fields: id, match_id, added_by_user_id, name, status (confirmed/waiting), created_at
- [x] 1.2 Add relationships on `User` model: `guests_added` and on `Match` model: `guest_players`
- [x] 1.3 Generate and apply database migration for guest_players table

## 2. Backend: Guest API Routes

- [x] 2.1 Create `backend/routes/guests.py` with blueprint register
- [x] 2.2 Implement `POST /api/matches/<match_id>/guests` — add guest (validate user is confirmed, check slot limit for confirmed guests)
- [x] 2.3 Implement `GET /api/matches/<match_id>/guests` — list guests (grouped by SPOC, admins see all)
- [x] 2.4 Implement `DELETE /api/matches/<match_id>/guests/<guest_id>` — remove guest (only SPOC, recalculate payment if confirmed)
- [x] 2.5 Implement `PATCH /api/matches/<match_id>/guests/<guest_id>` — update guest status (e.g., waiting → confirmed, with slot validation)

## 3. Backend: Payment Integration

- [x] 3.1 Add helper `recalculate_spoc_payment(match_id, user_id)` that recalculates splits = 1 + count(confirmed guests) and updates total_due
- [x] 3.2 Call `recalculate_spoc_payment` on guest add (confirmed), guest remove (confirmed), and guest status change (to confirmed)
- [x] 3.3 Ensure `GET /api/matches/<match_id>/payments` returns updated splits including guest counts

## 4. Backend: Notification Integration

- [x] 4.1 Create notification when a guest is added (message: "You added {guest_name} to {match}")

## 5. Frontend: Guest Management UI

- [x] 5.1 Create `AddGuestDialog` component (input: guest name, status toggle: confirmed/waiting)
- [x] 5.2 Create `GuestList` component showing guests grouped by SPOC with name, status, and remove action
- [x] 5.3 Integrate guest components into match detail page
- [x] 5.4 Show remaining available slots in the add-guest UI
- [x] 5.5 Show guest count in match player summary

## 6. Frontend: Payment Display Update

- [x] 6.1 Update payment summary to show splits breakdown (self + N guests) and corresponding total_due

## 7. Testing & Verification

- [x] 7.1 Test guest CRUD API endpoints with curl or test scripts
- [x] 7.2 Test payment recalculation on guest add/remove/status-change
- [x] 7.3 Test slot limit enforcement
- [x] 7.4 Test authorization (only SPOC can remove own guests, admins can view all)
