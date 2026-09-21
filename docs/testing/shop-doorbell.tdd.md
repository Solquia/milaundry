# The shop rings when a customer orders — TDD evidence

## Source plan

The owner's request (session 2026-09-17): "can we make sure that when a
customer orders it rings or it notifies the owners that someone ordered and
find a way that we can test it."

## The fault

An online booking landed in the shop's order list on a 15-second poll and
nowhere else. The counter had to be looking at the list. Walk-ins the shop
typed itself were the same silent insert as a customer booking from a phone.

There is still no push-notification pipeline (EAS credentials, FCM, a
server-side send). This change is the doorbell the counter can hear while
the app is open, plus a test button so the shop does not have to wait for
a real customer.

## User journeys

1. As a shop with the app open, I want the phone to ring when a customer
   books online, so I do not miss the load while I am on another tab.
2. As a shop taking a walk-in at the till, I do not want the phone to ring
   at me for an order I just typed.
3. As a shop setting the app up, I want a **Ring the shop** button, so I
   can hear the bell without placing a fake order.

## Task report

### Task 1 — When to ring, as data (`src/lib/domain/shop-doorbell.ts`)

`nextDoorbell(seen, orders, enabled)` answers the chimes and the ids the
next look should treat as already seen. The first look (`seen === null`)
is always silent: those orders were already in the shop. Walk-ins and
cancelled rows never chime. A muted phone still advances `seen`, so
turning the bell back on does not dump a backlog.

**RED** — `npx jest src/lib/domain/__tests__/shop-doorbell.test.ts`
→ `Cannot find module '../shop-doorbell'`

**GREEN** — 21 tests passed. Coverage on `shop-doorbell.ts`: statements
~100%, branches ≥ 90%, functions 100%.

### Task 2 — Hear it now (`DoorbellCard`, `doorbell-sound`)

Merchant settings gained a **New-order bell** card: a mute, and
**Ring the shop**. The test tap unlocks the browser's audio, asks for
notification permission so a background tab can ring later, plays the
ding-dong, vibrates on a phone, and shows the same banner a real order
would. Copy after the tap: "Rang. If you did not hear it, turn the
volume up."

### Task 3 — Watch the list (`useShopDoorbellWatch`)

The merchant shell subscribes to `orders` INSERT for the shop and
refetches `['shop-orders', shopId]` every 8 seconds as a backup. A new
online id raises one banner, even if two bookings land in the same
refresh.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|---|---|---|---|---|
| 1 | A new phone rings until someone silences it | `shop-doorbell.test.ts:starts a new phone ringing` | unit | PASS | `npx jest shop-doorbell.test.ts` |
| 2 | The first look at an existing list stays quiet | `stays quiet on the first look` | unit | PASS | same |
| 3 | A new online booking the shop has not seen rings | `rings for a new online booking` | unit | PASS | same |
| 4 | A walk-in the counter just took does not ring | `does not ring for a walk-in` | unit | PASS | same |
| 5 | A muted bell still marks the order seen | `stays quiet when the bell is off` | unit | PASS | same |
| 6 | Two bookings become one banner, not two | `counts two bookings rather than stacking two banners` | unit | PASS | same |
| 7 | The test chime does not need a customer | `is a ring the shop can hear without a customer placing an order` | unit | PASS | same |
| 8 | The settings card offers **Ring the shop** | `says the phone rings, and offers a way to hear it now` | unit | PASS | same |
| 9 | No regression across the app | `npx jest` | unit | PASS | full suite |

## How to hear it

1. Sign in as the shop.
2. Open **Settings** (the cog).
3. Under **New-order bell**, tap **Ring the shop**.
4. You should hear a ding-dong (web), feel a vibration (phone), and see
   a blue "Test ring" banner.
5. To prove a real booking: keep the shop signed in, place an order from
   the shop's `/s/<slug>` page on another phone or browser. The shop
   phone should ring within a few seconds.

A browser may stay silent until **Ring the shop** has been tapped once
in that tab — that tap is what allows sound on the next real order.

## Coverage and known gaps

- Domain module is the tested contract. The speaker (`doorbell-sound.ts`)
  is not unit-tested: oscillators and `Vibration` are the platform.
- There is still no push notification when the Android app is killed.
  That needs `expo-notifications` and a new APK. The in-app bell covers
  the counter phone that stays open.
