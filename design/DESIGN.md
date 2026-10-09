# AbsoluTurf — Clubhouse design system

## Reference
Stitch project: https://stitch.withgoogle.com/projects/2879531505315904499
Screen: Redesigned Turf Player Dashboard, eb269dcb600e46a490a86d45842e4d17.
The downloaded source and screenshot live beside this file. Preserve the original sports identity and replace fictional rank, XP, win/loss and home-ground statistics with real coordination data.

## Atmosphere
A calm night-stadium clubhouse: deep green-tinted charcoal, restrained emerald, strong athletic headings, and clear tactical information. Balanced density, controlled asymmetry on desktop, and a mobile-first reading order. The dashboard should answer what is next, who is playing, and what needs settling.

## Colours
- Pitch canvas `#101412`: page background.
- Deep pitch `#0b0f0d`: desktop navigation.
- Clubhouse surface `#1c201e`: cards and grouped content.
- Low surface `#181c1a`: inputs and nested controls.
- Elevated surface `#272b28`: interaction states.
- Primary ink `#e0e3df`: text.
- Secondary ink `#bbcabf`: supporting text.
- Muted ink `#8b9a90`: metadata.
- Emerald `#4edea3`: primary actions, active navigation, focus and progress.
- Amber `#ffb95f` and error `#ffb4ab`: semantic status only.

All app colours are semantic CSS variables. Light mode uses pale green neutral surfaces, dark green ink and accessible deep emerald `#006c49`. Avoid neon, outer glows, gradient text and pure black surfaces.

## Typography
Oswald headlines and numerical totals echo the Stitch reference. Geist body text provides clear controls, labels and dense lists. Fonts are self-hosted through Next.js font optimisation. Large headings scale with clamp; labels remain readable. No invented performance claims or decorative microtext.

## Components
Cards use 12–14px corners, tonal backgrounds and subtle structural borders. Primary buttons are flat emerald with dark ink in dark mode, with a minimum 44px height. Inputs have visible labels, 46px height and emerald focus outlines. Skeletons match their eventual content. Empty states explain the next useful action. Payment status must distinguish to-pay, awaiting verification and verified.

## Layout
Desktop: persistent 244px sidebar, sticky header, a contained main area and a 1.65:1 dashboard split. Mobile: a 72px header, 16px gutters, single-column main sections, two-column compact totals matching the reference, and five stable bottom tabs. Search is available on both layouts. Reserve bottom padding and safe-area space; no horizontal overflow.

## Motion and accessibility
Short transform/opacity page reveals and quiet skeleton shimmer only. Respect reduced motion. Use visible focus, labelled icon buttons, accessible navigation, and keyboard-accessible dialogs with Escape, focus containment and focus restoration. Do not block navigation with animated curtains.

## Product truth
Use actual approved memberships, attendance votes, guest counts, completed participation and payment status. UPI transfers happen in the player's banking app; submission is a report of payment and group-admin verification is a separate action. Never imply a payment was processed by AbsoluTurf.
