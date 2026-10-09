## ADDED Requirements

### Requirement: User can join playing list after turf is booked
A group member SHALL be able to vote Yes (join the playing list) even after the match status is "Turf Confirmed", as long as the playing list is not full and kickoff has not passed.

#### Scenario: Join after booking when slots available
- **WHEN** a match has status "Turf Confirmed" and yes_votes < max_players and the match has not started
- **THEN** a group member SHALL be able to vote Yes and be added to the playing list

#### Scenario: Cannot join after booking when full
- **WHEN** a match has status "Turf Confirmed" and yes_votes >= max_players
- **THEN** the system SHALL reject with "Match is full — maximum players reached"

#### Scenario: Cannot join after booking when match has started
- **WHEN** a match has status "Turf Confirmed" and kickoff time has passed
- **THEN** the system SHALL reject with "Voting is closed — match kickoff time has passed"

### Requirement: Frontend shows voting buttons after booking
The match detail view SHALL display the Playing/Out vote buttons when the match status is "Turf Confirmed" and slots remain.

#### Scenario: Vote buttons visible after booking
- **WHEN** a user views a match with status "Turf Confirmed" and yes_votes < max_players
- **THEN** the "Playing" and "Out" vote buttons SHALL be visible
