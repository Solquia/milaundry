# TDD evidence — schema-cache failures on the Book service screen

**Source plan:** none. Journeys were derived during this TDD run from a reported
defect: tapping **Book now** showed the customer

> Could not find the function public.place_order(p_customer_id, p_customer_name,
> p_customer_phone, p_deliver_by, p_delivery_address, p_fulfillment, p_is_paid,
> p_items, p_notes, p_payment_method, p_pickup_at, p_shop_id) in the schema cache

## Scope — read this first

This cycle fixes **how the failure is presented**, not the failure itself.

The booking cannot succeed until `supabase/migrations/0010_customer_booking.sql`
is applied to the Supabase project. That is a database deployment step; no
application change can substitute for it. See *Root cause* below.

## Root cause (evidence)

Probed the live PostgREST endpoint with the project's publishable key. An
anonymous `place_order` call aborts at `if auth.uid() is null` before touching
any data, so each probe is side-effect free and only reveals which signature
exists:

| Probe | Result | Reading |
|---|---|---|
| 12-arg call the app makes (migration 0010) | `404 PGRST202` — function not found | 0010 **not applied** |
| 10-arg call without the schedule (migration 0009) | `400 P0001 "not authenticated"` | 0009 **is applied** |
| `register_with_shop` control | `400 22P02 invalid uuid` | key + connection healthy |

The database sits at migration `0009_owner_console.sql`. The app calls the
`place_order` overload introduced by `0010_customer_booking.sql`, which adds
`p_pickup_at` / `p_deliver_by`, the `reviews` table, `choose_payment_method`,
and the `bank_transfer` payment method.

Contributing repo defect (fixed separately, not part of this cycle):
`supabase/all-in-one.sql` stopped at migration 0008 and `docs/SETUP.md` listed
only migrations 0001–0005, so 0009 and 0010 were easy to miss during setup.

## User journeys

1. As a customer, when the shop's backend is missing the online-booking upgrade,
   I want to be told the shop can't take online bookings yet and to contact
   them — not a list of SQL parameter names.
2. As a customer, I still want a dropped connection to read as a connection
   problem, and an ordinary shop message ("closed for the day") to reach me
   unchanged.

## Task report

**Behavior:** `friendlyBookingError` maps PostgREST schema-cache failures to a
customer-facing sentence.

- **Summary:** the raw message reads like prose, so the existing
  `TECHNICAL_RE` guard did not catch it and it was displayed verbatim. Added a
  `MISSING_BACKEND_RE` branch, checked *before* the generic technical fallback
  because "please try again" would send the customer in circles — no retry
  fixes a migration that was never applied.
- **Validation command:** `npx jest src/lib/domain/__tests__/booking-error.test.ts`
- **RED output** (commit `f60a005`):

  ```
  Tests: 2 failed, 9 passed, 11 total
  Expected: "This shop can't take online bookings yet. Please contact the shop to place your order."
  Received: "Could not find the table public.reviews in the schema cache"
  ```

- **GREEN output** (commit `0bdaa6e`):

  ```
  Tests: 11 passed, 11 total
  ```

- **Guaranteed by the passing tests:** no PostgREST schema-cache text can reach
  the booking screen; connection failures and plain shop messages keep their
  existing behavior.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | A missing `place_order` overload reads as "This shop can't take online bookings yet" | `booking-error.test.ts:hides a missing backend function behind something the customer can act on` | unit | PASS | `npx jest booking-error.test.ts` |
| 2 | Any missing database object (table, column, function) maps to the same message | `booking-error.test.ts:treats any missing database object the same way` | unit | PASS | same |
| 3 | Connection failures still blame the connection | `booking-error.test.ts:names the connection when the request never reached the shop` | unit | PASS | same |
| 4 | Constraint/PGRST detail still becomes the generic retry message | `booking-error.test.ts:replaces database detail with something the customer can act on` | unit | PASS | same |
| 5 | A shop's own sentence still reaches the customer unchanged | `booking-error.test.ts:keeps a message that already reads like a sentence to a customer` | unit | PASS | same |

## Coverage and known gaps

```
npx jest --coverage --collectCoverageFrom="src/lib/domain/booking-error.ts"
 booking-error.ts | 100 % stmts | 100 % branch | 100 % funcs | 100 % lines
```

Full suite: `npx jest` — 345 passed, 41 suites. `npx tsc --noEmit` — clean.

**Gaps, stated plainly:**

- No test asserts the message renders on the Book service screen; the screen has
  no component test in this repo. The wiring is a single call site,
  `src/app/(customer)/book/[serviceId].tsx:278`.
- The underlying booking failure is **not** fixed by this cycle and cannot be
  covered by a test in this repo — it needs `0010_customer_booking.sql` applied
  to the Supabase project.
- The probe results above were captured against the live project on
  2026-08-26; re-run them after applying the migration to confirm the 12-arg
  call stops returning `PGRST202`.

## Merge evidence

- RED: `f60a005` — `test: RED — schema-cache errors reach the customer verbatim` (2 failed, 9 passed)
- GREEN: `0bdaa6e` — `fix: tell the customer the shop cannot take online bookings yet` (11 passed)
- Refactor: none needed; the change is one regex and one branch.
