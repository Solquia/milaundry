# Booking schedule — calm the second step

## The complaint

The schedule step showed twenty chips at once. Two pickers of identical shape,
each with four day chips and six hour chips, stacked one above the other, both
open, both already answered. A customer arriving at a decision they had already
been given a good default for was handed a wall to read anyway.

Three separate faults are tangled in that:

1. **Everything is open.** The defaults — today at 4 PM, back tomorrow at 4 PM —
   are right for most bookings. Nothing needed to be open for them.
2. **The turnaround is said twice.** The delivery leg carried a note that
   restated what the two slot summaries above it already implied.
3. **The delivery day can leave its own grid.** Moving pickup to the last
   bookable day pushed delivery to day 4, which the delivery picker never
   offered as a chip — so the leg rendered with nothing selected.

## What the code must now say

### RED — `turnaroundNote`

The wait, said once, in the words a shop counter uses. Not glued together from
the two dates the customer would otherwise subtract.

```
turnaroundNote(pickup d0, deliver d0)  → 'Back the same day we collect it.'
turnaroundNote(pickup d0, deliver d1)  → 'Back the day after we collect it.'
turnaroundNote(pickup d0, deliver d3)  → 'Back 3 days after we collect it.'
```

Delivery set before pickup is rejected by `validateBookingSchedule`, but this
label runs while the customer is still moving chips. It must not narrate a
negative wait.

### RED — `keepDeliveryAfterPickup`

Delivery always lands after pickup, and always on a day the delivery grid
actually offers.

```
pickup d0, deliver d2  → d2 unchanged      (already later; leave the choice alone)
pickup d2, deliver d1  → d3                (pickup overtook it; next day)
pickup d2, deliver d2  → d3                (same day is not "after")
pickup d3, deliver d9  → d6                (clamped to the last offered day)
```

The chosen hour survives every nudge. Only the day moves.

### RED — `deliveryDayOffsets`

The delivery grid is relative to pickup, not to today. Four days, so the 2×2
grid never orphans a fifth chip.

```
deliveryDayOffsets(pickup d0) → [0, 1, 2, 3]
deliveryDayOffsets(pickup d3) → [3, 4, 5, 6]
```

## GREEN — the screen

- Both legs collapse to a single row each: name, the chosen slot, a chevron.
  Twenty chips at rest becomes zero.
- Opening one leg closes the other. Ten chips is the most that can ever be on
  screen, and they belong to one question.
- The turnaround appears once, under the two rows, where it describes the pair.
- The payment card is gone. Its one useful sentence moved into the footer note,
  which on this step had been repeating the estimate step's sentence verbatim.
