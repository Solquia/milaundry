# Customer settings, haptic touch and notification preferences — TDD evidence

## Source plan

No `*.plan.md` was supplied. Journeys were derived during this TDD run from the
request: *"add a settings button at customer home page, that will redirect to
sign out, heptic touch and notification settings, btw add heptic touch"*.

## User journeys

1. As a customer, I want a settings button on my home screen, so I can reach
   sign-out and app preferences without scrolling to the bottom of my order list.
2. As a customer, I want sign-out to ask before it happens, so I don't lose my
   session on a mis-tap.
3. As a customer, I want to turn haptic touch off, so my phone stops buzzing on
   every tap.
4. As a customer, I want to choose which notifications reach my feed, so routine
   progress updates don't bury the ones I must act on.
5. As a customer, I want those choices to survive closing the app.

## Interpretation recorded

"Notification settings" was read as preferences over the **existing derived
feed** (`domain/notifications` builds notifications from orders; the app has no
push channel). Two toggles were chosen because both change real behaviour;
a third, inert switch would have been a control that lies. A deliberate rule
was added and tested: a notification with `needsAction` — a price waiting to be
settled, laundry waiting to be collected — survives every mute setting.

## Task report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| Preferences model | Three booleans, tolerant parsing, immutable toggles, section metadata | `npx jest src/lib/domain/__tests__/app-settings.test.ts` | RED (module missing) → GREEN |
| Haptic map | Intent → effect, with "off means silent" inside the map | `npx jest src/lib/domain/__tests__/haptic-feedback.test.ts` | RED (module missing) → GREEN |
| Persistence | AsyncStorage round trip that cannot reject | `npx jest src/lib/__tests__/settings-store.test.ts` | RED (module missing) → GREEN |
| Feed filtering | `enabledNotifications` honours mutes, never hides an action | `npx jest src/lib/domain/__tests__/notifications.test.ts` | RED (export missing) → GREEN |
| Engine wrapper | `performHaptic` performs and never throws into a press | `npx jest src/lib/__tests__/haptics.test.ts` | GREEN (coverage backfill, see gaps) |
| Provider + hook | Load once, optimistic toggle, live haptic preference | `npx jest src/lib/__tests__/use-app-settings.test.tsx` | GREEN (coverage backfill, see gaps) |
| Screen + wiring | Settings route, hero gear, haptics on presses, sign-out moved | `npx tsc --noEmit`, `npm run test:coverage` | GREEN |

### RED evidence

`npx jest` on the first four suites, before any implementation existed:

```
Cannot find module '../app-settings' from 'src/lib/domain/__tests__/app-settings.test.ts'
Cannot find module '../haptic-feedback' from 'src/lib/domain/__tests__/haptic-feedback.test.ts'
Cannot find module '../domain/app-settings' from 'src/lib/__tests__/settings-store.test.ts'
Cannot find module '../app-settings' from 'src/lib/domain/__tests__/notifications.test.ts'

Test Suites: 4 failed, 4 total
Tests:       0 total
```

Compile-time RED: each suite newly references the module or export that did not
exist. Committed as `5335e43`.

### GREEN evidence

```
PASS src/lib/domain/__tests__/haptic-feedback.test.ts
PASS src/lib/domain/__tests__/app-settings.test.ts
PASS src/lib/__tests__/settings-store.test.ts
PASS src/lib/domain/__tests__/notifications.test.ts

Test Suites: 4 passed, 4 total
Tests:       62 passed, 62 total
```

Committed as `db9f07c`. Full suite after wiring (`npm run test:coverage`):

```
Test Suites: 58 passed, 58 total
Tests:       576 passed, 576 total
```

Committed as `8a3af82`.

## Test specification

| # | What is guaranteed | Test file or command | Type | Result |
|---|---|---|---|---|
| 1 | A new phone starts with haptics and every notification on | `app-settings.test.ts:starts a new phone with haptics and every notification on` | unit | PASS |
| 2 | Unreadable or partial stored settings degrade to working defaults, never to `undefined` | `app-settings.test.ts:parseSettings` (6 cases) | unit | PASS |
| 3 | Storage cannot widen the settings object with keys the app does not own | `app-settings.test.ts:drops keys that are not settings` | unit | PASS |
| 4 | Toggling flips one setting and mutates nothing | `app-settings.test.ts:toggleSetting` (3 cases) | unit | PASS |
| 5 | Every setting appears exactly once in the UI metadata, captioned and grouped | `app-settings.test.ts:SETTING_SECTIONS` (4 cases) | unit | PASS |
| 6 | A screen reader hears the state a switch only shows visually | `app-settings.test.ts:toggleStateLabel` | unit | PASS |
| 7 | Each press intent maps to one fixed effect; two impact weights only | `haptic-feedback.test.ts` (4 cases) | unit | PASS |
| 8 | Haptics off means silence for every intent, without call sites remembering | `haptic-feedback.test.ts:is silent for every intent once the customer turns haptics off` | unit | PASS |
| 9 | Preferences round-trip through AsyncStorage under `milaundry.settings.v1` | `settings-store.test.ts:persists the choice under its own key` | integration | PASS |
| 10 | A failed read or write never breaks launch or refuses the toggle | `settings-store.test.ts` (2 cases) | integration | PASS |
| 11 | Muting order updates or finished orders removes exactly those rows | `notifications.test.ts:enabledNotifications` (2 cases) | unit | PASS |
| 12 | A row the customer must act on survives every mute setting | `notifications.test.ts:still shows what the customer must act on, whatever they muted` | unit | PASS |
| 13 | The bell count and the filtered feed cannot disagree | `notifications.test.ts:keeps the badge and the feed agreeing when updates are muted` | unit | PASS |
| 14 | Filtering preserves feed order and does not mutate the feed | `notifications.test.ts` (2 cases) | unit | PASS |
| 15 | The engine is asked for exactly the mapped effect, and for nothing when there is none | `haptics.test.ts` (4 cases) | integration | PASS |
| 16 | Hardware that refuses a haptic never throws into a press handler | `haptics.test.ts:does not throw into the press when the hardware refuses` | integration | PASS |
| 17 | Stored preferences are read once at launch and drive the app | `use-app-settings.test.tsx` (2 cases) | integration | PASS |
| 18 | A toggle applies immediately and is written behind the switch | `use-app-settings.test.tsx:flips a toggle and writes it behind the switch` | integration | PASS |
| 19 | Turning haptics off goes quiet on the next press, not at next launch | `use-app-settings.test.tsx:goes quiet the moment the switch is flipped` | integration | PASS |

## Coverage

`npm run test:coverage` — 58 suites, 576 tests, all passing.

```
All files              |   81.31 |    81.63 |   73.76 |   81.12
  app-settings.ts      |     100 |      100 |     100 |     100
  haptic-feedback.ts   |     100 |      100 |     100 |     100
  haptics.ts           |     100 |      100 |     100 |     100
  settings-store.ts    |     100 |      100 |     100 |     100
  use-app-settings.tsx |   91.66 |       50 |   81.81 |   95.65
```

Baseline before this work was 77.16% statements (measured on a clean stash), so
the target of 80% is now met where it previously was not.

## Known gaps

- **Screen rendering is untested.** `src/app/(customer)/settings.tsx` and the
  home hero's gear have no component tests: the project has no React Testing
  Library dependency and `collectCoverageFrom` is scoped to `src/lib/**`, so
  every screen in the app is in the same position. The screens were kept thin —
  copy, grouping, accessibility labels and the mute rule all live in tested
  `domain/` modules. Verified instead by `npx tsc --noEmit` (clean).
- **Two suites were written after their implementation**, not RED-first:
  `haptics.test.ts` and `use-app-settings.test.tsx` were added to cover the
  wrappers once the wiring existed. They are recorded as backfill above rather
  than presented as RED/GREEN cycles.
- **No E2E.** The repo has no E2E harness; adding one was out of scope here.
- **Pre-existing lint error**, unrelated and untouched by this work:
  `src/lib/domain/__tests__/splash-gate.test.ts:7 import/no-unresolved` for
  `../splash-gate`, which exists and is committed at `5d6fa38`.
- **Uncommitted neighbouring work.** The repository had substantial uncommitted
  changes before this task. `(customer)/notifications.tsx` was among them and is
  included in `8a3af82` because this task edited it; everything else was left in
  the working tree untouched.

## Merge evidence

If these three commits are squashed, keep this summary in the squash body:

- **RED** `5335e43` — four suites fail to run; `domain/app-settings`,
  `domain/haptic-feedback`, `lib/settings-store` and the `enabledNotifications`
  export do not exist.
- **GREEN** `db9f07c` — those modules land; 62 tests pass.
- **Wiring** `8a3af82` — settings screen, hero gear, haptics on presses,
  sign-out relocated; 576 tests pass, coverage 81.31% (from 77.16%).
