# TDD evidence — a booking carries the customer's name and number

**Ask (verbatim):** "When customer already booked a drop off or pick up on their
own we want to already add the name and contact number to be shown on the order
on the owners side."

Follows [`booking-reaches-the-shop.tdd.md`](./booking-reaches-the-shop.tdd.md),
which made an online booking arrive at the shop at all.

## The defect

`place_order` wrote `customer_name` / `customer_phone` from `p_customer_name` /
`p_customer_phone` only — the two fields the counter types for a walk-in
(`service-order-form.tsx`, `walk_in` mode). The customer booking flow
(`(customer)/book/[serviceId].tsx:331`) passes neither: it sends only the
schedule, because the customer gave their name and number when they signed up.

So an online booking landed with two empty strings, and every merchant surface
fell back the same way:

| Surface | What the owner saw |
|---|---|
| `(merchant)/orders.tsx:84` | `Walk-in customer` |
| `(merchant)/orders.tsx:104` | no phone segment at all |
| `(merchant)/order/[id].tsx:377` | `Walk-in customer` + *No contact number on file* |
| `(merchant)/pos.tsx:64` | `Walk-in customer` |

An order booked for a *rider pickup* therefore showed as a walk-in with nobody
to ring — the shop had an address to collect from and no way to phone ahead.

## Where the fix belongs

Not a join at read time. `profiles` reaches a merchant only through the
"merchant reads own shop customers" RLS policy (`0002_rls.sql:41`), and the name
on an order is a fact about the order *as taken* — it should not change later
because someone edited their profile. So the details are stamped onto the order
row at placement, the same shape the walk-in fields already use.

## Task 1 — the fallback, TDD-first

**RED.** `src/lib/domain/__tests__/order-contact.test.ts` before any
implementation:

```
$ npx jest order-contact
Cannot find module '../order-contact' from 'src/lib/domain/__tests__/order-contact.test.ts'
Test Suites: 1 failed, 1 total
```

**GREEN.** `src/lib/domain/order-contact.ts` — `orderContact(order)` returns
`{ name, phone, isNamed }`. It trims, turns an empty number into `null` rather
than an empty string, and picks an honest placeholder: `Online customer` for an
online order, `App customer` for a claimed walk-in, and `Walk-in customer` only
for an order with no account behind it. Calling an app booking a walk-in sends
the shop looking for a face at the counter.

```
$ npx jest order-contact
Tests:       8 passed, 8 total
```

Eight cases, including the two that were the actual bug — an online order with
no stored name must not read `Walk-in customer`, and whitespace-only details
count as missing.

## Task 2 — the stamp (`0015_booking_customer_contact.sql`)

Same body as 0010, with one block added below the membership branch: when the
order has an account behind it and either field is blank, fill it from that
profile. Counter-typed details still win — the person standing there may be
dropping off on someone else's behalf, and theirs is the number worth ringing.
It also covers a merchant placing an order *for* a known customer without
re-typing what the account already holds.

Two more pieces so no order is left nameless:

- **Backfill** for bookings already placed. Fills blanks only, only from the
  order's own `customer_id`, so a hand-typed walk-in is untouched. Idempotent.
- **`stamp_claimed_order_contact`** — a `before update of customer_id` trigger.
  `claim_order` (0009) hands an unclaimed walk-in to an account; from then on
  the shop should see who holds it. Written as a trigger rather than an edit to
  `claim_order`, so any future path that attaches a customer gets it too.

## Task 3 — the merchant surfaces

`(merchant)/orders.tsx`, `(merchant)/order/[id].tsx` and `(merchant)/pos.tsx`
now read `orderContact(order)` instead of `order.customer_name || 'Walk-in
customer'`. The detail screen renders a placeholder name in italic subtle
(`customerUnnamed`) — a stand-in should not read like a person's name, or the
shop trusts it and stops looking for the number.

## Verification

```
$ npx tsc --noEmit
(clean)

$ npx jest
Test Suites: 73 passed, 73 total
Tests:       789 passed, 789 total
```

## Applied

`0015` was applied to the live project (`booking_customer_contact`,
2026-09-06), which also ran the backfill. Counted straight after:

| order_type | orders | with name | with phone | account rows still blank |
|---|---|---|---|---|
| online | 6 | 6 | 6 | 0 |
| walk_in | 2 | 2 | 2 | 0 |

All six online bookings had been nameless before this; none is now.

`supabase/all-in-one.sql` remains at 0010 and was already stale before this
change — a fresh project needs the migration files, not that paste.
`docs/SETUP.md` now lists 0011–0015.
