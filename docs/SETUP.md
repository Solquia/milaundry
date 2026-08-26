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
- **Order lifecycle**: pending → received → in_progress → ready → completed (cancel from
  any non-terminal state). Customers may only cancel their own *pending* orders.
- Totals are always recomputed server-side in `place_order`; the in-app estimate is advisory.

## 7. Tests

```bash
npm test              # unit tests (domain logic)
npm run test:coverage
npx tsc --noEmit      # typecheck
```
