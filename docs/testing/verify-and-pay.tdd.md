# TDD evidence — verify the price, ping the home screen, take the payment

**Source plan:** inline `/ecc:plan` run, 2026-08-28 ("verification process when
we send them the picture of the actual weight and the actual price and they can
be pinged on the home page … which will redirect them to the paying page").
Builds Phase 5 that [`weigh-and-settle.tdd.md`](./weigh-and-settle.tdd.md)
explicitly left unbuilt — `payment-proof.ts`, `submitPaymentProof`, and
`orderPhotoUrl` were all written, GREEN, and consumed by no screen.

## User journeys

1. As a customer, I want to see the photo of my laundry on the scale next to
   the actual price, so a number that moved reads as evidence, not a
   bait-and-switch.
2. As a customer, I want the home screen itself to tell me I owe money and how
   much, so I don't have to notice a badge on a bell.
3. As a customer, I want tapping that ping to land me where I can pay — the
   shop's real GCash/Maya/bank details — and to submit my receipt as proof.
4. As a shop, I want the customer's receipt and reference beside my "Mark paid"
   button, so confirming is a comparison against my own wallet, not a guess.

## Task report

### Task 1 — two domain modules, TDD-first

**RED.** Wrote `weigh-evidence.test.ts` and `home-attention.test.ts` before any
implementation (commit `f422e35`):

```
$ npx jest weigh-evidence home-attention
Cannot find module '../weigh-evidence'  from weigh-evidence.test.ts:1:1
Cannot find module '../home-attention'  from home-attention.test.ts:1:1
Test Suites: 2 failed, 2 total
```

Missing implementation, not a broken harness.

**GREEN** (commit `2f3c987`). Same command:

```
Test Suites: 2 passed, 2 total
Tests:       15 passed, 15 total
```

- `weigh-evidence.ts` shows the photo only when there is a confirmed price for
  it to back, and formats the scale reading without float drift.
- `home-attention.ts` derives the ping through the **same** `proofState` the
  pay screen reads, so the ping, the bell, and the screen it opens can never
  disagree about whether money is owed. Bills sort above receipts-in-review.

### Task 2 — wiring (commit `b544608`)

- **Evidence on the docket** — `(customer)/order/[id].tsx` renders the weigh
  photo inside the receipt paper, captioned ("Your laundry on the scale:
  7.5 kg"), through `orderPhotoUrl`'s signed link. `staleTime` is 45 min,
  under the link's one-hour TTL, so a screen left open refetches before the
  link dies.
- **The ping** — `(customer)/orders.tsx` mounts `AttentionBanner` rows straight
  under the hero: a bill in the app's action blue, a receipt-in-review in paper
  quiet. Tapping opens the order. Realtime invalidation of `['my-orders']`
  already existed, so the ping arrives live.
- **The paying page** — new `src/components/pay-sheet.tsx` replaces the static
  method chooser. Methods come from `payableMethods` (only rails the shop
  published, cash last); the chosen rail shows its account name and number in
  monospace; proof is a library screenshot + reference validated by
  `validateReference`; submission goes through `submit_payment_proof`, which
  deliberately does **not** mark the order paid. All customer-facing copy comes
  from `customerProofCopy`, which never claims money arrived.
- **The shop's side** — `ProofReview` in `(merchant)/order/[id].tsx` shows the
  screenshot and reference above `Mark paid`, with `merchantProofCopy`'s
  "check your own app before confirming".
- **API** — `ORDER_SELECT` now carries the shop's six payment-rail columns
  (additive; live since migration `0011`).

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | The photo is captioned with what the scale read | `weigh-evidence.test.ts:backs the actual price with the photo…` | unit | PASS | `npx jest weigh-evidence` |
| 2 | No photo → no evidence block, never a broken frame | `…:shows nothing when the shop took no photo` | unit | PASS | same |
| 3 | Evidence never appears for a price the customer hasn't been given | `…:shows nothing while the price is still an estimate` | unit | PASS | same |
| 4 | A missing scale reading degrades to a generic caption, never "null" | `…:still stands behind the price when the scale reading was not stored` | unit | PASS | same |
| 5 | Scale readings print without float drift | `formatKg:never prints float drift` | unit | PASS | same |
| 6 | The ping names the amount owed | `home-attention.test.ts:pings a weighed order with the amount owed` | unit | PASS | `npx jest home-attention` |
| 7 | No ping before weighing, after payment, for walk-ins or cancellations | three `stays quiet…`/`never pings…` tests | unit | PASS | same |
| 8 | A sent receipt becomes a quiet note, not a repeated demand | `…:turns a sent receipt into a quiet "being checked" note` | unit | PASS | same |
| 9 | A cash payer is still asked to settle, in counter words | `…:still asks a cash payer to settle` | unit | PASS | same |
| 10 | Owed money always outranks news, newest first within a kind | two ordering tests | unit | PASS | same |
| 11 | Rails, proof states, reference validation (already guaranteed) | `shop-payment.test.ts`, `payment-proof.test.ts` (prior session) | unit | PASS | `npx jest shop-payment payment-proof` |
| 12 | No regression across the app | `npx jest` | unit | PASS | **69 suites, 735 tests** |
| 13 | Everything typechecks | `npx tsc --noEmit` | typecheck | PASS | exit 0 |

## Coverage and known gaps

- `npx jest` — 69/69 suites, 735/735 tests (15 new).
- `npx expo lint` — only the pre-existing `splash-gate.test.ts:7`
  `import/no-unresolved` resolver quirk, documented across previous sessions.
- **`?pay=1` deep-link scroll was not built.** The ping navigates to the order
  screen, where the pay sheet is one screenful down; auto-scrolling to it was
  judged not worth the ref plumbing. Revisit if orders grow longer.
- **No push notifications.** The "ping" is in-app: home banner + bell +
  realtime invalidation. Expo push is future work.
- **Not verified from this session:** the device walkthrough — weigh on one
  phone, watch the banner arrive on another, send a real proof. No emulator
  here.
- **Commit hygiene note:** `(customer)/order/[id].tsx` and
  `(customer)/orders.tsx` carried uncommitted edits from parallel sessions;
  committing the files swept those in with `b544608`. The full suite and
  typecheck above ran against exactly that combined state. Another parallel
  edit to `(customer)/order/[id].tsx` (docket perforation/stamp work) landed
  after this session's validation run.

## Merge evidence

- RED: 2 suites failing on `Cannot find module` (`f422e35`).
- GREEN: 15/15 on the new suites (`2f3c987`), then 735/735 repo-wide and a
  clean typecheck after wiring (`b544608`).
- Refactor: none needed beyond the initial shape — both modules reuse
  `proofState` and `formatMoney` rather than restating their rules; the pay
  sheet reuses the weigh sheet's photo-frame pattern and the booking screen's
  friendly-error mapping.
