# Shopfront entrance — the wash line — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Targets:** `src/app/(customer)/shop/[id].tsx`, `src/components/entrance.tsx`,
`src/lib/domain/entrance.ts`

## Request

> "overdrive, can we do an animation everytime we open a merchant store, i'll
> give you the power to choose what style it is but be creative and vibrant and
> full of energy"

## The choice, and why

The app already owns a gesture for this. The splash screen opens on a **wash
line** — a bright band travelling across the brand field (commit `31836fa`,
"overdrive the splash — the wash line"). Inventing a new entrance for the
shopfront would have made the two most branded screens in the app speak
differently. The shopfront now opens on the same motif, so arriving at a laundry
rhymes with opening the app.

It runs **exactly once**, on arrival. A looping sheen is a skeleton loader, and
this surface is not loading.

## The choreography

One driver, six cues, 1.1 seconds end to end:

| ms | cue | what happens |
|---|---|---|
| 0 | field | the gradient settles down out of a 1.06 overscale |
| 120 | mark | the shop's initials land with overshoot (`Easing.back`) |
| 180 | **sheen** | the wash line crosses the field once, tilted 18° |
| 200 | name | rises 18pt |
| 240 | ripple | a ring of water leaves the mark and fades |
| 260 / 320 | address, facts | rise 14pt and 12pt behind it |
| 340+ | list | the category cards cascade, 70ms apart |

Colour that **grows** into place reads as a surface arriving; colour that fades
reads as an image loading. That is why the field scales rather than fades.

The wash line is three bands of falling opacity (0.06 / 0.13 / 0.05) rather than
one rectangle — a single band reads as a white bar sliding past, three read as
light. It is `pointerEvents="none"` and hidden from accessibility, so it can
never intercept a tap meant for the connect button underneath it.

Everything animates **transform and opacity only**, on the native driver, so the
entrance runs on the UI thread and cannot be stalled by a React render.

## What was worth testing

The timing table and the stagger live in `src/lib/domain/entrance.ts`, apart from
the view, because the *order* is the design decision.

**The stagger cap is the real defect this prevents.** A shop with twenty
services at 70ms each would put its last card 1.4 seconds in — long after the
customer has started scrolling, so the cards animate into a screen that has
moved on. It reads as the app lagging, not as choreography. `staggerDelay` caps
at 420ms; past that everything remaining arrives together.

Two invariants are pinned as tests rather than left as intentions:

- every cue starts within 340ms and the whole entrance ends inside 1,100ms —
  past that an entrance becomes the loading screen it was meant to replace;
- `field.delay < mark.delay < facts.delay` — the gradient has to exist before
  the mark lands on it, or the mark appears to fall onto nothing.

## Reduce Motion

`useEntrance` asks `AccessibilityInfo.isReduceMotionEnabled()` and, when it is
on, sets the driver straight to 1 — the screen is simply there, fully visible.
Nothing runs until the OS answers, which returns within a frame; starting before
the answer would restart the timeline and produce a visible hitch.

The entrance always settles fully visible, so motion is never required to read
the screen.

## Tests

**RED first.** Seven cases written before the module existed:

```
Test Suites: 1 failed — Cannot find module '../entrance'
```

**GREEN after:** `7 passed` — first item immediate, one step per index, the cap
at both 20 and 999, no negative delay (`Animated.delay` throws on some drivers),
NaN timings degrading to 0 rather than stalling, and the two ordering/budget
invariants above.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/entrance.test.ts` (pre-impl) | suite failed, module not found (RED) |
| same, post-impl | 7/7 passed (GREEN) |
| `npx jest` | 53 suites, 520/520 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <changed files>` | clean |

`tsc` caught one error mid-build: `progress` was added to `ShopfrontHero`'s prop
type but not to its destructuring, so six cues referenced an undefined name. It
is fixed and the run above is the clean one.

## Not verified

This is motion, and it has not been run on a device — no simulator was driven in
this pass. The physics are conservative (native-driver transforms only, no
layout animation, no new dependency), but **the feel is unverified**. Worth one
look on a real Android device before shipping, particularly the wash line's
speed across a wide screen.

## Preserved

Every price, name, and route; the accordion and its open/close rule; the connect
gate; all queries; and every `accessibilityLabel`. The new `WashLine` is
excluded from the accessibility tree entirely.
