# Database Schema

## Tables Overview

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| name | VARCHAR(100) | Not null |
| email | VARCHAR(120) | Unique, not null |
| phone | VARCHAR(20) | Not null |
| password_hash | VARCHAR(256) | Not null |
| profile_image | VARCHAR(255) | Nullable |
| upi_id | VARCHAR(100) | Nullable – for receiving payments |
| is_active | BOOLEAN | Default true |
| created_at | DATETIME | Auto-set |

**Relationships:** GroupMember, MatchVote, Substitute, Penalty, Notification, GuestPlayer (added_by), Payment

---

### `groups`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| name | VARCHAR(100) | Not null |
| description | TEXT | Nullable |
| sport_type | VARCHAR(50) | e.g. Football, Cricket |
| visibility | VARCHAR(20) | Public / Private |
| image | VARCHAR(255) | Nullable |
| created_by | INTEGER (FK → users.id) | Group creator |
| created_at | DATETIME | Auto-set |
| backout_penalty_enabled | BOOLEAN | Default false |
| backout_penalty_type | VARCHAR(30) | Match Ban (default) |
| backout_penalty_matches | INTEGER | Default 3 |
| backout_hours_threshold | INTEGER | Default 12 hours before match |

**Relationships:** GroupMember, Match, Penalty, PenaltyRule

---

### `group_members`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| group_id | INTEGER (FK → groups.id) | |
| user_id | INTEGER (FK → users.id) | |
| role | VARCHAR(20) | Admin / Member (default Member) |
| joined_at | DATETIME | Auto-set |
| status | VARCHAR(20) | Pending / Approved / Rejected |

**Unique constraint:** (group_id, user_id)

---

### `matches`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| group_id | INTEGER (FK → groups.id) | |
| created_by | INTEGER (FK → users.id) | |
| turf_name | VARCHAR(100) | Not null |
| location | VARCHAR(200) | Not null |
| match_date | VARCHAR(20) | YYYY-MM-DD |
| match_time | VARCHAR(20) | HH:MM |
| end_time | VARCHAR(20) | Nullable, HH:MM |
| max_players | INTEGER | Default 10 – total slots available |
| auto_booked | BOOLEAN | Default false – true when turf auto-confirmed |
| cost | FLOAT | Total turf booking cost in INR (default 0) |
| status | VARCHAR(30) | Proposed → Voting Open → Minimum Players Reached → Turf Confirmed → Completed / Cancelled |
| created_at | DATETIME | Auto-set |

**Derived fields (computed at runtime, not stored):**
- `per_player_cost = cost / max_players` (split evenly by total slots, not by actual voters)
- `user_total_cost = per_player_cost × (1 + confirmed_guests_count)` (self + guest splits)
- `pending_amount = user_total_cost - paid_amount`

**Relationships:** MatchVote, GuestPlayer, Payment, Substitute

---

### `match_votes`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| match_id | INTEGER (FK → matches.id) | |
| user_id | INTEGER (FK → users.id) | |
| vote | VARCHAR(10) | Yes / No / BackedOut |
| has_paid | BOOLEAN | Default false |
| paid_amount | FLOAT | Cumulative amount paid (default 0) |
| payment_verified | BOOLEAN | Default false – admin verification |
| created_at | DATETIME | Auto-set |
| backout_reason | TEXT | Nullable |
| backout_at | DATETIME | Nullable |

**Unique constraint:** (match_id, user_id)

---

### `guest_players`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| match_id | INTEGER (FK → matches.id) | |
| added_by_user_id | INTEGER (FK → users.id) | The user who added this guest |
| name | VARCHAR(100) | Guest's display name |
| status | VARCHAR(20) | Confirmed (playing) / Waiting |
| created_at | DATETIME | Auto-set |

**Logic:** Guest's payment is the responsibility of `added_by_user_id`. Adding a guest increases that user's `splits` count by 1.

---

### `payments`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| match_id | INTEGER (FK → matches.id) | |
| user_id | INTEGER (FK → users.id) | |
| splits | INTEGER | `1` (self) + confirmed guests added by this user |
| total_due | FLOAT | `splits × per_player_cost` |
| amount_paid | FLOAT | Cumulative amount paid so far |
| status | VARCHAR(20) | pending / partial / paid / verified |
| created_at | DATETIME | Auto-set |
| updated_at | DATETIME | Auto-updated on change |

**Derived field (computed, not stored):**
- `pending = total_due - amount_paid`

**Key rules:**
- `total_due` recalculated whenever guest is added/removed
- `amount_paid` only increases (never resets)
- `status = 'verified'` only set by admin when `amount_paid >= total_due`
- One row per (match_id, user_id)

---

### `substitutes`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| match_id | INTEGER (FK → matches.id) | |
| user_id | INTEGER (FK → users.id) | |
| queue_position | INTEGER | Position in waiting list (1-indexed) |
| promoted | BOOLEAN | Default false – true when promoted to playing team |
| invited_at | DATETIME | Nullable – when promotion offered |

---

### `penalties`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| user_id | INTEGER (FK → users.id) | |
| group_id | INTEGER (FK → groups.id) | |
| penalty_type | VARCHAR(30) | Match Ban / Mandatory Payment Fine / Voting Restriction |
| remaining_matches | INTEGER | Matches remaining under penalty |
| reason | TEXT | Nullable |
| created_by | INTEGER (FK → users.id) | Admin who applied it |
| created_at | DATETIME | Auto-set |

---

### `penalty_rules`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| group_id | INTEGER (FK → groups.id) | |
| trigger_event | VARCHAR(50) | e.g. `backout_no_sub`, `no_show` |
| penalty_type | VARCHAR(30) | Match Ban (default) |
| penalty_value | INTEGER | Number of match bans (default 1) |
| fee_multiplier | FLOAT | e.g. 2.0 = double fee (default 1.0) |
| description | TEXT | Nullable |
| is_active | BOOLEAN | Default true |
| created_at | DATETIME | Auto-set |

---

### `notifications`
| Column | Type | Notes |
|--------|------|-------|
| id | INTEGER (PK) | Auto-increment |
| user_id | INTEGER (FK → users.id) | Recipient |
| message | TEXT | Not null |
| read | BOOLEAN | Default false |
| created_at | DATETIME | Auto-set |

---

## Entity Relationships (Diagram)

```
User ──< GroupMember >── Group
  │                        │
  │──< MatchVote >── Match │
  │──< GuestPlayer >──┘    │
  │──< Payment >───────┘    │
  │──< Substitute >────┘    │
  │──< Penalty >────────────┘
  │──< Notification >
  │──< PenaltyRule >────────┘
```

## Payment Flow

```
Total turf cost (match.cost)
        │
        ▼
per_player_cost = cost / max_players
        │
        ├─ User pays for self     → 1 split
        ├─ User adds 1 guest      → 2 splits (self + guest)
        ├─ User adds 2 guests     → 3 splits (self + 2 guests)
        │
        ▼
total_due = per_player_cost × splits
        │
    amount_paid  ──(user pays)──►  increases
        │
        ▼
status flow: pending → partial → paid → verified (admin)
```
