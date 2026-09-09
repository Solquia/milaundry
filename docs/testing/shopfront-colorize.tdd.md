# Shopfront — colorize pass — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Target:** `src/app/(customer)/shop/[id].tsx` (+ `src/lib/domain/price-label.ts`)
**Source:** a screenshot of the shopfront as shipped by the preceding `bolder`
pass, reviewed against it.

## Request

> "colorize … only focus on the merchant store front … best professional, and
> actuall app store worthy of looks design and coolness while also being easy to
> read and easy to understant and not confusing"

Scoped to the storefront. The status bar, stack header, and tab bar visible in
the screenshot are outside it and untouched.

## What the screenshot showed

Three defects, two of them introduced by the previous pass.

### 1. Every price was blue — colour had stopped meaning anything

`priceFigure` took `accent.ink` whenever the customer was connected. Sparkle
clean's accent resolves to `#1263AF`, so **five blue figures** ran down the page
in the same blue family as the hero — while `ui-kit.tsx` states the rule the
whole system runs on: blue means *you can act here*. Spending it on every price
left nothing louder than anything else, exactly the failure the token file was
written to prevent.

Money is content, not an action. The figures are now `colors.text` ink, and the
accent goes back to naming the shop — hero mark and category glyphs only, where
it is the only thing wearing it.

### 2. The same number twice on one row

Each row printed `formatPriceLine` under the name:

```
Comforter (queen / king, thick)      ₱280.00
₱280.00/piece
```

The subtitle repeated the figure and added nothing. The only fact the figure
cannot carry is the shop's minimum. So the unit moved under the figure it
modifies, and the minimum became its own mark:

```
Comforter (queen / king, thick)      ₱280.00
                                      /piece

Curtains                              ₱60.00
[ 3 kg minimum ]                         /kg
```

New `minimumLabel(service)` in `price-label.ts` returns `3 kg minimum` or
`null`, sharing the existing private `effectiveMinimum` so it cannot disagree
with `minimumChargeNotice` — a test asserts the notice contains the label.

### 3. The category chip was invisible

`groupIcon` used `accent.surface` (`#E8F1FC`) as its background on the page
field (`colors.bg`, `#EDF2F8`). Those are the same colour to the eye, so the
30×30 container never rendered and the glyph read as floating loose above the
heading. The chip is deleted; the icon now sits inline in `accent.ink` beside
the tracked caps, which is what it looked like anyway — only now on purpose.

## The colour strategy

One saturated region, ink content, one semantic accent. In Operate mode rarity
is what gives an accent its force.

| Role | Colour | Where |
|---|---|---|
| **the shop** | `HERO_GRADIENT` + the shop's `ACCENTS` tone | the hero field, the mark, the category glyphs |
| **money** | `colors.text` ink, tabular figures | every price in the list |
| **costs you more than the figure** | `TAG_TONES.owed` amber | the minimum chip |
| **you can act here** | `colors.action` | the Connect pill, on unconnected shops only |
| **structure** | `colors.subtle` / `colors.border` | units, category labels, dividers |

The amber is not decoration: it is the tone this app already spends on money
owed (`TAG_TONES.owed`, `colors.moneyOut`), and a minimum is the one line on the
screen that can make a customer pay more than the number beside it.

Prices also gained `fontVariant: ['tabular-nums']` and a fixed-width right
column, so the figures share a right edge down the whole list. A price column
that wobbles cannot be compared at a glance, which is the entire job of a price
list.

No new colour, token, or primitive was introduced.

## Tests

**RED first.** Four cases added to `src/lib/domain/__tests__/price-label.test.ts`
before `minimumLabel` existed:

```
Tests: 4 failed, 14 passed, 18 total
```

**GREEN after:** `Tests: 18 passed, 18 total` — states the rule without the
price beside it, `null` when there is no minimum, `null` for flat services
(which ignore minimums when billed), and agreement with `minimumChargeNotice`.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/price-label.test.ts` (pre-impl) | 4 failed, 14 passed (RED) |
| same, post-impl | 18/18 passed (GREEN) |
| `npx jest` | 47 suites, 427/427 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <changed files>` | clean |

Contrast: price figures `colors.text` on `colors.card` ≥12:1; units and category
labels `colors.subtle` 5.5:1; the minimum chip is `TAG_TONES.owed` ink `#8A4F05`
on `#FDF0D2`, 5.7:1. The minimum is never colour-only — it carries the words
"3 kg minimum", and the booking screen repeats the rule as a sentence.

## Preserved

Every price, name, and unit; the grouping and its order; all routes, queries,
and the connect gate; the spoken `accessibilityLabel`, which still reads the
whole `formatPriceLine` sentence rather than the two-column split that makes the
row scannable by eye.
