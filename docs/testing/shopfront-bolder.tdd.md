# Customer shopfront — bolder pass — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Target:** `src/app/(customer)/shop/[id].tsx`

## Request

> "bolder, [screenshot] make the merchant store the best and most eligant look
> ever and entising to buy from"

Scoped to the customer-facing shop page — the screen a customer lands on when
deciding whether to hand this laundry their clothes. Everything outside it
(booking form, orders, merchant dashboard, tab bar, `ui-kit` tokens) is
unchanged. No new colour, font, spacing step, or system primitive was added.

The grey gear circle in the screenshot is the Expo dev-client button, not app
UI; it does not ship and was not touched.

## Why it read flat

The screen opted out of moves the app already owns, one section at a time:

| The system already does this | This screen did instead |
|---|---|
| `HERO_GRADIENT` + `elevation.hero` painted via `react-native-svg` (`orders.tsx:263`) | a flat `colors.primary` rectangle with no depth |
| `type.hero` / `type.title` for display type | hardcoded `fontSize: 26` and a local 17px `sectionTitle` |
| `groupServicesByCategory` + `CATEGORY_LABELS` (`service-catalog.ts`) | one undifferentiated 4-up grid |
| `formatPriceLine` (`price-label.ts`), used by the booking form | **no price anywhere on the storefront** |

The last row is the commercial defect. A customer could not learn what a wash
cost without first connecting to the shop and opening the booking form. The grid
also clipped names mid-word ("Comforter (queen / kin…") and drew the same
`bed-outline` glyph three times, because all three services share one category.

## User journeys

1. As a customer comparing two laundries, I want to see what this one charges
   **before** I commit to it, so the page can actually persuade me.
2. As a customer, I want to know whether other people were happy here, as one
   number, without averaging five star rows by eye.
3. As a customer at a shop with no reviews yet, I do not want to be shown
   "0.0 ★" — a new shop and a bad shop are opposite things.
4. As a customer with a load already in the wash here, I want that tracker to
   stay exactly where it was and keep working.
5. As a customer who has not connected yet, I want one obvious way in, not a
   dimmed grid that answers taps with an error.

## Task report

### Task 1 — the two facts a storefront is missing (`storefront.ts`)

New pure module `src/lib/domain/storefront.ts`:

- `shopReputation(reviews)` → `{ average, count, label }` or `null`
- `startingPrice(services)` → cheapest positive price or `null`

Both return `null` rather than a zero, because "no reviews" and "rated 0.0" are
opposite claims, as are "no price list" and "charges nothing". Ratings arrive
from the database, not from the review form, so anything outside 1–5 (or
non-finite) is dropped rather than averaged into a claim the shop never earned.
The average is rounded to one decimal *before* it is returned, so the figure in
`label` and the figure a caller renders can never disagree.

**RED first.** `src/lib/domain/__tests__/storefront.test.ts` was written and run
before the module existed:

```
Cannot find module '../storefront' from 'src/lib/domain/__tests__/storefront.test.ts'
Test Suites: 1 failed, 1 total
```

**GREEN after.** 11 tests, covering: empty review list, plain average, rounding
(4.666… → 4.7), out-of-range and NaN ratings dropped, all-unusable → `null`,
singular vs plural review wording, forced decimal ("5.0" not "5"), cheapest
price, zero/negative prices ignored, empty price list.

```
Tests: 11 passed, 11 total
```

### Task 2 — the hero becomes the app's own hero (`ShopfrontHero`)

The flat rectangle is replaced with the same measured-SVG gradient field the
home screen uses — `HERO_GRADIENT` painted lower-left to upper-right, bleeding
past the page gutter on three sides, `elevation.hero`, `HERO_GRADIENT[1]` as the
solid floor so a rounded corner never antialiases to white.

It now carries what a customer weighs: the mark (neutral until you connect, the
shop's `ACCENTS` tone the moment you do), the name at the app's full display
weight, the address, and a facts line — `4.5 · 12 reviews · From ₱55 ·
5 services` — assembled only from facts that exist.

The facts line is solid white text with a hairline separator, not translucent
pills: 14%-white chips on this field land near 3:1 and cannot legally carry
13px text. Secondary text is tinted white at 0.88 opacity rather than grey.

### Task 3 — the connect action moves onto the colour

The "Connect to book" card three sections down is gone. The action is now the
single bright object on the hero — a white pill with `elevation.lift` and
`colors.actionInk` label, the same `heroCta` idiom as the home screen. It
carries its own pending label ("Connecting…"), disables while pending, and keeps
`accessibilityState`. Join errors render immediately below the hero.

Net effect: one card removed, one decision made unmissable.

### Task 4 — the grid becomes a price list

`groupServicesByCategory` splits the list into non-empty category panels in
canonical order. The category glyph moves to the group header, so the repeated
bed icon problem disappears by construction; each row is then free to be a row:
full service name (no truncation), `formatPriceLine` subtitle carrying the unit
and any minimum, the figure at `type.value` on the right, chevron.

**Prices stay at full strength whether or not you are connected.** The old
`gridLocked` 45% dim is deleted — dimming the prices hid the only thing that
could persuade anyone to connect. The gate is still enforced: `handleBook`
short-circuits with "Connect to this shop first to book a service." and
`accessibilityState={{ disabled }}` is preserved on every row. Only the group
icon desaturates, as the "not yours yet" signal.

### Task 5 — reviews get a verdict

A single panel above the feed: the average at 40px, the star row, and the sample
size ("from 12 completed orders"). Absent entirely when `shopReputation` returns
`null`; the existing empty-state copy is unchanged.

## Preserved

- `WelcomeCard` and its reduce-motion handling — untouched.
- The "Your laundry here" tracker, `TrackDial`, and `leadingIndex` ordering.
- Every query, query key, and the `joinShop` mutation.
- All routes: `/(customer)/book/[serviceId]?shopId=`, `/(customer)/order/[id]`.
- Every accessibility label and role, plus the new hero `header` role.
- Empty-state and error copy, verbatim.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/storefront.test.ts` (pre-impl) | 1 suite failed — module not found (RED) |
| `npx jest src/lib/domain/__tests__/storefront.test.ts` | 11/11 passed (GREEN) |
| `npx jest` | 47 suites, 415/415 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <both changed files>` | clean |
| impeccable design detector (PostToolUse hook) | no findings |

## Contrast

| Pair | Ratio |
|---|---|
| white on `HERO_GRADIENT` (all three stops) | ≥4.5:1 — capped by design in `ui-kit.tsx:157` |
| `colors.actionInk` on `colors.card` (hero CTA) | 6.2:1 |
| `colors.text` on `colors.card` (price figure, name) | ≥12:1 |
| `colors.subtle` on `colors.card` (price detail, group label) | 5.5:1 |
| `accent.ink` on `colors.card` (connected price figure) | ≥5:1 — every `ACCENTS` ink is checked against its own surface |

## Not done

- Shop `phone` is loaded but still unused; surfacing it needs a `Linking` call
  action, which is a new affordance rather than a bolder pass.
- No `PRODUCT.md` / `DESIGN.md` exists. `context.mjs` reported `NO_PRODUCT_MD`
  and allowed this scoped refinement to proceed on the incumbent implementation
  as design authority. `/impeccable init` remains available as a follow-up.
