# Web storefront, phase 3: receipt claim on the web — TDD evidence

## Source plan

`docs/plans/web-storefront.md`, phase 3. The owner's instruction was "proceed
with phase 3" (2026-09-08). Phases 1 and 2 have their own reports beside this.

## User journeys

1. As a walk-in customer with no app, I want to point my phone camera at the
   code on the docket and follow that load, giving only my name and number.
2. As the customer who already holds the load, I want scanning the docket
   again to open my order, not to tell me the code is dead.
3. As anyone else holding that docket, I want to be told the load is on
   another account rather than be shown it.
4. As a customer with the app, I want the new code to scan exactly as the old
   one did.

## Task report

### Task 1 — The code and the slip (RED then GREEN, commits de3d7cf and 76efd4d)

`npx jest src/lib/domain/__tests__/{qr,receipt,web-claim}.test.ts`

- **RED**: `Tests: 2 failed, 28 passed`, plus `Cannot find module '../web-claim'`.
  The qr test now expects `https://milaundry.app/claim/<id>?token=…`; the
  receipt test expects the same value in the printed slip and a line that
  mentions the camera.
- **GREEN**: with the escpos and printer suites alongside, `57 passed`.
  `buildOrderQr` delegates to `claimUrl`; the slip reads "Scan with your phone
  camera / to follow this order online"; `web-claim.ts` supplies the page's
  headline, invitation, and button label, including the wording for a claimed
  receipt whose shop the peek no longer names (one test added after the
  browser check exposed "Your laundry at your laundry shop").

Journey 4 is covered by the existing parser tests: `/claim/<id>` and the old
`milaundry://order/<id>` both parse to an order code.

### Task 2 — The page (`src/app/claim/[id].tsx`)

`peek_scan('order', id, token)` names the shop and sets the theme for an
unclaimed load. A guest gives a name and number (the phase 2 form), then
`claim_order` runs and the tracking page opens. A signed-in visitor gets one
button. When the peek is empty the claim is still offered: the server makes
it idempotent for the holder and refuses everyone else, and `scanFailure`
from the app supplies the words. A malformed link (non-UUID id or token,
repeated `token=`) gets "This code is incomplete" without a request.

### Task 3 — A regression from the phase 2 review fix (`src/lib/auth.tsx`)

The cache clear on user change also fired on `INITIAL_SESSION`, which races
`getSession` on page load, so any signed-in page could clear its first query
mid-flight and sit on a spinner. Found when the holder re-opened the claim
link. The clear now runs only when a previous user existed and differs, which
also covers a start-up token refresh and the guest's own sign-in.

### Task 4 — Docs

`docs/SETUP.md` §6 and §7 describe the printed value and the claim page. Plan
status updated.

## Verification

- `npx jest` — 91 suites, 1029 tests, all pass (re-run after the review fixes).
- `npx tsc --noEmit` — clean. `npx eslint` on the changed files — clean.
- `npx expo export -p web` — succeeds (twice: before and after the auth fix).
- **Browser, on the exported build served with a SPA fallback**. A walk-in
  order was inserted by SQL for the seeded shop (`customer_id` null, 3 kg
  wash-and-fold, ₱528):
  1. Fresh context, `/claim/<id>?token=<claim_token>` → "YOUR RECEIPT / Your
     laundry at Sparkle clean" with the tagline, the invitation, name and
     number fields, "Follow this order", and a link to the shop's page.
  2. "Claim Guest", 917 000 0555 → landed on the tracking page: "Your laundry
     is at the shop", steps with "At the shop" current and the pickup-flavoured
     endings, the line and total, the password card. No console errors.
  3. Database: `customer_id` set, `claimed_at` stamped, `customer_phone`
     filled from the profile by the 0015 trigger, `customer_shops` row present.
  4. Same context, the claim link again → first a permanent spinner (the auth
     regression above); after the fix and a re-export, "Open this order" → the
     tracking page (idempotent for the holder).
  5. Second context, `/track/<id>` → guest form → a different number → "We
     can't find this order for your number".
  6. That second account on the claim link → "Open this order" → "This
     receipt's load is already on another account. Ask the shop if that
     isn't right."
- Test order, its items, and both test accounts were deleted afterwards.

## Test specification

| # | What is guaranteed | Test | Type | Result |
| --- | --- | --- | --- | --- |
| 1 | The receipt code is the https claim link | `qr.test.ts` receipt code | unit | PASS |
| 2 | The printed slip carries that link and tells people to use a camera | `receipt.test.ts` ends with the claim QR | unit | PASS |
| 3 | Old `milaundry://order` codes and `/claim` links both parse | `qr.test.ts` parser cases | unit | PASS |
| 4 | Page copy names the shop, or reads well without one | `web-claim.test.ts` (4) | unit | PASS |
| 5 | A guest claims a walk-in from the docket link and follows it | browser 1–3 | E2E (manual) | PASS |
| 6 | The holder re-opening the link gets the order | browser 4 | E2E (manual) | PASS |
| 7 | Another account is refused, on the track page and on the claim page | browser 5–6 | E2E (manual) | PASS |

## Coverage and known gaps

- Receipts printed before this change carry the deep-link value; the app
  reads both, a phone camera reads only the new one.
- The claim page has no automated test; the two server rules it relies on
  (0016, 0017) are exercised in the browser only.
- The review fixes below were verified by typecheck, lint, and the full suite,
  not by a third browser pass.

## Code review

Reviewed by the code-reviewer agent (opus). No critical findings; one high,
two medium, two low.

**Fixed:**

- The cache-clear guard skipped only `INITIAL_SESSION`; a start-up token
  refresh or the guest's own `SIGNED_IN` could still wipe a page's first query.
  It now clears only when a previous user existed and differs.
- The `?welcome=1` redirect offered "set a password" to accounts that already
  had one. Both the booking and claim pages now redirect plainly, and the
  tracking page relies on the browser-remembered flag alone.
- The claim page validates the id and token shape before any request and
  coerces a repeated `token=` to its first value.
- A failed claim from the guest form now surfaces in the form's own error
  slot rather than above a form that looked ready to resubmit.

**Owner decision:**

- The receipt link is a bearer credential: anyone holding a photographed or
  forwarded docket can now claim an unclaimed walk-in from a browser, without
  the app, and then read the name, number and address on it. The reviewer
  suggests expiring `claim_token` after the order completes, or asking for the
  last digits of the number the shop recorded. Same family as phase 2's
  number-squatting decision.

## Merge evidence

Checkpoints on `main`: `de3d7cf` (RED), `76efd4d` (GREEN), then the feature
commit after the review.
