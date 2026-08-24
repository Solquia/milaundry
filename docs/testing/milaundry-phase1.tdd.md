# TDD Evidence Report — MiLaundry Phase 1 (Domain Core)

**Source plan**: Inline plan approved in-session (2026-08-24). Auth decision: phone + password, no OTP.

## User Journeys

1. As a customer, I want to scan a shop QR code, so that I can register with my preferred laundry shop.
2. As a customer, I want to scan an order QR code, so that I can claim an existing order and track its status.
3. As a customer, I want to pick services and quantities when creating an order, so that I can see the estimated price before submitting.
4. As a merchant, I want to create orders POS-style with services and weights, so that walk-in orders are recorded with a correct total.
5. As a merchant, I want to move orders through a defined status lifecycle, so that customers always see an accurate status.
6. As a user, I want to sign in with my phone number and password, so that I don't need an email address.

## Test Specification

| # | What is guaranteed | Test file | Test type | Result | Evidence |
|---|--------------------|-----------|-----------|--------|----------|
| 1 | Line totals computed per unit type (per_kg, per_item, flat) with 2-decimal rounding | `src/lib/domain/__tests__/pricing.test.ts` | unit | pending | |
| 2 | Order total sums lines; unknown service or invalid quantity rejected | `src/lib/domain/__tests__/pricing.test.ts` | unit | pending | |
| 3 | Order status machine only allows defined transitions; terminal states frozen | `src/lib/domain/__tests__/order-status.test.ts` | unit | pending | |
| 4 | Shop/order QR payloads round-trip build→parse; malformed payloads return null | `src/lib/domain/__tests__/qr.test.ts` | unit | pending | |
| 5 | Phone numbers normalize to E.164 (+63 default); invalid input returns null | `src/lib/domain/__tests__/phone.test.ts` | unit | pending | |

(Results and coverage filled in after RED/GREEN runs.)
