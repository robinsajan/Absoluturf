## Why

Users often want to bring friends or extra players to matches, but the current system only supports registered users as confirmed players or substitutes. There is no way to add unregistered guests to a match's playing or waiting list, forcing manual coordination outside the platform. This feature enables users to add N guests per match, with the adding user acting as the SPOC (Single Point of Contact) for confirmation and payment.

## What Changes

- Add `GuestPlayer` model to backend (already defined in DATABASE.md, needs migration)
- CRUD API endpoints for guest players on a match
- Guest confirmation flow: SPOC confirms → guest notified (in-app notification)
- Payment logic: guest's share is added to the SPOC's payment splits
- Guests can be placed in either the **playing list** (confirmed) or **waiting list** (substitute queue)
- Frontend UI: add/remove guests, view guest list per match, guest status indicators
- Update match player count to include confirmed guests
- Update payment calculations to factor in guest splits

## Capabilities

### New Capabilities
- `guest-management`: Create, read, update, delete guest players on a match. Guests have status (confirmed/waiting) and are linked to a SPOC (adding user). Guest payments roll up to the SPOC's tab.

### Modified Capabilities

- *(None – no existing specs to modify)*

## Impact

- **Backend:** New model `GuestPlayer` + new route file `routes/guests.py` + updates to `routes/matches.py` (guest-aware player counts) and `routes/payments.py` (splits include guests)
- **Frontend:** New components for adding/managing guests in match detail page; updates to match voting/payment UI
- **Database:** New `guest_players` migration
- **Payment flow:** `splits` count now = 1 (self) + confirmed guests added by user
