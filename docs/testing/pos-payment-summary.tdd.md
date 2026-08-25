# POS payment summary above Save — TDD evidence

**Date:** 2026-08-25
**Branch:** main
**Source plan:** none — journeys derived during this TDD run from the user request
and a screenshot of the POS screen.

## Request

> "add a button if they paid already, so the owner can see and more organized"

The screenshot showed the POS scrolled to the bottom: `Estimated total: ₱175.00`
and `Save walk-in order`, with no payment control in sight.

## Scope decision

A paid/unpaid toggle already existed, but in the **Customer** card at the top of
the POS form — off-screen at the moment the owner taps Save. `order/[id].tsx`
already had "Mark as paid" for after the fact. The user confirmed the wanted
change is **placement**: the payment choice moves down next to the total, so it
is confirmed where the order is closed. Two other candidate placements (inline
"Mark paid" on the Orders list, and "Mark as paid" on the saved-order screen)
were offered and **not** selected — they remain unimplemented.

## User journeys

1. As a shop owner, when I finish adding a customer's services, I want to see
   the payment method and paid/unpaid choice directly above Save, so I do not
   scroll back up to record that the customer already paid.
2. As a shop owner, I want a one-line recap of what was paid or what is still to
   be collected, so I can read the order's money state at a glance.
3. As a shop owner taking a delivery order, I want the recap to say the money is
   collected *on delivery*, not *on pickup*.

## Task report

### Task 1 — payment copy as testable domain logic

Extracted the POS payment wording into `src/lib/domain/payment-summary.ts`
(`PAYMENT_LABELS`, `paymentToggleLabel`, `paymentSummaryLine`) so the copy the
owner reads is verified by tests rather than buried in JSX. Peso formatting moved
to `src/lib/domain/money.ts`; `ui-kit` re-exports it as `formatMoney` so its 20
importers are unchanged.

- **RED command:** `npx jest src/lib/domain/__tests__/payment-summary.test.ts`
- **RED output:**

  ```
  Cannot find module '../payment-summary' from 'src/lib/domain/__tests__/payment-summary.test.ts'
  Test Suites: 1 failed, 1 total
  ```

  Failure cause is the intended missing implementation, not unrelated setup.
- **RED checkpoint:** `13db2d7 test: add reproducer for POS payment summary above Save (RED validated: module missing)`
- **GREEN command:** `npx jest src/lib/domain/__tests__/payment-summary.test.ts`
- **GREEN output:** `Tests: 9 passed, 9 total`

### Task 2 — move the payment controls above Save

`service-order-form.tsx`: the payment method row and the paid toggle were removed
from the Customer card and re-rendered in their own card between the estimate
card and the Save button, now labelled via `paymentToggleLabel` and followed by
`paymentSummaryLine`. The local `PAYMENT_LABELS` duplicate was deleted in favour
of the domain one. The `fieldErrors.paymentMethod` error moved with the control.
Component props and the submitted payload (`paymentMethod`, `isPaid`) are
unchanged; `mode="customer"` renders no payment UI, as before.

- **Commands:** `npx tsc --noEmit`, `npx jest`, `npx expo lint`
- **Output:** tsc silent (no errors); `Test Suites: 25 passed, 25 total`,
  `Tests: 193 passed, 193 total`; lint reported no findings.
- **GREEN checkpoint:** `d9a5000 feat: move POS payment choice above Save with summary line (GREEN validated: 193/193 tests)`

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | Every supported payment method has a human-readable label | `payment-summary.test.ts:has a human label for every supported payment method` | unit | PASS | `npx jest payment-summary.test.ts` |
| 2 | GCash keeps its brand casing | `payment-summary.test.ts:spells GCash the way the brand does` | unit | PASS | same |
| 3 | The toggle reads `Paid now ✓` once payment is recorded, for pickup and delivery alike | `payment-summary.test.ts:confirms payment was already collected` | unit | PASS | same |
| 4 | An unpaid order's toggle names where the money will be collected (pickup vs delivery) | `payment-summary.test.ts:says where the money will be collected when unpaid` | unit | PASS | same |
| 5 | A paid order recaps as `Paid ₱175.00 · Cash` | `payment-summary.test.ts:states the amount already paid and how` | unit | PASS | same |
| 6 | An unpaid pickup recaps as `Collect ₱175.00 on pickup · GCash` | `payment-summary.test.ts:states what is still to be collected on pickup` | unit | PASS | same |
| 7 | An unpaid delivery says `on delivery`, not `on pickup` | `payment-summary.test.ts:states what is still to be collected on delivery` | unit | PASS | same |
| 8 | Amounts always carry two decimal places | `payment-summary.test.ts:always shows two decimal places` | unit | PASS | same |
| 9 | A zero total formats as `₱0.00` instead of crashing | `payment-summary.test.ts:handles a zero total without crashing` | unit | PASS | same |

## Coverage and known gaps

`npx jest --coverage`:

```
File                       | % Stmts | % Branch | % Funcs | % Lines
All files                  |   63.59 |    62.67 |   50.45 |   65.13
  money.ts                 |     100 |      100 |     100 |     100
  payment-summary.ts       |     100 |      100 |     100 |     100
  walk-in-order.ts         |     100 |      100 |     100 |     100
```

Known gaps, stated plainly:

- **Repo-wide coverage is 63.59%, below the 80% target.** The new modules are at
  100%; the shortfall is pre-existing and comes from React components and
  `src/lib/api.ts` being inside `collectCoverageFrom` while the project has no
  component-test tooling installed (`@testing-library/react-native` is absent).
  This run did not change that number materially and did not attempt to.
- **The placement itself is not covered by an automated test.** That the payment
  card renders *between* the estimate card and the Save button is verified only
  by reading the JSX — a component test would need RTL to be added first.
- **Not run:** the app was not launched on a device or simulator, so the visual
  result has not been confirmed against the screenshot.
- Journeys for the two unselected placements (Orders-list inline "Mark paid",
  saved-order-screen "Mark as paid") are out of scope and untested.

## Merge evidence

If these commits are squashed, preserve: RED `13db2d7` (missing module, suite
failed) → GREEN `d9a5000` (9/9 new, 193/193 total, tsc and lint clean). No
separate refactor commit — the duplicate `PAYMENT_LABELS` removal and the
`formatMoney` extraction were part of the GREEN change and are covered by the
same full-suite run.
