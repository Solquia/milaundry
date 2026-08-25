# Tappable order cards + Paid upfront button — TDD evidence

**Date:** 2026-08-25
**Branch:** main
**Source plan:** none — journeys derived during this TDD run from the user
request and two screenshots (merchant Orders list, POS payment card).

## Request

> "make them clickable and an easy way to move the status of their laundry and
> how much i cost and there should be a seperate button above the save walk in
> order that says paid upfront"

## Root cause found while scoping

The Orders cards were wrapped in `<Link asChild><View>…</View></Link>`. On React
Native a plain `View` has no press handling, so the cloned `onPress` had nothing
to attach to — **the cards were never tappable**, which matches the report. Fixed
by routing from a real `Pressable`.

Cost was already rendered (₱600.00 in the screenshot); it is kept and bumped to
`fontSize: 16` to match the customer name rather than being re-added.

## User journeys

1. As a shop owner, I want to tap an order card and land on its detail screen,
   so I can see everything about that load.
2. As a shop owner, I want to move a load to its next laundry stage straight from
   the list, so I do not open → tap → go back for every order.
3. As a shop owner, I want each card to show what the order costs, so I can read
   the money state without opening it.
4. As a shop owner, I want a separate "Paid upfront" button directly above Save
   walk-in order, so recording an upfront payment is one deliberate tap.

## Task report

### Task 1 — one-tap stage advance (`nextForwardStatus`)

Added `nextForwardStatus` to `src/lib/domain/order-status.ts`: the single next
laundry stage, excluding cancellation, or `null` at a terminal status. This is
what decides whether a card shows an advance button and which stage it names.

- **RED command:** `npx jest order-status payment-summary`
- **RED output:**

  ```
  ● nextForwardStatus › returns the next laundry stage, never cancellation
    TypeError: (0 , _orderStatus.nextForwardStatus) is not a function
  Tests: 5 failed, 15 passed, 20 total
  ```

  Failure cause is the intended missing export, not unrelated breakage.
- **GREEN output:** `Tests: 20 passed, 20 total`

### Task 2 — "Paid upfront" label (`paidUpfrontLabel`)

`paymentToggleLabel` was **replaced** by `paidUpfrontLabel` in
`src/lib/domain/payment-summary.ts`. The old in-card toggle read "Pay later
(collect on pickup)"; the requested control is a separate button above Save. Two
controls for one boolean would be ambiguous, so the toggle moved rather than
being duplicated. Same RED/GREEN commands and output as Task 1 (both suites run
together).

### Task 3 — wire the UI

- `src/app/(merchant)/orders.tsx`: `Link`+`View` → `Pressable` with
  `router.push`, an `accessibilityLabel` naming the customer and total, a
  `Move to <stage>` outline button per card driven by `nextForwardStatus`, and a
  `useMutation` that invalidates `['shop-orders']` on success. The button shows
  `Updating…` for the row in flight and disables while any advance is pending;
  mutation errors render in an `ErrorText` below the list.
- `src/components/service-order-form.tsx`: the paid toggle left the Payment card
  and became a dedicated `Paid upfront` / `Paid upfront ✓` button rendered
  immediately above the Save button, walk-in mode only. The payment summary line
  stays in the card.

- **Commands:** `npx tsc --noEmit`, `npx jest`, `npx expo lint`
- **Output:** tsc silent; `Test Suites: 25 passed, 25 total`,
  `Tests: 196 passed, 196 total`; lint reported no findings.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | Each stage advances to the correct next stage (pending→received→washing→drying→folded→ready→completed) | `order-status.test.ts:returns the next laundry stage, never cancellation` | unit | PASS | `npx jest order-status` |
| 2 | The advance action never offers cancellation as the "next" stage | same as #1 | unit | PASS | same |
| 3 | Completed and cancelled orders return null, so no advance button is rendered | `order-status.test.ts:returns null for terminal statuses so no advance button is offered` | unit | PASS | same |
| 4 | Every status the advance button can produce is a transition the state machine permits | `order-status.test.ts:only ever returns a status the state machine actually allows` | unit | PASS | same |
| 5 | The button reads `Paid upfront` when nothing is paid yet | `payment-summary.test.ts:offers to record an upfront payment when nothing is paid yet` | unit | PASS | `npx jest payment-summary` |
| 6 | The button reads `Paid upfront ✓` once toggled on | `payment-summary.test.ts:confirms the order is already settled once toggled on` | unit | PASS | same |

Guarantees 1–9 from `pos-payment-summary.tdd.md` (payment labels and the summary
line) still hold; only `paymentToggleLabel` was retired.

## Coverage and known gaps

`npx jest --coverage`:

```
File                       | % Stmts | % Branch | % Funcs | % Lines
All files                  |   63.59 |    62.92 |   51.35 |   65.13
  order-status.ts          |     100 |      100 |     100 |     100
  payment-summary.ts       |     100 |      100 |     100 |     100
```

Known gaps, stated plainly:

- **Repo-wide coverage is 63.59%, below the 80% target** — unchanged from the
  previous run and pre-existing. Components and `src/lib/api.ts` are inside
  `collectCoverageFrom` but the project has no `@testing-library/react-native`,
  so nothing renders under test.
- **The tap fix itself is not covered by an automated test.** That a `Pressable`
  responds where a `View` did not is exactly the class of bug a component test
  would catch, and this repo cannot yet write one. Verified by code reading only.
- **Not run on a device.** The advance button, the pressed-state opacity, and the
  fact that tapping the inner button does not also navigate (React Native gives
  the touch to the innermost responder) are unverified in a running app.
- The advance mutation disables *all* cards' buttons while any one is in flight —
  simple and safe, but it is a deliberate coarse choice, not a tested behavior.

## Merge evidence

RED `b2af904` (5 failing: `nextForwardStatus` / `paidUpfrontLabel` not a
function) → GREEN `4c182f5` (20/20 changed suites, 196/196 total, tsc and lint
clean). No separate refactor commit; the `paymentToggleLabel` retirement was part
of the GREEN change and is covered by the same full-suite run.
