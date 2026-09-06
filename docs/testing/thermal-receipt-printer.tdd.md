# Thermal receipt printer with claim QR

## Source plan

Request: "Add a connect printer feature as well in here so we can print a
receipt with also the qr on the bottom to claim the order on their dashboard.
We want to be able to connect a thermal printer in here."

Expo has no Bluetooth module, so the transport is `react-native-ble-plx`
(3.5.1, Expo config plugin, development build only). Everything the printer
needs that is not a radio lives in pure domain modules so it can be pinned to
the byte without hardware:

| Module | Job |
| --- | --- |
| `src/lib/domain/escpos.ts` | ESC/POS bytes: init, align, bold, double size, feed, cut, QR (model, size, EC, store, print), MTU chunking, base64 |
| `src/lib/domain/receipt.ts` | Receipt layout on 32 or 48 columns from `OrderWithDetails` + shop, ending in `buildOrderQr(order.id, order.claim_token)` |
| `src/lib/domain/printer.ts` | Saved-printer record, scan ranking, write-characteristic choice, settings-card copy |
| `src/lib/printer-store.ts` | AsyncStorage record of the paired printer; never rejects |
| `src/lib/printer/ble-transport.ts` | Scan, connect, discover, chunked writes, disconnect; lazy require so Expo Go and web degrade |
| `src/lib/use-printer.ts` | State machine both screens read |
| `src/components/printer-card.tsx` | "Connect printer" card in merchant Settings |

## User journeys

1. **Pair.** Merchant opens Settings, taps the printer row, taps "Look for
   printers". Printer-like names sort to the top; one tap pairs and remembers
   it on this phone. "Print a test slip" proves the pairing. Paper width
   (58mm / 80mm) is a toggle on the same card.
2. **Print from an order.** Merchant order detail has a Receipt card with
   "Print receipt". The slip carries shop name/address/phone, docket number,
   date, customer, each line with quantity and subtotal, ESTIMATED or TOTAL
   with a TO PAY / PAID stamp per the docket rule, notes, then the claim QR
   and "Scan in the MiLaundry app to follow this order on your phone".
3. **Print after charging.** The POS "Order saved" screen offers "Print
   receipt" when a printer is paired; it fetches the full order and prints.
4. **Claim.** The customer scans the printed QR; it is the same payload as
   the on-screen QR, so `claimOrder` puts the order on their dashboard.
5. **No radio.** In Expo Go or on web the card reads "Printing needs a
   development build" and print buttons stay disabled.

## Task report

### RED

`npx jest src/lib/domain/__tests__/escpos.test.ts src/lib/domain/__tests__/receipt.test.ts src/lib/domain/__tests__/printer.test.ts`

```
FAIL src/lib/domain/__tests__/escpos.test.ts
  Cannot find module '../escpos' from 'src/lib/domain/__tests__/escpos.test.ts'
FAIL src/lib/domain/__tests__/receipt.test.ts
  Cannot find module '../receipt' from 'src/lib/domain/__tests__/receipt.test.ts'
FAIL src/lib/domain/__tests__/printer.test.ts
  Cannot find module '../printer' from 'src/lib/domain/__tests__/printer.test.ts'

Test Suites: 3 failed, 3 total
Tests:       0 total
```

Commit `381cd15 test: add reproducers for the thermal receipt printer`.

### GREEN

Same command after implementing the three modules:

```
Tests:       40 passed, 40 total
```

The base64 encoder was added afterwards with its own test (14 passed in
`escpos.test.ts`). Full suite, type check and lint:

```
npx jest          Test Suites: 82 passed, 82 total   Tests: 934 passed, 934 total
npx tsc --noEmit  exit 0
npx eslint src    exit 0
```

Commit `b48c000 feat: connect a Bluetooth thermal printer and print the docket with its claim QR`.

### Checkpoints met along the way

- The item line first used `item.unit` raw; `PricingUnit` is
  `per_kg | per_item | flat`, so the receipt reuses `formatQuantity`
  from `price-label.ts` ("5 kg", "1 piece").
- The first draft stamped TO PAY on an unweighed order. `docket.ts` says an
  estimate carries no stamp, so the receipt prints ESTIMATED with no stamp,
  TOTAL + TO PAY once weighed, TOTAL + PAID once settled.
- The fixture had to be a full `OrderWithDetails` (no cast) to keep `tsc`
  honest about the row shape.

## Test specification

| Test | Pins |
| --- | --- |
| escpos: control commands | ESC @, ESC a 0/1/2, ESC E, GS ! 0x11/0x00, ESC d n clamped to 255, GS V 66 0 |
| escpos: text | printable ASCII kept, everything else becomes `?`, line feed appended |
| escpos: qrCode | model 2, size, EC M, store, print in that order; pL/pH split for 300 bytes; size clamped 1..16 |
| escpos: chunkBytes | 45 bytes at 20 gives 20/20/5 with nothing lost; empty and zero-size guards |
| escpos: bytesToBase64 | padding cases `G0A=`, `SGkK`, `//79/A==` |
| receipt: paper widths | 58mm is 32 columns, 80mm is 48 |
| receipt: moneyPlain | `P1,234.50`, no peso glyph |
| receipt: twoColumn / centered | right edge lands on the column, long left text clipped, short text centred |
| receipt: buildReceipt | header bold+big+centred; address and phone; docket and customer; item lines; ESTIMATED with no stamp; TO PAY when weighed; PAID with final total; notes; QR value equals `buildOrderQr`; scan instruction after the QR; cut last; 48-column widening; empty shop fields skipped |
| receipt: receiptToEscPos | starts with ESC @, centre before a centred line, a rule is one full row of dashes, ends with the cut |
| printer: parseSavedPrinter | null for garbage or missing id; name and paper defaults |
| printer: looksLikePrinter | MTP-II, PT-210, XP-P300, RPP02N, POS-58, GOOJPRT recognised; earbuds and null not |
| printer: rankScanResults | dedupe by id keeping the latest reading; printer-like first; RSSI within a tier |
| printer: pickWriteCharacteristic | 2AF1/FFE1 preferred over other writables; read-only ignored; short UUIDs case-insensitive |
| printer: printerCopy | one title/caption per state |

## Coverage and known gaps

`npx jest --coverage` scoped to the new domain modules:

| File | Stmts | Branch | Funcs | Lines |
| --- | --- | --- | --- | --- |
| escpos.ts | 100 | 95.45 | 100 | 100 |
| printer.ts | 95.45 | 91.11 | 100 | 97.22 |
| receipt.ts | 98.5 | 73.91 | 100 | 100 |

Gaps, all deliberate:

- `ble-transport.ts`, `use-printer.ts`, `printer-store.ts` and
  `printer-card.tsx` are untested here. They wrap a native radio and React
  state; the byte and layout logic they call is what the tests cover.
- No hardware run yet. The ESC/POS sequences follow the Epson reference and
  the common clones (Goojprt, Xprinter, MTP-II), but the first physical print
  is the real acceptance test. If a printer prints nothing, the likely cause
  is the write characteristic: add its UUID to `KNOWN_WRITE_UUIDS`.
- Double-width lines (shop name, docket) are not wrapped; a shop name longer
  than 16 characters on 58mm paper wraps by the printer's own rule.
- The paper width is chosen by the merchant, not detected.
- This needs a development build (`npx expo prebuild` or EAS). Expo Go has
  no BLE module and the card says so.

## Merge evidence

- `381cd15` test: reproducers (RED)
- `b48c000` feat: implementation (GREEN), 934 tests, tsc and eslint clean
- The wiring into `src/app/(merchant)/settings.tsx`, `order/[id].tsx` and
  `pos.tsx` sits in the working tree alongside the pre-existing uncommitted
  rewrites of those screens and is not in the feat commit, because those
  files could not be split into printer-only hunks.
