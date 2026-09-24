-- Booking again, and booking the way you like it.
--
-- Three additions, all columns with defaults, so every existing row, policy
-- and function keeps working unchanged:
--
--   * a saved address can say which building, which unit, and what it is
--     near — the three things a rider asks on the phone when the street
--     alone was not enough;
--   * a customer can keep laundry preferences (detergent, softener, separate
--     whites, delicates, air dry, free-text instructions) in a table only
--     they can read, which every booking starts from;
--   * a shop lists which of those preferences it actually honours, so a
--     customer is never offered "air dry" by a laundromat with no line.
--
-- Deliberately NOT changed: `place_order`. The preferences travel on the
-- order as plain lines in `orders.notes`, which every shop screen and printed
-- ticket already shows, so the counter reads them without a release of its
-- own. The address policies in 0024 already cover the new address columns.

alter table public.customer_addresses
  add column if not exists building text not null default ''
    check (length(building) <= 80),
  add column if not exists unit text not null default ''
    check (length(unit) <= 40),
  add column if not exists landmark text not null default ''
    check (length(landmark) <= 120);

-- Their own table, not a column on `profiles`: the "merchant reads own shop
-- customers" policy (0002) lets staff of every shop a customer ever connected
-- to read that whole row, and a free-text instruction written for one laundry
-- is not something every other laundry should be able to select. A shop sees
-- preferences only as they arrive on an order placed with it.
create table if not exists public.customer_laundry_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(preferences) = 'object'),
  updated_at timestamptz not null default now()
);

alter table public.customer_laundry_preferences enable row level security;

-- Yours and nobody else's, in every direction; no shop-side read at all.
drop policy if exists customer_laundry_preferences_own_select on public.customer_laundry_preferences;
create policy customer_laundry_preferences_own_select on public.customer_laundry_preferences
  for select using (auth.uid() = profile_id);

drop policy if exists customer_laundry_preferences_own_insert on public.customer_laundry_preferences;
create policy customer_laundry_preferences_own_insert on public.customer_laundry_preferences
  for insert with check (auth.uid() = profile_id);

drop policy if exists customer_laundry_preferences_own_update on public.customer_laundry_preferences;
create policy customer_laundry_preferences_own_update on public.customer_laundry_preferences
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists customer_laundry_preferences_own_delete on public.customer_laundry_preferences;
create policy customer_laundry_preferences_own_delete on public.customer_laundry_preferences
  for delete using (auth.uid() = profile_id);

-- Every shop starts out offering everything, which is what they all did
-- before this column existed. A shop narrows it; the app only shows what is
-- listed. The check keeps the list to keys the app knows how to draw.
alter table public.shops
  add column if not exists supported_preferences text[] not null
    default array['detergent', 'softener', 'separate_whites', 'delicates', 'air_dry', 'instructions']
    check (
      supported_preferences <@ array['detergent', 'softener', 'separate_whites', 'delicates', 'air_dry', 'instructions']
    );
