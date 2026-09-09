# Shopfront — full-bleed top + clarify — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Targets:** `src/app/(customer)/shop/[id].tsx`, `src/app/(customer)/_layout.tsx`,
`src/lib/domain/price-label.ts`

## Request

> "clarify, still the merchant shop and fill the color at the top … and make it
> easily to understand and clear"

## Fill the colour at the top

The screenshot shows the gradient starting below a white band: the status bar
and a stack header reading "Shop". Two strips of nothing above a surface built
to own the screen.

The home screen already solves this — `orders.tsx` sets `headerShown: false`,
reads `useSafeAreaInsets()`, pads the hero by `insets.top`, and switches the
status bar to `<StatusBar style="light" />`. The shopfront now does exactly the
same thing, so the two branded screens open the same way.

Three consequences handled:

1. **The header carried the only back control.** The hero now floats its own —
   a 40pt circular `chevron-back` at `insetTop + space.snug`, labelled "Back to
   shops", falling back to `/(customer)/shops` when there is no history to pop.
   It is absolutely positioned, so it does not shift the centred composition.
2. **The status bar sits on saturated blue.** `style="light"` draws the clock
   and battery in white. White on the lightest gradient stop under an 18% white
   wash measures ~5:1, past the 3:1 a control needs.
3. **Losing the "Shop" title costs nothing** — the hero states the shop's name
   at 32px directly beneath where that title used to be.

`headerShown: false` is scoped to the `shop/[id]` screen only; every other
customer route keeps its header.

## Clarify: "flat" was trade vocabulary

The last pass moved the unit under the figure. For per-kg and per-piece services
that reads cleanly (`₱60.00` / `/kg`). For a flat-rate service it printed:

```
Self-service dry (per load)     ₱75.00
                                  flat
```

Stacked under a number, the bare word "flat" reads as a *missing* unit, not as
"this is the whole price". `unitSuffix` returns `" flat"` so `₱75.00 flat` works
as a sentence — but a sentence is not what this column is.

New `unitCaption(unit)` returns `/kg`, `/piece`, or **null** for flat. The row
renders nothing rather than a word the customer has to decode; a flat price says
what it needs to by being a number, and the service name already carries "(per
load)". A test pins `unitCaption` to `unitSuffix` for the two units that keep a
caption, so the one-line and two-line forms can never disagree.

## Tests

**RED first.** Three cases added to `price-label.test.ts` before `unitCaption`
existed:

```
Tests: 3 failed, 18 passed, 21 total
```

**GREEN after:** `21 passed` — names what the figure is charged per, says
nothing for a flat price, and agrees with `unitSuffix` where both apply.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/price-label.test.ts` (pre-impl) | 3 failed, 18 passed (RED) |
| same, post-impl | 21/21 passed (GREEN) |
| `npx jest` | 47 suites, 430/430 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <all three changed files>` | clean |

## Preserved

Every price, name, unit, and minimum; the grouping and its order; the connect
gate and its error copy; all queries and routes; the spoken
`accessibilityLabel`, which still reads the full `formatPriceLine` sentence
including the flat-rate wording that the visual column now omits.

## Note

The grey circle beside "Shop" in the screenshot was the Expo dev-client button,
which does not ship in a production build. Hiding the header removes it from the
development view as a side effect; it was never app UI.
