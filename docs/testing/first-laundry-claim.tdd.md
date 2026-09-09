# The claim — connecting to a laundry — TDD evidence

**Date:** 2026-08-27
**Branch:** main
**Targets:** `src/lib/domain/connection-welcome.ts`, `src/components/claim.tsx`,
`src/app/(customer)/shop/[id].tsx`, `src/app/(customer)/shops.tsx`

## Request

> "delight the first ever store to be connected to when the customer connects to
> a store, every add or connect of the customer add a delight"

## The thesis

Connecting should feel like a machine accepting your load: the shop's mark takes
the colour it will wear on your home screen from now on, and rings of water push
out from under it. The **first** laundry a customer ever connects to is a
different event from the fifth — before it the app has nowhere to send a load and
every screen is a preview — so it gets the same gesture at a larger amplitude.

Not confetti. A laundry app that throws paper has borrowed someone else's idea of
joy; the ring of water is already the shopfront's own motif on arrival.

## The proportion

| | first laundry | every later connect |
|---|---|---|
| rings leaving the mark | 3, 170ms apart — a rinse | 1 |
| haptic | success notification | commit (Medium impact) |
| welcome card | shop's accent across the whole card, 2px hairline, 20px heading | white card, 1px accent hairline, 17px heading |
| heading | "Sparkle Wash is your first laundry" | "You're connected to Sparkle Wash" |
| second line | what the customer now owns | where this shop sits among the ones they already have |

The mark's flood and swell are identical in both. Only amplitude changes, so the
fifth connection reads as the first one's quieter sibling rather than as a
different product.

**No badge.** An eyebrow reading "Your first laundry" above a heading saying the
same thing is the heading admitting it cannot carry itself. The milestone lives
in the heading and in the card's weight — felt, not read.

## What was worth testing

The rank, the words, the tap, and the ring count live in
`src/lib/domain/connection-welcome.ts`, apart from the view, because the
*proportion* is the design decision and it is the thing that would drift.

**The real defect this prevents is a false milestone.** Telling a customer
"Sparkle Wash is your first laundry" on their fifth is worse than saying nothing
special at all, so `connectionRank` returns `'first'` only on an exact integer
zero: a negative, a fraction, or a `NaN` from a failed query all fall back to the
quieter moment. `welcomeNote` applies the same rule to the count it prints —
given `NaN` its body contains no digit at all rather than "alongside the NaN
laundries already on your home screen".

Three more invariants are pinned rather than left as intentions:

- "the one laundry already" at a prior count of 1, never "the 1 laundries";
- both ranks start a ring at delay 0 — the extra rings are the celebration,
  never the delay before the first acknowledgement of the finger;
- `parseWelcomeParam` refuses anything that is not a whole non-negative count,
  and takes the first value when Expo Router hands back an array for a repeated
  query key.

## Carrying the moment across the navigation

Connecting from the shops directory pushes straight to the shopfront, so the
screen that could stage the moment is not the screen the tap happened on — the
delight was being lost on the way. The pre-join count now rides across as
`?welcome=<prior>`, and the shopfront reads it once at mount.

Both paths count the same way: `registered` filtered to exclude this shop,
sampled **before** the query invalidation, so the number means "the laundries you
already had" regardless of which list it lands in.

A carried-in claim is held for 580ms (`ENTRANCE.mark.delay + duration`). A mark
cannot be seen taking a colour while it is still dropping into place; held until
the mark is down, the two read as one sequence — the shop arrives, then it
becomes yours. A connect made on the shopfront itself has nothing to wait for and
runs at 0.

## Motion and accessibility

One driver, 1000ms, everything on the native driver — transform and opacity only.
The accent arrives as an opaque coloured layer over the neutral mark rather than
as an animated text colour, because text colour cannot run on the UI thread.

- **Reduce Motion:** the driver jumps to 1. The mark is simply the shop's colour;
  the rings, which carry nothing a customer needs, never appear. The welcome card
  still shows, fully visible.
- **Screen readers:** the rings are `pointerEvents="none"`,
  `accessibilityElementsHidden` and `importantForAccessibility="no-hide-descendants"`.
  The words carry the moment — the welcome card is already an
  `accessibilityLiveRegion="polite"`.
- **Haptics off:** `claimHaptic` returns an intent, and `hapticEffectFor` already
  returns null when the customer has haptics off. Nothing new bypasses that.
- **Contrast:** on the tinted first-laundry card the body switches from the
  shared subtle grey to `colors.text` — grey secondary text on a coloured field
  is a white-card design pasted onto colour.

## Tests

**RED first.** 18 cases written before the module existed:

```
Test Suites: 1 failed — Cannot find module '../connection-welcome'
```

**GREEN after:** 18/18.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/connection-welcome.test.ts` (pre-impl) | suite failed, module not found (RED) |
| same, post-impl | 18/18 passed (GREEN) |
| `npx jest` | 60 suites, 602/602 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <5 changed files>` | clean |
| impeccable design hook (per-edit scan) | no findings on any changed file |

`tsc` caught one error mid-build: `StyleSheet.absoluteFillObject` is not in this
project's RN types. The wash layer spells out its four edges instead, and the run
above is the clean one.

## Fixed along the way

`styles.markStage` centres the rings on the mark. The gap below the mark used to
live on `heroMark`, which put the stage's centre 6px below the mark's own — every
absolutely-positioned ring inherited the offset, including the entrance ripple
that shipped before this. The margin moved to the stage. Layout is unchanged.

## Not verified

**The feel is unverified.** No simulator or device was driven in this pass. The
physics are conservative — native-driver transforms and opacity only, no layout
animation, no new dependency — but worth one look on a real device before
shipping, particularly the three-ring rinse on the first laundry and whether the
580ms hold on the directory path reads as sequence or as lag.

## Preserved

Every price, name, route, and query; the accordion and its open/close rule; the
connect gate on booking; the shopfront entrance and its timings; and every
existing `accessibilityLabel`. The routine connect keeps the welcome card it
already had — it is the milestone that is new, and the count in the second line.
