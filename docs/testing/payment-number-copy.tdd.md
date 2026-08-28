# TDD evidence — a copyable payment number

## Source plan

No `*.plan.md`. The journeys below were written during this TDD run from a
screenshot of the customer order screen: the shop's GCash number `9855421394`
set large in monospace under "How will you pay ₱616.00?", with no way to take
it anywhere.

## User journeys

1. As a customer paying online, I want to copy the shop's account number with
   one tap, so I can paste it into my banking app instead of transcribing ten
   digits between two apps.
2. As a customer, I want visible confirmation that the copy happened, so I do
   not paste blind or tap twice.
3. As a customer whose shop typed the number with spaces or dashes, I want the
   pasted value to be what a banking app will actually accept.

## Task report

### 1. Split the displayed number from the pasted number

The figure on screen keeps the shape the shop typed it in — that is how it is
printed on the tarpaulin above the till, and how the customer checks it. The
clipboard gets the separators removed, because a bank's account field takes
digits. A leading zero and a `+63` prefix are part of the number, not
formatting, so neither is stripped.

- **RED** — `npx jest src/lib/domain/__tests__/payment-copy.test.ts`

  ```
  FAIL src/lib/domain/__tests__/payment-copy.test.ts
    ● Test suite failed to run
      Cannot find module '../payment-copy' from 'src/lib/domain/__tests__/payment-copy.test.ts'
  Test Suites: 1 failed, 1 total
  ```

  Compile-time RED. The test newly references `copyableNumber`, `copyPrompt`,
  `copyConfirmation` and `COPY_FEEDBACK_MS`; the resolution failure is the
  intended missing-implementation signal, not an unrelated setup break.
  Checkpoint: `20ee180 test: add reproducer for a copyable payment number`.

- **GREEN** — same command

  ```
  PASS src/lib/domain/__tests__/payment-copy.test.ts
  Test Suites: 1 passed, 1 total
  Tests:       11 passed, 11 total
  ```

  Checkpoint: `dc391eb feat: copy the shop's payment number instead of
  transcribing it`.

**Guaranteed:** the string placed on the clipboard is the shop's number with
whitespace, hyphens and pasted-in dashes removed, and with its leading zero and
country-code plus intact.

### 2. Name what was copied

Three rails can be on screen at once. "Copied" alone answers the wrong
question, so the confirmation names the rail, and a bank figure is called an
account number on both the button and the confirmation.

**Guaranteed:** `copyPrompt` and `copyConfirmation` agree on the noun for a
given rail, and both quote the rail's own label.

### 3. A refused clipboard does not claim success

`Clipboard.setStringAsync` is awaited and its rejection is handled: the sheet
says the copy did not happen and tells the customer to type the number across.
The alternative — a silent failure behind a "Copied" badge — leaves someone
pasting whatever was on the clipboard before into a payment.

**Not covered by automated tests.** See known gaps.

### 4. Coverage follow-up

`copyableNumber`'s `?? ''` guard was the one uncovered branch after GREEN. The
column is typed `string`, but a row predating the payment fields returns null,
so the guard is real and got its own pinned test rather than a documented gap.

- `npx jest --coverage --collectCoverageFrom="src/lib/domain/payment-copy.ts" src/lib/domain/__tests__/payment-copy.test.ts`

  ```
  File             | % Stmts | % Branch | % Funcs | % Lines
  payment-copy.ts  |     100 |     100 |     100 |     100
  Tests:       12 passed, 12 total
  ```

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | Grouping spaces are removed before the number reaches the clipboard | `payment-copy.test.ts:strips the spaces a shop typed for readability` | unit | PASS | `npx jest payment-copy.test.ts` |
| 2 | Hyphens and pasted en/em dashes are removed too | `payment-copy.test.ts:strips dashes, including the ones a paste brings in` | unit | PASS | same |
| 3 | The leading zero of a PH mobile number survives cleaning | `payment-copy.test.ts:keeps the leading zero every PH mobile number depends on` | unit | PASS | same |
| 4 | A `+63` country code survives cleaning | `payment-copy.test.ts:keeps a country-code plus, which is part of the number` | unit | PASS | same |
| 5 | An already-clean number is passed through unchanged | `payment-copy.test.ts:leaves a number that is already clean alone` | unit | PASS | same |
| 6 | A blank or whitespace-only number cleans to empty, so no copy control is offered | `payment-copy.test.ts:returns nothing for a blank number` | unit | PASS | same |
| 7 | A null or undefined number from the database cleans to empty rather than throwing | `payment-copy.test.ts:treats a null out of the database as nothing rather than crashing` | unit | PASS | same |
| 8 | The copy control announces the rail and reads the number out | `payment-copy.test.ts:names the wallet and reads the number out` | unit | PASS | same |
| 9 | A bank figure is called an account number on the button | `payment-copy.test.ts:calls a bank figure an account number` | unit | PASS | same |
| 10 | The confirmation names which rail was copied | `payment-copy.test.ts:says what was taken, not just that something was` | unit | PASS | same |
| 11 | The confirmation reuses the button's noun for a bank | `payment-copy.test.ts:keeps the bank wording it used on the button` | unit | PASS | same |
| 12 | The confirmation stands for between 1.5s and 4s before the control resets | `payment-copy.test.ts:holds the confirmation long enough to read` | unit | PASS | same |

## Coverage and known gaps

- `src/lib/domain/payment-copy.ts`: **100%** statements, branches, functions,
  lines (12 tests).
- Full suite after the change: `npx jest` → **71 suites, 758 tests, all
  passing**. `npx tsc --noEmit` and `npx eslint` clean on the changed files.

Intentional gaps:

- **The `RailDetails` component itself has no rendering test.** This repo tests
  domain modules and has no React Native renderer configured, so the wiring —
  the pressable, the `expo-clipboard` call, the 2.2s reset timer, and the
  failure branch — is unverified by automated tests. The decisions it makes are
  pushed into `payment-copy.ts`, which is fully covered; what remains untested
  is that the component calls them.
- **The clipboard-rejection path is untested** for the same reason. It is
  handled in code (`.catch` → haptic `error` → a visible line telling the
  customer to type the number across) but no test exercises it.
- **No E2E coverage.** Clipboard behaviour needs a device or simulator; this
  project has no Detox/Maestro harness.

## Merge evidence

If these checkpoints are squashed, the RED/GREEN pair is:

- RED `20ee180` — `Cannot find module '../payment-copy'`, compile-time RED from
  the newly written reproducer.
- GREEN `dc391eb` — 11 passed on the same target, 758 passed across the suite.
- Coverage follow-up — 12 passed, 100% on all four metrics.
- No refactor commit: the implementation needed none.
