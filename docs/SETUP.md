# MiLaundry — Setup

Expo app (customer + merchant + superadmin) backed by Supabase.

## 1. Supabase project

1. Create a project at https://supabase.com (or `supabase start` locally with the CLI).
2. Apply migrations in order (SQL editor, or `supabase db push` with the CLI):
   - `supabase/migrations/0001_schema.sql`
   - `supabase/migrations/0002_rls.sql`
   - `supabase/migrations/0003_functions.sql`
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

## 3. Bootstrapping roles

Everyone who signs up starts as a **customer**. Promote the first superadmin manually
(SQL editor):

```sql
update public.profiles set role = 'superadmin' where phone = '+639XXXXXXXXX';
```

From the app, the superadmin can then:
1. Create laundry shops (each gets a shop registration QR).
2. Assign merchants by phone number (promotes the account and attaches it to the shop).

## 4. Flows

- **Customer registers with a shop**: scans the shop QR (printed from the admin shop page).
- **Merchant POS**: creates a walk-in order → order detail shows a one-time claim QR →
  customer scans it to register with the shop *and* attach the order to their account.
- **Order lifecycle**: pending → received → in_progress → ready → completed (cancel from
  any non-terminal state). Customers may only cancel their own *pending* orders.
- Totals are always recomputed server-side in `place_order`; the in-app estimate is advisory.

## 5. Tests

```bash
npm test              # unit tests (domain logic)
npm run test:coverage
npx tsc --noEmit      # typecheck
```
