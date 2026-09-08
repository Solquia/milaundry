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

---

# Follow-up: isometric dioramas on the tiles (overdrive)

**Request (2026-09-08):** "add a graphics on the tiles of the pricing making it more goodlooking and detailed looking connected to what services inside". Direction chosen by the user from three offered: isometric mini-diorama, with tile depth and a live touch.

## What changed

| Surface | Before | After |
|---|---|---|
| `src/lib/domain/service-scene.ts` (new) | — | `sceneFor` picks one of eight dioramas from the service name, then its category, in the same specificity order as `service-icon.ts`; `sceneFaces` derives one light source (top, left, right faces, floor shadow, tile gradient, rim) from the tile colour |
| `src/components/service-scene.tsx` (new) | — | Eight scenes drawn in SVG on a shared 2:1 isometric projection: folded stack, iron on a board with steam, garment cover on a hanger, made bed, front-loader, slatted basket, a pair of shoes, curtains on a rail. Every solid is painted through one `box` helper and edged with a hairline so neighbouring forms separate |
| `src/components/service-showcase-card.tsx` | A single Ionicons glyph plus a watermark on a flat tile | The diorama on a gradient tile with a lit top edge; the scene lifts and scales on a spring when the card is hovered or pressed, and holds still when the device asks for reduced motion |

## Task report

| Task | Test target | RED | GREEN |
|---|---|---|---|
| Scene choice and lighting | `src/lib/domain/__tests__/service-scene.test.ts` | `npx jest service-scene`: `Cannot find module '../service-scene'` (commit `test: add reproducer for the isometric service scenes`) | 10/10 pass; full suite 100 suites / 1122 tests |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | The service's own name outranks its category, and the most specific word wins: "Wash, Dry & Fold" is a stack, "Dry cleaning — Barong / Suit" a suit, "Wash and press" an iron | `sceneFor` (3 tests) | unit | PASS |
| 2 | Every category resolves to a known scene, and the name match ignores case | `sceneFor` (2 tests) | unit | PASS |
| 3 | Every face is a hex colour; the top face is lighter than the left, the left lighter than the right, so a box reads as a solid | `sceneFaces` (2 tests) | unit | PASS |
| 4 | The tile gradient is lighter at the top than at the foot; the ramp is deterministic and survives an unreadable colour | `sceneFaces` (3 tests) | unit | PASS |

## Defects found and fixed during visual review

1. **Every tile after the first painted itself with the first tile's gradient.** SVG ids share one document-wide namespace on web, and all scenes declared `id="sky"`, so the bedding tile rendered blue. The id is now keyed to the tile colour.
2. **The bed read as an open crate.** Its parts were painted near-to-far, putting the headboard in front of the pillows. In this projection a larger x + y is nearer, so the parts are now painted far to near.
3. **The shoes, basket, suit and iron read as generic boxes.** Redrawn with the detail that identifies each: a tapering cover and hanger, a rim lip and slats, a sole and tapered toe, a sole plate jutting past the body.
4. **Neighbouring pale faces merged into one mass.** Every solid now carries a hairline edge in the deep tile colour.

## Coverage and known gaps

- `service-scene.ts` is fully exercised by its suite. The drawing component has no unit test, matching repo practice; it was verified in Chrome against all eight scenes at 104px and 168px.
- The spring uses the JS `Animated` driver with `useNativeDriver: true`; reduced motion is read once and watched via `AccessibilityInfo`.
- A temporary `/scene-preview` route was used for the eight-scene review and removed before commit.
- Verified on web only. The app screen draws the same component and typechecks, but was not rendered on a device this session.

## Merge evidence

- RED: `test: add reproducer for the isometric service scenes`
- GREEN: the feature commit that follows this file.

---

# Follow-up: the price list as a grid of white cards

**Request (2026-09-08):** the user supplied a reference of a services menu — white cards in a grid, each holding a cut-out object standing on the page with its name above it — and asked for that style. An earlier ask in the same session was for real photographs.

## The photograph question, answered honestly

The user asked me to source a licensed stock set. I searched Wikimedia Commons, the one library reachable from this machine with clean, verifiable licences, and built a contact sheet of 32 candidates across eight categories. Roughly eight were usable: ironing returned 1940s archival photographs, dry cleaning a Navy fire drill and a designer garment bag on a floor, bedding a 19th-century oil painting, and the laundry basket category's best result was a cat. Beyond the individual misses, the set had no coherence — mixing an archival photograph with a product shot on one screen would read as less finished than the drawings.

The photograph path is therefore **built but unfed**: a tile renders `image_url` whenever a service has one, with the drawing as the fallback and a broken URL falling back to it too. No service carries an image yet; storing and uploading one is the outstanding step.

## What changed

| Surface | Before | After |
|---|---|---|
| `service-scene.ts` | `sceneFaces(brand)` — one lighting, for a coloured tile | `sceneFaces(brand, surface)`. On `'white'` the object carries the hue itself and the tile is dropped, because a near-white object on a white card is a hole |
| `service-scene.tsx` | Always painted a gradient tile, a rim and an isometric floor patch | On white: no tile, no rim, a soft contact ellipse under the object, and the frame crops to the object's bounds so it fills the card |
| `service-tile-card.tsx` (new) | — | The card from the reference: name above, object standing on white with its shadow, price and an Add button below. Replaces `service-showcase-card.tsx`, which is deleted |
| `web/price-list.tsx` and the app shop screen | A column of horizontal rows | Two cards to a row, with the app's entrance cascade counting cards across the columns |

## Task report

| Task | Test target | RED | GREEN |
|---|---|---|---|
| Scene tones on a white card | `service-scene.test.ts` | `npx jest service-scene`: 2 failures — the white variant still painted a tile and returned near-white faces (commit `test: add reproducer for scenes drawn on a white card`) | 14/14 pass; full suite 101 suites / 1137 tests |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | The white variant keeps the same light source: top lit, right shaded | `sceneFaces on a white card` | unit | PASS |
| 2 | The object is painted in its own colour rather than near-white, so it does not vanish | `sceneFaces on a white card` | unit | PASS |
| 3 | Nothing paints a panel behind the object on a white card | `sceneFaces on a white card` | unit | PASS |
| 4 | Every face that paints returns a hex colour | `sceneFaces on a white card` | unit | PASS |

## Coverage and known gaps

- Verified in Chrome at phone width on the public shop page. Typecheck, lint, and the Impeccable detector are clean.
- The app shop screen renders the same grid and typechecks, but was not viewed on a device this pass.
- The objects remain drawings, not photographs. The reference's images are photographic cut-outs; matching that needs real image files, which no reachable library supplied at an acceptable quality.

## Merge evidence

- RED: `test: add reproducer for scenes drawn on a white card`
- GREEN: the feature commit that follows this file.
