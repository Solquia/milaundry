# The schedule step — a month, with the time stated above it

## The problem

The day picker was four chips: today plus three. It was four because 2×2 is a
tidy grid, not because a laundry stops taking bookings on Thursday. A customer
who wanted collection a week out had no way to say so, and nothing on screen
admitted the limit was there — the window was a shape, not a statement.

The hours were another six chips below them, and the two rows repeated for the
delivery leg. Twenty chips, none of which said what the answer currently was.

## The change

The reference layout, in both flows:

```
┌───────────────────────┬───────────────────────┐
│ Pickup date           │ Pickup time           │
│ 📅 [Tue, Sep 15]      │ 🕐 4 PM  ⌄            │
├───────────────────────┴───────────────────────┤
│  ‹            September               ›       │
│  Su  Mo  Tu  We  Th  Fr  Sa                   │
│                   1   2   3   4   5           │
│   6   7  (8)  9  10  11  12                   │
│  13  14 [15] 16  17  18  19                   │
└───────────────────────────────────────────────┘
```

The strip states the answer — date left, time right — and each half is a door
back into the control that sets it. The month sits under it. Today unchosen is
**ringed**; the day actually picked is **filled**, so the two can never be
confused. Days outside the window are drawn and greyed rather than hidden: the
shape of what the shop accepts is now visible instead of inferred.

A month arrow that would land on a month with no bookable day is **hidden, not
disabled** — an arrow that pages to nothing has lied about there being more.

### The one product decision in here

`BOOKING_WINDOW_DAYS` is **30**, up from an effective 3. A calendar showing
four usable days out of thirty is worse than the chips it replaces, so widening
was implied by asking for a calendar. It is one named constant in
`booking-slot.ts` — change that line and both flows, the greying, and the
delivery clamp all follow. Flagging it because it changes what bookings shops
can receive, which is a shop's call and not a layout detail.

## RED → GREEN

### New module: `src/lib/domain/calendar-month.ts`

```
$ npx jest src/lib/domain/__tests__/calendar-month.test.ts
Cannot find module '../calendar-month'
Test Suites: 1 failed, 1 total
```

After implementation: **19 passed, 19 total.**

| # | What is guaranteed | Test | Result |
|---|--------------------|------|--------|
| 1 | Every row is seven cells, so the weekday header lines up | `lays the month out in whole weeks` | PASS |
| 2 | The first row pads to the weekday the month opens on | `pads the first row up to the weekday…` | PASS |
| 3 | Every day of the month appears exactly once | `holds every day of the month exactly once` | PASS |
| 4 | A day already gone cannot be booked | `will not let you book a day that has already gone` | PASS |
| 5 | The window's far end is the last selectable day | `stops at the end of the booking window…` | PASS |
| 6 | A floor above today works, which is how delivery stays after pickup | `honours a floor above today…` | PASS |
| 7 | "January" gains its year once paged out of this one | `adds the year once the calendar has walked…` | PASS |
| 8 | Paging rolls across the turn of the year both ways | `rolls into the next year…` / `rolls back…` | PASS |
| 9 | A month with nothing bookable reports itself empty | `is false for a month already behind you` | PASS |

### Changed spec: `keepDeliveryAfterPickup`

The old rule clamped delivery to within three days of pickup. That existed only
because the delivery leg was four chips wide, so a day without a chip rendered
as nothing selected. The calendar has no such gap, and the clamp was quietly
undoing a customer asking for a longer turnaround.

```
$ npx jest src/lib/domain/__tests__/booking-slot.test.ts   # after editing the spec
  × leaves a delivery a week out where the customer put it
  × clamps to the far end of the booking window
```

After the implementation change: **18 passed, 18 total.** A delivery nine days
out now stays at nine; only one past the window is pulled back, and the hour the
customer chose is never moved.

## Verified in the browser

Driven live at `localhost:8081/s/sparkle-clean/book` (Sep 8, 2026):

- Sep 1–7 render as `disabled` buttons carrying real date labels
  (`button "Tue, Sep 1" disabled`); Sep 8 announces as `Today`, Sep 9 as
  `Tomorrow`, the rest as dates.
- Only `Next month` exists on September — the back arrow is absent, because
  August holds no bookable day.
- Paging to October: 1–8 selectable (Oct 8 is day 30), **9 onward greyed**, the
  back arrow appears and the forward arrow disappears.
- Tapping Sep 15 moves the pill to `Tue, Sep 15` and the fill from 8 to 15,
  leaving 8 ringed as today.
- Tapping `Pickup time, 4 PM` opens the six hours and closes on choosing one.

## Reuse rather than re-implementation

- `Slot { dayOffset, hour }` is unchanged. Every cell carries its own offset, so
  the calendar is a way of *choosing* an offset rather than a second model of
  time that could drift from the validator's.
- `dayLabel` / `hourLabel` / `slotSummary` (`booking-slot.ts`) still write every
  label, including the accessibility labels on the day squares.
- One `SlotCalendar` serves both flows. The storefront passes its shop's accent
  and nothing else; the neutrals stay the app's, so a pale brand cannot make an
  unbookable day look bookable.
- `DELIVERY_DAY_SPAN` and `deliveryDayOffsets` were deleted with their tests
  rather than left dormant, along with the chip styles in both screens.

## Accessibility

- Each square is a button labelled with its full date; days outside the window
  carry `accessibilityState={{ disabled: true }}` and are genuinely disabled.
- The time is a disclosure with `accessibilityState={{ expanded }}` and a hint.
- Month arrows are 44×44 — the smallest targets on the screen — and the space
  one would occupy is held when hidden, so the month name stays centred.
- Today is marked by a ring and the selection by a fill: shape as well as
  colour.

## Whole-suite check

```
$ npx tsc --noEmit    # clean
$ npx eslint <changed files>   # clean
$ npx jest            # 103 suites, 1174 tests passed
```

## Left alone, deliberately

- **The native booking screen keeps its two legs behind disclosure rows**, with
  the pickup leg open on arrival. Two month grids permanently stacked is a lot
  of screen; one open at a time keeps the step to a phone's height.
- **Delivery may still be booked for the same day as pickup**, at a later hour.
  The validator already requires `deliverBy > pickupAt`, so a same-day
  turnaround is a real answer rather than a hole.
