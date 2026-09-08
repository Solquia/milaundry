# Placing an order — a rail that counts its steps by name

## The problem

Both booking flows were multi-step forms that would not say how many steps they
had.

The native screen (`src/app/(customer)/book/[serviceId].tsx`) drew two flat
bars; the web storefront (`src/app/s/[slug]/book.tsx`) drew three. Each filled
left to right as the customer advanced. That is the whole vocabulary of a
progress bar: *there is more after this*. It cannot say how much more, it cannot
say what the next question will ask, and — because the only way back was a Back
button that moved exactly one step — it cannot say that an answer already given
is still yours to change.

The native flow also ended one step too early. The last thing before `Book now`
was the schedule picker. Nothing ever read the booking back: not the items, not
the weight, not the address the laundry was about to be collected from.

## The change

A numbered, named rail, shared by both flows:

```
1. Items      2. Schedule     3. Review
━━━━━━━━      ━━━━━━━━        ────────
```

The step you are on and the ones behind it are underlined in the brand colour
and set in the heavier cut; the ones ahead are grey. A finished step is a
button back to itself. A step ahead is not rendered as a button at all — three
controls where only one does anything is worse for a screen reader than one.

The native flow gained the review step it was missing: the laundry as priced
lines, the pickup and delivery windows, and the address, read back before a
final button that now says **Place order** rather than *Book now*. The web flow
keeps its own three questions (Items, Schedule, Details) and drops its
`Next: schedule` / `Next: your details` button labels for a plain **Continue** —
the rail already names what comes next, and the button was repeating it.

### On the colour

The reference this was modelled on is green throughout. The palette here is
not: `colors.action` and the per-shop storefront accents are checked against
their real backgrounds in `design-scale`/`ui-kit`, and swapping the brand hue
would have been a separate decision with its own contrast work. What was adopted
is the **structure** — the numbered rail, the sectioned white cards under it,
the single full-width primary action pinned at the bottom, and the closing
review step. Each flow keeps its own accent: the rail takes `reached` from the
caller and holds the neutral greys itself, so a pale shop brand cannot make the
steps still ahead unreadable.

## RED → GREEN

New domain module `src/lib/domain/step-rail.ts`. Tests written first and run
failing before any implementation existed:

```
$ npx jest src/lib/domain/__tests__/step-rail.test.ts
Cannot find module '../step-rail' from 'src/lib/domain/__tests__/step-rail.test.ts'
Test Suites: 1 failed, 1 total
```

Then, after implementation:

```
$ npx jest src/lib/domain/__tests__/step-rail.test.ts
  stepRail
    √ numbers each step in the label, so the rail counts out loud
    √ marks the step you are on, what is behind it, and what is ahead
    √ lets you go back to a step you finished, but never skip ahead
    √ has nothing behind it on the first step
    √ leaves nothing ahead on the last step
    √ treats a step it does not know as no step at all
  stepAnnouncement
    √ says the position and the name, because a screen reader cannot see the underline
    √ says nothing when the step is not on the rail
  nextStep
    √ advances one step
    √ stops at the end rather than wrapping to the start
  previousStep
    √ goes back one step
    √ has nowhere to go from the first step

Tests: 12 passed, 12 total
```

### What the cases are defending

| # | What is guaranteed | Test | Type | Result |
|---|--------------------|------|------|--------|
| 1 | The rail states a count and a name, not just a fill level | `step-rail.test.ts:numbers each step in the label` | unit | PASS |
| 2 | Exactly one step is current; everything before it is done | `step-rail.test.ts:marks the step you are on…` | unit | PASS |
| 3 | You may walk back to a finished step and never skip forward | `step-rail.test.ts:lets you go back…but never skip ahead` | unit | PASS |
| 4 | An unknown step lights nothing rather than guessing | `step-rail.test.ts:treats a step it does not know…` | unit | PASS |
| 5 | The rail announces "Step 2 of 3: Schedule" to a screen reader | `step-rail.test.ts:says the position and the name` | unit | PASS |
| 6 | The last step does not wrap to the first | `step-rail.test.ts:stops at the end rather than wrapping` | unit | PASS |

- **Back, never forward.** Tapping *3. Review* from step one would jump the
  schedule's validation gate. Tapping *1. Items* from step two is only changing
  your mind about the laundry. The rule lives in the domain module rather than
  in the component because two screens draw this rail, and a rule that lives in
  one of them is a rule the other eventually breaks.
- **Never wraps.** If `nextStep` wrapped, the last tap in the flow — the one
  that places the order — could become a jump back to the top. That is the one
  ambiguity this screen cannot afford.
- **An unrecognised step lights nothing.** A rail that guessed would underline
  the wrong tab, and a customer who trusts a wrong count is worse off than one
  shown no count at all.

## Reuse rather than re-implementation

- `validateBookingSchedule` (`booking-schedule.ts`) was already the gate before
  `Book now`; it is now also the gate between Schedule and Review. The two
  copies of its call in the native screen were folded into one
  `settledSchedule()` helper that returns the validated value or opens the leg
  that is wrong.
- `buildBookingItems` (`booking-estimate.ts`) builds the review's lines — the
  same function the order is placed with, so the review cannot quietly disagree
  with what is sent.
- `slotSummary` (`booking-slot.ts`), `formatQuantity` / `formatPriceLine`
  (`price-label.ts`), `formatMoney` (`money.ts`) for the read-back.
- The flat-bar styles (`progress`, `progressBar`, `progressBarOn`) were deleted
  from both screens rather than left dormant.

## Accessibility

- The rail carries `stepAnnouncement` as its `accessibilityLabel` — an underline
  is invisible to a screen reader, and numbered labels alone leave a listener
  counting tabs.
- Finished steps are `accessibilityRole="button"` labelled `Go back to 2.
  Schedule`. Current and upcoming steps are plain views.
- The current step is distinguished by weight as well as colour
  (`type.label.fontFamily`), so it is not colour alone that marks position.
- A schedule that has gone stale while the review sat open sends the customer
  back to the step that can fix it, instead of failing under the last button.

## Verification

```
$ npx tsc --noEmit                       # clean
$ npx eslint <changed files>             # clean
$ npx jest                               # 102 suites, 1149 tests passed
$ npx jest --coverage --collectCoverageFrom=src/lib/domain/step-rail.ts
  step-rail.ts | 100 % stmts | 100 % branch | 100 % funcs | 100 % lines
```

## Left alone, deliberately

- **The palette stays blue.** See *On the colour* above.
- **The web flow's third step is still Details, not Review.** Its last step is
  where a guest becomes a customer; putting a read-back in front of the sign-up
  would add a screen between a name and the order it belongs to. The web cart is
  already itemised on step one and the total is pinned in the footer throughout.
- **The reference's detergent and fabric-softener pickers were not adopted.**
  This shop's catalogue has no such options; adding empty controls to match a
  screenshot would be a form asking questions it cannot use.

---

## Update: the rail was removed from the web flow

The storefront band already names the current step in full — *What are we
washing?* / *When and where?* / *Who is this for?* — directly above where the
rail sat, and the footer already carries Back and Continue. Three numbered tabs
under a heading that says the same thing in a sentence is one statement too
many, so the rail is gone from `s/[slug]/book.tsx`.

The native booking screen keeps it. Its header carries the service name and
price, not a step title, so there the rail is the only thing that says how many
questions are left — it is not repeating anything.

`STEPS` stays in the web file: `previousStep` reads it for the Back button, and
it remains the one place the order of the three questions is written down.
