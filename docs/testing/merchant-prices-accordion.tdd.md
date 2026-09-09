# Merchant Prices — collapsible categories

## The problem

The owner's Prices screen printed everything at once.

Every category was expanded, every service was its own floating card, and the
"Add something you offer" form sat permanently below all of it. A shop running
the starter price list — ten services across five categories — scrolled for a
screen and a half before reaching the form, and the form itself was the tallest
block on the screen despite being something an owner uses at setup and then
rarely again.

Inside that form, the Category control was six chips that wrapped to three rows.
The selected chip could end up alone on the last row, where it read as a
separate control rather than as the answer to the question above it. That was
the specific confusion reported.

## The change

One disclosure mechanic, used in three places, so an owner learns the chevron
once:

1. **Each price category is a section that opens and closes.** One open at a
   time; the first opens on arrival so the screen is never a wall of closed
   doors. A closed section still states what it holds — `4 prices · ₱35–₱180` —
   because an owner scans this screen to check the spread they charge, and a
   door that hides that has hidden the reason for opening the screen.
2. **The add-service form is folded away** behind a single row, and folds itself
   back after a successful save.
3. **The category chips became a picker.** Closed it is one line naming the
   choice; open it is a single column of six full-width options with a check on
   the selected one. A list has one reading direction; a wrapped chip grid has
   two.

Services also stopped being cards-inside-a-card. Each price is now a band inside
its category's sheet, ruled off by a hairline — the way a printed price board
separates lines within a section.

## RED → GREEN

New domain module `src/lib/domain/price-sections.ts`, tests written first and
run failing before implementation:

```
$ npx jest src/lib/domain/__tests__/price-sections.test.ts
Cannot find module '../price-sections'
Test Suites: 1 failed, 1 total
```

Then, after implementation:

```
$ npx jest src/lib/domain/__tests__/price-sections.test.ts
  categoryPriceSummary
    √ counts the prices in a closed section
    √ says "1 price" rather than "1 prices"
    √ prints a single figure when every price in the section is the same
    √ keeps the count when nothing in the section carries a usable price
    √ ignores unpriced entries when reading the range
    √ is empty for a section with nothing in it
  selectedCategoryLabel
    √ names the category currently chosen
    √ names every category the picker can offer

Tests: 8 passed, 8 total
```

### What the cases are defending

- **`2 prices · ₱75`, not `₱75–₱75`.** A shop charging the same for both
  self-service machines should not be shown a range whose ends meet; that reads
  as a control that has failed, not as a shop with one price.
- **`2 prices` with no figure when nothing is priced.** A section of ₱0 services
  is a mistake the owner has to go and find. The summary drops the range it
  cannot state but keeps the count, so the section does not go quiet about
  holding something wrong.
- **`1 price`, not `1 prices`.** The summary is read at a glance beside four
  others; a plural that does not agree is the kind of detail that makes an owner
  distrust the number next to it.
- **Every category has a label.** The closed picker is the only place the choice
  is shown. A category with no label would leave the control blank.

## Reuse rather than re-implementation

- `nextOpenCategory` (`price-accordion.ts`) — the open/close rule, already
  tested for the customer storefront accordion. Tapping the open section closes
  it; without that the only way to collapse one is to open another, and the
  header feels broken the first time somebody tries.
- `categoryIcon` (`shop-home.ts`), `CATEGORY_LABELS` / `CATEGORY_ORDER` /
  `groupServicesByCategory` (`service-catalog.ts`), `formatPriceLine`
  (`price-label.ts`), `formatMoneyCompact` (`money.ts`).

`categorySummaryLabel` in `price-accordion.ts` was deliberately *not* reused.
It quotes `from ₱60`, which is a storefront pitch aimed at a customer shopping
for the cheapest way in. An owner auditing their own board needs the count and
the spread, which is a different sentence about the same data.

## Accessibility

- Every header is a `Pressable` with `accessibilityRole="button"`,
  `accessibilityState={{ expanded }}`, and a hint that names what the tap does.
  A closed section announces its summary, so a screen reader hears
  `Wash & Fold. 4 prices, ₱35 to ₱180.` without opening it.
- Category options are `accessibilityRole="radio"` with
  `accessibilityState={{ checked }}` — the control is a single choice from six,
  and it now says so.
- Picker options carry `minHeight: 44`.

## Verification

```
$ npx tsc --noEmit      # clean
$ npx jest              # 60 suites, 602 tests passed
```

The Impeccable design hook scanned `src/app/(merchant)/services.tsx` and
reported no findings.

## Left alone, deliberately

The "How is it priced?" control is still three full-width `Button`s, which are
the heaviest thing left in the form and outweigh the `Add service` button they
sit above. Turning that into a segmented control is a real improvement and a
separate decision — it was not part of what was asked for here.
