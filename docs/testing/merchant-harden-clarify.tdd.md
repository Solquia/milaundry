# Merchant dashboard: harden + clarify

Follow-up to the `/impeccable critique` of the merchant dashboard
(`.impeccable/critique/2026-08-26T02-48-10Z__src-app-merchant.md`, 16/40).
Addresses both P0s, both P1s, the P2, and the robustness defects.

## RED

Four new domain suites written before any implementation:

| Suite | Covers |
|---|---|
| `money.test.ts` | thousands grouping, negatives, NaN fallback |
| `cash-payment.test.ts` | change, shortfall, tender parsing, tender ladder |
| `order-quantity.test.ts` | per-unit ceilings, float-drift-free steps |
| `confirm-prompts.test.ts` | prompt copy for cancel / remove / mark-paid / sign-out |

Verified failing before implementation:

```
Test Suites: 4 failed, 4 total
Tests:       4 failed, 1 passed, 5 total
```

Three suites failed to resolve their module (`Cannot find module '../cash-payment'`);
`money.test.ts` ran and failed on grouping, with only the sub-thousand case passing.

`daily-analytics.test.ts` was extended with two cases for `paymentsToday`,
which fail against the old four-field `DailyMoney`.

## GREEN

```
Test Suites: 38 passed, 38 total
Tests:       314 passed, 314 total
```

`npx tsc --noEmit` clean. `npx expo lint` clean (the three
`import/no-unresolved` errors it first reported were a stale
`.expo/cache/eslint`; direct `npx eslint` on the same files was always clean).

## What changed and why

### Safety — every destructive action is now guarded

- **Cancel order** (`order/[id].tsx`) — was a full-width danger button directly
  under the button the owner meant to press, no dialog, and `order-status.ts`
  has no reverse transition. Now a text link set apart from the button stack,
  behind a confirmation naming the order and the amount.
- **Remove from price list** (`services.tsx`) — one tap deleted a price. Now
  confirmed, naming the service, and stating that past orders keep their price.
- **Sign out** — was a bare `Subtle` text link at the end of the scrolling
  order list, so its screen position moved with the number of orders; on a
  quiet day it landed in the thumb arc. Removed, and replaced with a real
  Settings screen behind a `headerRight` gear.
- **`headerRight` did not exist on any merchant screen.** The grey gear in the
  production screenshots was the Expo dev-client button, which does not ship in
  a release build — the app had no account affordance at all.

### The money moment

`order/[id].tsx` had `<Button title="Mark as paid" />`: no amount, no method,
no cash arithmetic, no confirmation, and a silent re-render as the only
feedback. Replaced with a payment sheet: amount due as the card's one hero
figure, three common methods with the rest behind a disclosure, cash tender
chips plus free entry deriving change, a confirmation titled with the amount,
and an announced result.

There is deliberately **no undo** — the backend exposes no reverse-payment
call, so the confirmation before the fact is the safeguard. Adding an
`unmark_order_paid` RPC would let a real undo replace it.

`formatMoney` now groups thousands (`₱2,841.00`), and the payment line uses
`PAYMENT_LABELS` instead of `order.payment_method.toUpperCase()`, which was
showing owners `BANK_TRANSFER`.

### Robustness

- `orders.tsx` — `FlatList` with pull-to-refresh replaces a mapped
  `ScrollView` that re-rendered every order the shop had ever taken on a
  15-second poll. The meta line wraps to two lines so the phone number is no
  longer the first thing truncated at 360dp.
- `order/[id].tsx` — a deleted or mistyped id rendered an infinite spinner;
  now a not-found state with a way back. Load failures get a retry.
- `pos.tsx` — a failed shop lookup rendered as "No shop assigned", reporting a
  network problem as a provisioning one. Now distinguished.
- `services.tsx` — the list query's `error` was never destructured, so a failed
  fetch showed the "Start your price list" upsell. Now surfaced with retry.
- `service-order-form.tsx` — quantities are clamped per unit (unbounded before:
  fifty taps gave 25 kg with no check); a pricing failure is stated instead of
  swallowed into a `null` that looked identical to "nothing selected" while
  Save stayed enabled; the ± buttons carry accessible labels.
- `ui-kit.tsx` — `keyboardShouldPersistTaps="handled"` (the first stepper tap
  after typing a name used to be eaten dismissing the keyboard, with no way for
  the owner to tell); `SafeAreaView` limited to side edges to stop
  double-insetting under the header and tab bar.

### Accessibility

- All `StatusBadge` backgrounds now clear 4.5:1 against white 12px text.
  `folded` (3.8:1) and `ready` (3.2:1) previously failed.
- `drying` moved from a second purple to orange: `washing` and `drying` are the
  two states read most often and were the same badge at arm's length.
- `Tag` text darkened to clear AA; the alert style keys off the exported
  `UNPAID_TAG` rather than a bare string literal that a copy change would break.
- "Edit" in the price list is a `Pressable` with a role and a 12pt `hitSlop`
  instead of a `Text` with `onPress` (invisible to TalkBack, ~17pt target).
  Filter and category chips raised to a 44pt effective target.

### Clarify

- Analytics: `Collected today` now reports the payment count alongside the
  amount, and `Orders today` became `Orders taken today`. The pair
  "₱2,841.00 collected / 0 orders" is arithmetically correct — collections key
  off `paid_at`, counts off `created_at` — but read as a money screen
  contradicting itself. The screen also carries an explicit date.
- Empty states name the state and offer the action where one exists.
- Errors name what failed and what to do, instead of printing a raw backend
  string with nothing to press.

## Not addressed here

Out of scope for `harden` + `clarify`, still open from the critique:

- **[P0] The FAB points at Customers, not at taking an order** (`tab-config.ts:17`).
- **[P1] POS is an unstructured scroll** — needs `groupServicesByCategory` and a
  sticky total. `Screen` now accepts a `footer` prop the sticky total can use.
- Analytics has no chart or trend.
- Dark mode: `app.json` declares `userInterfaceStyle: "automatic"` and `src/`
  never reads the color scheme.
- Type and spacing scales exist in `ui-kit.tsx` but the screens still carry
  inline literals.

## Second pass: colour, then plain language

After the first pass the owner's audience was named explicitly: a laundry shop
owner who is not technical. Two follow-up passes ran against that.

**Colorize.** Colour was given three jobs and nothing else — you can act here
(blue), money came in (green), money is still owed (amber). The blue had been
spent on every outline button, link and *unselected* chip, so nothing was
louder than anything else; it is now rare, and `#208AEF` was split into an
identity blue (large marks only, 3.5:1) and an `action` blue whose white label
clears 4.96:1. Status badges are ranked by urgency rather than decorated per
state, with "Ready for pickup" the loudest badge in the app. All 30
foreground/background pairs computed and passing — see the sweep in the
session log; washing vs drying went from an RGB distance of 24 to 217.

`app.json` moved from `userInterfaceStyle: "automatic"` to `"light"`: nothing
in `src/` ever read the colour scheme, so "automatic" meant the OS darkened
system chrome while every app surface stayed white.

**Clarify.** Tab labels became words a shop owner says out loud — POS →
**New Order**, Analytics → **Earnings**, Services → **Prices** (route names
unchanged). Status badges lost their ambiguity: "Pending" → "Not started",
"Received" → "In the shop" (received *what* — the laundry or the money?),
"Delivered / picked up" → "Done". Advance buttons stopped being built from
state names — `advanceActionLabel` gives each transition its own verb, so
"Mark as In the shop" became "Laundry received", "Start washing",
"Handed to customer".

New `merchant-error.ts` (sibling of `booking-error.ts`) ends the practice of
printing Postgres constraint names and PostgREST codes to a shop owner. Each
failure now names what did not happen and what to do; a connection failure says
so; a message the shop's own rules produced passes through.

```
Test Suites: 41 passed, 41 total
Tests:       343 passed, 343 total
```

`tsc` clean, `expo lint` exit 0.

## Note on tooling

Impeccable's `detect.mjs` returns `[]` / exit 0 on this codebase, and that is a
false negative rather than a pass: its rules match CSS kebab-case
(`font-family:`, `border-radius:`) and React Native `StyleSheet` uses camelCase.
Verified by planting detectable antipatterns in a probe `.tsx` (no findings)
that fired correctly in a `.html` file. Do not read a clean detector run here as
a signal.
