# TDD Evidence — Branded Shop Console (redesign + auto-generated accounts)

**Source plan**: in-session request 2026-08-25 with reference screenshots (WebNegosyo-style console). Runner: Jest via jest-expo (npm).

## User journeys

1. As a superadmin, I enter a laundry's name, logo and location, and the app auto-generates an original username + branded password so the shop can sign in by themselves.
2. As a superadmin, I see a platform Overview (live count, stat tiles, recently added) and a Shops tab with search, status filters and Manage / Open store actions.
3. As a shop owner, I sign in with my branded username (or a phone number) — one sign-in box handles both.
4. As a superadmin, Manage shows General / Accounts / Features / Integrations / Delivery segments, with future features visible as coming-soon toggles.

## Task report

| Task | Validation | Result | Guarantee |
|---|---|---|---|
| shop-slug, branded-account, login-id domain modules | `npx jest shop-slug branded-account login-id` | RED module-not-found (`096ec71`) → GREEN 18/18 (`319ccd1`) | Slug rules, branded username/password generation, username-vs-phone parsing, no username/phone email collisions |
| Migration `0008_shop_branding.sql` | MCP `apply_migration` + `select name, slug from shops` | applied; existing shops backfilled (`sparkle-clean`, `sparkle-wash`) | `shops.slug` unique + `logo_url`, `profiles.username`, `shop-logos` bucket policies, RPCs carry slug/logo/username |
| Edge Function v2 (username or phone) | MCP `deploy_edge_function` | ACTIVE version 2 | Branded accounts created without a phone; server-side validation mirrors domain rules |
| Sign-in with username or phone | full suite + tsc + lint | 133/133 PASS (`532acab`) | `parseLoginId` routes both identities to the right synthetic auth email |
| Console redesign (tabs, overview, shops, new-shop, manage segments) | `npx tsc --noEmit`, `npx jest`, `npx expo lint` | 0 errors / 133 PASS / clean (`532acab`) | Compiles; no suite regressions |
| Review HIGH fix: no stranded shops | `npx jest branded-account` | RED 1 failed (`dbeb054`) → GREEN 134/134 (`422233c`) | Usernames always ≥3 chars; collision retries with suffixes; failure path directs admin to the Accounts tab |

## Coverage

`src/lib/domain` remains ~99% statements / 100% functions (18 suites, 134 tests). Screens/hooks (admin UI, api, contexts) follow the repo's existing untested-UI pattern; guarded by tsc + lint.

## Review

`ecc:code-reviewer` over `4130d2b..HEAD`: 0 CRITICAL, 1 HIGH (orphaned shop on account failure — **fixed** in `422233c`), 1 LOW (non-atomic slug check in `admin_create_shop`; accepted — single-admin console, unique index still enforces).

## Manual follow-ups

- On-device: add a shop with logo, confirm the credentials screen, sign in with the generated username, confirm merchant dashboard.
- Reload required: run `npx expo start -c` and reload the app — earlier "nothing changed" reports were the app running a stale bundle, plus the Edge Function having never been deployed (fixed this session).
