# Web storefront, phase 1: the public shop page — TDD evidence

## Source plan

`docs/plans/web-storefront.md` (2026-09-07). The owner asked for a white-label
web version of MiLaundry per laundry, so that a customer without the app can
book, claim a receipt, follow an order, and see the shop's QR. Phase 1 is the
read-only page: branding, prices, reviews, contact, counter QR.

## User journeys

1. As a customer without the app, I want to open a laundry's link and see its
   prices in its own colours, so that I can decide to use it without installing
   anything.
2. As a customer with the app, I want to scan the QR on that page and be
   connected to the laundry, the way the counter code works.
3. As a customer who points a phone camera at the counter code, I want to land
   on the shop's page rather than on a dead `milaundry://` link.
4. As a shop owner, I want to find my link, copy it, share it, and switch the
   page off, so that I control what is public.

## Task report

### Task 1 — Links and codes (`src/lib/domain/web-links.ts`, `qr.ts`)

**RED** — `web-links.test.ts` (9 tests): host normalisation strips scheme,
path, case; blank env falls back to `milaundry.app`; the default host is always
kept in the accepted list so codes already printed survive a host change.
`qr.test.ts` rewritten: the shop code is now
`https://<host>/join/<id>?token=…`; the receipt code stays on the deep-link
scheme until phase 3; the parser reads the old scheme, the old `/shop` and
`/order` paths, the new `/join` and `/claim` paths, a configured host, and
refuses `/s/<slug>`.

**GREEN** — `parseQrPayload(raw, hosts = acceptedHosts())` with a path-to-type
table. Every caller of `buildShopQr` (merchant QR card, admin shop page)
prints the web link without change.

### Task 2 — The shop's colour on the web (`src/lib/domain/web-theme.ts`)

**RED** — `web-theme.test.ts`: for every entry in the app's `ACCENTS` palette,
white on the brand tone, the brand tone on white, and the ink on the soft
field all clear WCAG AA (4.5:1). A tone added to the app that fails on the web
fails this test.

**GREEN** — `storefrontTheme(accent)` and a WCAG `contrastRatio`.

### Task 3 — One public read (`supabase/migrations/0019_web_storefront.sql`)

- `shops.web_enabled boolean not null default true`.
- `get_storefront(p_slug)` — `security definer`, granted to `anon`: display
  fields, active services in sort order, the latest 20 reviews without the
  reviewer. Returns nothing for an unknown slug, an inactive shop, or a shop
  that switched its page off, so the three cannot be told apart. It includes
  `qr_token` on purpose: the page prints the counter code, and a public page
  is the invitation the token used to gate. Off means off the web, token
  included.
- `set_shop_web_enabled(p_shop_id, p_enabled)` — `can_operate_shop` guarded.

Applied via MCP as `0019_web_storefront`. Verified with
`select … from shops s cross join lateral get_storefront(s.slug)`: two seeded
shops answered, one with 2 services and 1 review.

### Task 4 — The page (`src/app/s/[slug]/index.tsx`, `src/components/web/`)

Web-safe primitives only: `View`, `Text`, `Pressable`, `expo-image`,
`react-native-svg`, `react-native-qrcode-svg`. No maps component, no haptics,
no camera, no Bluetooth. `expo-router/head` sets the tab title to the shop's
name. The address opens the customer's own maps app (`directionsUrl` with a
pin, `searchUrl` without); the phone is a `tel:` link; the sticky footer holds
"Call to book" in the brand colour and "Directions" on the soft field.

`src/app/join/[id].tsx` resolves a counter code through the existing
`peek_scan` RPC and redirects to `/s/<slug>`; a code the server will not vouch
for says so.

### Task 5 — Owner controls (`src/components/web-page-card.tsx`)

"Your web page" on merchant Settings under Branding: the link, Copy, Share,
and an on/off switch bound to `set_shop_web_enabled`. Refreshes every shop
surface through `invalidateShopSurfaces`.

### Task 6 — Build and hosting

`web.output` moved from `static` to `single`: the static export wrote
`s/[slug].html`, and `npx expo serve` answered 404 for `/s/sparkle-clean`
because nothing rewrote the dynamic route. A single-page export serves every
path from `index.html`, which every static host including EAS Hosting can do.
`docs/SETUP.md` §7 documents `EXPO_PUBLIC_WEB_HOST`, the export, and the SPA
fallback. `.env.example` carries the variable.

### Task 7 — A logo that never decoded (`src/components/shop-logo.tsx`)

The seeded shop's `logo_url` points at a 14-byte object: an upload made
before `ensurePhotoBytes` guarded order photos. `expo-image` rendered an empty
disc on the web page (and does in the app). The shared `ShopLogo` now falls
back to the initials on `onError`, so a broken upload shows the mark the shop
had before it uploaded anything. The stub file itself needs re-uploading by
the shop.

## Verification

- `npx jest` — all suites pass (29 tests across the three new/changed files).
- `npx tsc --noEmit` — clean.
- `npx eslint` on the new files — clean.
- `npx expo export -p web` — succeeds; `/s/[slug]` and `/join/[id]` are in the
  route list.
- Browser check on the exported build served with a SPA fallback:
  `http://localhost:8122/s/sparkle-clean` renders the hero in the shop's chosen
  accent, two price sections with `₱176/kg · 2 kg minimum` and `₱123/piece`,
  the 5.0 rating with its one review, the address with Directions, the phone
  with Call, and the counter QR. No console errors.

## Code review

Reviewed by the code-reviewer agent after the build. No critical findings.

- **High, accepted as a product decision:** pages default to on, so from 0019
  onward `qr_token` is readable for any active shop and stops being proof of
  standing at the counter. That is what the page is for, and phase 2 adds
  registration by slug anyway. Recorded in the migration header.
- **Fixed:** `parseQrPayload` looked up path segments with a plain object, so
  `/constructor/<uuid>` slipped past the guard (test added). `set_shop_web_enabled`
  turned a page on when handed null; it now refuses. Review rows are keyed on
  the review `id`, which the RPC now returns.
- **Deferred:** server-rendered link previews need `static` output plus a host
  that rewrites dynamic routes; scheduled for phase 4. `all-in-one.sql` drift
  predates this work.

## Left for later phases

- Booking, guest identity, and tracking (phase 2); receipt claim on the web
  (phase 3); custom domains and link previews (phase 4).
- `supabase/all-in-one.sql` stops at migration 0010 and predates this work.
