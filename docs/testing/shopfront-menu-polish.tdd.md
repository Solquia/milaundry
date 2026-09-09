# Shopfront price list — the menu restyle — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Targets:** `src/app/(customer)/shop/[id].tsx`, `src/lib/domain/money.ts`

## Request

> "Polish … I think the price is to bold and the text is to clanky and imagining
> if theres a lot of services there would be a lot to scroll too i dont really
> see another style can you free style and give a shine on what might be a good
> style for a merchant store"

Three complaints, all correct, and one open question about style. Taken as a
restyle of the price list only; the hero, reviews, tracker, and every route are
unchanged.

## The diagnosis

The list had been built as a *settings list* — rows of label, value, chevron,
grouped into cards. That is the wrong ancestor. This content is a **menu**: a
column of things with prices, read by scanning top to bottom. Everything that
felt clanky came from the mismatch.

| Symptom | Cause |
|---|---|
| price too bold | `type.value` (20/700) is the size for a **total** you land on, not for a column of forty figures |
| price too heavy | `₱280.00` — the `.00` is four characters of nothing, repeated on every row |
| clanky text | the unit stacked *under* the figure, so every row had a two-line right column |
| clanky text | the chevron ate ~26pt of width, pushing names onto a second line |
| too much scroll | one floating card per category, each with a heading above and a gap below |

## The restyle

**One sheet, not a card per category.** Categories are now recessed bands
*inside* a single panel, the way a printed price board rules off a section
without cutting itself into pieces. Removes the per-category card margins,
outer gaps, and duplicated borders.

**One line per row.** Figure and unit share a baseline (`₱60 /kg`) instead of
stacking. The minimum became an inline amber note instead of a chip — a chip on
the one row in five that has a minimum made *every* row tall enough to hold one.

**No chevron.** The strongest convention for this exact content — a merchant's
menu — has no chevron, and the row is the tap target. Removing it returns ~26pt
of width to the name, which is what stops "Comforter (queen / king, thick)"
wrapping in the first place.

**Price at 17/700, not 20/700**, still ink, still `tabular-nums` so the column
cannot wobble. Loud enough to find, quiet enough that forty of them do not
shout at once.

**`formatMoneyCompact`** drops a trailing `.00` and nothing else. `₱280`, but
`₱60.50` stays `₱60.50` — a price list that disagrees with the checkout is a
broken promise. Totals, receipts, and anything a customer actually pays keep
`formatMoney`, where the centavos column is what lets figures be added by eye.
The hero's "From ₱60" uses the compact form too.

### Measured effect on scroll

Rough per-row heights, the shop in the screenshot (5 services, 2 categories):

| | before | after |
|---|---|---|
| typical row | ~68pt (often 78 when the name wrapped) | ~44pt |
| category | ~54pt incl. gaps and card margin | ~39pt band |
| **this shop** | **~448pt** | **~298pt** |
| a 20-service shop | ~1,470pt | ~950pt |

About a third off, and the saving compounds with the service count — which was
the worry.

## Tests

**RED first.** Six cases added to `money.test.ts` before `formatMoneyCompact`
existed:

```
Tests: 6 failed, 5 passed, 11 total
```

**GREEN after:** `11 passed` — drops `.00`, keeps real centavos, still groups
thousands, handles zero/negative/NaN like `formatMoney`, and a guard test that
the compact form never rounds away from `formatMoney`.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/money.test.ts` (pre-impl) | 6 failed, 5 passed (RED) |
| same, post-impl | 11/11 passed (GREEN) |
| `npx jest` | 47 suites, 436/436 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <changed files>` | clean |

Contrast unchanged and still passing: price ink on card ≥12:1, unit and band
labels `colors.subtle` 5.5:1, minimum note `TAG_TONES.owed.ink` `#8A4F05` on
white 6.4:1 (better than on the amber chip it replaced).

## Preserved

Every price, name, unit, and minimum; the grouping and its canonical order; the
connect gate; all queries and routes; and the spoken `accessibilityLabel`, which
still reads the full `formatPriceLine` sentence with centavos and the flat-rate
wording the visual row now omits.

## Not done — the next lever if shops get long

A sticky or jump-to category rail (tap "SELF-SERVICE" to scroll straight to it)
is the real answer for a 40-service shop. It needs a `ScrollView` ref and
per-section `onLayout` offsets, which means opening up the shared `Screen`
component — a bigger change than this pass, and worth doing only once a real
shop's price list is long enough to need it.
