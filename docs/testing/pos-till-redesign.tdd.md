# TDD evidence — the New Order tab becomes a till

**Request (2026-09-05):** "redesign the new order to be like a very intuitive
POS … make sure the flow is easier to understand and have better UI/UX".

## What was wrong

`(merchant)/pos.tsx` rendered `ServiceOrderForm` in `walk_in` mode: a customer
card first (name required before anything was counted), then category
accordions, then a service row that grew a `− 0.5 kg +` stepper once tapped,
then a duplicate basket card, then payment buttons, then a paid toggle, then
Save. The running total lived below the fold and a 7 kg load took a dozen taps.

## The redesign

Two steps, the way a phone POS rings a sale.

| Step | What is on screen |
|---|---|
| Ring | Category chip strip · 2-up grid of priced service tiles · pinned footer with `n items · Clear` and one button, `Charge ₱X` |
| Checkout | `‹ Add more items` · the ticket on receipt paper, every line editable · Customer · pickup/delivery segment · payment-method tiles · paid-now/pay-later segment · pinned `Save order` |

Tap rules (pure, in `domain/pos-ticket.ts`): a per-piece tile adds one more on
each tap; a flat tile adds once; a per-kg tile opens the scale sheet, which
reuses the customer booking screen's drag-ruler `WeightScale` plus quick chips
(shop minimum first, then 3/5/8/12 kg) and quotes the exact charge on its
button before the ticket moves.

New files: `components/service-menu.tsx`, `components/scale-sheet.tsx`,
`components/ticket-slip.tsx`, `components/checkout-form.tsx`,
`domain/pos-ticket.ts` (+ test). `merchant-error.ts` gained a `save-order`
fallback. `service-order-form.tsx` is untouched and still serves the customer
`new-order` route; its `walk_in` branch is now unused.

## Task report

**RED.** `pos-ticket.test.ts` was written before `pos-ticket.ts` existed (22
cases). The first run failed for a tooling reason rather than the intended one:

```
● Validation Error: Preset jest-expo not found.
```

`node_modules` was half-installed after the Expo 57.0.19 bump (the lockfile had
been deleted). `npm install` restored it. Honest note: by the time jest could
run, the module was already written, so the missing-module failure was never
observed on this machine.

**GREEN.**

```
$ npx jest src/lib/domain/__tests__/pos-ticket.test.ts
Tests:       22 passed, 22 total
```

**Whole suite, type-check, lint** after the screen and components landed:

```
$ npx tsc --noEmit -p tsconfig.json      (no output)
$ npx eslint <changed files>             (no output after one fix)
$ npx jest
Test Suites: 73 passed, 73 total
Tests:       789 passed, 789 total
```

The one lint finding was `react-hooks/set-state-in-effect` in the scale sheet,
which seeded its weight from props inside an effect. Fixed by mounting the open
sheet keyed on the service id so the `useState` initializer reads the starting
weight once.

## Follow-up (2026-09-06) — the ruler rocked back and forth

Reported on device: opening the scale for a service, or tapping a weight chip,
made the ruler judder between two positions. Cause, in `WeightScale`
(`quantity-picker.tsx`): the effect that scrolls the ruler to an externally set
value listened to *every* value change, and `onScroll` reported every frame of
that very animation as a new value, so each frame re-issued a scroll. A flick
had the same problem after `onScrollEndDrag` cleared the dragging flag while
momentum was still running.

Fix: the ruler now remembers the weight it is physically showing and skips the
scroll when a change originated from itself; a programmatic scroll records its
target and ignores its own in-flight frames until it arrives; momentum keeps
the "finger is driving" flag until `onMomentumScrollEnd`; and the first
placement is an instant jump rather than a sweep from zero. `tsc`, `eslint` and
the suite (792 tests) stay green. Shared with the customer booking screen and
the weigh sheet, which use the same component.

## Not verified here

No emulator or device was available in this session, so the screens were not
run. The impeccable detector reported no findings on the changed files; the
finish review ran from source only.
