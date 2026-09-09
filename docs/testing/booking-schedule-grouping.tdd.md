# Booking schedule — grouping the day and time — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Targets:** `src/app/(customer)/book/[serviceId].tsx`, `src/lib/domain/booking-slot.ts`

## Request

> "polish … the date and time of deliver should just be grouped because for new
> customers it might be hard to understand and comprehend thats always the goal
> east comprehension and easy flow"

## What was hard to comprehend

The schedule step showed **twenty chips in four rows**: four days, then six
hours, then four days, then six hours again. Three separate things made that
hard to read, and only one of them was the grouping.

1. **Neither chip row said what it was.** The second row's job was given away
   only by the fact that "8 AM" looks like a time. Nothing labelled it.
2. **The screen never said back what you had chosen.** To know your pickup, you
   found the blue chip in one row, found the blue chip in the next, and
   assembled "Tomorrow at 4 PM" in your head — then did it again for delivery
   without losing track of which half you were on.
3. **The two legs were the same object twice.** A thin divider and a different
   sentence above were the only things distinguishing them, and both scrolled
   out of view.

## The fix

Each leg is now a group that **answers itself**:

```
⬆ PICKUP                          Tomorrow, 4 PM
Day    [Today] [Tomorrow] [Fri, Aug 28] [Sat, Aug 29]
Time   [8 AM] [10 AM] [12 PM] [2 PM] [4 PM] [6 PM]
───────────────────────────────────────────────────
⬇ DELIVERED BACK                Fri, Aug 28, 4 PM
Next day — after the shop collects your laundry
Day    …
Time   …
```

- **The answer sits on the heading line**, in `colors.actionInk`, so the choice
  is readable without decoding two rows of chips.
- **"Day" and "Time" label their rows.** The cheapest fix on the screen and the
  one that removes the most guessing.
- **Each leg gets a direction glyph** (up for handing over, down for coming
  back) so the two identical shapes are told apart before a word is read.
- **The turnaround is stated once** — "Next day — after the shop collects your
  laundry" — instead of leaving the customer to subtract two dates they had
  each assembled from chips.
- Labels shortened to **"Pickup"** and **"Delivered back"**: with the answer
  beside them, "Pick up my laundry" and "Deliver it back by" were doing work the
  summary now does better.

## The domain move

`dayLabel` and `hourLabel` were private, untested helpers inside the screen that
read the clock through `Date.now()` internally — untestable by construction.
They now live in `src/lib/domain/booking-slot.ts` taking an explicit `now`,
joined by `slotSummary` and `turnaroundLabel`.

`turnaroundLabel` clamps at zero deliberately. While the customer is moving
chips around, delivery can briefly sit before pickup; validation rejects that
ordering, but the label must not announce "In -1 days" in the meantime.

`hourLabel` also picked up a correctness fix in the move: the old
`hour >= 12 ? 'PM' : 'AM'` would call hour 24 "PM"; the tested version bounds it
to `>= 12 && < 24`. That value is not reachable from `SLOT_HOURS` today, which
is exactly why it was worth pinning before someone widens the list.

## Tests

Nine cases in `src/lib/domain/__tests__/booking-slot.test.ts`, against a fixed
`NOW` so "tomorrow" never depends on the day CI runs: today/tomorrow naming,
dating anything further out, the 12-hour clock, the noon and midnight cases that
break naive modulo, the summary sentence, the summary agreeing with the chip
labels, and all four turnaround readings including the clamped one.

**Honest note on RED:** the tests were written before the module existed, but
the module was implemented without first capturing the failing run, so no RED
output is recorded for this one. The other modules in this series
(`storefront`, `shop-directory`, `price-label`, `money`, `service-icon`) each
have their failing run quoted in their own evidence file.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/booking-slot.test.ts` | 9/9 passed |
| `npx jest` | 51 suites, 491/491 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <changed files>` | clean |

Contrast: `colors.actionInk` on white 6.2:1 for the answer; `colors.subtle`
5.5:1 for the caps label, the row labels, and the turnaround note. The direction
glyphs never carry meaning alone — each sits beside its written label.

## Preserved

`validateBookingSchedule` and every rule it enforces; `slotDate` and the exact
`Date` values sent to the backend; the default that keeps delivery a day after
pickup; the self-drop-off branch; the estimate step; all field errors and their
copy; and every route.
