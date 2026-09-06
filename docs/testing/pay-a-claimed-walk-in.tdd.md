# Your own shops only, and paying a claimed walk-in — TDD evidence

**Date:** 2026-09-06
**Branch:** main
**Targets:** `src/app/(customer)/shops.tsx`, `src/lib/domain/shop-directory.ts`,
`src/lib/domain/payment-proof.ts`, `src/lib/domain/order-tags.ts`,
`src/lib/domain/home-attention.ts`, `src/components/ui-kit.tsx`,
`src/app/(customer)/orders.tsx`

## Request

> "remove the store recommendations yes they can connect to new stores but i
> dont want them to see other stores just yet … this is the order page after
> the merchant changed and ask for final and actual weight of the laundry and
> now at this point the customer haven't paid yet … add at the bottom of
> image 4 a payment options for them to pay the actual weight of the laundry
> and after they pay that is when it will notify the merchant to start the
> laundry process"

Journeys were derived in this run; no plan file.

## User journeys

1. As a customer, I want the Shops tab to show only the laundries I have
   connected to, so I am not browsing other people's shops.
2. As a customer holding a weighed ticket I scanned into my account, I want
   payment options under the bill, so I can pay the actual amount from my
   phone.
3. As a shop, I want a sent receipt to show up on my board as something to
   check, so I know to confirm it and start the wash.

## The defect

The order in the screenshot (docket DE1709) is a walk-in the customer claimed
by scanning its receipt. The pay sheet — rails, account number, receipt
upload — already existed for bookings, but `proofState` returned
`not_applicable` for anything whose `order_type` was not `online`. So a
claimed walk-in, once weighed, showed the amber "TO PAY" bill and then
nothing: no way to pay, and no ping on the home screen either, since the
ping derives from the same function.

## What changed

- **Shops tab:** the "More laundry shops" section, its directory query, and
  the connect button are gone. `splitShopsByRegistration` had no other caller
  and was removed with its tests. The empty state now sends a new customer to
  the counter's QR code instead of to a list.
- **Payability follows the account:** `proofState` is `not_applicable` only
  for a ticket nobody holds (`customer_id` null) or a cancelled order. A
  claimed walk-in gets the same states as a booking, so `PaySheet` renders
  the shop's rails, the copyable number, and the receipt upload under the
  bill, and the home screen pings the amount owed.
- **The shop's side:** while a receipt is unchecked, `orderTags` swaps
  `Unpaid` for `Receipt sent` (same amber tone), on every card and hero that
  already renders tags. The merchant order page already shows the screenshot
  and reference beside "Mark paid" for the `submitted` state; the board
  refetches every 15 seconds, so the tag arrives without a reload.

No migration. `choose_payment_method` and `submit_payment_proof` already gate
on `customer_id = auth.uid()`, not on `order_type`.

## Task report

| Task | Command | RED | GREEN |
|---|---|---|---|
| Directory copy | `npx jest shop-directory` | `emptyDirectoryMessage` took a counts object and promised shops "below" | 7/7 |
| Claimed walk-in payable | `npx jest payment-proof` | claimed walk-in → `not_applicable` | all pass |
| Receipt tag | `npx jest order-tags` | `RECEIPT_TAG` undefined | all pass |
| Home ping | `npx jest home-attention` | pinned the old walk-in rule; updated to "unclaimed walk-in" and added the claimed case | all pass |
| Whole suite | `npx jest`, `npx tsc --noEmit -p .`, `npx expo lint` | | 83 suites / 938 tests; tsc and lint clean |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | With no shops, the customer is sent to the counter's QR, never to a list | `shop-directory.test.ts: sends a new customer to the counter` | unit | PASS |
| 2 | An unclaimed walk-in has nothing to settle in the app | `payment-proof.test.ts: walk-in nobody has claimed` | unit | PASS |
| 3 | A claimed walk-in, weighed, is `awaiting_payment` (rail) or `awaiting_counter` (cash) | `payment-proof.test.ts: lets a claimed walk-in pay` | unit | PASS |
| 4 | A sent receipt replaces Unpaid with Receipt sent on the shop's cards | `order-tags.test.ts: replaces Unpaid with Receipt sent` | unit | PASS |
| 5 | The receipt tag disappears once the shop confirms | `order-tags.test.ts: drops the receipt tag` | unit | PASS |
| 6 | The home screen pings a claimed walk-in's bill, and never an unclaimed one | `home-attention.test.ts` (two cases) | unit | PASS |

## Coverage and known gaps

- Screens are not unit tested; the decisions live in the tested modules.
- "Notify the merchant" is the board tag plus the existing receipt review on
  the merchant order page. There is no push notification in the app yet; the
  board polls every 15 seconds.
- No on-device run this session.

## Merge evidence

- RED `e699715` test: add reproducers for the counter-only directory and paying a claimed walk-in
- GREEN `2e4fb0f` feat: show only the customer's own shops, and let a claimed walk-in pay from the phone
