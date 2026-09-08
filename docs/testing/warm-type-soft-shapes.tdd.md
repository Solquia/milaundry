# TDD evidence: a warmer face and softer shapes, merchant side first

**Request (2026-09-08):** "typeset + polish, in the app and in the web, i dont like the feeling of boxiness or the shapes are to boxy and to formal, can we change that so we can make it not boring but still keep the easy to use just give more engagement to the eyes for now start at the merchant side."

**Direction chosen by the user** from options offered: *soft surfaces plus drawn touches*, and *a warm face everywhere*.

## What the survey found

A read of the seven merchant screens plus the shared kit established the two causes, and neither was a matter of taste:

1. **The type scale had no room in it.** Roles ran 17 / 15 / 14 / 12 with no line heights at all. Three roles sat within three pixels, so screens overrode them constantly: `section` was never once rendered at its declared 17, because both call sites knocked it to 16. A de-facto 16 / 15 / 14 / 13 scale was operating underneath the declared one.
2. **There was no radius token.** Every corner in the codebase was a bare number, and thirteen distinct values were in use on a single merchant screen. A card at 14 with its inner control at 12 is a step nobody can see.

## User journeys

1. As a merchant, the screens feel warm and approachable rather than clerical, and I can still find everything exactly where it was.
2. As a merchant, a heading is unmistakably a heading beside its body text, without me reading the words.
3. As anyone on either surface, nothing on screen has a hard corner, and a card reads as something resting on the page rather than as a box.

## What changed

| Surface | Before | After |
|---|---|---|
| `src/lib/domain/design-scale.ts` (new) | — | The tested foundation: `FONT` and `fontFor` (a family per weight), `TYPE_ROLES` (seven roles, each with a line height and tracking), `RADII`, and `CROWN` |
| `src/app/_layout.tsx` | Preloaded the icon font only | Loads Figtree's five cuts in the same call, so no text paints in the fallback face and reflows |
| `src/components/ui-kit.tsx` | Seven roles by size and weight; card, input, button and tag radii as literals | Roles come from the scale; the card lost its 1px outline for a soft shadow and took the crown; buttons became pills; every radius names a token |
| 6 merchant screens | 13 local type overrides, 6 literal radii | No overrides; shapes from the tokens |
| 12 shared components | Radii from 6 to 20, mostly one step apart | Full-width cards take the crown, tiles the card radius, the search field a pill |
| `src/components/section-heading.tsx` | Title, caption | Plus a swash: a short stroke with a rise and a fall in it, drawn rather than ruled |

**The crown** is the drawn touch the user picked. A sheet is rounded further at the head (30) than at the foot (20), which gives the shape a direction. A rectangle with four equal corners is still a box however round they are.

## Task report

| Task | Test target | RED | GREEN |
|---|---|---|---|
| The type and shape scale | `src/lib/domain/__tests__/design-scale.test.ts` | `npx jest design-scale`: `Cannot find module '../design-scale'` (commit `test: add reproducer for the warmer type and softer shape scale`) | 11/11 pass; full suite 101 suites / 1133 tests |

Two of those tests failed on the first implementation and were fixed in the implementation, not the test: `fontFor(450)` sat exactly between two cuts and took the lighter one (it now takes the heavier, because text a step bold still reads and a step light can vanish on a tint), and `hero` had a line height a tenth of a pixel under the 1.15 floor.

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Every role names a family the face actually ships, and a weight maps to its own file rather than leaning on `fontWeight` | `FONT` (3 tests) | unit | PASS |
| 2 | Sizes step down with no ties, and neighbouring roles differ by enough to carry different jobs | `TYPE_ROLES` (2 tests) | unit | PASS |
| 3 | Every role has a line height of at least 1.15x its size | `TYPE_ROLES` | unit | PASS |
| 4 | Body sits at the 16px reading floor, and no role tracks tighter than -0.04em | `TYPE_ROLES` (2 tests) | unit | PASS |
| 5 | The radius scale is strictly ordered and a card is never under 18 | `RADII` (2 tests) | unit | PASS |
| 6 | The crown is symmetric left to right and rounder at the head than the foot | `CROWN` | unit | PASS |

## Coverage and known gaps

- `design-scale.ts` is fully exercised by its suite. The components that consume it are presentational and were verified in the browser.
- **Analytics and customers were not seen rendered.** Both are owner-only and the available test login is staff, so the takings panel and the stat tiles were changed by the same tokens but reviewed in source only.
- Verified as staff on web: orders, prices, the till, and the public shop page. Typecheck, lint, and the Impeccable detector are clean on every changed file.
- The customer app screens inherit the face and the tokens automatically; they were not individually re-reviewed this pass.
- Figtree adds one dependency, `@expo-google-fonts/figtree`, and five font files to the bundle.

## Merge evidence

- RED: `test: add reproducer for the warmer type and softer shape scale`
- GREEN: the feature commit that follows this file.
