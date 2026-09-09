# Shopfront price list — the category accordion — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Targets:** `src/app/(customer)/shop/[id].tsx`, `src/lib/domain/price-accordion.ts`

## Request

> "layout, what if we do A CATEGORY AND JUST A TOGLE TO OPEN IT AND WHEN YOU
> CLICK ANOTHER CATEGORY THEN THE OTHER CHOICES CLOSE HOW ABOUT THAT WOULD THAT
> MAKE IT MORE CLEANER IN ITS LOOKS"

Yes — and it is the fix for the scroll problem the previous pass had to ship
knowing it made worse (~96pt per service, ~1,900pt for a 20-service shop). A
shop is now a short list of doors regardless of how long its price list is.

## The risk this carries, and the answer

Three passes ago the argument for putting prices on the storefront was that the
original icon grid **hid the price behind a tap**, so a customer could not
choose without connecting first. An accordion hides prices behind a tap again.
Shipping it naively would walk that back.

So the closed state still sells. Every collapsed header carries
`categorySummaryLabel`:

```
Bedding & Heavy Items                                  ⌄
3 services · from ₱180
Self-Service                                           ⌄
2 services · from ₱75
```

A door that says "3 services · from ₱180" has **summarised** the price, not
hidden it. The customer can still compare shops, still see the shape of the
price list, and now sees the whole range without scrolling at all.

The label drops the price rather than printing "from ₱0" when nothing in the
category is usefully priced — a free category and a category with no usable
price are different things, and neither is a sales pitch.

## Interaction decisions

**Tapping the open header closes it.** Without that, the only way to collapse a
section is to open a different one, and the header feels broken the first time
somebody tries it. `nextOpenCategory(current, tapped)` returns `null` on a
self-tap.

**The first category starts open.** A shop that opens as a wall of closed doors
teaches a first-time customer nothing about what a price here looks like. State
is `string | null | undefined`: `undefined` means "nothing chosen yet, use the
first", `null` means "deliberately closed". Collapsing those two into one value
is a real bug — tapping the first header would re-open it instead of closing it,
because the fallback would immediately fire again.

**Rows live inside the category card**, not as cards within a card. The row
anatomy approved last pass survives — circle mark, name, price as a quiet
subtitle underneath — at a 44pt mark instead of 52, with a hairline separating
the header from what it revealed.

**No expand animation.** `LayoutAnimation` needs an Android opt-in this project
has not made, and reaching for Reanimated layout transitions to animate a list
that is already correct is the kind of risk that breaks a working screen. The
chevron flips direction; the content appears. If motion is wanted here it should
be its own pass with a device check.

## Scroll, finally

| version | a 20-service shop |
|---|---|
| original grid | n/a — no prices at all |
| the sheet | ~1,150pt |
| service cards (last pass) | ~1,900pt |
| **accordion, all closed** | **~6 rows ≈ 480pt** |
| accordion, one open | ~480pt + that category's rows |

## Tests

**RED first.** Eight cases written before the module existed:

```
Test Suites: 1 failed — Cannot find module '../price-accordion'
```

**GREEN after:** `8 passed` — opening from nothing, switching categories,
self-tap closing, the summary's count and cheapest price, singular "1 service",
the unpriced case, the empty case, and that the summary quotes the cheapest
rather than the first.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/price-accordion.test.ts` (pre-impl) | suite failed, module not found (RED) |
| same, post-impl | 8/8 passed (GREEN) |
| `npx jest` | 52 suites, 504/504 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <changed files>` | clean |

A parse error was introduced mid-edit (a doubled comment terminator left by a
comment edit) and caught by `tsc` before anything else ran; it is fixed and the
run above is the clean one.

Accessibility: each header is a button carrying `accessibilityState={{ expanded }}`
and a label that states the category, its summary, and what the tap will do
("Tap to see prices" / "Tap to collapse"). Contrast unchanged — `colors.subtle`
5.5:1 for the summary, `accent.ink` on white ≥5:1 for the category glyph.

## Preserved

Every price, name, unit, and minimum; canonical category order; the connect gate
and the unconnected treatment; per-service icons; all queries and routes; and
the spoken `accessibilityLabel` on each service with its full `formatPriceLine`
sentence.
