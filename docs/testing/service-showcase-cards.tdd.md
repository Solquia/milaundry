# TDD evidence: the price list as showcase cards (app and web)

**Source plan:** none. The request (2026-09-08): "create a better price list showcase that is clean, modern and has personality", modelled on a reference where each service is a card with a bold title, a description, an illustrated tile and an ADD button; "this should apply to both the app and the website version".

## User journeys

1. As a customer on a shop's web page or in the app, I see each service as a card that tells me what it is, not just a name and a number.
2. As a customer, I can tell services apart at a glance: each kind of service wears its own colour and glyph.
3. As a customer, I tap a card (or its Book sticker) and land on the booking page with that service chosen.
4. As a customer of a shop that is not taking bookings, the cards are still readable and carry no Book sticker.
5. As an app customer who has not connected to the shop yet, the sticker is greyed and a tap tells me to connect first (existing behaviour, kept).

## What changed

| Surface | Before | After |
|---|---|---|
| `src/lib/domain/service-showcase.ts` (new) | — | What a card says: `showcaseTitle` (shouted names in title case), `showcaseBlurb` (shop's description or a line per category), `showcasePrice` (figure / unit / minimum), `showcaseTone` (a colour pair per category) |
| `src/components/service-showcase-card.tsx` (new) | — | One card used by both surfaces: tinted tile with the service glyph and a faint oversized watermark, title in the tone's ink, blurb, price, Book sticker overlapping the tile; hover lift on web, press scale everywhere |
| `src/components/web/price-list.tsx` | One white sheet of hairline rows | Cards, with quiet uppercase category labels only when there is more than one category; footnote and empty state kept |
| `src/app/(customer)/shop/[id].tsx` | One-open-at-a-time accordion of rows | Cards with the same category labels; the entrance cascade now counts cards. `PriceRow`, the accordion state and their styles removed; `price-accordion.ts` stays (still tested) but is no longer imported here |

## Task report

| Task | Test target | RED | GREEN |
|---|---|---|---|
| Card copy and tones | `src/lib/domain/__tests__/service-showcase.test.ts` | `npx jest service-showcase.test.ts`: `Cannot find module '../service-showcase'` (commit `54a75cd test: add reproducer for the service showcase cards`) | 13/13 pass; full suite `npx jest`: 99 suites / 1112 tests pass |
| Card component and both surfaces | none (presentational, per repo practice) | n/a | `npx eslint` on the five touched files: clean; `npx tsc --noEmit`: see below |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | `WASH AND FOLD` reads `Wash And Fold`; a name the shop cased itself is untouched; a 3-letter all-caps name is left as a possible acronym; whitespace trimmed | `showcaseTitle` (4 tests) | unit | PASS |
| 2 | The shop's own description wins, trimmed; an undescribed wash-and-fold service gets `Washed, dried and folded, ready to wear.`; every category has a line | `showcaseBlurb` (3 tests) | unit | PASS |
| 3 | Per-kg price splits into `₱176` / `/kg` / `2 kg minimum`; per-item has `/piece` and no minimum; flat has no unit and ignores a stray minimum | `showcasePrice` (3 tests) | unit | PASS |
| 4 | Six categories, six distinct backgrounds, each with a hex ink; unknown category falls back to `other` | `showcaseTone` (3 tests) | unit | PASS |

## Coverage and known gaps

- `service-showcase.ts` is fully exercised by its suite; `collectCoverageFrom` covers `src/lib/**` only, so the global figure is unaffected by the components.
- The card component has no unit test, matching repo practice for presentational components.
- Title-casing is a display rule only; the accessibility label and the booking page still use the shop's own string.
- Category tones are fixed pairs, not derived from the shop's brand; the Book sticker is what carries the brand on web (`theme.brand`) and the action blue in the app.

## Merge evidence

- RED: `54a75cd test: add reproducer for the service showcase cards`
- GREEN: the feature commit that follows this file.
