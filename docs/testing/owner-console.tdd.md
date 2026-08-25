# TDD Evidence — Shop Owner Console (Orders / POS / Analytics / Services)

**Source plan:** inline plan approved in-session (2026-08-25); no `.plan.md` artifact.
**Commits:** `c9a06a8` (RED) → `d83e4a9` (GREEN domain) → `a445369` (migration 0009, deployed) → `2849ab9` (screens + API).

## User journeys

1. As a shop owner, I see walk-in and online orders in one list, tagged, and can open each to see the customer's name, phone, and services.
2. As a shop owner, I move an order through the washing cycle: received → washing → drying → folded → ready → delivered/picked up.
3. As a shop owner, I jot down a walk-in at the POS (name, phone, pickup/delivery + address, payment method, paid now/later) and immediately start the next customer.
4. As a shop owner, I see money collected today, projected earnings for today, and what customers still owe.
5. As a shop owner, I build a price list with per-kilo (with minimum weight), per-piece, and flat-rate services across categories, seeded from a starter list.

## RED / GREEN evidence

- RED: `npx jest src/lib/domain/__tests__/...` → **6 suites failed, 8 failed / 7 passed** — old status pipeline, missing modules (walk-in-order, order-tags, daily-analytics, service-catalog), no `min_quantity` support (commit `c9a06a8`).
- GREEN: `npx jest src/lib/domain` → **23 suites, 170 tests passed** (commit `d83e4a9`).
- Full verify: `npx tsc --noEmit` clean; `npx jest` → 23 suites / 170 tests green after screen rewiring.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Status machine only allows received→washing→drying→folded→ready→completed, cancel from non-terminal, no skips/backwards/self | `order-status.test.ts` | unit | PASS |
| 2 | Per-kg services bill `max(qty, min_quantity)`; flat ignores minimum; zero/negative qty throws | `pricing-minimum.test.ts` (+ legacy `pricing.test.ts`) | unit | PASS |
| 3 | Walk-in intake requires name; PH phone normalized to E.164 or rejected; delivery requires address (dropped for pickup); payment method whitelist; all errors reported at once | `walk-in-order.test.ts` | unit | PASS |
| 4 | Order cards tag Walk-in/Online + Pickup/Delivery + Paid/Unpaid (payment tag omitted when cancelled) | `order-tags.test.ts` | unit | PASS |
| 5 | Daily money: collected = paid today (final over estimated), projected = collected + today's unpaid, receivables = all unpaid non-cancelled, orders-today excludes cancelled, 2-dp rounding | `daily-analytics.test.ts` | unit | PASS |
| 6 | Category order/labels, grouping skips empty and folds unknown→other; starter list covers all selling styles with valid units/prices, per-kg minimums only | `service-catalog.test.ts` | unit | PASS |

## Coverage

`npx jest --coverage` on `src/lib/domain`: **98.94% statements / 97.23% branches / 99.61% lines** (target ≥80%).

## Backend verification (migration 0009, applied to remote via Supabase MCP)

Post-apply SQL check: 8 new `orders` columns present, 4 new `services` columns present, exactly one `place_order` overload, `mark_order_paid` exists, 0 rows left on legacy `in_progress` status.

## Known gaps

- Screens are verified by `tsc` + domain tests, not component tests (repo has no RN component-test setup); manual smoke via Expo recommended.
- `supabase/all-in-one.sql` (fresh-install bundle) not yet regenerated to include 0009.
- Server "today" boundaries are computed client-side in the shop's local timezone by design; `get_shop_analytics` remains lifetime-only.
