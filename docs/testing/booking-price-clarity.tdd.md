# Booking price clarity and failure copy — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Source plan:** `.impeccable/critique/2026-08-26T02-21-50Z__src-app-customer-book-serviceid-tsx.md`
— the two P0 issues from a dual-agent design critique of the customer booking flow.

## Request

> "clarify"

Scoped by the preceding critique to its two P0 findings, both of which are copy
defects rather than logic defects: the shop's billing rule was invisible until it
moved the total, and every failure to load the price list was reported as a
missing service.

## User journeys

1. As a customer adding curtains at ₱60/kg, I want to be told about the 3 kg
   minimum **before** I tap "+", so the total does not jump ₱180 unexplained.
2. As a customer on mobile data whose signal drops, I want to be told my
   connection failed and offered a retry — not told the service does not exist.
3. As a customer whose booking is rejected by the backend, I want a sentence I
   can act on, not a Postgres constraint name.
4. As a shop owner, I want my own price list to read the same way to me as it
   does to my customer, so I can answer questions about it.

## Task report

### Task 1 — make the minimum visible (`price-label.ts`)

`pricing.ts:37` bills `Math.max(quantity, min_quantity)`. That rule was correct
and disclosed nowhere the customer could act on it: the add-on rows showed only
`₱60.00/kg`, and the main service card hardcoded `` ` · ${min} kg minimum` ``,
so a **per-piece** service with a minimum claimed a kilo minimum. The same file
also fell back to `/item` for flat-rate services, mislabelling a per-load price
as a per-piece price.

Added `src/lib/domain/price-label.ts`: `unitSuffix`, `formatQuantity`,
`formatPriceLine`, `minimumChargeNotice`. `minimumChargeNotice` quotes
`estimateLineTotal(service, minimum)` rather than recomputing `price × minimum`,
so the number shown is by construction the number billed.

Flat services return no minimum at all — `estimateLineTotal` ignores
`min_quantity` on them, so showing one would be a claim the system does not honour.

**Terminology decision (user-confirmed):** the merchant editor said "Per piece"
and rendered `/piece`; the customer screen rendered `/item`. Standardised on
**piece** on both sides, per the user's answer to a direct question. This changes
customer-visible copy: `₱280.00/item` → `₱280.00/piece`.

- **RED command:** `npx jest src/lib/domain/__tests__/price-label.test.ts`
- **RED output:**

  ```
  ● Test suite failed to run
    Cannot find module '../price-label' from 'src/lib/domain/__tests__/price-label.test.ts'
  Test Suites: 2 failed, 2 total
  ```

  Failure cause is the intended missing module.
- **GREEN output:** `Tests: 23 passed, 23 total` (both new suites together)

### Task 2 — one cause, one sentence (`booking-error.ts`)

`[serviceId].tsx` destructured only `{ data, isLoading }` from `useQuery`. On a
fetch error `isLoading` is false and `services` is undefined, so the screen fell
through to `!service` and rendered *"Service not found. Go back and pick another
service."* with no retry. The identical message appeared when `shopId` was
missing, because the query is `enabled: Boolean(shopId)`. Separately, `:183`
piped raw backend strings to the user.

Added `src/lib/domain/booking-error.ts`: `describeCatalogProblem` returns a
`CatalogProblem { title, body, canRetry }` or null, and `friendlyBookingError`
maps a submit failure.

A load failure **outranks** a missing service in the branch order: when the price
list never arrived, "we couldn't reach the shop" is the true cause and "off the
menu" is a guess. `friendlyBookingError` passes through a message that already
reads like a sentence (a shop's own "closed for the day") and replaces anything
carrying Postgres/PostgREST/HTTP detail.

- **RED command:** `npx jest src/lib/domain/__tests__/booking-error.test.ts`
- **RED output:** `Cannot find module '../booking-error'` — intended missing module.
- **GREEN output:** `Tests: 23 passed, 23 total`

### Task 3 — wire both into the screens

- `src/app/(customer)/book/[serviceId].tsx`: query now destructures `error` and
  `refetch`. New `BookingProblem` component renders title + body, a **Try again**
  button only when `canRetry`, and always a **Back to the shop** escape. Both
  price lines call `formatPriceLine`; add-on rows render `minimumChargeNotice`
  under the row (new `extraBlock` wrapper), the main service renders it under the
  stepper. `onError` maps through `friendlyBookingError`.
- New `PriceCard` component replaces the estimate card that was duplicated
  verbatim at two call sites, and adds a third state: when a selection exists but
  `estimateBooking` returned null (`booking-estimate.ts:57` swallows pricing
  faults), the card now says so instead of vanishing — an absent price card reads
  as "free".
- `src/app/(merchant)/services.tsx`: deleted its private `unitSuffix` and its own
  `` ` · min ${min} kg` `` (same per-piece bug), now calls `formatPriceLine`.
  Removed the then-unused `formatMoney` import.

- **Commands:** `npx tsc --noEmit`, `npx jest`, `npx expo lint`
- **Output:** tsc silent; `Test Suites: 34 passed, 34 total`,
  `Tests: 278 passed, 278 total`; lint reported no findings.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | `per_kg` and `per_item` use one word across both roles (`/kg`, `/piece`) | `price-label.test.ts:labels each pricing unit with the same word on both sides of the app` | unit | PASS | `npx jest price-label` |
| 2 | A flat price is never labelled as a per-piece price | `price-label.test.ts:does not label a flat price as a per-piece price` | unit | PASS | same |
| 3 | Kilos render as a unit, including halves (`0.5 kg`) | `price-label.test.ts:keeps kilos as a unit, not a count` | unit | PASS | same |
| 4 | Counted pieces pluralise (`1 piece` / `2 pieces`) | `price-label.test.ts:pluralises counted pieces` | unit | PASS | same |
| 5 | A minimum is disclosed in the price line | `price-label.test.ts:discloses a minimum in the price line` | unit | PASS | same |
| 6 | No minimum text when the service has none | `price-label.test.ts:omits the minimum when there is none` | unit | PASS | same |
| 7 | A per-piece minimum never claims to be a kilo minimum | `price-label.test.ts:never claims a kilo minimum on a per-piece service` | unit | PASS | same |
| 8 | A flat service shows no unit and no minimum | `price-label.test.ts:shows a flat price without a unit or a minimum` | unit | PASS | same |
| 9 | Below the minimum, the notice quotes the amount actually billed | `price-label.test.ts:warns when the chosen quantity is billed up to the minimum` | unit | PASS | same |
| 10 | The notice pluralises for counted pieces | `price-label.test.ts:pluralises the notice for counted pieces` | unit | PASS | same |
| 11 | Silence at and above the minimum | `price-label.test.ts:says nothing at or above the minimum` | unit | PASS | same |
| 12 | Silence before anything is selected | `price-label.test.ts:says nothing before the customer has chosen anything` | unit | PASS | same |
| 13 | Silence when no minimum applies | `price-label.test.ts:says nothing when the service has no minimum` | unit | PASS | same |
| 14 | Silence on flat services, which ignore minimums when billed | `price-label.test.ts:says nothing for flat services, which ignore minimums when billed` | unit | PASS | same |
| 15 | A loaded service produces no problem screen | `booking-error.test.ts:stays quiet when the service loaded` | unit | PASS | `npx jest booking-error` |
| 16 | A network failure names the connection, not a missing service | `booking-error.test.ts:blames the connection, not the shop, when the price list fails to load` | unit | PASS | same |
| 17 | A load failure still offers retry when a stale service is cached | `booking-error.test.ts:offers a retry for a load failure even if a stale service is still cached` | unit | PASS | same |
| 18 | A missing `shopId` routes back to the shop, not to a retry | `booking-error.test.ts:sends the customer back to the shop when there is no shop to price against` | unit | PASS | same |
| 19 | A genuinely missing service explains itself without a pointless retry | `booking-error.test.ts:explains a genuinely missing service without offering a pointless retry` | unit | PASS | same |
| 20 | Submit failures on a dead connection say so | `booking-error.test.ts:names the connection when the request never reached the shop` | unit | PASS | same |
| 21 | Postgres/PostgREST/HTTP detail never reaches the customer | `booking-error.test.ts:replaces database detail with something the customer can act on` | unit | PASS | same |
| 22 | An empty or whitespace failure still says something useful | `booking-error.test.ts:falls back when the failure arrives with nothing to say` | unit | PASS | same |
| 23 | A human sentence from the shop passes through unmangled | `booking-error.test.ts:keeps a message that already reads like a sentence to a customer` | unit | PASS | same |

## Coverage and known gaps

`npx jest --coverage`:

```
File                       | % Stmts | % Branch | % Funcs | % Lines | Uncovered
All files                  |   70.61 |    70.57 |   57.14 |   71.19 |
  booking-error.ts         |     100 |      100 |     100 |     100 |
  price-label.ts           |     100 |    96.15 |     100 |     100 | 32
  pricing.ts               |     100 |      100 |     100 |     100 |
```

Known gaps, stated plainly:

- **Repo-wide coverage is 70.61%, below the 80% target.** Up from 64.80% because
  the new modules are fully covered. The remaining gap is pre-existing: components
  and `src/lib/api.ts` are inside `collectCoverageFrom` while the project has no
  `@testing-library/react-native`, so nothing renders under test.
- **`price-label.ts:32` branch uncovered** — the `Number.isFinite` guard on a
  `NaN`/`Infinity` `min_quantity`. Defensive only; no catalog path produces it.
- **Nothing here was observed running.** The screens were not launched. The new
  `BookingProblem` and `PriceCard` components, the notice placement, and the
  `noticeText` colour (`colors.primaryDark`) are unverified visually.
- **The screen-level wiring is untested.** That `useQuery`'s `error` reaches
  `describeCatalogProblem`, that **Try again** calls `refetch`, and that the
  notice appears under the right row are all assertions no unit test makes.
- **`friendlyBookingError`'s technical-detail regex is a heuristic.** A shop
  message containing a 4xx/5xx-shaped number or the word "null" would be replaced
  by the generic fallback. Chosen deliberately over leaking a constraint name.
- **The `/item` → `/piece` change is customer-visible copy**, confirmed with the
  user before implementation but not seen by any end user yet.
- Four of the critique's P1 issues remain open: the 20-chip scheduling grids, the
  unexplained disabled `Proceed` button, sub-44pt touch targets with missing
  accessibility labels, and the absent booking summary.

## Merge evidence

RED (both suites failed: modules missing) → GREEN (23/23 new, 278/278 total, tsc
silent, lint clean). The screen wiring in `[serviceId].tsx` and `services.tsx`
rode in with the GREEN state and is covered by the same full-suite run.
