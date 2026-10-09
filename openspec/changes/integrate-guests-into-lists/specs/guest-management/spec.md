## MODIFIED Requirements

### Requirement: User can view guests on a match
The system SHALL return all guest players for a given match, grouped by SPOC, showing guest name, status, and SPOC name. The frontend SHALL render confirmed guests inline in the Playing Team list and waiting guests inline in the Waiting List. Each guest entry SHALL display an info icon that reveals the SPOC name.

#### Scenario: Confirmed guest appears in Playing Team list
- **WHEN** a confirmed guest exists for a match
- **THEN** the guest SHALL appear in the Playing Team list alongside registered Yes voters, sorted by created_at, with a "(Guest)" label

#### Scenario: Waiting guest appears in Waiting List
- **WHEN** a waiting guest exists for a match
- **THEN** the guest SHALL appear in the Waiting List alongside substitutes, with a "(Guest by {SPOC name})" label

#### Scenario: Info icon shows SPOC on click
- **WHEN** a user clicks the info icon on a guest entry
- **THEN** the system SHALL display the SPOC name ("Added by {name}")

## ADDED Requirements

### Requirement: Add Guest auto-selects Waiting when Playing list is full
When the playing list (confirmed voters + confirmed guests) has reached max_players, the "Add Guest" form SHALL hide the "Playing" status option and default to "Waiting".

#### Scenario: Playing option hidden when full
- **WHEN** yesCount + confirmedGuests >= max_players
- **THEN** the "Add Guest" form SHALL only show the "Waiting" option and default to it

#### Scenario: Pre-confirmed Add Guest button shows Waiting hint
- **WHEN** a confirmed Yes voter opens the Add Guest form and the playing list is full
- **THEN** the UI SHALL show a text hint that only the waiting list is available

### Requirement: No separate Guests section
The match detail view SHALL NOT display a separate "Guests" heading or section. All guests SHALL be integrated into the Playing Team list and Waiting List.

#### Scenario: Guests section removed
- **WHEN** a user views the match detail page
- **THEN** there SHALL be no "Guests" heading or guest-only section visible anywhere in the Playing Team card

#### Scenario: Guest count still visible
- **WHEN** confirmed guests exist
- **THEN** the player count badge SHALL still include them (e.g., "8/10 Players +2 guests")
