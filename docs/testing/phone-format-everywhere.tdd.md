# The website is a phone, on every screen — TDD evidence

## Source plan

The owner's request (session 2026-09-12): "adapt for anytype of phones and
websites but for the sake of the mostly phone users display a phone format in
me opening the website", with a screenshot of the storefront drawn as a
centred phone-width column on a dark field.

Confirmed by question before any code was written: **a phone column with no
device chrome** — no bezel, no notch mockup — rather than a handset drawing or
a wide desktop storefront.

## What this reverses, and what it keeps

`storefront-full-screen-responsive.tdd.md` (2026-09-09) gave `/s/<slug>` the
whole browser window: a two-column desktop storefront with the shop's details
in an aside. That answered a laptop well and doubled the surface to keep in
step, for the smallest share of the traffic.

The wide layouts are **kept, tested and reachable by one constant**
(`FRAME_MAX_WIDTH`). `webLayout(1440)` still answers `hasAside: true` and
`WebShell` still knows how to draw it. Nothing was deleted; the frame simply
never hands the page a wide number today.

## User journeys

1. As a customer opening a shop's link on a laptop, I want the page to look
   like the app I would have used on my phone, not a stretched copy of it.
2. As a customer on a small phone (320px), I want two readable price cards a
   row and a hero that does not eat the screen before the prices.
3. As a customer who turns their phone sideways, I want to see prices, not a
   full-bleed photograph.
4. As a customer on a phone with a home indicator, I want "Book online" clear
   of the system's swipe bar.

## Task report

### Task 1 — One presentation on the web (`domain/web-frame.ts`)

`frameLayout` no longer exempts the public pages. Every web page wider than
`FRAME_MAX_WIDTH` (430 — the widest phone anyone holds) is a centred column on
the splash navy; anything narrower fills itself, which is the same layout
without a backdrop. `hasOwnWebLayout` is gone with its last caller.

**RED first.** The tests that mattered beyond the rename:

- a shop page, a tracking page, a claim and a join link are all framed at
  1440px — the assertion that used to say the opposite;
- an unmeasured width (`0`, `NaN`) is treated as narrow, not framed on
  nothing. This failed until the guard became `!(w > FRAME)`: `NaN <= 430` is
  false, so the old form framed a page it had not measured.

### Task 2 — The page reads the column, not the window (`components/viewport.tsx`)

A page asking `useWindowDimensions()` inside a 430px column would have laid
out a 1440px desktop in it — a four-across price grid folded over itself, an
aside with nowhere to stand. `ViewportProvider` publishes the frame's width;
`useWebLayout` reads it. Off the web, and in any tree without a provider, it
is the window.

### Task 3 — The small end of the phone range (`domain/web-layout.ts`)

A 320px handset and a 430px one were the same layout. New `compact`
breakpoint below 380: gutter 12 rather than 16, hero 260 rather than 300.

**8 tests**, including the one that names the point: at 320 a price card is
still at least 140px wide — the width a peso figure needs.

### Task 4 — The hero answers height, not just width (`domain/web-layout.ts`)

A hero sized for a portrait phone filled a landscape one, so turning the phone
buried the price list. `webLayout(width, height?)` clamps the hero to 42% of
the window, floor 140.

The clamp alone proved **inert**: `minHeight` lets the hero's own contents —
logo, name, tagline, chips — hold the block open at ~230px regardless. So
`isTight` reports when the room is under what those contents occupy, and
`StorefrontHero` spends less on itself: logo 48 rather than 72, the name one
step down the type scale, half the vertical padding, the tagline held to one
line rather than dropped. Measured in Chrome at 844×390: hero 235px → 180px,
with two price cards above the fold.

**6 tests.** `isTight` is false for a small phone upright (320×568) and true
for the same phone sideways — the distinction the first, naive definition
(`clamped at all`) got wrong.

### Task 5 — The document, from the app (`lib/web-document.ts`)

`app/+html.tsx` was written first and **verified not to ship**: with
`web.output: "single"` and `vercel.json` rewriting every path to `/`, Expo
Router uses its own shell in dev *and* in `expo export -p web`. Confirmed by
grepping the exported `index.html`; the file was deleted rather than left
looking effective.

`claimWebDocument()` runs module-side from the root layout, web only:

- viewport `viewport-fit=cover`, and **no** `maximum-scale` — Expo's default
  forbids pinch-zoom, and a price list is a page people zoom into;
- `theme-color` navy, so the browser chrome matches the splash;
- the surfaces the browser owns: selection, caret, scrollbar, focus ring,
  `overscroll-behavior`, and iOS Safari's landscape text inflation.

Verified live: `viewport-fit=cover` present, sheet attached, no horizontal
overflow at 320/390/430.

### Task 6 — Two bugs the column exposed (`web/web-shell.tsx`)

- **Full-bleed blocks were not full-bleed.** The scroll container centred its
  children, which sized the hero and the `PageBand` to the words inside them —
  on `/book` the blue band was 290px wide in a 430px column, with field colour
  showing at both shoulders. Children stretch now; `styles.column` is what
  centres the reading content.
- **The pinned bar ignored the home indicator.** `paddingBottom` is
  `max(16px, env(safe-area-inset-bottom))` on web, and the scroll gains the
  matching room so the credit line no longer ends up behind the bar.

## Verification

- `npx jest` — 108 suites, 1259 tests, all passing.
- `npx tsc --noEmit` and `npx expo lint` — clean.
- Impeccable mechanical detector over the five changed UI files — no findings.
- Chrome, live at `/s/sparkle-clean` and `/s/sparkle-clean/book`: 1440×900
  (column measured at exactly 430, centred), 320×568, 390×844, 844×390
  landscape. No horizontal overflow at any size.

## Known, not fixed

On the price cards the figure and the "minimum" chip overlap the illustration
behind them at phone width. That is the incumbent card design — the artwork is
drawn first "so the words sit over it" — and it is present in the owner's own
screenshot. Changing it is a card redesign, not an adaptation.

---

## Follow-up (same session): the service cards

Three further requests against the same screen.

### The column's unfilled edge

The owner: "look at the top its not filled there white of the side and also
blue." Measured in Chrome: the hero was **417px inside a 430px column**. The
`ScrollView` rendered a classic 13px scrollbar, which reserves its width from
the layout, so every full-bleed block stopped short of the right edge and left
a pale strip down the page.

`showsVerticalScrollIndicator={false}` — a phone overlays its scrollbar, and
the column is a phone. Hero now measures 430 of 430.

### The artwork crossing the words

The owner: "try not getting it overlapped with the text without changing the
size of the graphics."

Measured collision on a 189×182 card: words ended at y=119, the object began at
y=45 — a 74px overlap, so the price sat on a stack of towels and the minimum
chip ran through a hanger.

The object keeps its exact size (150×150, still anchored past the bottom-right
corner and clipped). The fixed `CARD_HEIGHT` became a `CARD_MIN_HEIGHT` plus a
spacer of `ART_CLEARANCE = OBJECT_SIZE - OBJECT_DROP - space.room`, **derived
from the object's own geometry** rather than a measured-once number. Because it
is a spacer and not a height, a name that wraps to two lines grows the card
instead of colliding.

### The card's ground

The owner, with a reference image of pastel-tinted tiles: "in the background of
the services make it look like this."

`ShowcaseTone` gains `field` — the category's hue at a whisper, lighter than the
page it sits on. The two chips go white so they still read as chips on it.

**RED first, 3 tests**, and they are contrast tests rather than colour
snapshots, computing WCAG relative luminance in the test itself:

- every category's ground is distinct;
- `tone.ink`, `colors.text` and `colors.subtle` each clear 4.5:1 **on that
  ground** — the tightest is dry-cleaning's subtle at 4.54:1;
- the ground stays a ground: lighter than the tile the same hue paints at full
  strength, luminance above 0.78, and within 1.25:1 of white so a white chip
  still separates from it.

## Cross-surface note

`ServiceTileCard` is shared with the in-app customer shop screen
(`src/app/(customer)/shop/[id].tsx`). The clearance and the tinted ground apply
there too. The collision existed identically on that screen, and the two
surfaces are meant to read as one product — but it is a change to a screen this
session was scoped away from, and it is a line's work to gate to the web price
list if that is not wanted.

## Known, not fixed

On the wash-and-fold, bedding and curtain cards the drawing's own pale base —
invisible against a white card — now shows faintly against the tint. It is the
artwork, not the card: the scene's backdrop is already transparent on this
surface. Blending those bases into the ground is an asset change.

---

## Overdrive: the hero (same session)

The owner: "make this top the best it can be and the info readable but soo
elegant that it makes people stop and look". On the shape, first "a straight
line and curves in the sides", then corrected: "I dont want a straight line i
want a curvy one."

Two directions confirmed by question before any code: **deep convex sweep**
(bottom bulges to its lowest point at the centre, rising to meet both side
walls) and **cinematic entrance** (one authored moment, not scattered effects).

### The sweep, as tested data (`domain/web-layout.ts`)

`heroSweep` joins the layout scale — 40 / 52 / 60 / 68 / 76 by size — then is
clamped with the hero it ends: `max(32, min(size, heroHeight * 0.22))`, so a
window that cut the hero short does not keep a curve drawn for the tall one.

**3 tests, RED first:** the sweep never shrinks as the hero grows; it stays
between 32px and a quarter of the hero's height at every width (a drawn arc,
not a bite out of the photograph); and a landscape phone obeys the same bound.

Drawn as an elliptical corner radius — `50% <sweep>px` on each bottom corner —
so the two corners meet at the centre and read as one continuous curve. Not a
`border-radius` approximation of an arc: the ellipse *is* the arc. The foot
pads the words clear of it by `sweep + space.room`, so the curve is empty space
the photograph fills.

### The rest

- **Facts, not pills.** Three translucent capsules became one ruled row with
  hairline dividers. Same three facts, no chrome.
- **The name** at 40px / -1.5 tracking (inside the -0.04em floor), the tagline
  small and opened to 1.9 tracking as a line of engraving under it.
- **Scrim** went from two stops to four: the picture stays almost clear through
  its upper third, deepens under the words, deepens again at the very foot so
  the lowest point of the arc still reads as an edge.
- **One driver** for the entrance: a single `Animated.Value` that each element
  reads a different slice of, so the stagger is one curve rather than four
  animations kept in time. The push-in hands off to an endless drift on the
  same value, so the picture never appears to stop and restart. All of it
  short-circuits to the settled state under `useReducedMotion`.
- `service-tile-card` now imports the shared `lib/use-reduced-motion` instead
  of carrying its own copy.

### Not verified visually

The browser profile was held by another session for the whole of this build,
so the batched screenshot pass Overdrive requires **did not run**. `tsc` is
clean and 1280 tests pass, but the sweep, the stagger timing and the scrim
ramp have not been looked at.
