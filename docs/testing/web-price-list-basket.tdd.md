# TDD evidence: the price list that is the basket (overdrive)

**Source plan:** impeccable `overdrive` on the shop web page's price list. Three directions were offered; the user chose "the list is the basket". Journeys were derived during the run.

## User journeys

1. As a customer reading a shop's prices, I tap a service and it joins my order right there, with a stepper in the row and the line's cost for my quantity.
2. As I change quantities, the one button at the bottom of the page tells me what I am about to book and for how much.
3. When I press that button, the booking page opens with my whole basket already in it.
4. If I arrive at the booking page from a hand-edited or stale link, the basket is held to the shop's rules and never books a line the shop would refuse.

## Task report

| Task | Test target | RED | GREEN |
|---|---|---|---|
| Basket in the address (`encodeCart`, `decodeCart`, `cartFromParams`) | `web-cart.test.ts` | `npm test -- web-cart basket-copy`: `encodeCart/decodeCart/cartFromParams is not a function` (commit `8ef4a36`) | 29 passed (commit `04fa5ff`) |
| Basket copy (`bookButtonLabel`, `lineSummary`) | `basket-copy.test.ts` | `Cannot find module '../basket-copy'` | passes |
| Rows with steppers, tint and springs; footer counts up; hand-off | none (React) | n/a | Full suite 99 suites / 1112 tests; tsc, lint, impeccable detector clean; Chrome walk-through below |

## Chrome walk-through (`/s/sparkle-clean`, 1280px window, 480px frame)

1. Tap "Add WASH AND FOLD" → row tints in the shop's soft colour, shows "₱352 for 2 kg" (the 2 kg minimum) and a stepper; footer reads "Book 1 item · ₱352".
2. Tap "+" → "₱528 for 3 kg"; tap "Add BIG BEDDINGS" → "₱123 for 1 piece"; footer reads "Book 2 items · ₱651".
3. Tap the footer → `/s/sparkle-clean/book?cart=<wash>:3,<bedding>:1` opens with both lines and "2 lines · estimate ₱651.00".

One defect found and fixed in the round: the row's `disabled` prop disabled the stepper inside it on the web; the row now simply has no press handler once its line exists.

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | A basket round-trips through one query value; empty encodes to nothing | `encodeCart / decodeCart: round-trips…`, `encodes nothing…` | unit | PASS |
| 2 | Unknown services, zero, and non-numbers are dropped on the way back | `drops lines the shop no longer sells…` | unit | PASS |
| 3 | A per-kg line is held to the shop minimum and the weight cap; a flat line is one | `holds a per-kg line…`, `keeps a flat line at one` | unit | PASS |
| 4 | Missing, blank, or nonsense values open an empty basket | `opens empty…` | unit | PASS |
| 5 | A whole basket wins over a single tapped service; a repeated key uses its first value | `cartFromParams` | unit | PASS |
| 6 | The button says "Book online" while empty and "Book N items · ₱total" otherwise | `bookButtonLabel` | unit | PASS |
| 7 | A line reads "₱528 for 3 kg" / "₱25 for 1 piece"; a flat line is just its price | `lineSummary` | unit | PASS |

## Coverage and known gaps

- The new domain code is fully exercised by its suites; global figure unchanged.
- `price-list.tsx` and the storefront footer have no unit tests, per repo practice for screens; verified in Chrome as above.
- Motion uses React Native's own `Animated` (springs on the quantity and the footer, a 180 ms tint), which already runs the splash and welcome screens on web. Reanimated is installed but was not introduced here.
- Not verified on a physical phone in this run.

## Merge evidence

- RED: `8ef4a36 test: add reproducers for the price list that is the basket`
- GREEN: `04fa5ff feat: the price list is the basket`
