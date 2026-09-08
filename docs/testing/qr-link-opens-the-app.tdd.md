# TDD evidence: a printed QR link opens the app when installed, the web page when not

**Source plan:** inline `/plan` output in the session (no `.plan.md`); journeys below are the plan's.

## User journeys

1. As a customer with the app, I scan the counter or receipt code with my phone camera and the app opens and connects the shop or claims the load, as the in-app scanner would.
2. As a customer without the app, the same scan opens the shop's web page or the web claim page (unchanged behaviour, now in `[id].web.tsx`).
3. As a signed-out customer with the app, the link hands me to sign-in with the scan kept, and it is finished for me after I sign in (existing pending-scan flow).

## Task report

| Plan task | Test target | RED evidence | GREEN evidence |
|---|---|---|---|
| Phase 1: native ownership of `/join/` and `/claim/` (app.json + `public/.well-known`) | `src/lib/domain/__tests__/app-links.test.ts` | `npm test -- link-landing app-links`: suite failed to run, `WEB_LINK_PATHS is not iterable` (commit 52fcfde) | same command: 17 passed (commit 87f16be) |
| Phase 2: decide what a link does inside the app | `src/lib/domain/__tests__/link-landing.test.ts` | same run: `Cannot find module '../link-landing'` | same run: passed; `link-landing.ts` at 100% line/branch coverage |
| Phase 2: shared finish hook + native landing + route split | no unit test (React hooks/components; see gaps) | n/a | `npx tsc --noEmit` exit 0, `npx expo lint` 0 problems, full suite 95 suites / 1078 tests passed |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | A route's params parse to the same code the camera parses from the printed link | `link-landing.test.ts: reads the same code the scanner reads` | unit | PASS |
| 2 | Repeated `token` keys take the first; missing/non-uuid id or empty token is refused | `link-landing.test.ts: takes the first token…`, `refuses a link…` | unit | PASS |
| 3 | On web the page is shown regardless of session state | `linkLanding: shows the web page in a browser` | unit | PASS |
| 4 | In the app, signed in → finish the scan; signed out → hand off to `/sign-in` | `finishes the scan…`, `hands a signed-out customer…` | unit | PASS |
| 5 | In the app, nothing is decided while the session is restoring | `waits while the session is still being restored` | unit | PASS |
| 6 | A malformed link is reported before waiting on auth | `calls a broken link malformed…` | unit | PASS |
| 7 | `app.json` claims exactly `/join/` and `/claim/` on the default host with `autoVerify`, BROWSABLE + DEFAULT | `app-links.test.ts: Android App Links` | config | PASS |
| 8 | `assetlinks.json` names the app's package and only well-formed SHA-256 fingerprints | `publishes an assetlinks.json…` | config | PASS |
| 9 | `associatedDomains` includes the host; AASA names the bundle id and only the owned paths | `app-links.test.ts: iOS Universal Links` | config | PASS |
| 10 | The three sources (printed paths, app.json, well-known files) cannot drift apart | whole `app-links.test.ts` | config | PASS |

## Coverage and known gaps

- `npm run test:coverage`: all files 77.27% statements (unchanged pre-existing global figure; `src/lib` includes untested API/hook modules). New `link-landing.ts` 100%; `web-links.ts` 100% lines.
- `use-signed-in-scan.ts` and `native-link-landing.tsx` have no unit tests, matching the repo's existing practice for hooks and screens (`use-finish-scan.ts`, `scan.tsx`). Verified by typecheck, lint, and manual device steps in SETUP.md §7.6.
- `apple-app-site-association` ships with a placeholder Team ID `XXXXXXXXXX`; `assetlinks.json` ships only the shared Android debug-key fingerprint. Release fingerprints and the Team ID must be added before store builds (SETUP.md §7.6).
- Not verified in this run: OS-level link verification on a device, and that EAS Hosting serves the extensionless AASA file with a JSON content type.

## Merge evidence

- RED: `52fcfde test: add reproducers for a printed link opening the app`
- GREEN: `87f16be feat: a printed link opens the app when it is installed`
