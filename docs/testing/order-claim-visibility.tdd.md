# The claimed ticket — who holds an order — TDD evidence

**Date:** 2026-09-06
**Branch:** main
**Targets:** `src/lib/domain/order-holder.ts`, `src/lib/domain/order-tags.ts`,
`src/lib/domain/order-board.ts`, `src/lib/domain/customer-insights.ts`,
`src/components/order-holder-card.tsx`, `src/app/(merchant)/order/[id].tsx`,
`src/app/(merchant)/customer/[key].tsx`, `src/components/ui-kit.tsx`

## Request

> "we tried claiming a laundry, the problem is it's not shown on the orders
> management if there's a user claimed an order, or whose user it's to, and we
> should also view the profile of the user and see the past orders they made"

## The defect

`claim_order` (0003) hands a walk-in ticket to the account that scanned it and
stamps `claimed_at`; the 0015 trigger fills in a blank name or number from the
profile. Everything on the server happened. Nothing on the merchant's screens
changed: the card on the board and the hero on the order looked exactly as they
did before the scan, because no view read `customer_id` or `claimed_at` on a
walk-in. The shop had no way to know the ticket was claimed, or by whom, or to
get from the ticket to that person's history.

A second, quieter half: the customer book keyed walk-ins by the digits the
counter typed (`0917…`) and accounts by the digits the profile stores
(`+63 917…`). One person, two entries — so even a found profile showed only the
orders since the scan, never the ones before it.

## What changed

- **Board card and hero:** a walk-in with an account behind it wears a
  `Claimed` tag, in a blue tone that reads as a fact rather than an alert. The
  screen-reader label says "Walk-in, claimed". An online order never earns it —
  it always has an account, and "Online" already says so.
- **Order detail:** a new card under the hero names the account in its own
  words (the profile's full name, not the "Maria" the counter typed), says how
  it came to hold the ticket — "Claimed this ticket 10:15 AM · has the app" or
  "Booked in the app" — shows the account's number when the ticket carries a
  different one, and opens the customer profile. It renders nothing for an
  unclaimed walk-in; the QR card below already covers that case.
- **Customer profile:** "Their orders" now lists every order under every key
  the person carries — the account plus the phone typed on walk-ins before they
  had the app — cancelled ones included, since the profile is a history, not a
  bill.
- **Customer book:** phone keys use `searchDigits`, so `0917 000 0000` and
  `+63 917 000 0000` are the same person, and a registered account absorbs the
  walk-ins made under its number.

The account name comes from `get_shop_customers`, which the Customers tab
already loads under the same query key, so the card is usually served from
cache. `claim_order` inserts the claimant into `customer_shops`, so the row is
always there. No migration; RLS is untouched.

## What was worth testing

The proportion of who-holds-it lives in `order-holder.ts`, apart from the
view, because the words are the design decision:

- an unclaimed walk-in summarises to **null** — nothing to say, so nothing said;
- a claim without a `claimed_at` stamp still says "Claimed this ticket" rather
  than printing "Invalid Date";
- a blank profile name falls back to "App customer" and `isNamed: false`, so
  the card can italicise a stand-in the way the hero does;
- the account's number is surfaced only when it differs from the ticket's, by
  digits, so `0917-123-4567` and `+639171234567` are not shown as two numbers.

The book's merge is pinned by the real defect: two walk-ins typed as
`0917 000 0000` and `09170000000` plus a claimed ticket on `acct-1` whose
profile says `+639170000000` fold into **one** customer with three orders and
keys `['acct:acct-1', 'tel:9170000000']`. An account with no phone folds
nothing.

## Tests

**RED first.** 13 cases in `order-holder.test.ts` failed on
`Cannot find module '../order-holder'`; 2 new `order-tags` cases, 2 new
`order-board` cases and 4 new `customer-insights` cases failed on behaviour.

The merge test exposed the digit mismatch above; `customerKey` moved from raw
digits to `searchDigits`, and the one existing expectation that pinned the raw
form (`tel:09171234567` → `tel:9171234567`) was updated with a new case saying
why.

**GREEN after:** all green.

## Verification

| Check | Result |
|---|---|
| `npx jest` (4 touched suites, pre-impl) | 4 failed, 6 tests failed (RED) |
| `npx jest` | 79 suites, 893/893 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <12 changed files>` | clean |

## Not verified

No device was driven. The card's layout against a long profile name and the
blue `Claimed` chip next to `Unpaid` amber are worth one look. The profile
route is pushed `as never`, matching how the Customers tab already reaches it.

## Preserved

Every route, query key, price, and status transition; the QR card for an
unclaimed walk-in; the POS "saved" docket, which now also reads `Claimed` if a
ticket is claimed while it is still on screen.
