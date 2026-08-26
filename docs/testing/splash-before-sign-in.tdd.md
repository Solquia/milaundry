# TDD evidence — branded splash before the sign-in form

**Source plan:** none. Journeys were derived during this TDD run from the
request *"CREATE A SPLASH PAGE THAT WILL SHOW BEFORE THE LOG IN PART"*.

## What was there before

`src/app/index.tsx` rendered a bare `<Loading />` while the saved session was
restored, then redirected to `/sign-in` or a role home. The first thing anyone
saw on opening MiLaundry was a spinner. The `expo-splash-screen` entry in
`app.json` is a static native launch image and cannot show app state, so it does
not cover this.

## User journeys

1. As someone opening MiLaundry, I want a branded splash before the sign-in
   form, not a bare spinner.
2. As a returning signed-in user, I want the splash to hand me straight to my
   own home screen once the session is restored.
3. As someone on a bad connection, I don't want to be stranded on the splash if
   the session check hangs.

## Interpretation recorded

The request says "before the log in part". The splash was built to play on
**every** cold open, not only for signed-out users, because it is what the
session restore happens behind — a signed-in user would otherwise still get the
bare spinner. For a signed-out user this is literally "before the log in part";
for a signed-in user it adds `SPLASH_MIN_MS` (1.6 s) before their home screen.
Restricting it to signed-out users is a one-line change in `openRoute`.

## Task report

### 1. Domain: the open gate (`src/lib/domain/splash-gate.ts`)

- **Summary:** the redirect chain moved out of `index.tsx` into pure functions —
  where the app goes on open, which home a role owns, and when the splash may
  hand over.
- **Validation command:** `npx jest src/lib/domain/__tests__/splash-gate.test.ts`
- **RED output** (commit `774f7c4`):

  ```
  Cannot find module '../splash-gate' from 'splash-gate.test.ts'
  Test Suites: 1 failed, 1 total
  ```

- **GREEN output** (commit `7b8e172`):

  ```
  Tests: 14 passed, 14 total
  ```

- **Guaranteed:** the splash is the first destination on a launch, including
  while auth is still loading; it never plays twice in one launch; a signed-out
  user reaches `/sign-in` and each role reaches its own home; a session whose
  profile has not arrived is treated as a customer; the splash holds for
  `SPLASH_MIN_MS`, waits for auth, and gives up at `SPLASH_MAX_MS`.

### 2. Launch flag (`src/lib/splash-state.ts`)

- **Summary:** a module-level boolean, deliberately not persisted — the splash
  should play once per launch, so the flag must die with the process. Persisting
  it would mean it never plays again; React state would replay it on every
  return to the index, including straight after signing out.
- **Not covered by a test** — a two-line getter/setter with no branching. Its
  effect is expressed through `openRoute`'s `hasSeenSplash` parameter, which is
  tested.

### 3. Splash screen (`src/app/splash.tsx`) and index (`src/app/index.tsx`)

- **Summary:** the wordmark on the shared `HERO_GRADIENT` field, a fade-and-rise
  entrance, a footer that reads "Getting things ready…" while the session is
  restoring and "Tap to continue" once it is known. Tapping skips the remaining
  wait, but only when there is a certain destination. `index.tsx` is now three
  lines of decision delegated to `openRoute`.
- **One implementation note worth keeping:** the entrance animation holds its
  `Animated.Value` in `useState(() => …)`, not `useRef(…).current`. The value is
  read during render to build the style, and with `reactCompiler: true` the
  `react-hooks/refs` rule rejects a ref read there — it failed lint with 7 errors
  until this changed.
- **Validation:** `npx tsc --noEmit` clean; `npx eslint` clean on all five
  touched files; full suite green.
- **Not covered by tests** — see gaps.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | The app opens on the splash, before the sign-in form | `splash-gate.test.ts:opens the app on the splash, before the sign-in form` | unit | PASS | `npx jest splash-gate.test.ts` |
| 2 | The splash covers the session restore instead of a spinner | `splash-gate.test.ts:shows the splash while the session is still being restored, not a bare spinner` | unit | PASS | same |
| 3 | A signed-out user reaches sign-in after the splash | `splash-gate.test.ts:sends someone who is not signed in to sign in once the splash is done` | unit | PASS | same |
| 4 | The splash never plays twice in one launch | `splash-gate.test.ts:never shows the splash twice in one launch` | unit | PASS | same |
| 5 | Each role lands on the screen it owns | `splash-gate.test.ts:routes each role to the screen it owns` | unit | PASS | same |
| 6 | A session without a profile yet lands on the customer tab | `splash-gate.test.ts:treats a profile that has not arrived yet as a customer` | unit | PASS | same |
| 7 | The splash is held long enough to read, not flashed | `splash-gate.test.ts:holds the splash long enough to be read, not flashed` | unit | PASS | same |
| 8 | It waits for the session before choosing a destination | `splash-gate.test.ts:keeps waiting while the session check is still running` | unit | PASS | same |
| 9 | A hung session check never strands anyone on the splash | `splash-gate.test.ts:never strands anyone on the splash when the session check hangs` | unit | PASS | same |

## Coverage and known gaps

```
npx jest --coverage --collectCoverageFrom="src/lib/domain/splash-gate.ts"
 splash-gate.ts | 100 % stmts | 100 % branch | 100 % funcs | 100 % lines
```

Full suite: `npx jest` — 389 passed, 45 suites. `npx tsc --noEmit` — clean.
`npx eslint` on the five touched files — clean.

**Gaps, stated plainly:**

- **No test renders the splash screen.** The repo has no component-test setup
  (no `@testing-library/react-native`), so the timer, the tap-to-skip, the
  entrance animation and the `router.replace` call are verified by reading the
  code, not by a test. The decision logic behind them is fully tested.
- **Not seen on a device.** The gradient, the animation and the handover have
  not been run on a phone or simulator in this session — the visual result is
  unverified.
- `src/lib/splash-state.ts` has no direct test (see task 2).
- The double-leave guard (`hasLeftRef`) is a React-level concern and is not
  covered by the domain tests.

## Merge evidence

- RED: `774f7c4` — `test: RED — branded splash before the sign-in form` (module not found; 1 suite failed)
- GREEN: `7b8e172` — `feat: branded splash before the sign-in form` (14 passed; full suite 389)
- Refactor: none beyond the lint-driven `useRef` → `useState` change, which is
  part of the GREEN commit.
