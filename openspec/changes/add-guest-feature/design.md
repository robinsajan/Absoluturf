## Context

The current AbsoluTurf platform supports registered users only for match participation. Players vote Yes/No on matches, and confirmed players' payments are tracked via `match_votes` and `payments` tables. The `guest_players` table is already defined in DATABASE.md but not yet implemented in code or migrations. The match's `max_players` field determines total available slots.

This change introduces unregistered guests who can be added to a match by a registered user (SPOC). The guest concept already has a defined schema but needs full API, business logic, payment integration, and frontend support.

## Goals / Non-Goals

**Goals:**
- Allow any confirmed (voted Yes) user to add N guests to a match
- Guests can be in **confirmed** (playing) or **waiting** status
- Guest payment responsibility falls entirely on the SPOC (adding user)
- SPOC's `splits` count in `payments` table = 1 (self) + number of confirmed guests
- Guest limit per user per match: must not exceed available slots (max_players - confirmed players)
- In-app notification to SPOC when guest is added (no external notification for MVP)
- Full CRUD API for guest management

**Non-Goals:**
- Guest registration/self-signup (guests remain unregistered)
- Guest voting or independent payment
- Guest backout or penalty enforcement
- External invitation system (SMS/Email) for MVP

## Decisions

1. **Guest status split: Confirmed vs Waiting** — Confirmed guests count toward playing slots and SPOC splits. Waiting guests are similar to substitutes but linked to a specific SPOC, not to the match substitute queue.
2. **Payment rollup to SPOC** — Rather than tracking per-guest payments, we increment SPOC's `splits` count. This keeps the existing `payments` table structure intact and avoids per-guest payment granularity.
3. **Separate route file** — `routes/guests.py` for clarity, following the pattern of existing route modules (auth.py, groups.py, matches.py, etc.).
4. **Guest limit per user** — A user cannot add more guests than remaining slots (max_players - confirmed unique voters). Waiting guests have no slot limit.
5. **Guest deletion cascades** — Removing a confirmed guest decrements the SPOC's splits and recalculates `total_due`.

## Risks / Trade-offs

- **Risk: SPOC over-commits guests** → Mitigation: enforce slot limit at API level; UI shows remaining available slots
- **Risk: Payment calculation staleness** → Mitigation: recalculate `total_due` and `splits` on every guest add/remove/status-change via helper function
- **Trade-off: No individual guest payment tracking** → Simpler implementation but loses per-guest payment history. Acceptable for MVP; can be added later with a `guest_payments` table
- **Risk: Guest name collisions** → Mitigation: guest names are display-only, no uniqueness constraint (multiple guests can share a name)
