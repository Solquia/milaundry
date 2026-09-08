# TDD evidence: the shop web page's price list, polished

**Source plan:** none; the request was to make the price list on the shop's public web page cleaner, faster, friendlier, and elegant. Refinement of the incumbent look (impeccable `polish`), not a redesign.

## User journeys

1. As a customer on a shop's web page, I read every price at a glance with nothing said twice.
2. As a customer, I tap the service I want and land on the booking page with it already in my basket.
3. As a customer of a shop that is not taking bookings, I still read the list; rows are just rows.

## What changed

| Before | After |
|---|---|
| Each category a separate card with an uppercase eyebrow and a "1 service · from ₱176" line, repeating the price one line below | One white sheet; plain bold category headings; hairline rows |
| Figure in text colour | Figure in the shop's ink with tabular numerals; unit beside it; minimum under the name |
| Rows inert; booking only through the footer button | A row is a button: opens `/s/<slug>/book?service=<id>` with that service in the basket at its first-tap quantity; hover/press tint in the shop's soft colour; chevron; "Tap a service to book it." footnote. Absent when the shop cannot take bookings |

## Task report

| Task | Test target | RED | GREEN |
|---|---|---|---|
| Basket pre-seeded from a tapped row | `web-cart.test.ts: startingCart` | `npm test -- web-cart`: `startingCart is not a function` (commit 4 in sequence: `test: add reproducer for booking a service straight from the price list`) | passes; full suite 98 suites / 1099 tests; tsc, lint clean (commit `2be48b6`) |
| List layout and row affordance | none (presentational) | n/a | impeccable detector on `price-list.tsx`: `[]`; Chrome on `/s/sparkle-clean`: sheet renders, row tap navigates to the booking page with `?service=<id>` |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | A tapped per-kg service opens the basket at the shop minimum; per-item at one piece | `startingCart: opens the basket with the tapped service…` | unit | PASS |
| 2 | A repeated query key uses its first value | `takes the first id…` | unit | PASS |
| 3 | No id, an empty id, or an id the shop no longer sells opens an empty basket | `opens empty…` | unit | PASS |

## Coverage and known gaps

- `web-cart.ts` remains fully covered by its suite; global figure unchanged.
- `price-list.tsx` has no unit test, matching the repo's practice for presentational components; verified in Chrome and by the detector.
- Service names arrive as the shop typed them (often all caps); left untouched as the shop's own copy.
- Hover tint relies on `onHoverIn`/`onHoverOut`, which only fire on web; native gets the press tint only, which is correct.

## Merge evidence

- RED: `test: add reproducer for booking a service straight from the price list`
- GREEN: `2be48b6 feat: a price list on one sheet, where a row books the service`
