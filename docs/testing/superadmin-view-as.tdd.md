# TDD Evidence — Superadmin Console: View-as-Merchant, Shop Accounts, UI Fixes

**Source plan**: inline `/plan` output approved in-session on 2026-08-25 (no `*.plan.md` artifact).
**Test runner**: Jest via jest-expo (`npm test`, package manager npm).

## User journeys

1. As a superadmin, I want to open any laundry shop's merchant dashboard from the console, so that I can check their orders/POS/customers/analytics without logging in to their account.
2. As a superadmin, I want to create a login account for a laundromat and hand them their credentials, so that they can sign in by themselves.
3. As a superadmin, I want to edit a shop's details and type phone numbers with a fixed +63 prefix, so that the console is usable and data stays E.164.

## Task report

| Task | Validation run | Result | Guarantee |
|---|---|---|---|
| Land in-flight +63 phone-input module | `npx jest` | 104/104 PASS (commit `b26245b`) | National-format display, E.164 storage, prefix/trunk stripping |
| RLS/RPC widening for view-as (`0007_superadmin_view_as.sql`) | `mcp apply_migration` + `pg_policies` query | success; 9 superadmin policies live | Superadmin can read orders/items/history/registrations, manage services; `place_order`/`update_order_status`/`get_shop_customers` accept superadmin via `can_operate_shop()` |
| Deploy `admin-create-shop-account` Edge Function | `mcp deploy_edge_function` | ACTIVE v1 | Account creation path exists in production (it had **never been deployed** — root cause of "can't add accounts") |
| View-as-shop domain rules | `npx jest view-as-shop` | RED: module-not-found (commit `34900df`) → GREEN 9/9 (commit `fbd5e59`) | Merchant always admitted; superadmin only with a view-as shop; customer never; active shop resolution |
| View-as wiring (context, layout gate, banner, admin button) | `npx tsc --noEmit`, `npx jest`, `npx expo lint` | tsc 0 errors, 113/113 PASS, lint clean (commit `e18334c`) | Compiles and does not regress any suite |
| Credentials handoff summary | `npx jest credentials-handoff` | RED: module-not-found (commit `0fca21c`) → GREEN 2/2 (commit `8112a89`) | Title/lines/note format, PH phone pretty-printing with raw fallback |
| Admin UI fixes (edit shop, PasswordField, handoff card) | full suite + tsc + lint | 115/115 PASS (commit `5090d73`) | No regressions; edit form reuses `validateShopForm` guarantees |
| Review fix: clear view-as on sign-out | full suite + tsc + lint | 115/115 PASS (commit `598e7cd`) | View-as state cannot outlive the auth session |

## Coverage

`npx jest --coverage`: `src/lib/domain` 99.43% statements / 100% functions & lines — above the 80% floor. Known gaps (pre-existing repo pattern: hooks/screens are not unit-tested): `use-active-shop.ts`, `view-as-shop-context.tsx`, `auth.tsx`, `api.ts` at 0%; behavior there is exercised manually and guarded by `tsc` + lint.

## Security review

`ecc:code-reviewer` verdict: **APPROVE** — 0 CRITICAL/HIGH. RLS widening judged correctly scoped (SELECT-only except services); RPCs re-derive role server-side. The single MEDIUM (view-as surviving sign-out) was fixed in `598e7cd`. Supabase security advisors after migration: only pre-existing WARNs (SECURITY DEFINER RPCs are intentional; each re-checks the caller's role internally).

## Manual follow-ups (not covered by automated tests)

- End-to-end on-device check: create a shop account from the console, sign out, sign in with the temp password, confirm merchant dashboard loads.
- Remote migration `0006_repair_auth_bootstrap` exists in the database but has no file in `supabase/migrations/` (applied outside the repo); local numbering skips 0006 deliberately.
