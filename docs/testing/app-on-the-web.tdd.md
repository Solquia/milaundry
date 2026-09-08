# TDD evidence: the app on the web (login, customer, owner, POS)

**Source plan:** the request was to bring the app's login and signed-in screens to the website. The project is Expo universal, so the screens already compile for web; this run audited them in Chrome and fixed what stopped them from working or looking like the app. Journeys were derived during the run.

## User journeys

1. As a customer in a browser, I sign up or sign in and see the same home, shops, and scan screens as the app, in a phone-shaped column.
2. As a customer, I can refresh any page (`/shops`, `/settings`) without the page hanging.
3. As a shop owner in a browser, I sign in and use Orders, New Order (POS), Customers, Earnings, and Prices.
4. As anyone in a browser, I can enter the code printed under a QR square, since the browser cannot scan it.

## What was found in Chrome before the change

| Where | What happened | Cause |
|---|---|---|
| `/shops`, `/settings` refresh (signed-in customer) | "Maximum update depth exceeded", page dead | URL matched `(admin)/shops` first; the admin layout redirected to `/`, which resolved back into the admin group, forever |
| Merchant dashboard | "Invalid hook call" at the tab bar | React Compiler compiled the PascalCase `MerchantTabBar` factory as a component and planted a hook; React Navigation calls `tabBar(props)` as a plain function |
| Every screen at desktop width | Stretched to the full monitor width | No layout for wide viewports |
| `/scan` and the front-door scan | Stops at "Allow camera"; barcode scanning is Android/iOS only per the SDK 57 camera docs | No web entry path for a code |

## Task report

| Task | Test target | RED evidence | GREEN evidence |
|---|---|---|---|
| Role-safe redirects across route groups | `route-groups.test.ts` | `npm test -- route-groups web-frame scan-entry`: `Cannot find module '../route-groups'` (commit 76dd4ad) | same command: passes; Chrome: `/shops` refresh lands on the customer home instead of hanging (commit 9966eed) |
| Phone-width column on the web | `web-frame.test.ts` | `Cannot find module '../web-frame'` | passes; Chrome screenshots at 1280px show a 480px column on navy for customer and merchant screens |
| Typed code instead of the camera on the web | `scan-entry.test.ts` | `Cannot find module '../scan-entry'` | passes; Chrome: `/scan` shows "Enter your code" with the link field |
| Merchant tab bar hook crash | none (component wiring) | n/a | Chrome: merchant Orders, New Order, Customers, Earnings, Prices render with no console errors |

## Test specification

| # | What is guaranteed | Test | Type | Result |
|---|---|---|---|---|
| 1 | Each role maps to its own route group; unknown role is treated as a customer | `route-groups.test.ts: groupForRole` | unit | PASS |
| 2 | A wrong-role visitor is sent to the same screen inside their own group when it exists | `routeForRole: keeps the same screen…` | unit | PASS |
| 3 | …and to their home when it does not | `routeForRole: falls back…` | unit | PASS |
| 4 | The redirect target is never a bare path that could resolve into the wrong group | `never answers with a bare path…` | unit | PASS |
| 5 | The screen table matches the files in `src/app/(customer|merchant|admin)` | `GROUP_SCREENS lists exactly…` | config | PASS |
| 6 | Phones and narrow windows are never framed; wide web windows get a 480px column | `web-frame.test.ts` | unit | PASS |
| 7 | Web uses a typed code, native uses the camera | `scanEntryMode` | unit | PASS |
| 8 | A pasted link parses exactly as the camera's read of the printed code, whitespace forgiven, junk refused | `parseTypedCode` | unit | PASS |

## Coverage and known gaps

- `npm run test:coverage`: all files 77.42% statements (global figure, pre-existing untested API/hook modules). The three new domain modules are at 100%.
- `WebFrame`, `TypedCodeForm`, the layout redirects, and the merchant tab-bar change have no unit tests, matching the repo's practice for screens; they were verified in Chrome as listed above.
- The merchant layout fix (`src/app/(merchant)/_layout.tsx`) is **not committed**: that file carries earlier uncommitted work that introduced the factory, so the fix lives in the working tree with it.
- Not exercised on the web in this run: placing a POS order (the test shop has no price list and seeding one would change real shop data), the Bluetooth printer (reports unsupported on web by design), and the map card (address-only on web by design).
- Test accounts created for this run: customer `+639170000777` and owner `+639170000778` (owner of Sparkle Wash), both `@example.com` like the existing test users.

## Merge evidence

- RED: `76dd4ad test: add reproducers for the app on the web`
- GREEN: `9966eed feat: the app on the web, held to a phone-width column`
