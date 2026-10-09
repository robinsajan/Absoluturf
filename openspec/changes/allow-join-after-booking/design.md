## Context

The match lifecycle has statuses: Proposed → Voting Open → Minimum Players Reached → Turf Confirmed → Completed / Cancelled. The `vote_match` endpoint in `routes/matches.py` blocks voting when status is `Turf Confirmed`, `Completed`, or `Cancelled`. The frontend's `canVote` check on `matches/page.tsx` mirrors this logic, only enabling vote buttons for `Proposed`, `Voting Open`, `Minimum Players Reached`.

The problem: once the admin confirms the turf booking, no new players can join even if slots remain (e.g., max_players=14, only 10 confirmed). The only path to join is the substitute queue, which is designed for when the match IS full.

## Goals / Non-Goals

**Goals:**
- Remove 'Turf Confirmed' from backend vote-blocking check
- Remove 'Turf Confirmed' from frontend canVote exclusion list
- Keep all other restrictions intact: match must not be past kickoff, full, or completed/cancelled

**Non-Goals:**
- Allowing vote changes after booking (existing users should not switch from No to Yes after booking — though this is currently unrestricted)
- Changing substitute queue behavior
- Changing the admin confirm flow

## Decisions

1. **Minimal change — one line per file** — Only remove `'Turf Confirmed'` from the two status checks. No new logic or flags needed because the existing full-check (`yes_votes >= max_players`) already prevents overfilling.
2. **Frontend `canVote` updated** — Add `'Turf Confirmed'` to the array. The UI already handles the "full" state visually (shows "Team is full" message), so no additional UI work needed for the full case.
3. **Fallback message unchanged** — The locked message "Attendance voting is locked — match confirmed, completed, or past kickoff" will still display for Completed/Cancelled/past matches.

## Risks / Trade-offs

- **Risk: Admin expects no new joiners after booking** → Mitigation: This is a deliberate feature change; communicate to admins that late joiners are allowed. The admin can still manually close the match by marking it Completed.
- **Trade-off: Simple change, no migration** — Removing a restriction is safe because the max_players guardrail is always enforced
