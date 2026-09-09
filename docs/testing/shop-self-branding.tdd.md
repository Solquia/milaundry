# TDD evidence — a shop brands itself

**Source plan:** none. Journeys were derived during this TDD run from the
request: *"add a place where the merchant can edit the page and what the
customer can see — different colors and change the profile logo for their
laundry store, just for branding."*

## What was missing

| Gap | Evidence |
|---|---|
| A shop's colour was **hashed, never chosen** | `accentIndex(shop.id, …)` at `shops.tsx:71`, `orders.tsx:157`, `shop/[id].tsx:644` |
| A merchant **could not touch their own logo** | `0008_shop_branding.sql:178` grants `shop-logos` writes to `superadmin` only |
| A shop had **nothing to say about itself** | `shops` had no tagline column |

## User journeys

1. As a shop owner, I want to pick my brand colour, so the app matches the
   signboard I already paid for.
2. As a shop owner, I want to upload my own logo without asking an admin.
3. As a shop owner, I want one line under my name that says what I offer.
4. As a customer, I want a shop to look the same wherever I meet it — home tab,
   directory, shopfront.

## Task report

### Task 1 — `shop-branding.ts`, TDD-first

**RED.** `npx jest shop-branding` →
`Cannot find module '../shop-branding' from shop-branding.test.ts:2:1`,
`Test Suites: 1 failed`.

**GREEN.** Same command after implementing → `Tests: 19 passed`.

The module keeps the hash as the default, so a shop that never opens the
branding screen looks exactly as it always has. It deliberately does **not**
wrap an out-of-range index with modulo: a stale choice degrades to the shop's
*stable* hashed tone, not to an arbitrary different colour.

### Task 2 — the tile carries the choice

**RED.** Extending `ConnectedShopTile` with `brand_accent` first:
`npx jest connected-shops` → `Tests: 4 failed, 10 passed`, the existing
full-object `toEqual` reporting a tile with no `brand_accent`.

**GREEN.** After adding the field to `ConnectedShop`/`ConnectedShopTile` and
the builder → all pass. Without this the home tab would hash its own colour and
disagree with the shopfront the customer taps into — one laundry wearing two
colours.

### Task 3 — migration `0012_shop_branding_self_serve.sql`

Applied as `shop_branding_self_serve`. Verified live: `brand_cols: 2`,
`set_shop_branding: 1`, check constraint
`brand_accent IS NULL OR (brand_accent >= 0 AND brand_accent < 12)`,
`logo_policy: 1`, `existing_logos: 0`.

The logo policy scopes writes by the first path segment (`<shop_id>/<file>`),
so one shop's owner cannot overwrite another's logo — the old flat
`<slug>-<ts>.<ext>` keys had no shop to check against. **A bug was caught before
applying:** the first draft cast that segment with `::uuid`, which raises on any
non-UUID folder name, and a policy that throws takes down every read of the
bucket. It matches `shops.id::text` instead.

### Task 4 — merchant branding card, customer surfaces

`src/components/branding-card.tsx` in `(merchant)/settings.tsx`: a live preview
first, controls under it. Six swatches plus an explicit "Use my default colour"
— clearing a choice is a real option, not an absence of one. The three customer
surfaces now read the choice through `assignBrandAccents` / `resolveAccent`,
and the shopfront hero renders the tagline above the address.

### Task 5 — CRITICAL security fix found while verifying (`0013`)

An anonymous probe of `set_shop_branding` **returned a row instead of raising**.
Root cause:

```sql
-- my_role() is NULL for an anonymous caller, so:
--   false OR (NULL = 'superadmin')  ->  NULL, not false
-- and therefore  `if not can_operate_shop(...) then raise`  evaluates
--   `if NULL then`  -> the branch never executes, the guard is skipped.
```

Because these are `SECURITY DEFINER`, RLS did not catch it either. Four
functions were affected, enumerated by querying `pg_get_functiondef`:
`mark_order_paid` (**shipped in 0010, before this session**), `weigh_order`,
`set_shop_payment_details`, `set_shop_branding`.

Fixed at the root by making `can_operate_shop` total with `coalesce`, plus an
explicit `auth.uid() is null` guard on the three functions added in 0011/0012.
`my_role()` was deliberately left alone: its NULL is harmless in RLS, where a
NULL predicate fails closed, and changing it would alter policy semantics.

**RED → GREEN**, same diagnostic before and after:

| Expression (anonymous context) | Before | After |
|---|---|---|
| `can_operate_shop(...)` | **NULL** | **false** |
| `not can_operate_shop(...)` — does the guard fire? | **NULL** (never) | **true** |
| anon `POST /rpc/set_shop_branding` | returned a row of nulls | `P0001 not authenticated` |
| anon `POST /rpc/set_shop_payment_details` | would have run | `P0001 not authenticated` |
| anon `POST /rpc/weigh_order` | would have run | `P0001 not authenticated` |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | An unbranded shop keeps the colour it has always had | `shop-branding.test.ts:falls back to the hashed tone…` | unit | PASS | `npx jest shop-branding` |
| 2 | A chosen colour is honoured, including index 0 | `…honours a tone the shop chose` / `…honours a chosen zero` | unit | PASS | same |
| 3 | A stale index degrades to the stable tone, not an arbitrary one | `…falls back to the hash for an index the palette no longer has` | unit | PASS | same |
| 4 | A deliberate choice is never bumped by the collision walk | `…never moves a tone the shop deliberately chose` | unit | PASS | same |
| 5 | Two shops may both keep a colour they each chose | `…lets two shops both keep a tone they each chose` | unit | PASS | same |
| 6 | A tagline cannot exceed what the shopfront shows | `…rejects a tagline longer than the shopfront can show` | unit | PASS | same |
| 7 | A pasted newline cannot break the one-line layout | `…collapses a pasted line break into a space` | unit | PASS | same |
| 8 | Clearing a tagline is allowed | `…accepts an empty tagline` | unit | PASS | same |
| 9 | The home tab shows the same colour as the shopfront | `connected-shops.test.ts:carries a tone the shop chose…` | unit | PASS | `npx jest connected-shops` |
| 10 | Branding columns, RPC, constraint and policy exist remotely | `information_schema` + `pg_proc` + `pg_policies` | schema | PASS | 2 / 1 / constraint / 1 |
| 11 | The server rejects an out-of-palette accent | `shops_brand_accent_check` | schema | PASS | `brand_accent >= 0 AND < 12` |
| 12 | **An anonymous caller cannot brand a shop** | anon `POST /rpc/set_shop_branding` | integration | PASS | `P0001 not authenticated` |
| 13 | **An anonymous caller cannot set payment rails** | anon `POST /rpc/set_shop_payment_details` | integration | PASS | `P0001 not authenticated` |
| 14 | **An anonymous caller cannot reprice an order** | anon `POST /rpc/weigh_order` | integration | PASS | `P0001 not authenticated` |
| 15 | **The shared operator guard can no longer return NULL** | `select can_operate_shop(...)` | schema | PASS | `false`, `not …` = `true` |
| 16 | No regression across the app | `npx jest` | unit | PASS | **65 suites, 693 tests** |
| 17 | Everything typechecks | `npx tsc --noEmit` | typecheck | PASS | clean, no output |

## Coverage and known gaps

- `npx jest` — 65/65 suites, 693/693 tests. This work adds 22 (19 branding + 3
  connected-shops).
- **Not verified from this session:** the device walkthrough — pick a colour,
  upload a logo, and confirm it appears on the home tab, the directory and the
  shopfront. No emulator here. Tests 1–11 establish the logic and the schema;
  they are not a substitute for looking at it.
- **`mark_order_paid` was exploitable before this session** and is now closed by
  the root fix. It was not re-created, so its body is unchanged; the fix works
  because the guard it already calls is now total. Anything else added later
  that calls `can_operate_shop` inherits the fix.
- Still outstanding from the previous task: the **customer pay screen**
  (`payment-proof.ts` is GREEN but consumed by no screen).
- `npx expo lint` — not re-run this round; the pre-existing `splash-gate.test.ts`
  resolver quirk was the only prior finding.

## Merge evidence

- RED: `Cannot find module '../shop-branding'`; `connected-shops` 4 failing;
  live DB missing `brand_accent`/`tagline`/`set_shop_branding`; anon RPC probe
  returning a row instead of refusing.
- GREEN: 19/19 then 693/693; migration `shop_branding_self_serve` verified;
  migration `fix_null_operator_guard` verified by re-running the exact
  diagnostic that exposed the NULL.
- Refactor: `assignBrandAccents` reuses `accentIndex` from `accent.ts` rather
  than re-implementing the hash; the `::uuid` cast in the storage policy was
  replaced with a text match against `shops.id` before it ever shipped.
