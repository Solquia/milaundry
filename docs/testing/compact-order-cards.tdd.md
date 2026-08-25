# Compact order cards (stage button removed) — TDD evidence

**Date:** 2026-08-25
**Branch:** main
**Source plan:** none — journeys derived during this TDD run from the user
request and a screenshot of the merchant Orders list.

## Request

> "remove the button that said move to ready to pick up because its just clutter
> and imagine if theres a lot of customers then it be more confusing make it a
> bit small but still very readble the important details"

This reverses the per-card `Move to <stage>` button added in
`order-card-actions.tdd.md`. The reasoning is sound: one full-width button per
card doubles card height, and at twenty orders the list becomes a wall of
buttons. Stage changes remain available on the order detail screen, which already
has the full transition set plus cancel.

## User journeys

1. As a shop owner with many orders, I want each card to hold only the details I
   scan for — who, how much, what stage — so the list stays readable.
2. As a shop owner, I want more orders visible per screen, so I do not scroll
   past chrome to find a customer.
3. As a shop owner, I want the reference and time to stay legible even though
   they are smaller, so I can still match a card to a ticket.

## Task report

### Task 1 — compact meta line (`order-card.ts`)

The meta line read `#4b141b63 · 8/25/2026, 7:09:22 PM · +639855421399` — a full
`toLocaleString` date plus seconds, on every card, for orders usually taken the
same day. Added `src/lib/domain/order-card.ts` with `shortOrderId` and
`formatOrderTime`: today's orders render as `7:09 PM`, older ones as
`Aug 24, 6:36 PM`. Formatting is hand-rolled rather than locale-based so output
is stable across devices and testable without timezone flakiness (test inputs are
built from local date components, not ISO literals).

- **RED command:** `npx jest order-card`
- **RED output:**

  ```
  ● Test suite failed to run
    Cannot find module '../order-card' from 'src/lib/domain/__tests__/order-card.test.ts'
  Test Suites: 1 failed, 1 total
  ```

  Failure cause is the intended missing module.
- **RED checkpoint:** `24020e6 test: add reproducer for compact order card meta line (RED validated: module missing)`
- **GREEN output:** `Tests: 9 passed, 9 total`

### Task 2 — remove the stage button and tighten the card

- `src/app/(merchant)/orders.tsx`: deleted the `Move to <stage>` button, its
  `useMutation`, and the now-unused `updateOrderStatus`, `STATUS_LABELS`,
  `Button`, `formatDate`, `useQueryClient`, and `OrderStatus` imports. Name and
  total dropped 16 → 15pt and share a row with `alignItems: center`; the name
  gets `numberOfLines={1}` + `flexShrink` so a long name truncates instead of
  pushing the price off-screen. Tag gap 6 → 4. The meta line is now explicit
  12pt subtle text on a single line.
- `src/components/ui-kit.tsx`: `Card` gained an optional `compact` prop
  (padding 16 → 12, gap 8 → 6, radius 12 → 10). Default is `false`, so the other
  19 importers render unchanged.
- `src/lib/domain/order-status.ts`: `nextForwardStatus` and its three tests were
  **removed** — the button was its only caller, and leaving it would be dead
  code. `nextStatuses` (used by the order detail screen) is untouched.

- **Commands:** `npx tsc --noEmit`, `npx jest`, `npx expo lint`
- **Output:** tsc silent; `Test Suites: 26 passed, 26 total`,
  `Tests: 206 passed, 206 total`; lint reported no findings.
- **GREEN checkpoint:** `fa619b6 refactor: drop order-card stage button, compact card meta line (GREEN validated: 206/206 tests)`

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | A uuid shortens to a scannable `#4b141b63` reference | `order-card.test.ts:shortens a uuid to a scannable reference` | unit | PASS | `npx jest order-card` |
| 2 | An already-short id is not mangled | `order-card.test.ts:leaves an already-short id alone` | unit | PASS | same |
| 3 | Orders taken today show time only, no date | `order-card.test.ts:shows only the time for orders taken today` | unit | PASS | same |
| 4 | Orders from an earlier day gain a short date | `order-card.test.ts:adds the date for orders from an earlier day` | unit | PASS | same |
| 5 | Orders from another month render that month's name | `order-card.test.ts:adds the date for orders from another month` | unit | PASS | same |
| 6 | Midnight renders as `12:05 AM`, not `0:05 AM` | `order-card.test.ts:renders midnight as 12 AM, not 0 AM` | unit | PASS | same |
| 7 | Noon renders as `12:00 PM`, not `0:00 PM` | `order-card.test.ts:renders noon as 12 PM, not 0 PM` | unit | PASS | same |
| 8 | Single-digit minutes are zero-padded (`7:05`, not `7:5`) | `order-card.test.ts:pads single-digit minutes` | unit | PASS | same |
| 9 | Same month/day in a *different year* is not treated as today | `order-card.test.ts:treats the same calendar day in a different year as not today` | unit | PASS | same |

Retired this run: the three `nextForwardStatus` guarantees from
`order-card-actions.tdd.md`, along with the feature they described. The
`paidUpfrontLabel` and payment-summary guarantees from that report still hold.

## Coverage and known gaps

`npx jest --coverage`:

```
File                       | % Stmts | % Branch | % Funcs | % Lines
All files                  |    64.80 |   64.02 |   52.63 |   66.43
  order-card.ts            |      100 |     100 |     100 |     100
  order-status.ts          |      100 |     100 |     100 |     100
```

Known gaps, stated plainly:

- **Repo-wide coverage is 64.80%, below the 80% target.** Up slightly from 63.59%
  only because dead code was removed. The gap is pre-existing: components and
  `src/lib/api.ts` are inside `collectCoverageFrom` while the project has no
  `@testing-library/react-native`, so nothing renders under test.
- **The visual result is untested and unobserved.** Whether the card is now "a
  bit small but still very readable" is a judgement no unit test makes, and the
  app was not launched. The specific numbers (15pt name/total, 12pt meta, 12px
  padding) are my choice and may need a nudge either way.
- `formatOrderTime` takes `now` as an argument and the screen passes a `new Date()`
  created during render. A list left open across midnight will keep showing bare
  times until the next re-render (the 15s refetch interval makes that brief). Not
  covered by a test.
- Long customer names truncate to one line — deliberate, so the price stays
  visible, but untested.

## Merge evidence

RED `24020e6` (suite failed: module missing) → GREEN `fa619b6` (9/9 new, 206/206
total, tsc and lint clean). The button removal and dead-code deletion rode in the
GREEN commit and are covered by the same full-suite run.
