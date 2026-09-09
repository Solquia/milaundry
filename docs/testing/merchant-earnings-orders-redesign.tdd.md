# TDD evidence — Earnings, Customers, Orders and the order screen

**Request (2026-09-06):** "make the analytics Ui/UX much more better on the
owners side plus … customers insight LTV, and filters on the analytics. And on
the orders management aswell … and also the management of the ORder … make it
feel like made by a million dollar brand. Dont make it too flashy."

## What was wrong

- **Earnings** showed one day and nothing else: no period to choose, no
  comparison, no shape of the week, nothing about where the money came from,
  and customers were two numbers in a card.
- **Customers** listed only people who had scanned the QR — the minority for
  a walk-in laundry — under a 220-point QR code the owner shares once a month.
  No lifetime value, no search, no sort.
- **Orders** had five same-weight chips that wrapped to two rows and scrolled
  away, no search, no counts, a header that said "Orders" under a tab that
  said "Orders", and a card whose badge, tags and time were silent to a screen
  reader (see `.impeccable/critique/2026-08-28…orders-tsx.md`).
- **The order screen** opened with the one line nobody can read (`Order
  #4b141b63`), buried the customer's name in the third card, tracked stages
  with ✓ ● ○ glyphs and no times, and put the one button that moves the
  order on at the bottom of six cards.

## The redesign

| Screen | What is on it now |
|---|---|
| Earnings | Period chips (Today · 7 · 30 · 90 days · All time) · tinted hero with the collected figure, a change pill against the previous period, and a bar trend · four tiles (orders taken, average order, still to collect, expected today / payments) · money by source and by payment method · top five services · customer summary (count, repeat rate, average lifetime value, new this month) with the top three by lifetime value |
| Customers | Folded QR row · four summary tiles · search · segment chips with counts (Everyone / New / Regulars / Owe money / Not seen lately) · sort (Top spenders / Most recent / Most visits) · rows with initials, visits, last order, lifetime value and what they owe |
| Customer detail (new route `customer/[key]`) | Hero with initials, standing, call / text pills, first and last visit · lifetime value, orders, average order, still owes · every order of theirs |
| Orders | Pinned headline ("3 in the shop · 1 ready for pickup · ₱440.00 to collect") · search by name, number or ticket · view chips with counts (In the shop / Ready / Unpaid / Done / All) · source facet · list grouped Today / Yesterday / named days · card with the total as the largest figure, amber only while owed, "Estimate" as a chip, and a full spoken label · the chosen view survives a trip to another tab |
| Order | Hero (name, total, badges, call / text pills, delivery, notes) · timeline rail with the time each stage was reached from the status history · the ticket on receipt paper · weigh sheet · payment · pinned footer with the next step |

Pure logic, all new and tested: `domain/analytics-range.ts`,
`domain/earnings-summary.ts`, `domain/customer-insights.ts`,
`domain/order-board.ts`, plus `searchDigits` in `domain/phone.ts`.
`STATUS_LABELS` moved from the UI kit into `domain/order-status.ts` (the kit
re-exports it) so the board can speak a status without importing React Native.

New components: `chip-row`, `search-field`, `stat-tile`, `trend-bars`,
`share-rows`, `section-heading`, `customer-row`, `order-card`, `order-hero`,
`order-timeline`, `order-lines`, `collect-payment` (the payment sheet and
proof review moved out of the order screen), `contact-pills`, `shop-qr-card`.

## Decisions worth knowing

- Lifetime value is everything billed across non-cancelled orders, paid or
  not; what is owed sits beside it. Identity is the account, else the phone
  digits, else the name, so walk-ins count.
- Money is counted by the day it was paid, orders by the day taken — the same
  split `daily-analytics` already made. Receivables ignore the period.
- "Today" borrows the surrounding week for its trend so a single bar is not
  alone; 90 days rolls into weeks, all time into the last twelve months.
- Standing: lapsed after 45 days without an order, regular from three orders,
  returning at two, new at one.
- No chart library. Bars are plain views; green is the app's "money in".

## Task report

**RED.** Four test files were written before their modules existed:

```
Cannot find module '../order-board' …
Cannot find module '../customer-insights' …
Cannot find module '../earnings-summary' …
Cannot find module '../analytics-range' …
Test Suites: 4 failed, 4 total
```

**GREEN.** One honest failure on the way: a search for `0917 123` did not
match a stored `+639171234567`. Fixed with `searchDigits`, which drops a
leading `63` or `0` from both sides before comparing.

```
$ npx jest src/lib/domain
Test Suites: 74 passed, 74 total
Tests:       846 passed, 846 total
```

**Whole suite, type-check, lint** after the screens and components landed:

```
$ npx tsc --noEmit -p tsconfig.json      (exit 0, no output)
$ npx eslint src/app/(merchant) src/components/… src/lib/domain   (no output)
$ npx jest
Test Suites: 78 passed, 78 total
Tests:       871 passed, 871 total
```

## Not verified here

No emulator or device was available in this session, so the screens were not
run; layout was reasoned from the existing components' measurements. The
`customer/[key]` route relies on expo-router decoding the URL-encoded key
(`acct:…`, `tel:…`, `name:…`) back into the search param.
