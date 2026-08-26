# TDD evidence — saved sign-in accounts

**Source plan:** none. Journeys were derived during this TDD run from the
request *"can you add a saved account on the buttom so that they will not have
to keep typing it"*.

**Clarified before any code was written.** "Account" was ambiguous — it could
have meant the login or the pickup address retyped on the booking screen. The
answers chosen: **saved accounts on sign-in**, and **login identifier only, no
stored password**.

## User journeys

1. As someone who signs in often, I want the accounts already used on this
   device listed under the form, so one tap fills the login field instead of
   typing it.
2. As someone whose number can be typed three ways (`0917 123 4567`,
   `09171234567`, `+63 917 123 4567`), I want it listed once.
3. As someone on a shared phone, I want to remove a saved account — and I never
   want my password stored.

## Task report

### 1. Domain: the saved-account list (`src/lib/domain/saved-accounts.ts`)

- **Summary:** canonicalises a typed login through the existing `parseLoginId`,
  keeps the list most-recent-first and capped, and sanitises whatever comes back
  from device storage.
- **Validation command:** `npx jest src/lib/domain/__tests__/saved-accounts.test.ts`
- **RED output** (commit `f68f84c`):

  ```
  Cannot find module '../saved-accounts' from 'saved-accounts.test.ts'
  Test Suites: 1 failed, 1 total
  ```

- **GREEN output** (commit `e410731`):

  ```
  Tests: 17 passed, 17 total
  ```

- **Guaranteed:** one account per identity however it was typed; the account
  just used returns to the top; the list never exceeds `MAX_SAVED_ACCOUNTS`;
  invalid input is never saved; damaged storage yields an empty list rather
  than a broken screen; inputs are never mutated.

### 2. Storage adapter (`src/lib/saved-accounts-store.ts`)

- **Summary:** one AsyncStorage key, `milaundry.saved-accounts.v1`, wrapping the
  domain functions.
- **Validation command:** `npx jest src/lib/__tests__/saved-accounts-store.test.ts`
- **Output** (commit `492ead0`): `Tests: 7 passed, 7 total`
- **Honest note:** these tests were written **after** the adapter, not before.
  The adapter was built as part of the GREEN step for journey 1. It is I/O glue
  with no branching logic of its own; the behaviour it adds — key name, write
  contents, failure degradation — is now pinned by tests, but this file did not
  go through a RED gate.
- **Guaranteed:** only `{id, label, kind}` is ever written — no password, no
  token; a failed read or write degrades to an empty list / in-session list
  instead of failing the sign-in.

### 3. Sign-in screen (`src/app/(auth)/sign-in.tsx`)

- **Summary:** loads the list on mount, records a login only after `signIn`
  resolves, renders the list under the form with a remove control per row and
  the line "Your password is never saved."
- **Validation:** `npx tsc --noEmit` clean; `npx eslint` clean; full suite green.
- **Not covered by tests** — see gaps.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | A login used before is offered on the next sign-in | `saved-accounts.test.ts:offers the account on the next sign-in` | unit | PASS | `npx jest saved-accounts.test.ts` |
| 2 | The same number typed three ways is one entry | `saved-accounts.test.ts:lists the same account once, however it was typed` | unit | PASS | same |
| 3 | The account just used returns to the top | `saved-accounts.test.ts:moves the account just used back to the top` | unit | PASS | same |
| 4 | The list never grows past the cap | `saved-accounts.test.ts:drops the oldest account once the list is full` | unit | PASS | same |
| 5 | A typo never becomes a saved account | `saved-accounts.test.ts:remembers nothing when the sign-in field held junk` | unit | PASS | same |
| 6 | Removing an account leaves the others | `saved-accounts.test.ts:removes the account someone asked to forget` | unit | PASS | same |
| 7 | Damaged storage cannot break the sign-in screen | `saved-accounts.test.ts:never lets damaged storage break the sign-in screen` | unit | PASS | same |
| 8 | Only the login identifier is written — never a password | `saved-accounts-store.test.ts:never writes a password or a token, only the login identifier` | integration | PASS | `npx jest saved-accounts-store.test.ts` |
| 9 | A refused write does not fail the sign-in | `saved-accounts-store.test.ts:still returns the list for this session when the device refuses the write` | integration | PASS | same |
| 10 | A failed read yields an empty list | `saved-accounts-store.test.ts:is empty rather than broken when the read fails` | integration | PASS | same |

## Coverage and known gaps

```
npx jest --coverage --collectCoverageFrom="src/lib/domain/saved-accounts.ts" \
                    --collectCoverageFrom="src/lib/saved-accounts-store.ts"
 saved-accounts.ts       | 100 % stmts | 100 % branch | 100 % funcs | 100 % lines
 saved-accounts-store.ts | 100 % stmts | 100 % branch | 100 % funcs | 100 % lines
```

Full suite: `npx jest` — 369 passed, 43 suites. `npx tsc --noEmit` — clean.
`npx eslint` on the four touched files — clean.

**Gaps, stated plainly:**

- **No test renders the sign-in screen.** The repo has no component-test setup
  (no `@testing-library/react-native`), so the wiring — list appears on mount,
  tap fills the field, × removes the row, the list is written only after a
  successful `signIn` — is verified by reading the code, not by a test.
- **Not verified on a device.** The list rendering and AsyncStorage persistence
  across app restarts have not been exercised on a real phone in this session.
- The storage adapter is test-after, not test-first (see task 2).
- **Deviation from the approved mockup:** the mockup showed two-letter initials
  in the avatar (`(SW) sparklewash`). Shipped as an icon instead — a phone
  handset for mobile-number logins, a storefront for shop usernames — because
  initials derived from `sparklewash` would render `SP`, not the `SW` shown, and
  the kind of account is the more useful signal.

## Merge evidence

- RED: `f68f84c` — `test: RED — saved sign-in accounts on this device` (module not found; 1 suite failed)
- GREEN: `e410731` — `feat: saved sign-in accounts under the form` (17 passed; full suite 362)
- Follow-on: `492ead0` — `test: cover the saved-accounts storage adapter` (7 passed; full suite 369)
- Refactor: none needed.
