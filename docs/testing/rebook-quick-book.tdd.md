# TDD evidence: Book Again, Quick Book, Recent Shops, addresses, preferences, booking validation

**Source plan:** none; journeys derived during this run from the batch request (2026-09-24).

## User journeys

1. As a customer with a completed order, I tap **Book again** and land on a filled review
   (same shop, service, weight, add-ons, pickup/delivery, address, instructions) that I can
   change before placing it.
2. As a returning customer, I tap **Quick book** on Home and reach last time's booking in one tap.
3. As a customer, I see my **recent shops** (by last order, newest first) with a one-tap
   "Book again" each.
4. As a customer, I save several addresses with building, unit, landmark and rider
   instructions, mark one default, edit and delete them, and pick them during booking.
5. As a customer, I keep laundry preferences (detergent, softener, separate whites,
   delicates, air dry, special instructions); a booking shows only what that shop supports.
6. As a customer, a booking that cannot work tells me why on the step that can fix it:
   under 1 kg, over 30 kg, service or shop unavailable, no pickup or delivery slots left,
   or an address too incomplete for a rider to find.

## RED → GREEN

| Stage | Commit | Command | Result |
|---|---|---|---|
| RED | `5eaba4f` | `npx jest` on the 6 suites below | 6 suites failed: 4 on missing modules (`laundry-preferences`, `rebook`, `recent-shops`, `booking-validation`), 13 assertions failed in `customer-book` and `booking-error` |
| GREEN | `4b079d7` | `npx jest src/lib/domain` | 123 suites, 1509 tests passed |
| Full | (working tree) | `npx jest --coverage` | 127 suites, 1534 tests passed |
| Review RED | (working tree) | `npx jest booking-error booking-validation` | 2 failed: rebook-load failure had no problem; "SM MOA" / "Blk 5A" rejected |
| Review GREEN | (working tree) | `npx jest` | 127 suites, 1537 tests passed |
| Types | (working tree) | `npx tsc --noEmit` | no errors |
| Lint | (working tree) | `npx eslint <touched files>` | no findings |

## Code review round (ecc:code-reviewer)

| Severity | Finding | Resolution |
|---|---|---|
| HIGH | A "Book again" whose order failed to load silently became a blank booking | `describeCatalogProblem({ rebookLoadError })` shows "We couldn't load your previous order" with a retry |
| HIGH | Preferences on `profiles` would be readable by staff of every connected shop (row-level policy 0002) | Moved to `customer_laundry_preferences`, an owner-only table; shops see preferences only on their own orders |
| MEDIUM | Address minimum of 8 characters rejected short real places on the web booking page | Minimum lowered to 5; "SM MOA" and "Blk 5A" now pass, "12 A" still refused |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Book Again is offered only on completed orders with a service line still tied to a service | `rebook.test.ts › hasBookableItem / canBookAgain` | unit | PASS |
| 2 | A rebook reuses shop, per-kg main service, add-ons, fulfillment, address, parsed preferences and rider notes | `rebook.test.ts › rebookDraft` | unit | PASS |
| 3 | An over-limit previous weight is snapped to 30 kg; self drop-off carries no address | `rebook.test.ts › rebookDraft` | unit | PASS |
| 4 | Add-ons the shop dropped are removed and named; a dropped main service is reported | `rebook.test.ts › reconcileRebook` | unit | PASS |
| 5 | Recent shops are unique, newest first, skip hidden shops, rebook from the newest non-cancelled order | `recent-shops.test.ts › recentShops` | unit | PASS |
| 6 | Quick Book goes to rebook, else a connected shop, else the directory | `recent-shops.test.ts › quickBookTarget` | unit | PASS |
| 7 | Preferences are normalised from untrusted jsonb and limited to shop-supported keys (absent means all) | `laundry-preferences.test.ts` | unit | PASS |
| 8 | Notes format round-trips through the parser; legacy free text becomes instructions; newlines are flattened | `laundry-preferences.test.ts › booking notes` | unit | PASS |
| 9 | Load validation: nothing chosen, under 1 kg, over 30 kg (including per-kg add-ons), per-item needs one | `booking-validation.test.ts › validateBookingLoad` | unit | PASS |
| 10 | Address validation: empty, too short, digits only, over 300 characters | `booking-validation.test.ts › validateDeliveryAddress` | unit | PASS |
| 11 | Open hours respect a 60-minute lead and the 30-day window; delivery hours come after pickup | `booking-validation.test.ts › openHours / deliveryHours` | unit | PASS |
| 12 | The suggested schedule is always bookable and keeps last time's hour when open | `booking-validation.test.ts › suggestSchedule` | unit | PASS |
| 13 | "No pickup times left today", "no delivery times left that day", passed hour, delivery before pickup | `booking-validation.test.ts › slotProblems` | unit | PASS |
| 14 | Addresses keep building/unit/landmark within column limits; the formatted line and matching are stable | `customer-book.test.ts` | unit | PASS |
| 15 | Unavailable shop outranks missing service; a rebook names the gone service; server refusals become sentences | `booking-error.test.ts › unavailable shops and services` | unit | PASS |

## Coverage (new and changed modules)

`npx jest --coverage --collectCoverageFrom="src/lib/domain/{rebook,recent-shops,laundry-preferences,booking-validation,customer-book,booking-error,booking-schedule}.ts"`

| File | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| All | 96.77 | 90.80 | 97.10 | 98.16 |

## Known gaps

- Screens (`book/[serviceId].tsx`, `orders.tsx`, `order/[id].tsx`, `settings.tsx`) and the new
  components have no render tests; the project covers `src/lib` only. All their decisions are
  delegated to the tested domain modules above.
- No E2E run: the project has no Playwright/Detox setup for the native app.
- Migration `0027_rebook_and_preferences.sql` has not been applied to the remote database in this
  run. Until it is, the app treats a missing `supported_preferences` as "all supported" and
  blank building/unit/landmark, and a booking opens without preferences; saving an address or
  preferences will fail against the old schema.
- Merchants cannot yet narrow `shops.supported_preferences` from the app (default: all). That is a
  shop-side screen, outside this customer-side batch.
