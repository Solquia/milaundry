# Web storefront, phase 2: guest booking — TDD evidence

## Source plan

`docs/plans/web-storefront.md`, phase 2. The owner's instruction was
"proceed with next phase" (2026-09-08). Phase 1's evidence is in
`web-storefront-phase1.tdd.md`.

## User journeys

1. As a first-time visitor on a laundry's web page, I want to pick what to wash
   and when, give only my name and mobile number, and have the order placed, so
   that I never install anything or invent a password.
2. As that visitor, I want to watch the order move as the shop updates it, and
   to see how to pay once the shop has weighed it.
3. As someone whose number already has a MiLaundry account, I want the page to
   ask for my password rather than let anyone book as me by typing my number.
4. As a guest who now wants the app, I want to set a password from the tracking
   page and sign in to the app with the same number.

## Task report

### Task 1 — Domain (RED then GREEN, checkpoint commits 3623f93 and 0ea426a)

`npx jest src/lib/domain/__tests__/{web-cart,guest-identity,order-tracking}.test.ts`

- **RED** (before the modules existed): `Test Suites: 3 failed, 3 total`,
  each with `Cannot find module`.
- **GREEN**: `Tests: 30 passed, 30 total`. One test failed on the first
  implementation (`finishes with every step done`): a completed order left its
  last step "current". Fixed before the GREEN commit.

Guarantees: a per-kg line starts at the shop's minimum and steps by whole
units, capped at the booking weight limit; dropping below the minimum removes
the line; a flat service is on or off; carts are never mutated; lines are
priced as `place_order` prices them; the guest form validates name before
number and returns E.164; the edge function's two answers parse and anything
else throws; rate-limit and wrong-password failures get their own sentences;
the tracking path is seven steps with the last two named by fulfilment, empty
for a cancelled order.

### Task 2 — Database (`supabase/migrations/0020_web_guest_booking.sql`)

`register_with_shop_by_slug(p_slug)`: signed-in only, active and web-enabled
shops only, idempotent, returns the shop id. `guest_session_attempts` +
`note_guest_attempt(key, limit, window_seconds)`: fixed-window counter,
service_role only, RLS on with no policies, sweeps rows older than a day.

Applied via MCP as `0020_web_guest_booking`. Verified:
`select note_guest_attempt('test:probe', 2, 60)` three times →
`true, true, false`. Probe row deleted afterwards.

### Task 3 — Edge function (`supabase/functions/web-guest-session/index.ts`)

Deployed with `verify_jwt=false` (the app's key is a publishable key, not a
JWT, and the caller has no session by definition). Charges the IP and phone
counters before looking anything up. Creates the user with a random password
and `full_name`/`phone` metadata (the 0004 trigger fills `profiles`), then
returns a magic-link `token_hash`. An existing email returns `{ exists: true }`
and nothing else. A failed link generation deletes the just-created user.

Verified with curl against the live function:

| Call | Answer |
| --- | --- |
| fresh number | `{"token_hash":"f33…"}` |
| same number again | `{"exists":true}` |
| `phone: "0917"` | `{"error":"phone must be an E.164 mobile number"}` [400] |

Test user removed afterwards.

### Task 4 — Client (`src/lib/api.ts`)

`startGuestSession` (invoke → parse → `verifyOtp` with the token hash),
`signInGuest`, `setOwnPassword`, `registerWithShopBySlug`. The order select
now carries the shop's `slug` so the tracking page can link back.

### Task 5 — Pages and components

- `src/app/s/[slug]/book.tsx`: items → schedule → contact, brand band with
  progress, sticky estimate footer. The contact step shows the guest form, or
  "Booking as <name>" for a session that already exists.
- `src/app/track/[orderId].tsx`: headline, step list, items and bill, schedule,
  payment rails once the bill is weighed, the password card while the browser
  remembers that no password was set (the `?welcome=1` flag was dropped in
  phase 3), a guest form when there is no session. Polls every 30 s.
- `src/app/s/[slug]/orders.tsx`: the visitor's orders at this shop.
- `src/app/s/[slug]/index.tsx`: "Book online" leads the footer; "Your orders
  here" appears for a session.
- `src/components/web/`: `cart-list`, `guest-form`, `schedule-picker`,
  `tracking-steps`, `password-card`.

### Task 6 — Docs

`docs/SETUP.md`: migration 0020 in the list, the function's deploy command
under §3, the booking pages under §7. Plan status updated.

## Verification

- `npx jest` — 90 suites, 1026 tests, all pass.
- `npx tsc --noEmit` — clean (one refetch return type fixed on the way).
- `npx eslint` on every new and changed file — clean.
- `npx expo export -p web` — succeeds.
- **Browser, on the exported build served with a SPA fallback**
  (`http://localhost:8122`, fresh isolated context):
  1. `/s/sparkle-clean` → "Book online" → `/s/sparkle-clean/book`.
  2. Add WASH AND FOLD (starts at "2 kg", the shop's minimum), add more → 3 kg;
     add BIG BEDDINGS → 1 piece. Footer: "2 lines · estimate ₱651.00".
  3. Schedule: address, pickup Tomorrow 10 AM, delivery follows to the next
     day, a note.
  4. Contact: "Web Guest", 917 000 0888 → "Book now".
  5. Landed on `/track/<id>?welcome=1`: "Your booking is in", seven steps with
     "Booked" current, the two lines and ₱651.00 estimate, the address and
     both times, the "Want the app?" card. No console errors or warnings.
  6. Database: `orders` row `pending / online / delivery`, `customer_name`
     "Web Guest", `customer_phone` +639170000888, the note, ₱651.00;
     `customer_shops` has the registration; `profiles` row is a customer.
  7. "Set password" → "You're set for the app" with the number.
  8. `update orders set status = 'received'` in SQL → within the poll interval
     the page read "Your laundry is at the shop" with "At the shop" current.
  9. `/s/sparkle-clean/orders` listed "Order 09DA1F · In the shop · ₱651.00".
  10. Second isolated context, `/track/<id>` with no session → guest form →
      same name and number → "0917 000 0888 already has a MiLaundry account.
      Enter its password…" → password → the order. Two copy fixes came out of
      this step (fine print hidden under the password prompt; notice no longer
      says "to book with it" on a tracking page).
- Test order, its items and history, and the test user were deleted afterwards.

## Test specification

| # | What is guaranteed | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | A per-kg line starts at the minimum, steps by 1, caps at the limit, and removes below the minimum | `web-cart.test.ts` adjustLine (8) | unit | PASS |
| 2 | Lines are priced in catalog order and unknown ids are dropped | `web-cart.test.ts` cartLines (3) | unit | PASS |
| 3 | The cart shapes itself for place_order and counts lines | `web-cart.test.ts` cartItems/cartCount (2) | unit | PASS |
| 4 | Name before number; short names and incomplete numbers refused; E.164 out | `guest-identity.test.ts` validateGuestDetails (4) | unit | PASS |
| 5 | Only `{exists:true}` and a non-empty `token_hash` are accepted | `guest-identity.test.ts` parseGuestSessionResponse (3) | unit | PASS |
| 6 | Rate-limit and wrong-password errors have their own wording | `guest-identity.test.ts` copy (4) | unit | PASS |
| 7 | Seven steps, done/current/upcoming, fulfilment-named endings, none when cancelled, all done when completed | `order-tracking.test.ts` (6) | unit | PASS |
| 8 | Rate limiter refuses the (limit+1)th call in a window | SQL probe, above | integration | PASS |
| 9 | Fresh number → token; known number → exists; bad input → 400 | curl, above | integration | PASS |
| 10 | First-time visitor books with name and number and follows the order | browser walk-through, above | E2E (manual) | PASS |

## Coverage and known gaps

- Domain modules are fully covered by the suites above. Pages and components
  are covered by the browser walk-through, not by automated tests (no
  component test harness in this repo).
- The edge function has no automated test; its two branches and its
  validation were exercised against the deployed function.
- Payment on the web stops at showing the shop's rails and the reference
  advice; uploading a proof screenshot stays in the app (phase 3 or later).
- Link previews still show the app shell (`output: single`), as in phase 1.

## Code review

Reviewed by the code-reviewer agent (opus) after the browser walk-through. No
critical findings; four high, eight medium, two low.

**Fixed before the feature commit** (`npx tsc --noEmit`, eslint, and the full
jest suite re-run clean; function redeployed as version 2 and smoke-tested: a
fresh number with a spoofed `x-forwarded-for` still got a token, the retry got
`exists`, and the preflight answered):

- The address bucket read the *first* X-Forwarded-For hop, which the caller
  writes. It now prefers the proxy's own header, falls back to the last hop,
  and a `global` key (120/min) bounds the function as a whole.
- `{exists:true}` was also returned for any error containing "already"; now
  only for the `email_exists` code, everything else is logged and refused.
- CORS: an `ALLOWED_ORIGINS` secret allowlists the storefront host(s); unset
  keeps `*` for previews.
- Guest form: changing the number clears the password prompt, the typed
  password, and any error; password fields carry `autoComplete`.
- A lost reply after `place_order` no longer invites a second booking: a ref
  blocks re-entry, and a connection failure shows "your booking may have gone
  through" with a link to the orders list.
- Sign-out failure on the contact step is shown, not swallowed; the orders
  page distinguishes a failed load from an empty list.
- The React Query cache is cleared whenever the signed-in user changes
  (`src/lib/auth.tsx`), so "use another number" on a shared phone cannot show
  the previous person's orders.
- The rate-limit table sweep runs on ~2% of calls with an index on
  `window_start`, instead of a full delete on every sign-in.
- The "set a password" offer is remembered in the browser
  (`src/lib/web-guest-state.ts`) and shown on every tracking view until a
  password is set.

**Accepted or deferred:**

- *Anyone can mint an account on any number* (high). Inherent to booking with
  a number and no SMS; the plan's D2 named it. Mitigated by the global budget
  and the tighter "exists" match; a proper fix needs either an OTP provider or
  a provisional-account flag with shop-mediated recovery. Owner decision.
- *No recovery path for a guest who never set a password* beyond the
  remembered offer above. Same decision.
- `Pressable` navigations render without `href` on the web (no middle-click,
  nothing for crawlers). Phase 4 with the link-preview work.
- Enter does not submit the guest form (`PhoneField` has no submit prop).
- `register_with_shop_by_slug` does not refuse merchant accounts (low).

## Merge evidence

Checkpoints on `main`: `3623f93` (RED tests), `0ea426a` (GREEN domain), plus
the feature commit that follows the code review. Shared files that already
carried earlier uncommitted work (`src/lib/api.ts`, `docs/SETUP.md`,
`src/app/s/[slug]/index.tsx` from phase 1) are left in the working tree.
