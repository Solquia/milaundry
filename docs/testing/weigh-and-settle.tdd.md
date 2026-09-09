# TDD evidence — weigh, photograph, notify, settle

**Source plan:** inline `/ecc:plan` run, 2026-08-28 ("merchant weighs the laundry,
photographs it, customer is notified of the actual cost and can pay it").
Follows [`booking-reaches-the-shop.tdd.md`](./booking-reaches-the-shop.tdd.md),
which made online bookings reach the shop in the first place.

## The blocker found during planning

The merchant had **no way to enter an actual price**. Every RPC on the live
database was checked: the only function touching `final_total` was
`mark_order_paid`, doing `final_total = coalesce(final_total, estimated_total)`
— it copied the estimate. There was no `set_final_total`, and
`(merchant)/order/[id].tsx` imported only `getOrder, markOrderPaid,
updateOrderStatus`.

So three modules that were already written, already tested, and already correct
had been **unreachable since they were merged**:

| Already built | Why it never fired |
|---|---|
| `actual-bill.ts` `'weighed'` stage | needs `final_total !== estimated_total` |
| `booking-status.ts` `'price_confirmed'` | needs `final_total !== null` from a real weighing |
| `notifications.ts` `price_ready` notice | derived from `bookingPaymentStage` |

The destination existed; the road stopped short. This work builds the road.

## Assumptions recorded

The user answered `proceed` without picking between the two options the plan
raised. Both were resolved by the plan's own recommendation and stated before
work began:

1. **Payment rail = manual (GCash/Maya/bank + uploaded proof)**, not a
   PayMongo/Xendit gateway. The money genuinely moves; it is not
   gateway-mediated, and the app records a *claim* rather than asserting
   receipt.
2. **Weigh photo required for online bookings, optional for walk-ins** — only
   an online customer is not standing at the counter to see the scale.

## User journeys

1. As a shop, I want to weigh a load I have received and photograph it, so the
   customer gets a price backed by evidence rather than a number that moved.
2. As a customer, I want to be told the actual cost with the photo behind it,
   so a changed price does not read as a bait-and-switch.
3. As a shop, I want to publish how I take money, so a customer who is not at
   the counter can pay me.
4. As a customer, I want to send payment and prove it, and have the shop
   confirm it against their own records.

## Task report

### Task 1 — three domain modules, TDD-first

**RED.** Wrote `weigh-order.test.ts`, `shop-payment.test.ts`, and
`payment-proof.test.ts` before any implementation.

```
$ npx jest weigh-order shop-payment payment-proof
Cannot find module '../weigh-order'   from weigh-order.test.ts:1:1
Cannot find module '../shop-payment'  from shop-payment.test.ts:1:1
Cannot find module '../payment-proof' from payment-proof.test.ts:1:1
Test Suites: 3 failed, 3 total
```

Missing implementation, not a broken harness.

**GREEN.** Implemented the three modules; same command, unchanged:

```
Test Suites: 3 passed, 3 total
Tests:       60 passed, 60 total
```

### Task 2 — migration `0011_weigh_and_settle.sql`

**Summary.** Written to `supabase/migrations/` first (the local history was
drifting from production — flagged in the previous session), then applied via
`mcp__supabase__apply_migration` as `weigh_and_settle`. Additive only.

**RED → GREEN**, verified by query on the live database:

| Check | Before | After |
|---|---|---|
| `orders` weigh/proof columns | 0 | **5** |
| `shops` payment columns | 0 | **6** |
| `weigh_order` / `submit_payment_proof` / `set_shop_payment_details` | 0 | **3** |
| `order-photos` bucket `public` | absent | **false** |
| storage policies on those objects | 0 | **4** |

`weigh_order` recomputes the total server-side from the `services` table and
re-applies the shop minimum, exactly as `place_order` does; the merchant's
on-screen figure is advisory. It refuses a paid order (`cannot reprice a paid
order`), a `pending`/`completed`/`cancelled` order, a weight outside `(0, 100]`,
and a line not sold by weight.

`submit_payment_proof` deliberately does **not** set `payment_status = 'paid'`.
Only the shop can, via `mark_order_paid`, after checking their own wallet.

### Task 3 — merchant weighs and photographs

`src/components/weigh-sheet.tsx`, mounted in `(merchant)/order/[id].tsx`
between the Services and Payment cards — the price must be true before it can
be collected. Scale input reuses the booking screen's `WeightScale`; the photo
uses `expo-image-picker@57.0.13` (verified `mediaTypes: MediaType[]` against the
installed types rather than assumed), falling back to the library when camera
permission is denied so a denied prompt is not a dead end. The sheet queries
`['services', shop_id]` — the booking screen's own cache key — because
`order_items` carries no `min_quantity`, and without it a below-minimum load
would preview at a price the server then corrects.

### Task 4 — merchant publishes payment rails

`src/components/payment-rails-card.tsx`, mounted in `(merchant)/settings.tsx`.
Shows "Customers will see: …" live, so an incomplete bank entry (a name with no
account number) is visibly dropped at entry rather than silently at render.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | A scale reading prices only the weighed line; booked extras are untouched | `weigh-order.test.ts:leaves per-item extras exactly as the customer booked them` | unit | PASS | `npx jest weigh-order` |
| 2 | A light load bills at the shop minimum and says so | `weigh-order.test.ts:bills a light load at the shop minimum` | unit | PASS | same |
| 3 | Totals round to centavos; no float drift reaches a receipt | `weigh-order.test.ts:rounds to centavos…` | unit | PASS | same |
| 4 | A non-per-kg line cannot be priced from kilos | `weigh-order.test.ts:throws when the named line is not sold by weight` | unit | PASS | same |
| 5 | A paid order can never be repriced | `weigh-order.test.ts:refuses once the customer has paid` + `weigh_order` guard | unit + schema | PASS | same; `raise exception 'cannot reprice a paid order'` |
| 6 | A slipped decimal point is rejected, not billed | `weigh-order.test.ts:rejects a reading past what a shop scale can hold` | unit | PASS | same |
| 7 | A rail with no account number is never offered | `shop-payment.test.ts:ignores a bank with a name but no account number` | unit | PASS | `npx jest shop-payment` |
| 8 | Cash is always payable, and listed last | `shop-payment.test.ts:always offers cash…` / `puts cash last…` | unit | PASS | same |
| 9 | A cash-only shop says so instead of showing an empty list | `shop-payment.test.ts:tells a cash-only shop customer where to pay` | unit | PASS | same |
| 10 | A settled bill never reopens for want of a screenshot | `payment-proof.test.ts:is settled even if no receipt was ever uploaded` | unit | PASS | `npx jest payment-proof` |
| 11 | The app asks the owner to verify rather than asserting money arrived | `payment-proof.test.ts:asks the owner to check their own app before confirming` | unit | PASS | same |
| 12 | A pasted URL cannot enter the reference field | `payment-proof.test.ts:rejects characters no reference number carries` | unit | PASS | same |
| 13 | Weigh/proof columns, RPCs, and private bucket exist remotely | `information_schema` + `pg_proc` + `storage.buckets` query | schema | PASS | 5 / 6 / 3 / `public=false` / 4 policies |
| 14 | Order photos are not public | `select public from storage.buckets where id='order-photos'` | schema | PASS | `false` |
| 15 | No regression across the app | `npx jest` | unit | PASS | **64 suites, 671 tests** |
| 16 | New code typechecks | `npx tsc --noEmit` | typecheck | PASS | clean at the point all my edits landed |

## Coverage and known gaps

- `npx jest` — 64/64 suites, 671/671 tests. The three new modules add 60 tests.
- **Phase 5 (customer pay screen) was not built.** `payment-proof.ts` is
  written, GREEN, and currently **consumed by no screen**. The reason is
  concrete: partway through this session another process began editing
  `src/app/(customer)/order/[id].tsx` and `ui-kit` in parallel — a new
  `order-time.ts` module appeared mid-run, and `formatDate` was removed from
  `ui-kit` while that screen still imports it. That screen is exactly Phase 5's
  target. Editing it mid-refactor would have conflicted with, and possibly
  destroyed, that work.
- **Repo-wide typecheck is currently red, from that parallel work, not from
  this:** `(customer)/order/[id].tsx(20,3): Module '@/components/ui-kit' has no
  exported member 'formatDate'`. `formatDate` appears in none of the eight files
  this task touched (verified by grep). `npx tsc --noEmit` was clean immediately
  after each of my own edits.
- **Not verified from this session:** the device walkthrough — weigh a real
  order, see the photo upload, watch the `price_ready` notification arrive on a
  customer device, save payment rails and see them render. No emulator here.
- `npx expo lint` still reports the pre-existing `splash-gate.test.ts:7`
  `import/no-unresolved` resolver quirk, unrelated to this work.

## Merge evidence

- RED: 3 suites failing on `Cannot find module`; live DB missing 5 order
  columns, 6 shop columns, 3 RPCs, and the `order-photos` bucket.
- GREEN: 60/60 on the new suites, then 671/671 repo-wide; migration
  `weigh_and_settle` applied with all schema checks passing and the photo
  bucket private.
- Refactor: reused the existing `'save-price'` merchant-error action for a
  failed weighing rather than adding a near-identical one; filtered
  `order_items` with a null `service_id` out of the weighable set, since a
  deleted service has no per-kilo rate to look up.
