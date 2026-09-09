# Notification bell, feed, and the actual bill — TDD evidence

**Source plan:** none. Journeys were derived during this TDD run from the
request: a bell on the customer home that says which cycle stage each load is
in, a notifications page in the project's style, and a detail page carrying the
stage, the actual price after weighing, and payment in the customer's chosen
method.

## User journeys

1. As a customer, I want a bell on the home hero showing how many loads need me,
   so I know something changed without opening anything.
2. As a customer, I want a notifications page listing each load and the cycle
   stage it is in, so I can see where my clothes are at a glance.
3. As a customer, I want to be told when the shop has weighed my laundry and set
   the actual price, so the estimate becoming a real bill is not a surprise.
4. As a customer, I want tapping a notification to open that order — stage
   tracker, the weighed total next to the estimate, and payment by the method I
   choose, available only once there is a real price to pay.

## Task report

### 1. Derive the notification feed from orders (`src/lib/domain/notifications.ts`)

Notifications are derived from the orders the customer can already see rather
than stored in a second table that could disagree with them. One load can raise
two notifications — where it is, and what is now owed — because one is news and
the other is a question.

- **RED:** `npx jest src/lib/domain/__tests__/notifications.test.ts`
  → `Cannot find module '../notifications'` — suite failed, 0 tests ran.
  Compile-time RED: the test newly exercises a code path that does not exist.
- **GREEN:** same command after implementing → 21 passed.
- **Guaranteed:** stage copy per status; price notification only in the
  `price_confirmed` window; walk-ins, cancelled and paid orders never asked for
  payment; action-needed sorted above news, then by recency; ids unique per
  order+kind.

### 2. Name the bill (`src/lib/domain/actual-bill.ts`)

The detail screen showed one figure with `(estimated)` in brackets, so the
moment the price became real looked like nothing had happened.

- **RED:** `npx jest src/lib/domain/__tests__/actual-bill.test.ts`
  → `Cannot find module '../actual-bill'`.
- **GREEN:** 13 passed.
- **Guaranteed:** heading names which of the two figures is on screen; the
  weighing difference is stated against the estimate; centavo rounding, so
  `340.1 − 300.05` reads `₱40.05` and not `₱40.049999…`; `isPayable` is false
  while the total is an estimate, after settlement, and on a cancelled order.

### 3. Share `roundCentavos` (`money.ts`, `cash-payment.ts`)

`cash-payment.ts` held a private copy. Two modules subtracting money must round
identically, so it moved to `money.ts` and `cash-payment.ts` now imports it.

- **Validation:** `npx jest src/lib/domain/__tests__/cash-payment.test.ts
  src/lib/domain/__tests__/money.test.ts` → both suites pass unchanged.

### 4. Screens

- `src/app/(customer)/notifications.tsx` — new page, project card/panel style,
  split into `NEEDS YOU` and `UPDATES`; subscribes to `orders` changes so the
  feed updates live; each row opens its order.
- `src/app/(customer)/orders.tsx` — bell on the hero opposite the wordmark, with
  an amber count dot; count derived from the orders already on screen.
- `src/app/(customer)/order/[id].tsx` — stage tracker added, bill block replaces
  the bracketed total, payment card gated on `bill.isPayable`. The two banners
  that repeated the same figure were removed.
- `src/components/wash-cycle-tracker.tsx` — the stage row extracted from the
  home screen so home and detail cannot disagree about which stage is lit.
- **Validation:** `npx tsc --noEmit` → clean. `npx expo lint` → one pre-existing
  error in `src/lib/domain/__tests__/splash-gate.test.ts`
  (`import/no-unresolved`), in a file untouched by this work and unmodified
  since commit `e2472a3`. No lint errors in any file changed here.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | An empty order list produces no notifications | `notifications.test.ts:says nothing when the customer has no orders` | unit | PASS |
| 2 | The feed names the cycle stage the laundry is actually in | `notifications.test.ts:names the cycle stage the laundry is actually in` | unit | PASS |
| 3 | Every notification carries its order, so a tap can open it | `notifications.test.ts:carries the order it belongs to` | unit | PASS |
| 4 | Ids are unique across the feed | `notifications.test.ts:gives every notification an id unique across the feed` | unit | PASS |
| 5 | A weighed load announces the actual price and asks for action | `notifications.test.ts:announces the actual price once the shop has weighed the laundry` | unit | PASS |
| 6 | Stage and price are reported separately for one load | `notifications.test.ts:reports the stage and the price separately` | unit | PASS |
| 7 | A paid order stops being chased for payment | `notifications.test.ts:stops asking for payment once the order is paid` | unit | PASS |
| 8 | A walk-in never gets the online payment question | `notifications.test.ts:never asks an online-only question of a walk-in order` | unit | PASS |
| 9 | A cancelled order raises nothing that needs action | `notifications.test.ts:does not chase payment on a cancelled order` | unit | PASS |
| 10 | Ready loads say pickup or delivery correctly | `notifications.test.ts:says delivery, not pickup` | unit | PASS |
| 11 | Action-needed sorts above news, then by recency | `notifications.test.ts:puts what needs the customer above what is only news` | unit | PASS |
| 12 | The badge caps at `9+` and hides at zero or nonsense counts | `notifications.test.ts:badgeLabel` | unit | PASS |
| 13 | The bell announces its count to a screen reader, singular and plural | `notifications.test.ts:bellLabel` | unit | PASS |
| 14 | An unweighed total is labelled an estimate and says the shop will weigh it | `actual-bill.test.ts:calls an unweighed total an estimate` | unit | PASS |
| 15 | A weighed total is labelled actual and states the change vs. the estimate | `actual-bill.test.ts:shows what the weighing changed` | unit | PASS |
| 16 | An exact estimate reports no difference | `actual-bill.test.ts:stays quiet when the estimate was exactly right` | unit | PASS |
| 17 | Payment is offered only once there is a real price, and never when cancelled or paid | `actual-bill.test.ts:is payable only once there is a real price to pay` | unit | PASS |
| 18 | Float drift never reaches the bill | `actual-bill.test.ts:does not let float drift reach a bill the customer pays` | unit | PASS |

Evidence command for the whole set: `npx jest` → **49 suites, 474 tests, all
passing.**

## Coverage

```
npx jest --coverage --collectCoverageFrom='src/lib/domain/notifications.ts' \
                    --collectCoverageFrom='src/lib/domain/actual-bill.ts'

File              | % Stmts | % Branch | % Funcs | % Lines
------------------|---------|----------|---------|--------
actual-bill.ts    |     100 |     100  |     100 |     100
notifications.ts  |     100 |   96.87  |     100 |     100
```

Both are above the 80% bar. The one uncovered branch is the `?? 0` fallback on
`final_total` inside the price notification, which is unreachable — that notice
is only built when `bookingPaymentStage` has already established the total is
non-null — and is kept as a defensive default.

## Known gaps

- **No component or E2E tests.** The repo has no React Native component test
  setup (`collectCoverageFrom` is scoped to `src/lib/**`) and no Playwright
  harness, so the screens are covered by their pure logic plus `tsc --noEmit`,
  not by rendering. Adding a component-test setup would be a separate change.
- **Read state is not persisted.** The badge counts what still needs the
  customer — a price to settle, a load to collect — rather than what has not
  been opened. It therefore clears when the thing is done, not when the page is
  viewed. Per-notification read tracking would need storage and is not built.
- **No push notifications.** Updates arrive over the existing Supabase realtime
  subscription while the app is open. Delivery to a closed app would need
  `expo-notifications` and a device-token table.
- **GCash / Maya / bank transfer are not charged in-app.** Choosing a method
  records the customer's choice via the existing `choose_payment_method` RPC;
  settlement still happens with the shop. No payment gateway is integrated, and
  none was added here.

## Merge evidence

RED for both modules was a module-resolution failure caused by the missing
implementation the new tests exercise. GREEN is `npx jest` at 474/474 with
`npx tsc --noEmit` clean. The refactor step — extracting `roundCentavos` into
`money.ts` and `WashCycleTracker` into its own component — was made with the
pre-existing suites (`cash-payment`, `money`, `wash-cycle`) still green.

No checkpoint commits were created: the working tree already carried a large
amount of unrelated in-progress work, so committing would have mixed it in.
This report is the preserved RED/GREEN/refactor evidence.
