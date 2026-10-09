## Context

The `add-guest-feature` change implemented guest management with a separate "Guests" section below the Waiting List in the Playing Team card. Each guest is listed with name, SPOC name, and remove button. The GET guests API returns `added_by_name` and `added_by_user_id` for every guest record.

The current UX has two problems: (1) guests are visually segregated from the main player lists, breaking the user's mental model; (2) there is no quick way to see who added a guest without scanning the text label.

## Goals / Non-Goals

**Goals:**
- Confirmed guests render inline in the Playing Team list, sorted by join time alongside registered players
- Waiting guests render inline in the Waiting List, sorted by join time alongside substitutes
- Each guest entry has an info icon ("i") that shows the SPOC name on hover/click
- Add Guest flow: when playing slots are full, the option to add as "Playing" is hidden; only "Waiting" is available
- No separate "Guests" heading or section

**Non-Goals:**
- Changing the backend API (no new endpoints or response fields needed)
- Adding guest avatar or profile (guests are unregistered, name-only)
- Modifying payment or splits logic

## Decisions

1. **Inline rendering via merged lists** — The frontend will merge `currentMatch.votes` (filtered to Yes) with `guests` (filtered to confirmed) into a single sorted array for the Playing Team. Similarly, the Waiting List merges `currentMatch.substitutes` with waiting guests. Sorting preserves the original order (by `created_at`).
2. **Guest indicator label** — Confirmed guests show "(Guest)" after their name in the Playing Team list; waiting guests show "(Guest by SPOC)" in the Waiting List. This is clearer than a separate icon-only approach.
3. **Info icon tooltip** — An "i" icon inside a small circle next to the guest name. On click, it shows a tooltip/popover: "Added by {SPOC name}". Uses a simple state toggle rather than a full tooltip library.
4. **Add Guest button behavior** — The existing button in the voting column stays. When `yesCount + confirmedGuests >= max_players`, the "Playing" toggle in the add form is removed, leaving only "Waiting" as the option.

## Risks / Trade-offs

- **Risk: List sorting feels random** → Mitigation: sort merged lists by `created_at` so newest entries appear at the bottom, matching existing behavior
- **Risk: Info icon clutters small screens** → Mitigation: icon is small (12px) with a simple click-to-reveal text, no popover chrome
- **Trade-off: Guest label adds visual noise** — Alternative was a separate color/tint for guest rows, but labels are more accessible and self-documenting
