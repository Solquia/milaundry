# TDD Evidence — Shop QR on Customers Tab + Raised Tab Bar

**Source plan:** journeys derived during this TDD run from the user's request and two reference screenshots (merchant Customers tab with empty-glyph tab icons; a reference app with a raised circular center QR button).
**Commits:** `95a2cd1` (RED) → `436c8f7` (GREEN domain) → `b07a71e` (UI wiring).

## User journeys

1. As a shop owner, I open the Customers tab and see my shop's QR code so a customer can scan it at the counter.
2. As a customer, I scan that shop QR in the app and get connected to that laundry shop, so I can book online and track my laundry.
3. As either role, I see clear icons in the bottom bar with the middle action raised as a circular QR button.

## Task report

| Task | Summary | Validation run | Result |
|---|---|---|---|
| Tab configuration | Added `src/lib/domain/tab-config.ts` defining merchant/customer tabs, icons, and the raised center flag | `npx jest src/lib/domain/__tests__/tab-config.test.ts` | RED: `Cannot find module '../tab-config'` → GREEN: 13 passed |
| Shop QR card | Customers tab now renders `buildShopQr(shop.id, shop.qr_token)` as a 220px QR with a Share fallback | `npx tsc --noEmit` | clean |
| Raised tab bar | New `RaisedTabBar` component wired into both group layouts | `npx jest` / `npx expo lint` | 24 suites, 184 tests passed; lint clean |
| Icon font | Preloaded `Ionicons.font` in the root layout to fix empty glyph boxes | `npx tsc --noEmit` | clean |

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Merchant tabs render in order Orders / POS / Customers / Analytics / Services | `tab-config.test.ts:lists the merchant tabs in display order` | unit | PASS |
| 2 | Customer tabs render in order My Laundry / Scan / Shops | `tab-config.test.ts:lists the customer tabs in display order` | unit | PASS |
| 3 | Each tab bar marks exactly one raised center button | `tab-config.test.ts:marks exactly one tab as the raised center button` | unit | PASS |
| 4 | The raised button sits at the exact middle index, so adding a tab can't silently push it off-center | `tab-config.test.ts:places the raised button at the exact middle...` | unit | PASS |
| 5 | The raised center button uses the QR icon | `tab-config.test.ts:uses a QR icon for the raised center button` | unit | PASS |
| 6 | Every tab has a non-empty title and icon, and route names are unique | `tab-config.test.ts:gives every tab a title and an icon` / `has unique route names` | unit | PASS |
| 7 | `centerTabIndex` returns -1 when no tab is flagged | `tab-config.test.ts:reports -1 when no tab is marked as the center` | unit | PASS |
| 8 | Shop QR round-trips through the scan parser (pre-existing, still green) | `qr.test.ts:round-trips a shop QR payload` | unit | PASS |

## Coverage

`npx jest` → **24 suites / 184 tests passed**. `tab-config.ts` is fully exercised by the 13 tests above; overall `src/lib/domain` coverage was 98.9% at the previous measurement and this module adds no uncovered branches.

## Known gaps

- `RaisedTabBar` is verified by type check and lint only — the repo has no React Native component-test setup, so the visual lift, safe-area padding, and press handling need a manual pass on device.
- The Ionicons empty-glyph boxes are addressed by preloading the font; confirming the fix requires running the app on the Android device where it was observed.
- Scanning end-to-end (merchant QR → customer camera → `registerWithShop`) is covered at the payload level by `qr.test.ts`; there is no E2E test driving a real camera.
