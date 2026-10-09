# AbsoluTurf UI and backend revamp

The implementation uses the existing [Stitch dashboard](https://stitch.withgoogle.com/projects/2879531505315904499) as the visual reference. See `design/DESIGN.md` for the shared design language and `design/qa/` for browser screenshots.

## Implemented
- Responsive clubhouse shell, persistent desktop sidebar and five stable mobile tabs: Home, Matches, Groups, Payments, Profile.
- Redesigned landing, authentication, dashboard, payment ledger and profile; themed match/group/invite flows, readable labels and working creation links.
- Desktop and mobile search across matches and groups, notification links/read actions, empty/loading/error states and reduced-motion support.
- Dashboard totals derived from approved memberships and actual participation rather than invented levels or ranks.
- Personal payment ledger and a separate group-admin view; guest-inclusive shares, unpaid/awaiting-review/verified states and UPI details.
- Additional guest shares after an existing payment show only the remaining amount to transfer. Submission remains separate from administrator verification.
- Editable name, phone and UPI ID, persistent light/dark mode, account deactivation and group-scoped penalty controls.
- Validation for registration, profile, match creation/editing; deactivated-user token rejection; guest-inclusive match capacity; payment permission checks and notifications.
- Attendance responses include vote IDs, so admin no-show actions address the actual vote record.
- Editing cannot silently reset a fixture with guest/payment records. Fixtures without those records retain the existing vote-reset flow.
- Venue-local kickoff/backout checks default to India's UTC+05:30; configure `MATCH_UTC_OFFSET_MINUTES` for another fixed-offset deployment.
- Tests initialise an in-memory database before SQLAlchemy, avoiding the previous risk of modifying the app database.

## New API endpoints
`GET /api/dashboard`: current user's participation, group, notification and payment totals.

`GET /api/payments?scope=mine`: current user's confirmed/completed paid-match shares.

`GET /api/payments?scope=managed`: player shares only in groups where the current user is an approved admin.

Existing `POST /api/matches/:id/pay` reports payment for verification; `POST /api/matches/:id/verify_payment/:userId` verifies receipt and accepts any approved group admin.

## Run locally
Keep the backend `.env` and frontend `.env.local` values private. Example files document the required values. The frontend API URL should be `http://127.0.0.1:5000/api` or the matching backend origin.

From `backend`:
```powershell
.\venv\Scripts\python.exe app.py
```
From `frontend`:
```powershell
npm run dev
```

## Verification
From `backend`, run `.\venv\Scripts\python.exe -m unittest test_api test_overview -v`.

From `frontend`, run `npm run lint` and `npm run build`.

The browser suite uses a separate in-memory QA server and synthetic accounts, never the app database. See `design/qa/README.md`.

## Scope
Payments use manual bank/UPI transfer reporting and administrator verification, matching the app's MVP specification. No payment gateway, external turf-booking integration, push notifications or production deployment was added. Match times use one configured fixed offset across the deployment; per-venue daylight-saving/IANA-zone scheduling remains future work.
