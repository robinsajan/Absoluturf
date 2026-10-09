## Why

The current guest implementation shows guests in a separate "Guests" section below the Waiting List, making the match view cluttered and confusing. Users expect guest players to appear inline within the Playing Team list (if confirmed) or Waiting List (if waiting), just like registered players. Additionally, there is no way to see who added each guest, causing confusion about responsibility.

## What Changes

- Remove the separate "Guests" section from the Playing Team card
- Confirmed guests appear inline in the **Playing Team list** mixed with registered players, distinguished by a visual indicator (e.g., "(Guest)" label)
- Waiting guests appear inline in the **Waiting List** mixed with substitutes
- Every guest entry (confirmed or waiting) shows an info icon ("i") that reveals the SPOC name (who added them) on hover/click
- Add Guest button: when playing list is full, the status auto-locks to "Waiting" and Playing option is hidden/disabled
- Backend: GET guests endpoint already returns `added_by_name` — no backend changes needed

## Capabilities

### New Capabilities
- *(None – this modifies existing guest-management behavior)*

### Modified Capabilities
- `guest-management`: Guest display behavior changes – guests are rendered inline in Playing Team / Waiting List instead of a separate section; SPOC info icon added; add-guest flow auto-selects Waiting when full

## Impact

- **Frontend only:** `frontend/src/app/matches/page.tsx` — Playing Team rendering, Waiting List rendering, Add Guest dialog logic
- **No backend changes** — the API already returns guest data with `added_by_name` and `added_by_user_id`
