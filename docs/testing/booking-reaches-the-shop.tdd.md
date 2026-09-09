# TDD evidence — the booking reaches the shop

**Source plan:** inline `/ecc:plan` run, 2026-08-28 ("make a way to connect the
booking to the store"). Continues the defect opened in
[`booking-schema-cache.tdd.md`](./booking-schema-cache.tdd.md), which mapped the
symptom to a customer-readable sentence and left the cause as a known gap.

Tapping **Book now** showed the customer:

> This shop can't take online bookings yet. Please contact the shop to place your order.

That sentence is `booking-error.ts:71`, reached because `friendlyBookingError`
matched `MISSING_BACKEND_RE` against a PostgREST `PGRST202`. The message was
correct. The shop was not the problem — **the migration was**.

## Root cause

The client was ahead of the backend. `src/lib/api.ts:151` sends `p_pickup_at` /
`p_deliver_by`, which only exist in the `place_order` overload introduced by
`0010_customer_booking.sql`. That migration had never been applied to the remote
project, which sat at `0009_owner_console`.

## User journeys

1. As a customer registered with a shop, I want **Book now** to place my order,
   so that the shop receives it instead of telling me to phone them.
2. As a shop, I want an online booking to appear in my order list at `pending`,
   so that I can accept it and advance it through the wash cycle.
3. As a customer, I want to choose how I'll pay after the shop weighs my
   laundry, including bank transfer.

## Task report

### Task 1 — apply migration 0010

**Summary.** Applied `supabase/migrations/0010_customer_booking.sql` verbatim to
the remote project via `mcp__supabase__apply_migration`, name `customer_booking`.
Additive only: `add column if not exists`, `create table if not exists`,
`create or replace function`, and a single `drop function` targeting the exact
superseded 11-argument signature. No existing row was read or rewritten.

**RED** — live database probed before the apply, via `pg_proc`,
`information_schema`, and `pg_constraint`:

| Check | Before | After |
|---|---|---|
| `place_order` overloads | 1 | 1 |
| …carrying `p_pickup_at` | **0** | **1** |
| `choose_payment_method` | **0** | **1** |
| `reviews` table | **0** | **1** |
| `orders.pickup_at` + `deliver_by` | **0** | **2** |
| payment check allows `bank_transfer` | **no** | **yes** |
| `reviews` RLS enabled / policies | n/a | **true / 3** |

**GREEN** — the live signature now reads, argument for argument, what
`src/lib/api.ts:151` sends:

```
p_shop_id uuid, p_items jsonb, p_customer_id uuid, p_notes text,
p_order_type text, p_fulfillment text, p_delivery_address text,
p_customer_name text, p_customer_phone text, p_payment_method text,
p_is_paid boolean, p_pickup_at timestamptz, p_deliver_by timestamptz
```

`list_migrations` now ends at `20260828014956 customer_booking`. Exactly **one**
`place_order` overload remains, so the RPC is unambiguous.

### Task 2 — prove PostgREST resolves the call

**Summary.** Reused the side-effect-free probe established in
`booking-schema-cache.tdd.md:20`: an anonymous `place_order` call aborts at
`if auth.uid() is null` before touching any data, so the response reveals only
whether the signature resolves.

| Probe | Before | After |
|---|---|---|
| `place_order`, full booking payload | `PGRST202 Could not find the function … in the schema cache` | **`P0001 not authenticated`** |
| `choose_payment_method` | function absent | **`P0001 order not found`** |

`not authenticated` is `place_order`'s own first guard. Reaching it proves the
schema cache resolved the new overload and entered the function body — the exact
thing that was impossible before. `friendlyBookingError` no longer has a
`PGRST202` to translate, so the red sentence cannot be produced by this path.

### Task 3 — the shop can see what lands

**Summary.** Verified by policy read, not by assumption. `place_order` sets
`v_status := 'pending'` and `v_order_type := 'online'` for a non-member caller.

- `pg_policies` on `orders`: `members read shop orders` — `SELECT` using
  `is_shop_member(shop_id)`. The merchant's `getShopOrders(shopId)`
  (`src/lib/api.ts:99`) therefore returns the new row.
- `src/app/(merchant)/orders.tsx:35` filters `order_type === 'online'` for the
  **Online** tab; `:31` shows all non-terminal statuses under **Active**, which
  includes `pending`.
- `order-status.ts:17` permits `pending → received`, so the shop can accept it.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | The booking `place_order` signature exists remotely and is unambiguous | `pg_proc` query via Supabase MCP | schema | PASS | 1 overload, ends `p_pickup_at, p_deliver_by` |
| 2 | PostgREST resolves the app's exact booking payload | anonymous `POST /rest/v1/rpc/place_order` | integration | PASS | `P0001 not authenticated` (was `PGRST202`) |
| 3 | The customer can pick a payment method after weighing | anonymous `POST /rest/v1/rpc/choose_payment_method` | integration | PASS | `P0001 order not found` (was absent) |
| 4 | Bank transfer is an accepted payment method | `pg_get_constraintdef` on `orders_payment_method_check` | schema | PASS | `bank_transfer` present in the CHECK |
| 5 | Shop members can read orders placed at their shop | `pg_policies` on `orders` | schema | PASS | `members read shop orders` / `is_shop_member(shop_id)` |
| 6 | `reviews` is protected by RLS | `pg_policies`, `pg_class.relrowsecurity` | schema | PASS | RLS true, 3 policies |
| 7 | A missing backend still reads as an actionable sentence | `booking-error.test.ts` | unit | PASS | `npx jest` |
| 8 | No regression across the app | `npx jest` | unit | PASS | **60 suites, 602 tests passed** |
| 9 | Types still compile | `npx tsc --noEmit` | typecheck | PASS | exit 0, no output |

## Security review

`mcp__supabase__get_advisors(security)` returns **zero ERROR-level findings**.
All results are WARN, and the two entries touching this change join a pattern
already shared by every `SECURITY DEFINER` RPC in the project:

- `place_order` — flagged as anon-executable, but raises on `auth.uid() is null`
  before reading or writing anything. Confirmed live by probe #2.
- `choose_payment_method` — flagged likewise; raises `not your order` for anon,
  since a non-null `customer_id` is always distinct from a null `auth.uid()`.
  Confirmed live by probe #3.

Pre-existing and untouched by this work: `touch_updated_at` has a mutable
`search_path`, and leaked-password protection is disabled in Auth.

## Coverage and known gaps

- `npx jest` — 60/60 suites, 602/602 tests pass. No new application code was
  written, so no new unit tests were owed; the change is entirely a backend
  migration and its guarantees are schema- and integration-level (rows 1–6).
- **Not verified from this session:** the two-account device walkthrough
  (customer books → merchant sees it under **Online** → advances to `received`).
  It needs a running emulator or device, which this environment does not have.
  Rows 1–5 establish that every link in that chain is present and permitted, but
  they are not a substitute for the tap-through.
- `npx expo lint` reports one **pre-existing** error unrelated to this work:
  `splash-gate.test.ts:7` — `import/no-unresolved` on `../splash-gate`. The
  module exists at `src/lib/domain/splash-gate.ts` and Jest resolves it fine, so
  this is an ESLint resolver quirk in in-flight untracked work, not a regression.
  Zero source files were modified by this task.
- `0006_repair_auth_bootstrap` exists on the remote with **no local migration
  file**. Not blocking — 0010 does `create or replace` on the whole function body
  — but the local migration history is not a faithful mirror of production.

## Merge evidence

- RED: live schema probe, six checks failing (`p_pickup_at` absent,
  `choose_payment_method` absent, `reviews` absent, schedule columns absent,
  `bank_transfer` rejected) plus `PGRST202` from PostgREST.
- GREEN: `apply_migration customer_booking` → all six checks pass; PostgREST
  returns the function's own guard instead of a missing-function error;
  `npx jest` 602/602; `npx tsc --noEmit` exit 0.
- Refactor: none. The migration was applied verbatim from the repository.
