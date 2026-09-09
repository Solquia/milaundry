# MiLaundry — Setup

Expo app (customer + merchant + superadmin) backed by Supabase.

## 1. Supabase project

1. Create a project at https://supabase.com (or `supabase start` locally with the CLI).
2. Apply **every** migration in order (SQL editor, or `supabase db push` with the CLI).
   Skipping any of them leaves the app calling functions the database does not have,
   which surfaces in the app as *"Could not find the function public.… in the schema
   cache"*:
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_functions.sql`
   - `supabase/migrations/0004_phone_email_auth.sql`
   - `supabase/migrations/0005_shop_accounts.sql`
   - `supabase/migrations/0007_superadmin_view_as.sql`
   - `supabase/migrations/0008_shop_branding.sql`
   - `supabase/migrations/0009_owner_console.sql` — walk-in intake, payments, laundry
     stages, service categories/minimums
   - `supabase/migrations/0010_customer_booking.sql` — customer booking with a
     pickup/delivery schedule, bank transfer, reviews
   - `supabase/migrations/0011_weigh_and_settle.sql` — weighing, order photos,
     published payment rails, uploaded proof
   - `supabase/migrations/0012_shop_branding_self_serve.sql` — a shop editing its own
     logo, accent and tagline
   - `supabase/migrations/0013_fix_null_operator_guard.sql` — security fix: guards that
     never fired because `can_operate_shop` returned NULL
   - `supabase/migrations/0014_fix_logo_policy_name_binding.sql` — fix: the logo upload
     policy bound the wrong `name`
   - `supabase/migrations/0015_booking_customer_contact.sql` — a customer booking
     carries the booker’s name and number onto the order the shop sees
   - `supabase/migrations/0016_peek_scan.sql` — a guest sees the shop's name before
     signing up
   - `supabase/migrations/0017_claim_own_order.sql` — claiming is idempotent for the
     holder and row-locked
   - `supabase/migrations/0018_shop_cover_and_location.sql` — storefront photo and map pin
   - `supabase/migrations/0019_web_storefront.sql` — the public web page: `web_enabled`,
     `get_storefront`, `set_shop_web_enabled`
   - `supabase/migrations/0020_web_guest_booking.sql` — booking from the web page:
     `register_with_shop_by_slug`, and the rate-limit counter the guest session function uses

   `supabase/all-in-one.sql` is the same set concatenated, for a fresh project set up in
   one paste. Keep it in step whenever a migration is added.
3. Optional dev data: `supabase/seed.sql`.
4. **Auth settings** (Authentication → Providers → Phone):
   - Enable the Phone provider.
   - **Disable "Confirm phone"** (phone confirmations). This app uses phone + password
     with no OTP, so no SMS provider is needed.
5. Enable Realtime for the `orders` table (Database → Replication) so customers get
   live status updates.

## 2. App configuration

```bash
cp .env.example .env   # fill in EXPO_PUBLIC_SUPABASE_URL + EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm start
```

## 3. Deploy the account-provisioning function

Creating a login for a laundry shop requires the `service_role` key, which must never
ship in the Expo bundle — so it runs in an Edge Function instead:

```bash
supabase functions deploy admin-create-shop-account
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the
platform. Only set `AUTH_EMAIL_DOMAIN` if you also overrode
`EXPO_PUBLIC_AUTH_EMAIL_DOMAIN` in the app — the two must match:

```bash
supabase secrets set AUTH_EMAIL_DOMAIN=example.com
```

Until this function is deployed, "Create shop account" reports that provisioning is not
available; everything else in the superadmin console still works.

### Guest sessions for the web pages

A customer booking from a shop's web page types only a name and a mobile number. The
`web-guest-session` function creates the account (with a password nobody knows) and hands the
browser a one-time sign-in token; a number that already has an account is asked for its
password instead. It is called before anyone is signed in, so it must be deployed **without**
JWT verification; it rate-limits itself per number and per address through
`note_guest_attempt` (migration 0020):

```bash
supabase functions deploy web-guest-session --no-verify-jwt
```

Same `AUTH_EMAIL_DOMAIN` rule as above. Until it is deployed, the web booking page's last step
reports that it cannot reach the shop.

### Image storage (ImageKit)

Every picture the app stores — a shop's logo and cover, the photo of a load on the scale, the
receipt a customer sends — goes to [ImageKit](https://imagekit.io), not Supabase Storage. The
app bundle carries no ImageKit credential at all: it asks the `imagekit-media` function for a
one-use upload token, and that function is the only place the private key exists.

Create an ImageKit account, then take the three values from **Developer options → API keys**
and the URL endpoint from the same page:

```bash
supabase functions deploy imagekit-media
supabase secrets set   IMAGEKIT_PRIVATE_KEY=private_xxxxxxxxxxxxxxxxxxxxxxxxxxx   IMAGEKIT_PUBLIC_KEY=public_xxxxxxxxxxxxxxxxxxxxxxxxxxxx   IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/your_imagekit_id
```

JWT verification stays **on** — every caller is signed in. The function issues an ImageKit v2
upload token, which signs the whole upload payload, so the folder it picks is the folder the
upload must land in:

| Image | Folder | Visibility | Who may upload |
|---|---|---|---|
| Shop logo, shop cover | `/shops/<shop_id>` | public | the shop's owner, or a superadmin (`can_manage_shop`) |
| Weigh photo, payment receipt | `/orders/<order_id>` | **private**, signed links only | anyone who can read that order (its customer, the shop's members, a superadmin) |

A private file's plain CDN URL answers 403; the app fetches a fresh one-hour signed link
through the same function each time it shows one.

Nothing has to be migrated. Shops branded before the move keep a Supabase URL in the same
column, and orders photographed before it keep a Supabase object key — those keys have no
leading slash, ImageKit's paths do, and that is how the app tells which one it is holding.

Until this function is deployed, picking a logo or taking a weigh photo reports that the image
could not be uploaded; everything that does not touch an image still works.

## 4. Bootstrapping the first superadmin

Everyone who signs up starts as a **customer**, and there is deliberately no in-app path
to grant the superadmin role — so the first one is promoted by hand, exactly once.

1. Sign up normally in the app with the mobile number you want to administer with.
2. Run this in the Supabase SQL editor, using that number in E.164 form:

```sql
update public.profiles set role = 'superadmin' where phone = '+639XXXXXXXXX';
```

3. Sign out and back in. The app now routes you to the superadmin console.

Repeat for any additional superadmin — this is the only way to create one.

## 5. Running the platform as superadmin

From the console you can:

1. **Add a laundry shop** — name, address, optional contact number. Each shop gets its
   own registration QR.
2. **Create a shop account** — full name, mobile number, temporary password, and a role
   of *Owner* or *Staff*. This creates the login outright; hand over the number and
   temporary password and they can sign in to the shop dashboard immediately.
   An **Owner** runs the whole dashboard. **Staff** run the counter: they see the orders
   coming in, take new walk-in orders and edit prices, and nothing else — no Earnings, no
   customer book, and none of the shop settings (branding, map pin, payment rails, web
   page). The same rule applies on the web build and in the app, and the database
   refuses the owner-only calls to a staff session (`can_manage_shop`, migration 0021),
   so a bookmarked link cannot get around it.
3. **Attach an existing account** — for someone who already signed up themselves. They
   keep their own password.
4. **Review and remove accounts** — every login attached to the shop is listed with its
   role. A shop always keeps at least one Owner; removing the last one is refused both
   in the app and in the database. Removing someone's last shop returns them to a plain
   customer account.
5. **Deactivate a shop** — new customers can no longer register with it via QR. Existing
   orders and history are untouched, and it can be reactivated at any time.

## 6. Flows

- **Customer registers with a shop**: scans the shop QR (printed from the admin shop page).
- **Merchant POS**: creates a walk-in order → order detail shows a one-time claim QR →
  customer scans it to register with the shop *and* attach the order to their account.
  The same code is printed on the thermal docket as `https://<host>/claim/<order-id>?token=…`:
  the app claims it; a phone camera opens the web claim page (§7).
- **Order lifecycle**: pending → received → in_progress → ready → completed (cancel from
  any non-terminal state). Customers may only cancel their own *pending* orders.
- Totals are always recomputed server-side in `place_order`; the in-app estimate is advisory.

## 7. Web pages (one per shop)

Every active shop has a public page at `https://<EXPO_PUBLIC_WEB_HOST>/s/<slug>`, served
from the same Expo project as a static web export. The shop's counter QR is a link to
`/join/<shop-id>?token=…` on that host: the app's scanner connects the account, a phone
camera opens the shop's page.

1. Set `EXPO_PUBLIC_WEB_HOST` in `.env` **before** the first counter code is printed. The
   default host stays accepted by the scanner, so codes printed under it keep working after
   a change.
2. Build and deploy:

   ```bash
   npx expo export -p web     # writes ./dist
   npx eas deploy             # EAS Hosting; or upload ./dist to any static host
   ```

   The output is a single-page app: every path serves `index.html` and the shop loads in the
   browser through the `get_storefront` RPC, which is callable without a session. A host
   other than EAS needs the usual SPA fallback so any unknown path serves `index.html`.
3. Owners switch the page on or off from Settings → "Your web page", which also copies and
   shares the link. A shop the superadmin deactivates is off the web too.
4. **Booking** lives at `/s/<slug>/book`: a basket from the price list, a schedule, then a
   name and number. The order is placed through the same `place_order` the app uses and the
   customer is sent to `/track/<order-id>`, which re-reads the order every 30 seconds and offers
   "set a password" so the same number works in the app. `/s/<slug>/orders` lists a returning
   visitor's orders at that shop.
5. **Receipt claim** lives at `/claim/<order-id>?token=…`, the value printed on the docket. The
   page shows the shop's name (the token vouches for the code), takes a name and number, claims
   the load through the same `claim_order` the app uses, and opens `/track/<order-id>`. Receipts
   printed before this change carry the old `milaundry://` value, which the app still reads.
6. **Opening the app from a printed link.** A phone with the app installed opens `/join/…`
   and `/claim/…` in the app instead of the browser, through Android App Links and iOS
   Universal Links. Three things must agree, and `app-links.test.ts` holds them together:
   the paths the codes print (`WEB_LINK_PATHS`), the `intentFilters` / `associatedDomains`
   in `app.json`, and the two files in `public/.well-known/`, which the web export copies
   into `dist` so they are served from the host.
   - `assetlinks.json` must list the SHA-256 fingerprint of every key that signs a build:
     `eas credentials -p android` shows it per build profile, and a Play Store build uses the
     key under Play Console → Release → Setup → App signing. The file ships with the shared
     debug key so development builds verify; add the release keys before the first store build.
   - `apple-app-site-association` needs the Apple Team ID in `appIDs`
     (`<TEAM_ID>.com.milaundry.app`). It ships with `XXXXXXXXXX` until there is an Apple
     developer account; iOS will not open the app from a link until it is replaced.
   - After `npx eas deploy`, check both files are served as files, not the SPA page:
     `curl -sI https://<host>/.well-known/assetlinks.json` should answer `200` with a JSON
     content type. Then on a device: `adb shell pm get-app-links com.milaundry.app` should
     say `verified`, and
     `adb shell am start -a android.intent.action.VIEW -d "https://<host>/claim/<order-id>?token=<token>"`
     should open the app on the order.
   - A host change (`EXPO_PUBLIC_WEB_HOST`) must also change the host in `app.json` and
     rebuild the app; the verification is per host.

## 8. Tests

```bash
npm test              # unit tests (domain logic)
npm run test:coverage
npx tsc --noEmit      # typecheck
```
