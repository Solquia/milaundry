# TDD Evidence Report — MiLaundry Phase 1 (Domain Core)

**Source plan**: Inline plan approved in-session (2026-08-24). Auth decision: phone + password, no OTP ("proceed dont add phone otp yet, but sure do use phone number for credentials..").

## User Journeys

1. As a customer, I want to scan a shop QR code, so that I can register with my preferred laundry shop.
2. As a customer, I want to scan an order QR code, so that I can claim an existing order and track its status.
3. As a customer, I want to pick services and quantities when creating an order, so that I can see the estimated price before submitting.
4. As a merchant, I want to create orders POS-style with services and weights, so that walk-in orders are recorded with a correct total.
5. As a merchant, I want to move orders through a defined status lifecycle, so that customers always see an accurate status.
6. As a user, I want to sign in with my phone number and password, so that I don't need an email address.

## RED/GREEN cycle evidence

- **Cycle 1 (pricing, order-status, qr, phone)**
  - RED: `npm test` → 4 suites failed, "Cannot find module '../pricing'" etc. (missing implementations — the intended failure). Commit `3d769a7`.
  - GREEN: `npm test` → `Test Suites: 4 passed, Tests: 34 passed`. Commit `23fbb5d`.
- **Cycle 2 (credentials)**
  - RED: `npx jest credentials` → 1 suite failed (missing module). Committed as RED checkpoint.
  - GREEN: `npx jest credentials` → `5 passed`. Committed.
- **Final full run**: `npm run test:coverage` → `Test Suites: 5 passed, Tests: 39 passed`.

## Test Specification

| # | What is guaranteed | Test file | Test type | Result | Evidence |
|---|--------------------|-----------|-----------|--------|----------|
| 1 | Line totals per unit type (per_kg, per_item, flat) with 2-decimal rounding; invalid quantities throw | `src/lib/domain/__tests__/pricing.test.ts` | unit | PASS | `npm test` (34→39 passing) |
| 2 | Order total sums lines immutably; unknown service rejected | `src/lib/domain/__tests__/pricing.test.ts` | unit | PASS | same |
| 3 | Status machine allows only pending→received→in_progress→ready→completed (+cancel from non-terminal); terminal states frozen | `src/lib/domain/__tests__/order-status.test.ts` | unit | PASS | same |
| 4 | Shop/order QR payloads round-trip; malformed/foreign/token-less payloads → null | `src/lib/domain/__tests__/qr.test.ts` | unit | PASS | same |
| 5 | Phone normalization to E.164 (+63 default, other-country passthrough); invalid → null | `src/lib/domain/__tests__/phone.test.ts` | unit | PASS | same |
| 6 | Credentials validation: valid phone + ≥8-char password required, field-level errors | `src/lib/domain/__tests__/credentials.test.ts` | unit | PASS | `npx jest credentials` (5 passed) |

## Coverage and known gaps

`npm run test:coverage` (2026-08-24):

- `src/lib/domain/**`: **98.5% stmts / 100% lines** — meets the 80% bar for the tested layer.
- `src/lib/{api,auth,supabase,use-active-shop}`: **0%** — these are thin Supabase bindings; testing them meaningfully requires a running Supabase stack (or extensive client mocks with low assertion value). Planned as Phase 6 integration tests with `supabase start` + RLS policy tests.
- SQL (`supabase/migrations/*.sql`) is **unexecuted in this environment** (no Supabase CLI/Docker here). It must be validated against a real stack before production use — see docs/SETUP.md. RLS policy tests are the top follow-up.
- No component/E2E tests yet (screens were built after the domain TDD cycles); Phase 6 work.

## Merge evidence

Checkpoint commits on `main`: scaffold → RED (cycle 1) → GREEN (cycle 1) → supabase schema/RLS/RPCs → RED (cycle 2) → GREEN (cycle 2) → app screens (this commit). If squashed later, this file preserves the RED/GREEN record.
