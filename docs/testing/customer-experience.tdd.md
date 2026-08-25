# TDD Evidence — Customer Shop Experience & Booking Flow

**Source plan:** Inline plan from `/ecc:plan` (2026-08-25/26 session), confirmed by the user
with "proceed" / "proceed with the rest". No `*.plan.md` artifact was produced.

## User journeys

1. As a customer, I open a shop from the Shops tab and see a branded home page with the
   laundry's name, its services as an icon grid, and real customer reviews inline.
2. As a customer, I tap a service, estimate my laundry's weight on a scale, add thick or
   heavy items, and see a live estimated price (online booking only).
3. As a customer, I choose rider pickup & delivery (with address and pickup/deliver-by
   times) or self drop-off, then book.
4. As a customer, my order shows "booked — waiting for the actual price"; once the shop
   weighs it I see the confirmed price and choose Cash on delivery / GCash / Maya / Bank
   transfer.
5. As a customer, after a completed order I can post a star rating + comment that shows
   up on the shop's home page.

## Task report (RED → GREEN per module)

| Module | RED commit (validated failing) | GREEN commit (validated passing) | Tests |
|---|---|---|---|
| `shop-home.ts` (category icons) | `452f2d8` — module missing | `730453e` — 4/4 | 4 |
| `booking-estimate.ts` (scale, add-ons, estimate) | `99b574a` — module missing | `ea6aec1` — 13/13 | 13 |
| `booking-schedule.ts` (defaults, validation) | `1a00ac3` — module missing | `ff13a52` — 7/7 | 7 |
| bank transfer in `walk-in-order.ts` / `payment-summary.ts` | `c7e8b4d` — 2 failed, 18 passed | `3296e41` — 20/20 | +2 |
| `booking-status.ts` (payment stage) | `ec1c4f6` — module missing | `2269024` — 8/8 | 8 |

All RED states were actual executed failures (`npx jest <target>`: module-not-found or
assertion failures), captured before any production code was written.

## Test specification (new guarantees)

| # | What is guaranteed | Test target | Result |
|---|---|---|---|
| 1 | Every service category maps to a distinct Ionicons glyph; unknown → `other` | `shop-home.test.ts` | PASS |
| 2 | Weight snaps to 0.5 kg within [0, 30]; NaN → 0 | `booking-estimate.test.ts` | PASS |
| 3 | Below-minimum loads billed at shop minimum (3 kg @ min 5 → ₱175) | `booking-estimate.test.ts` | PASS |
| 4 | Heavy add-ons priced on top of base weight; empty selection → null estimate | `booking-estimate.test.ts` | PASS |
| 5 | Delivery bookings need address, future pickup, delivery after pickup | `booking-schedule.test.ts` | PASS |
| 6 | Self drop-off skips address/times entirely | `booking-schedule.test.ts` | PASS |
| 7 | `PAYMENT_METHODS` includes `bank_transfer` with label "Bank transfer" | `walk-in-order.test.ts`, `payment-summary.test.ts` | PASS |
| 8 | Online orders: awaiting_price → price_confirmed (final_total set) → paid; walk-in/cancelled → none | `booking-status.test.ts` | PASS |
| 9 | Payment method choosable only in price_confirmed | `booking-status.test.ts` | PASS |

## Validation commands actually run

- `npx jest <module>` per RED/GREEN gate (outputs quoted in commit messages)
- `npm test` full suite: **239 passed / 239** (final)
- `npx tsc --noEmit`: exit 0
- `npx expo lint`: no errors reported
- `npm run test:coverage`: `booking-estimate.ts` 100%, `booking-status.ts` 100%,
  `booking-schedule.ts` 91.66% (uncovered lines 76,82 are two error-message branches),
  `shop-home.ts` 100%

## Coverage and known gaps

- Overall `src/lib` coverage is 66.72% because `api.ts`/`supabase.ts` network glue is not
  unit-tested (pre-existing gap, unchanged by this work). All new domain logic is at or
  above 91%.
- UI screens (`shop/[id]`, `book/[serviceId]`, `order/[id]`, `scan`) follow the repo's
  existing convention: logic lives in tested domain modules; screens are thin and are not
  covered by jest (jest-expo component testing is not set up in this repo).
- `supabase/migrations/0010_customer_booking.sql` (pickup_at/deliver_by columns,
  bank_transfer, choose_payment_method RPC, reviews table + RLS) must be applied to the
  database before the new booking flow works end-to-end. SQL is not covered by jest;
  the RLS insert gate (completed-order requirement) should be smoke-tested after applying.

## Plan-safety note

The plan contained no embedded commands; validation used only the repo's standard
jest/tsc/lint scripts.
