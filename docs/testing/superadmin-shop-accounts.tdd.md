# TDD evidence — superadmin shop & account management

## Source plan

No `*.plan.md` was supplied. Journeys were derived during this TDD run from the
request:

> "I want you to make a superadmin account and I want to be able to create or add
> laundry stores in there and manage accounts on that laundry and create account per
> laundry shops so they can visit their dashboards as well..."

Two decisions were taken by the user before any test was written:

| Decision | Choice | Consequence |
|---|---|---|
| How shop accounts get provisioned | **Edge Function (true account creation)** | Creating an `auth.users` row needs the `service_role` key, which can never ship in the Expo bundle. Adds a deploy step. |
| How the first superadmin is made | **Documented SQL one-liner** | No privileged promotion path exists in application code. Documented in `docs/SETUP.md` §4. |

## User journeys

1. As the platform owner, I promote my own account to superadmin **once** via documented SQL, so I can administer the platform.
2. As a superadmin, I add a laundry store with validated name/address/phone, so it appears in the shop list.
3. As a superadmin, I create an account for a laundry shop (name, mobile, temp password, owner/staff), so that shop can sign in to its own dashboard.
4. As a superadmin, I see every account attached to a laundry, so I know who has access.
5. As a superadmin, I remove an account from a laundry — but the system never lets me leave a shop with no owner.
6. As a superadmin, I deactivate a laundry so it stops accepting new customers.
7. When provisioning fails, I get a clear message that never leaks the synthetic auth email.

## Test runner

Resolved before the RED gate. `package.json` `scripts.test` is `jest` with the
`jest-expo` preset — **not** Bun's native runner.

- `<test>` = `npm test`
- `<coverage>` = `npm run test:coverage`
- `<lint>` = `npm run lint` (`expo lint`)

## Task report

### Baseline (before any change)

`npm run test:coverage` → 8 suites, **61 passed**. `src/lib/domain` 98.98% stmts;
`src/lib` adapters (`api.ts`, `auth.tsx`, `supabase.ts`, `use-active-shop.ts`) 0%.
All-files 51.04%. This established the project convention followed here: **domain
logic fully tested, Supabase adapters kept thin and untested.**

### RED — commit `3d1c7e9`

Five specs written against modules that did not exist yet.

```
Cannot find module '../shop-form'     from src/lib/domain/__tests__/shop-form.test.ts
Cannot find module '../shop-account'  from src/lib/domain/__tests__/shop-account.test.ts
Cannot find module '../temp-password' from src/lib/domain/__tests__/temp-password.test.ts
Cannot find module '../shop-member'   from src/lib/domain/__tests__/shop-member.test.ts
Cannot find module '../admin-error'   from src/lib/domain/__tests__/admin-error.test.ts

Test Suites: 5 failed, 8 passed, 13 total
Tests:       61 passed, 61 total
```

Valid RED: the failures are the intended missing implementations, and all 61
pre-existing tests still pass, so nothing unrelated regressed.

### GREEN — commit `01b3199`

Implemented `shop-form.ts`, `shop-account.ts`, `temp-password.ts`, `shop-member.ts`,
`admin-error.ts`.

```
Test Suites: 13 passed, 13 total
Tests:       104 passed, 104 total
```

### Wiring — commit `d995fd7`

Database, Edge Function, API adapter and admin UI. Not unit-tested (adapter/UI layer,
per the project convention above); verified by typecheck and lint.

```
$ npx tsc --noEmit
TSC OK
$ npm run lint          # expo lint — no findings
$ npm test
Test Suites: 13 passed, 13 total
Tests:       104 passed, 104 total
```

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | A shop form with name/address/mobile normalizes the mobile to E.164 and trims text | `shop-form.test.ts:accepts a complete shop…`, `:trims surrounding whitespace…` | unit | PASS |
| 2 | A blank or over-long shop name is rejected against the name field | `shop-form.test.ts:rejects a blank name…`, `:rejects a name longer than the maximum` | unit | PASS |
| 3 | A shop contact number is optional, but a malformed one is rejected | `shop-form.test.ts:treats an omitted phone…`, `:rejects a malformed phone…` | unit | PASS |
| 4 | Shop accounts may only be Owner or Staff — never superadmin | `shop-account.test.ts:offers exactly owner and staff`, `:rejects an unknown role…` | unit | PASS |
| 5 | A shop account requires a real name, a valid mobile, and a password meeting the shared 8-char minimum | `shop-account.test.ts:rejects a blank full name…`, `:rejects an invalid mobile…`, `:rejects a password shorter than…` | unit | PASS |
| 6 | Validation errors never echo the submitted password back to the screen | `shop-account.test.ts:never echoes the password back…` | unit | PASS |
| 7 | Generated temp passwords meet the minimum length and exclude look-alike glyphs (0/O, 1/l/I) | `temp-password.test.ts:is at least the shared minimum…`, `:excludes characters that are ambiguous…` | unit | PASS |
| 8 | Temp password generation maps each random draw to the alphabet and stays in bounds | `temp-password.test.ts:maps each random draw…`, `:asks the random source for an index within…` | unit | PASS |
| 9 | Removing staff, or an owner while another owner remains, is allowed | `shop-member.test.ts:allows removing staff…`, `:allows removing an owner when another owner remains` | unit | PASS |
| 10 | **A shop's last owner can never be removed** | `shop-member.test.ts:refuses to remove the only owner…` (×2) | unit | PASS |
| 11 | Removing a non-member, or removing from an empty list, is refused | `shop-member.test.ts:refuses to remove somebody who is not a member…`, `:refuses to remove anybody from an empty member list` | unit | PASS |
| 12 | The removal check does not mutate the member list it is given | `shop-member.test.ts:does not mutate the member list…` | unit | PASS |
| 13 | A permission failure is reported as a superadmin-only action, not raw RPC wording | `admin-error.test.ts:explains a permission failure…` | unit | PASS |
| 14 | A duplicate account is reported in terms of the mobile number | `admin-error.test.ts:reports an already-registered…`, `:reports a duplicate-key database error…` | unit | PASS |
| 15 | A missing Edge Function is reported as "not deployed", not as a generic failure | `admin-error.test.ts:explains that provisioning is not deployed…` | unit | PASS |
| 16 | **Admin errors never leak the synthetic auth email address** | `admin-error.test.ts:never leaks the synthetic auth email address`, `:rewrites email wording…` | unit | PASS |
| 17 | Unrecognized errors pass through, and an empty error still yields a message | `admin-error.test.ts:passes an unrecognized message through unchanged`, `:falls back to a generic message…` | unit | PASS |

## Coverage

```
$ npm run test:coverage
 lib/domain          |   99.37 |    97.8 |     100 |     100 |
  admin-error.ts     |     100 |     100 |     100 |     100 |
  shop-account.ts    |     100 |     100 |     100 |     100 |
  shop-form.ts       |     100 |     100 |     100 |     100 |
  shop-member.ts     |     100 |     100 |     100 |     100 |
  temp-password.ts   |     100 |     100 |     100 |     100 |
All files            |   57.97 |   62.67 |   43.28 |   59.43 |
```

All five new modules are at **100% statements, branches, functions and lines**. The
domain layer as a whole is at 99.37%.

**All-files coverage is 57.97%, below the 80% target.** This is honest reporting, not
a pass: `collectCoverageFrom` includes `src/lib/**`, which sweeps in the Supabase
adapters `api.ts`, `auth.tsx`, `supabase.ts` and `use-active-shop.ts` — all at 0%
**before this change** and still at 0% after. This change moved the number *up* from
51.04% to 57.97%; it did not create the gap.

## Known gaps

These are real and deliberately left open — none are covered by a passing test:

1. **No test executes the SQL in `0005_shop_accounts.sql`.** The last-owner rule,
   `assert_superadmin()`, and the demote-on-last-removal behaviour are enforced in
   Postgres but verified only by reading. Closing this needs a local
   `supabase start` stack and integration tests.
2. **No test executes the Edge Function.** Its input re-validation, the
   authorize-before-create ordering, and the delete-user rollback on attach failure
   are unverified at runtime. It is Deno code and is excluded from `tsconfig.json`, so
   it is not even typechecked by `npx tsc --noEmit`. `supabase functions serve` plus
   an integration test would close this.
3. **No test renders the admin screens.** No React Testing Library setup exists in this
   repo; adding one was out of scope for this change.
4. **The superadmin bootstrap is manual and untested by design** — the user chose the
   documented SQL one-liner precisely so no privileged promotion path exists in code.
5. **Validation is duplicated across the runtime boundary.** The Edge Function
   re-implements the E.164, role and password-length checks rather than importing
   `src/lib/domain`, because it runs on Deno. If `MIN_PASSWORD_LENGTH` or
   `SHOP_ACCOUNT_ROLES` change, `supabase/functions/admin-create-shop-account/index.ts`
   must be updated to match.
6. **`adminCreateShopAccount` in `api.ts` is untested**, including its
   `readFunctionError` unwrapping of `FunctionsHttpError` bodies.

## Merge evidence

If these commits are squashed, preserve:

- **RED** `3d1c7e9` — 5 suites failed on missing modules; 61 pre-existing tests passed.
- **GREEN** `01b3199` — 104/104 tests pass.
- **Wiring** `d995fd7` — `tsc --noEmit` clean, `expo lint` clean, 104/104 tests pass.
- No refactor commit was needed; the implementation was written against the specs and
  required no post-GREEN restructuring.
