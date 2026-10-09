## ADDED Requirements

### Requirement: User can add a guest to a match
A user who has voted Yes on a match SHALL be able to add an unregistered guest to that match. The guest SHALL have a name and an initial status of "confirmed" or "waiting". The adding user SHALL be recorded as the SPOC (added_by_user_id).

#### Scenario: Add confirmed guest successfully
- **WHEN** a confirmed user adds a guest with name "John" and status "confirmed"
- **THEN** a GuestPlayer record is created with match_id, added_by_user_id, name="John", status="confirmed"

#### Scenario: Add waiting guest successfully
- **WHEN** a confirmed user adds a guest with name "Jane" and status "waiting"
- **THEN** a GuestPlayer record is created with status="waiting"

#### Scenario: Add guest exceeds available slots
- **WHEN** a user tries to add a confirmed guest but total confirmed players + confirmed guests = max_players
- **THEN** the system SHALL reject with an error "No available slots"

#### Scenario: Non-confirmed user cannot add guest
- **WHEN** a user who has not voted Yes on a match tries to add a guest
- **THEN** the system SHALL reject with an error "Only confirmed players can add guests"

### Requirement: User can view guests on a match
The system SHALL return all guest players for a given match, grouped by SPOC, showing guest name, status, and SPOC name.

#### Scenario: View guests for a match
- **WHEN** a user requests guests for a match with 3 guests
- **THEN** the response SHALL include all 3 guest records with their details

### Requirement: User can remove a guest
The SPOC who added a guest SHALL be able to remove that guest. Removing a confirmed guest SHALL decrement the SPOC's splits count and recalculate total_due. Removing a waiting guest SHALL just delete the record.

#### Scenario: Remove confirmed guest recalculates payment
- **WHEN** the SPOC removes a confirmed guest
- **THEN** the guest record is deleted AND the SPOC's splits count decreases by 1 AND total_due is recalculated

#### Scenario: Non-SPOC cannot remove guest
- **WHEN** a different user tries to remove a guest added by another SPOC
- **THEN** the system SHALL reject with an error "Only the SPOC can remove this guest"

### Requirement: Guest payment is rolled up to SPOC
For each confirmed guest added by a user, that user's `splits` count in the `payments` table SHALL increase by 1. The `total_due` SHALL be `splits * per_player_cost`. Waiting guests SHALL NOT affect splits.

#### Scenario: SPOC payment includes guest splits
- **WHEN** a user adds 2 confirmed guests to a match with per_player_cost=500
- **THEN** the user's splits = 3 (self + 2 guests) and total_due = 1500

#### Scenario: Waiting guest does not affect payment
- **WHEN** a user adds a waiting guest
- **THEN** the user's splits and total_due SHALL remain unchanged

### Requirement: Guest limit per user per match
A user SHALL NOT add more confirmed guests than remaining available slots. Available slots = max_players - number of distinct confirmed voters. Waiting guests SHALL have no upper limit beyond reasonable constraints.

#### Scenario: Slot limit enforced
- **WHEN** max_players=10, confirmed voters=8, and a user tries to add 3 confirmed guests
- **THEN** the system SHALL allow only 2 guests (the remaining slots) and reject the 3rd

### Requirement: Admin can view all guests
Group admins and match creators SHALL be able to view all guests across all SPOCs for a match without being the SPOC themselves.

#### Scenario: Admin views all guests
- **WHEN** a group admin requests guests for a match
- **THEN** the system SHALL return all guest records regardless of SPOC
