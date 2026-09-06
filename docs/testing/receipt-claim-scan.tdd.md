# Claiming a load from its receipt — TDD evidence

**Date:** 2026-09-06
**Branch:** main
**Targets:** `src/lib/domain/scan-outcome.ts`, `src/app/(customer)/scan.tsx`,
`src/app/(customer)/orders.tsx`, `supabase/migrations/0017_claim_own_order.sql`

## Request

> "in the customer home page you can remove now the scan QR and shops because
> … the shops is already there and the scan QR is already in the bottom tab in
> the middle, now a few changes on the QR make it so its not just to connect to
> a store make it also so that it can claim a order when they scan the receipt
> that is given by the laundry shop."
>
> Follow-up: "just remove the two at the top the two squares and nothing else
> in the home page".

Journeys were derived in this run; no plan file.

## User journeys

1. As a customer, I want the home page to stop repeating the scan and shops
   controls that already live in the tab bar, so the page leads with my shops
   and my wash.
2. As a customer holding the receipt the shop printed, I want to scan its QR
   and have that load appear on my account and open, so I can follow and pay
   for it from the phone.
3. As a customer who already holds the order (I booked in the app, or claimed
   the walk-in earlier), I want scanning the same receipt to simply open the
   order, not tell me the code is invalid.
4. As a customer who scans a receipt that belongs to someone else, I want to be
   told that in plain words, so I ask the shop rather than retry.

## What was already there, and what was not

The scanner already parsed order codes and called `claim_order`, and the thermal
docket (`receipt.ts`) already printed `buildOrderQr(order.id, claim_token)`.
The gap was on the server and in the words: `claim_order` only succeeded while
`customer_id is null`, so the account that *already held* the ticket — every
app-booked order, and every walk-in on its second scan — got "invalid or
already-claimed order QR". The scanner then showed that raw log message.

## Task report

| Task | Summary | Command | Result |
|---|---|---|---|
| Domain: scan outcome | New `scan-outcome.ts` owns the hint under the viewfinder, the route after a scan, and the sentence shown when the server refuses one. | `npx jest src/lib/domain/__tests__/scan-outcome.test.ts` | RED `Cannot find module '../scan-outcome'` → GREEN 8/8 |
| Server: idempotent claim | `claim_order` returns the holder's own order on a rescan, raises `order belongs to another account` for a taken ticket, `invalid order QR` for a wrong token. | `mcp__supabase__apply_migration claim_own_order`, then a rolled-back plpgsql probe | Before: live def refused any `customer_id is not null`. After: `own=true other=order belongs to another account badtoken=invalid order QR` |
| Scanner | Uses the domain module; refreshes `my-orders`, `registered-shops` and `order/<id>` after a claim; retry delay from `SCAN_RETRY_MS`. | `npx tsc --noEmit -p .`, `npx expo lint` | both clean |
| Home page | Removed the `ACTIONS` pair, the action row, `ActionCard` and its six styles. Nothing else on the page changed; shop tiles now stagger from index 0. | `npx tsc --noEmit -p .`, `npx jest` | clean; 83 suites / 942 tests pass |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | The hint names the counter code (connect) and the receipt code (claim) | `scan-outcome.test.ts: scanHint` | unit | PASS |
| 2 | A shop scan lands on the shopfront, a receipt scan on the order | `scan-outcome.test.ts: routeAfterScan` | unit | PASS |
| 3 | A receipt on another account says so and points at the shop | `scan-outcome.test.ts: another account` | unit | PASS |
| 4 | A refused code reads as stale, not as a bug | `scan-outcome.test.ts: fresh one` (order and shop) | unit | PASS |
| 5 | A dropped request blames the signal | `scan-outcome.test.ts: signal` | unit | PASS |
| 6 | Anything else falls back to a plain sentence | `scan-outcome.test.ts: falls back` | unit | PASS |
| 7 | Holder rescanning their own receipt gets the order back unchanged | rolled-back plpgsql probe on the live project | integration | PASS |
| 8 | A taken ticket is refused with `order belongs to another account` | same probe | integration | PASS |
| 9 | A wrong token is refused with `invalid order QR` | same probe | integration | PASS |

## Applied

`0017_claim_own_order.sql` was applied to the live project verbatim as
`claim_own_order`. `get_advisors(security)` afterwards: 0 ERROR-level findings;
the 54 WARN-level entries are the pre-existing "security definer executable by
anon/authenticated" pattern shared by every RPC in the project, unchanged by
this migration. `peek_scan` (0016) still answers only for unclaimed orders,
which is correct: a guest with someone's receipt gets no shop name.

## Coverage and known gaps

- `scan.tsx` (camera, router) and `orders.tsx` (UI) are not unit tested;
  the decisions they make live in the tested domain modules.
- The guest path (`use-finish-scan.ts`) still routes a failed claim home; with
  the server change a holder's rescan now succeeds there too, so that fallback
  is reached only for a genuinely taken or stale receipt.
- No on-device scan was run in this session.

## Merge evidence

- RED `3267ac8` test: add reproducer for claiming an order from its receipt QR
- GREEN `6f63272` feat: claim an order from its receipt QR, and clear the home quick actions
