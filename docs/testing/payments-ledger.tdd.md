# Payments ledger — TDD evidence

**Branch:** `feat/payments-ledger`
**Date:** 2026-09-15
**Runner:** Jest via npm (`package.json` → `"test": "jest"`, `package-lock.json`, no `packageManager` field, no `bun:test` imports). `<test>` = `npx jest`, `<coverage>` = `npx jest --coverage`.

## Source plan

No `*.plan.md`. Journeys were derived during this TDD run from the request:

> when the customer pay.. iwant a way to store the payments and reference number into a tab so they can look if they actually recieved the payment

### Finding that reshaped the scope

**The storage already existed.** `public.orders` already carries
`payment_reference`, `payment_proof_path`, `payment_status` and `paid_at`,
written by the `submit_payment_proof` RPC when the customer taps
"I've sent ₱616.00". The reference was only *readable* one order at a time
(`collect-payment.tsx:174`, `pay-sheet.tsx:125`).

So no migration and no schema change were needed. The work is a read/verify
surface, not a storage feature. This is recorded here because the request asked
to "store" them, and doing that again would have duplicated a column.

## Decisions taken with the user

| Question | Chosen |
|---|---|
| Where the list lives | Segmented sub-tab at the top of the existing Orders tab. The owner bar is full at 5 tabs and the raised centre button (`isCenter` / `centerTabIndex`) needs an odd count, so a 6th tab would have broken the centre. |
| Who may open and confirm | Owner **and** staff. Staff already confirm receipts per-order today, so a list view grants no new power. `orders` is in both `MERCHANT_TABS` and `STAFF_TABS`; no change to `OWNER_ONLY_ROUTES`. |

## User journeys

1. As a shop owner or staff member, I want every payment a customer claims to
   have sent — amount, rail, reference number, receipt — listed in one place,
   so that I can check them against my own GCash/Maya app instead of opening
   orders one by one.
2. As a shop owner, I want receipts I have not checked separated from ones I
   have already confirmed, oldest-waiting first, so that nobody waits twice.
3. As a shop owner, I want the app to never tell me money *arrived* — only that
   a customer says it did — so that I never confirm a payment I did not receive.

## Task report

### 1. Ledger domain module

Splits a shop's orders into receipts awaiting an answer and payments already
confirmed, reusing `proofState()` from `payment-proof.ts` rather than restating
settlement rules.

**RED** — `npx jest src/lib/domain/__tests__/payment-ledger.test.ts`

```
Cannot find module '../payment-ledger' from
'src/lib/domain/__tests__/payment-ledger.test.ts'

Test Suites: 1 failed, 1 total
Tests:       0 total
```

Compile-time RED: the spec newly references the missing module and the
resolution failure is itself the intended signal. Checkpoint `a24ceda`.

**GREEN** — same command

```
Tests:       16 passed, 16 total
Test Suites: 1 passed, 1 total
```

Checkpoint `22c3b76`.

**Guaranteed:** a reference number and a screenshot stay a *claim* until the
shop marks the order paid; the queue is ordered by longest wait; the record is
ordered most-recent-first; the reference survives verbatim, spacing included.

### 2. Payments half of the Orders tab

A two-up mode switch above the heading, the claim card, and the two-section
list. Reads the orders the board already fetched (`['shop-orders', shopId]`),
so the view costs no extra request and confirming refreshes both halves.

**GREEN** — full suite, types, lint

```
npx jest                 -> Tests: 1345 passed, Test Suites: 116 passed
npx tsc --noEmit         -> clean for all touched files
npx eslint <4 files>     -> clean
```

Checkpoint `72ab71a`.

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | A submitted receipt appears as something to check | `payment-ledger.test.ts:lists a submitted receipt as something to check` | unit | PASS |
| 2 | The reference number survives exactly as typed, spacing included | `…:carries the reference number exactly as the customer typed it` | unit | PASS |
| 3 | A receipt with no reference is still listed, not dropped | `…:still lists a receipt that came without a reference number` | unit | PASS |
| 4 | A reference number alone never counts as confirmed | `…:never calls a claim confirmed just because it has a reference` | unit | PASS |
| 5 | Only the shop marking it paid moves a claim to confirmed | `…:moves a claim to confirmed once the shop has marked it paid` | unit | PASS |
| 6 | Settled cash orders stay in the record | `…:keeps a settled cash order in the record` | unit | PASS |
| 7 | Unweighed, unsent, counter-cash, unclaimed and cancelled orders are excluded | `…:leaves out orders with nothing to settle yet` | unit | PASS |
| 8 | The longest-waiting receipt is at the top of the queue | `…:puts the longest-waiting receipt at the top of the queue` | unit | PASS |
| 9 | The record shows the most recently settled payment first | `…:shows the most recently settled payment first` | unit | PASS |
| 10 | The amount is what the customer was actually asked for | `…:reports the amount the customer was actually asked for` | unit | PASS |
| 11 | The row carries customer name, receipt path and rail | `…:carries the customer name and the receipt so the row can be checked` | unit | PASS |
| 12 | A confirmed payment is dated by settlement, not submission | `…:dates a confirmed payment by when it was settled, not when it was sent` | unit | PASS |
| 13 | A settled order with no `paid_at` falls back to its last change | `…:falls back to the last change when a settled order has no paid_at` | unit | PASS |
| 14 | A shop with no orders yields two empty lists | `…:returns two empty lists for a shop with no orders` | unit | PASS |
| 15 | The tab badge counts only receipts waiting on the shop | `…:counts only the receipts still waiting on the shop` | unit | PASS |
| 16 | The badge is zero when nothing is waiting | `…:is zero when nothing is waiting` | unit | PASS |

## Coverage

`npx jest --coverage --collectCoverageFrom="src/lib/domain/payment-ledger.ts"`

```
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered
 payment-ledger.ts |     100 |    91.66 |     100 |     100 | 63
```

Above the 80% floor on every axis.

## Known gaps

- **Line 63** is the `order.final_total ?? 0` fallback in `toClaim`.
  Unreachable: `proofState` returns `awaiting_price` for a null total, so such
  an order never reaches either list. The fallback exists to keep the type
  honest, and is not worth a test asserting a state the filter forbids.
- **No UI test.** The project has no React Testing Library or Playwright setup;
  every suite here is domain-level. The screen was verified by `tsc`, `eslint`
  and the full suite, **not** by running it on a device. The Payments half has
  not been opened on a phone or in a browser in this session.
- **`markOrderPaid` is not covered here.** It is an existing RPC whose
  authorisation lives in the database, untouched by this work.
