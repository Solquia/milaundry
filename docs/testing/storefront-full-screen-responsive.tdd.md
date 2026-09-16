# The shop's own pages answer the window they are opened in — TDD evidence

## Source plan

The owner's request (session 2026-09-09): "on the online ordering on each
laundry we want to make everyone in full screen but make sure its responsive
for every and each screens. Right now its mobile first but we also want it to
be responsive in all devices."

## The fault

`/s/<slug>` was capped twice on the web, so a customer ordering from a laptop
read a 480px strip in the middle of their monitor:

- `src/components/web-frame.tsx` held the *whole app* — public pages included
  — to a 480px navy column above `FRAME_MAX_WIDTH`.
- `src/components/web/web-shell.tsx` then capped the page at
  `PAGE_MAX_WIDTH = 560` inside that.

The inner cap never had a chance to apply: the frame around it was narrower.

## User journeys

1. As a customer opening a shop's link on a laptop, I want the page to use the
   screen, so it reads as the shop's storefront and not as a phone screenshot.
2. As a customer on a phone, I want nothing to change: the page still fills the
   screen and the action still sits within thumb reach.
3. As a customer on a tablet or a half-width window, I want the price grid to
   use the extra width rather than leave it empty.

## Task report

### Task 1 — The sizes, as data (`src/lib/domain/web-layout.ts`)

`webLayout(viewportWidth)` answers one `WebLayout`: `breakpoint`,
`contentWidth`, `gutter`, `priceColumns`, `heroHeight`, `hasAside`,
`asideWidth`. Four steps — phone (<700), tablet (700), laptop (1024),
desktop (1440) — chosen where a layout actually breaks, not at round numbers.

`gridRows(items, columns)` deals cards into rows and pads the last one, so a
short final row never stretches one card across a monitor. It replaces the
`pairs()` helper that was hard-coded to two.

**RED first, 14 tests.** The ones that matter beyond arithmetic:

- content never exceeds the window it is drawn in (a 700px viewport is a
  tablet, but it is still only 700px) — this failed until `contentWidth` was
  clamped to the viewport as well as to the size;
- an unmeasured width (`0`, `NaN`, negative) falls back to the phone layout,
  because the phone layout fits every window and a wide one does not;
- `priceColumns`, `heroHeight` and `gutter` are monotonic in width — a wider
  window is never given less;
- `mainWidth` stays wider than the aside at every size that has one;
- `gridRows(items, 0)` does not loop forever.

### Task 2 — The frame lets the public pages through (`domain/web-frame.ts`)

`hasOwnWebLayout(pathname)` — true for `/s/`, `/track/`, `/claim/`, `/join/`.
`frameLayout` takes an optional `pathname` and refuses to frame those. Tests
cover each prefix, the app's own screens staying framed, and near-misses
(`/settings/shops`, `/tracking`, `/joined`) not matching. `WebFrame` now reads
`usePathname()`.

### Task 3 — The shell (`components/web/web-shell.tsx`)

- `useWebLayout()` — the one place `useWindowDimensions` meets `webLayout`.
- `hero` renders edge to edge, outside the reading column, so colour bleeds
  and words do not.
- `aside` sits under the main column on a phone and beside it from 1024 up.
- `footer` keeps its pinned foot bar on a narrow window; from 1024 it moves to
  the top of the side column and follows the scroll (`position: sticky`, web
  only — no native screen ever takes that branch).
- `PageBand` replaces the brand band duplicated in `book.tsx` and `orders.tsx`.
- `PAGE_MAX_WIDTH` is gone; nothing else referenced it.

### Task 4 — The three pages

- `s/[slug]/index.tsx` — hero via `hero`, price grid takes
  `columns={layout.priceColumns}`, "Find the shop" moves into `aside`, the
  Book/Call buttons stack full-width in the side column and stay side by side
  in the foot bar.
- `s/[slug]/book.tsx` — `PageBand` as hero; the total and its buttons ride the
  side column on a desktop instead of lying across the foot of the screen.
- `s/[slug]/orders.tsx` — the order cards wrap (`flexBasis: 280`), so it is one
  column on a phone and two or more on a laptop with no breakpoint arithmetic.

Every page gutter is `layout.gutter`, so spacing grows with the window.

## Validation commands

```
npx jest web-layout web-frame     # 23 passed
npx jest                          # 107 suites, 1245 tests passed
npx tsc --noEmit                  # clean
npx eslint src/app/s src/components/web src/lib/domain   # clean
```

## Not verified from this session — please confirm in a browser

Chrome DevTools MCP could not attach (a browser was already running on its
profile), so no screenshots were taken. `npx expo start --web` is running on
port 8099; open `http://localhost:8099/s/sparkle-wash` and check:

- 390px — unchanged from before: full-bleed hero, two price cards a row,
  Book/Call pinned across the foot.
- 834px — three cards a row, wider gutters, still one column.
- 1440px — hero across the whole window, four cards a row, the shop's details
  and the booking buttons in a column on the right that follows the scroll.
- The same three widths on `/s/sparkle-wash/book` at each of the three steps,
  and on `/s/sparkle-wash/orders`.
- The app's own screens (`/`, `/(customer)/shops`) still sit in the navy
  phone-width frame on a wide window.
