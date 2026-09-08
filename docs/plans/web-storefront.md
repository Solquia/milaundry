# Per-tenant web storefront (white-label web)

Status: phases 1 to 3 built 2026-09-07 to 2026-09-08 (evidence under `docs/testing/`). Phase 4 remains.

## What it is

Every laundry on MiLaundry gets its own public web page, branded as that laundry,
at `https://<web-host>/s/<slug>`. A customer without the app can:

1. Browse the price list with no account.
2. Book a pickup or delivery, giving only a name and mobile number at checkout.
3. Scan the QR on a printed receipt with the phone camera, claim that load with
   a name and number, and follow its status.
4. See the shop's QR on the page. Scanned from inside the app it connects the
   account to the laundry, as the counter QR does today.

The page carries the shop's own branding: name, logo, storefront photo, accent
colour, tagline, address, map link, and payment rails. All of that already
exists on `shops` (migrations 0008, 0012, 0018). The web reuses it.

## What already fits

| Need | Existing piece |
| --- | --- |
| URL identity per shop | `shops.slug`, unique, backfilled (0008) |
| Branding fields | `logo_url`, `cover_url`, `brand_accent`, `tagline`, `latitude/longitude` |
| Guest peek before sign-in | `peek_scan` RPC, callable by `anon` (0016) |
| Booking with delivery and schedule | `place_order` RPC (0010, 0015) |
| Claiming a receipt | `claim_order` RPC, idempotent for the holder (0017) |
| QR parsing of an https form | `parseQrPayload` already accepts `https://milaundry.app/...` |
| Web build | `react-native-web` and `web.output: static` in app.json; `supabase.ts` is SSR-safe |
| Phone-based accounts without SMS | synthetic email in `phone-email.ts` |

## What is missing

1. Anonymous read of a shop and its services. RLS on `shops` and `services`
   requires `auth.uid()`. The web needs one public, slug-keyed read.
2. A guest identity. Today an account needs phone, name, and password. The web
   asks for phone and name only.
3. Registration with a shop by slug. `register_with_shop` needs the secret
   `qr_token`. A public storefront is itself the opt-in.
4. Web-safe screens. The customer shop and booking screens import `expo-maps`,
   haptics, and native entrance animations. Those do not build for web.
5. QR codes a phone camera can open. Both QRs are `milaundry://` deep links.
6. Hosting and a real host name. `WEB_HOST` is hard-coded to `milaundry.app`.

## Decisions (recommended, please confirm)

### D1. URL shape: path-based now, custom domains later

`https://<web-host>/s/<slug>`. One deploy, no wildcard DNS, works on EAS
Hosting today. Custom domains per tenant (`wash.sparklewash.ph`) become a
Phase 4 item: a `shops.custom_domain` column plus a host-to-slug lookup in the
root layout. Nothing in Phases 1 to 3 has to change for that.

### D2. Guest identity: name + phone, password only when the phone already has an account

Supabase phone OTP needs a paid SMS provider, which the project has avoided.
So:

- New edge function `web-guest-session` (service role, like
  `admin-create-shop-account`). Input: phone (E.164), full name.
- If no user exists for that phone's synthetic email: create one with a random
  password and `full_name`/`phone` metadata (the existing trigger fills
  `profiles`), then return a one-time sign-in token via
  `auth.admin.generateLink({ type: 'magiclink' })`. The browser exchanges the
  `hashed_token` with `verifyOtp` and holds a normal session.
- If a user already exists: return `{ exists: true }` and the web shows a
  password field ("Welcome back, enter your password"). This is the line that
  stops anyone from taking over an account by typing its number.
- The tracking page offers "Set a password to use the MiLaundry app", which
  calls `updateUser({ password })`. Until then the account works on the web
  only. The app's sign-in already accepts the phone.
- Rate limit the function per IP and per phone (a few calls per minute) so it
  cannot be used to mass-create accounts.

Guest orders therefore belong to a real `profiles` row keyed by phone. When the
customer later installs the app and signs in with that number, every web order
is already theirs. No merge step.

### D3. Every active shop is on the web unless it opts out

`shops.web_enabled boolean not null default true`. A toggle on the merchant
branding screen. The superadmin console shows the link.

### D4. QR values move to https, with backwards compatibility

- Shop QR: `https://<web-host>/join/<shop-id>?token=<qr_token>`
- Receipt QR: `https://<web-host>/claim/<order-id>?token=<claim_token>`

A phone camera opens the web page. The app's scanner keeps accepting the old
`milaundry://` values (receipts already printed) and learns the two new paths.
`/shop/<id>` and `/order/<id>` are not used because the customer and merchant
route groups already occupy those URLs on web.

The host comes from `EXPO_PUBLIC_WEB_HOST`, defaulting to `milaundry.app`.

## Backend changes (one migration, 0019_web_storefront.sql)

```sql
alter table public.shops
  add column if not exists web_enabled boolean not null default true;

-- Public read of one storefront. No created_by, no rails until the customer
-- is signed in and registered. The qr_token IS included: the page prints the
-- counter code, and a public page is itself the invitation the token used to
-- gate. Switching the page off takes the token off the web with it.
create function public.get_storefront(p_slug text)
returns jsonb  -- { shop: {...display fields...}, services: [...], reputation: {average, count} }
language sql stable security definer ...
-- only where is_active and web_enabled; active services only.
grant execute ... to anon, authenticated;

-- Registration by slug: the public page is the invitation.
create function public.register_with_shop_by_slug(p_slug text) returns uuid ...
-- requires auth.uid(); inserts customer_shops; returns shop id.
grant execute ... to authenticated;
```

`place_order` and `claim_order` are reused unchanged. The customer branch of
`place_order` already stamps `customer_name`/`customer_phone` from the profile
(0015), so the shop's order card shows the guest's name and number.

Payment rails (`gcash_number` and friends) are read after sign-in through the
existing `orders` select, exactly as the app does.

## Web routes (new files, web-safe only)

```
src/app/s/[slug]/_layout.tsx   loads get_storefront once; provides shop + theme
src/app/s/[slug]/index.tsx     storefront: hero, price list by category, QR, map link, reviews
src/app/s/[slug]/book.tsx      cart -> schedule -> delivery address -> contact -> payment method
src/app/s/[slug]/track.tsx     the guest's orders at this shop (session required)
src/app/claim/[id].tsx         receipt landing: peek_scan -> name+phone -> claim_order -> track
src/app/join/[id].tsx          counter QR landing: resolves slug and redirects to /s/<slug>
src/app/track/[orderId].tsx    one order's status, timeline, payment, "set a password"
```

Shared with the app (no changes): `domain/pricing`, `booking-schedule`,
`booking-slot`, `booking-estimate`, `order-status`, `wash-cycle`, `money`,
`phone-input`, `credentials`, `storefront`, `price-sections`, `shop-branding`,
`accent`, `qr` (extended).

New domain modules (pure, tested with jest):

- `domain/web-links.ts`: `storefrontUrl(slug)`, `joinUrl`, `claimUrl`, host
  from env. Replaces the constants inside `qr.ts`.
- `domain/guest-identity.ts`: validates name + phone, decides between
  "new guest", "needs password", and error copy.
- `domain/web-theme.ts`: maps `brand_accent` to CSS-friendly tokens
  (background, ink, surface) for the storefront.

Web components live under `src/components/web/` and use only
`react-native-web`-safe primitives: `View`, `Text`, `Pressable`, `Image` from
`expo-image`, `react-native-qrcode-svg` (SVG works on web). No `expo-maps`
(use a Google Maps link), no haptics, no BLE, no `expo-camera`.

## Phases

### Phase 1. Public storefront (read-only)

- Migration 0019: `web_enabled`, `get_storefront`.
- `EXPO_PUBLIC_WEB_HOST`, `domain/web-links.ts`, `qr.ts` reads the host from it
  and parses the two new paths.
- Routes: `s/[slug]` layout + index, `join/[id]` redirect.
- Storefront page: cover, logo, name, tagline, reputation and starting price
  (from `domain/storefront.ts`), price list grouped as the app groups it,
  address with "Open in Maps", phone with `tel:`, shop QR, "Book" call to action.
- `expo export -p web` succeeds; deploy with `eas deploy`.
- Merchant branding screen: "Your web page" row with the link, copy, share,
  and the `web_enabled` toggle.

Done when: a shop's link opens on a phone browser with the shop's colours and
prices, with no account.

### Phase 2. Guest booking

- Edge function `web-guest-session` (D2) with rate limiting.
- `register_with_shop_by_slug`.
- Cart and checkout on web, reusing the booking domain modules and the
  `place_order` call from `api.ts`.
- `track/[orderId]` with status timeline, estimate, payment rails once the
  shop has weighed, and "Set a password to use the app".
- Polling every 30 seconds while the tab is open (react-query `refetchInterval`).

Done when: a first-time visitor books a delivery with name and phone only and
watches the order move on the tracking page as the shop updates it.

### Phase 3. Receipt claim on the web

- Receipt QR switches to the https form (`domain/receipt.ts`). The printed
  slip says "Scan to follow this load".
- `claim/[id]`: `peek_scan` shows the shop's name, name + phone form, guest
  session, `claim_order`, redirect to `track/[orderId]`.
- The app scanner accepts the new values (`parseQrPayload`).

Done when: a walk-in customer with no app scans the docket with the phone
camera and sees the load's status.

### Phase 4. White-label polish

- Custom domain per shop (`shops.custom_domain`, host lookup).
- Open Graph tags per storefront (name, logo, tagline) for link previews.
- Printable QR poster from the merchant screen.
- Optional: web push or SMS when the order is ready (needs a provider).

## Risks and open points

- Account takeover by phone number is prevented only by the password check in
  D2. Do not weaken it to "phone only" for existing accounts.
- Random-password guest accounts have no recovery path, but neither do app
  accounts today (no SMS). The "set a password" prompt on the tracking page
  is the mitigation.
- `web.output: static` prerenders `s/[slug]` as one template; the shop data
  loads on the client. Fine for a storefront; Open Graph previews (Phase 4)
  need either `output: server` or a small edge function for crawlers.
- The root `_layout.tsx` loads Ionicons and providers meant for the app. They
  run on web without harm, but the web layout must not wait on the app's
  splash gate: `src/app/index.tsx` stays the app entry, and `/s/<slug>` never
  routes through it.
- `WEB_HOST` is used to validate scanned codes. Changing the host after
  receipts are printed means the parser must keep accepting the old host.
  Keep a list of accepted hosts rather than one value.

## Test plan

- Jest, pure domain: `web-links` (URL building, host override), `qr` (old
  scheme, new paths, wrong host, wrong ids), `guest-identity` (validation and
  branch copy), `web-theme` (every accent index yields readable contrast).
- Supabase: `get_storefront` returns nothing for inactive or opted-out shops
  and never includes `qr_token`; `register_with_shop_by_slug` refuses
  unauthenticated callers and opted-out shops.
- Edge function: new phone creates a user and returns a token; existing phone
  returns `exists: true` and no token; rate limit trips.
- Manual, per phase, recorded under `docs/testing/` as the repo does now.
