# Shopfront price list — the shops-card anatomy — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Targets:** `src/app/(customer)/shop/[id].tsx`, `src/lib/domain/price-label.ts`

## Request

> "polish, in the laundry merchant services, you know what make it like this
> [screenshot of the Shops list] with the prices below make it less bold"

The reference is this app's own connected-shops card: a tracked-caps section
label on the field, then one card per thing, each with a circular mark, a bold
name, and one quiet subtitle underneath, chevron at the right.

## What changed

The price list now uses that anatomy, with the **price where the address sits**.

| | before | after |
|---|---|---|
| container | one sheet, categories as bands inside | one card per service, gap between, tracked caps on the field |
| mark | 38pt squircle | 52pt circle, accent surface + accent ink |
| name | 15/500 | 17/700 |
| price | 17/700 ink, right-hand column | `type.body` regular, `colors.subtle`, under the name |
| minimum | separate amber note line | folded into the subtitle: `₱60/kg · 3 kg minimum` |
| divider | inset hairline | gone — the cards separate themselves |

The squircle argument from the last pass is reversed on purpose. It said circles
are avatars and a rounded square says "a thing you can buy". The reference is
explicit and the brief wins: the mark is a circle, matching the shops card the
customer already knows from the home screen and the directory.

The card also drops its 1px border and keeps only `elevation.rest`, which is
what the reference shows — a surface lifted off the field rather than a box
drawn around content.

## The domain move

`priceSubtitle(service)` composes the whole price into one line:

- `₱280/piece` — per-piece
- `₱60/kg · 3 kg minimum` — the shop rule folded in, no separate note line
- `₱75` — flat, no unit and no minimum, because a flat price is the whole price
- `₱60.50/kg` — centavos a shop really charges survive

It differs from `formatPriceLine` in dropping `.00`: a subtitle is read, not
added up. `formatPriceLine` is untouched and still supplies the spoken
`accessibilityLabel`, so a screen reader hears the full sentence with centavos.

## Tests

**RED first.** Five cases added to `price-label.test.ts` before the function
existed:

```
Tests: 5 failed, 21 passed, 26 total
```

**GREEN after:** `26 passed` — the per-piece phrase, the minimum folded in, the
flat price alone, centavos preserved, and a guard that no reading ever trails a
lone separator.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/price-label.test.ts` (pre-impl) | 5 failed, 21 passed (RED) |
| same, post-impl | 26/26 passed (GREEN) |
| `npx jest` | 51 suites, 496/496 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <changed files>` | clean |

Contrast: name `colors.text` on white ≥12:1; subtitle `colors.subtle` 5.5:1;
`accent.ink` on `accent.surface` ≥5:1. The chevron is decorative — every card
states its action through the spoken label.

## The tradeoff, stated plainly

This style is **taller**, and it moves against the scroll concern raised two
passes ago:

| version | per service |
|---|---|
| original (the one called too tall) | ~68pt |
| the dense sheet | ~58pt |
| **this card** | **~96pt** incl. gap |

A 20-service shop is roughly 1,900pt here against 1,150pt in the sheet. That is
the price of the reference's calm — big mark, generous padding, air between
cards — and the brief asked for it explicitly, so it ships.

If a real shop's list gets long enough that this hurts, the smallest fix that
keeps the look is to shrink the tile to 40pt and the padding to `space.cosy`,
which lands around 72pt without changing the anatomy.

## Preserved

Every price, name, unit, and minimum; grouping and canonical order; the connect
gate and the unconnected treatment; per-service icons from `serviceIcon`; all
queries and routes; and the spoken `accessibilityLabel` with its full sentence.
