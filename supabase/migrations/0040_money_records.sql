-- ── The owner's money records, kept on the server ─────────────────────────
-- Three things the expense tracker (0039) left on the phone or out entirely:
--
--   1. The daily sales goal and the drawer count at close lived in
--      AsyncStorage, so a new phone, a second counter tablet or the web
--      dashboard started blank. Both are now shop rows.
--   2. Rent and wages are the same amount on the same day every month. A
--      recurring bill is a template; the app offers to log it when it falls
--      due and links the logged expense back to it (`recurring_id`), at most
--      once per bill per month.
--   3. A receipt photo per expense, in a private bucket. Supabase Storage,
--      like shop logos (shop-asset.ts), not ImageKit: this needs no edge
--      function, and the owner check is the same folder rule.
--
-- All owner-only (can_manage_shop, 0021). The goal is not a column on
-- `shops` on purpose: customers read that row for the storefront.

-- 1a. The daily goal ---------------------------------------------------------
create table if not exists public.shop_sales_goals (
  shop_id uuid primary key references public.shops (id) on delete cascade,
  daily_goal numeric(10, 2) check (daily_goal is null or (daily_goal > 0 and daily_goal <= 10000000)),
  updated_at timestamptz not null default now()
);

drop trigger if exists shop_sales_goals_touch on public.shop_sales_goals;
create trigger shop_sales_goals_touch
  before update on public.shop_sales_goals
  for each row execute function public.touch_updated_at();

alter table public.shop_sales_goals enable row level security;
drop policy if exists "owners manage sales goals" on public.shop_sales_goals;
create policy "owners manage sales goals"
  on public.shop_sales_goals for all to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

-- 1b. The drawer count at close, one per shop per day ------------------------
create table if not exists public.shop_day_closes (
  shop_id uuid not null references public.shops (id) on delete cascade,
  day date not null,
  counted numeric(10, 2) not null check (counted >= 0),
  difference numeric(10, 2) not null,
  tone text not null check (tone in ('even', 'over', 'short')),
  closed_at timestamptz not null default now(),
  closed_by uuid default auth.uid() references auth.users (id) on delete set null,
  primary key (shop_id, day)
);

alter table public.shop_day_closes enable row level security;
drop policy if exists "owners manage day closes" on public.shop_day_closes;
create policy "owners manage day closes"
  on public.shop_day_closes for all to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

-- 2. Recurring bills ---------------------------------------------------------
create table if not exists public.shop_recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0 and amount <= 1000000),
  category text not null check (
    category in ('supplies', 'utilities', 'rent', 'wages', 'repairs', 'delivery', 'other')
  ),
  note text not null default '' check (char_length(note) <= 200),
  paid_from text not null default 'cash' check (paid_from in ('cash', 'gcash', 'bank', 'other')),
  -- 29–31 fall on the month's last day in a shorter month (expense-recurring.ts).
  day_of_month smallint not null check (day_of_month between 1 and 31),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_recurring_expenses_shop_idx
  on public.shop_recurring_expenses (shop_id, is_active);

drop trigger if exists shop_recurring_expenses_touch on public.shop_recurring_expenses;
create trigger shop_recurring_expenses_touch
  before update on public.shop_recurring_expenses
  for each row execute function public.touch_updated_at();

alter table public.shop_recurring_expenses enable row level security;
drop policy if exists "owners manage recurring expenses" on public.shop_recurring_expenses;
create policy "owners manage recurring expenses"
  on public.shop_recurring_expenses for all to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

alter table public.shop_expenses
  add column if not exists recurring_id uuid
    references public.shop_recurring_expenses (id) on delete set null;

-- A double tap on "Log it" cannot pay the rent twice.
create unique index if not exists shop_expenses_recurring_month_idx
  on public.shop_expenses (recurring_id, (date_trunc('month', spent_on::timestamp)))
  where recurring_id is not null;

-- 3. Receipt photos ----------------------------------------------------------
-- Keyed `<shop_id>/receipt-<ms>.<ext>`; the first segment is the owner check.
alter table public.shop_expenses
  add column if not exists receipt_path text;

alter table public.shop_expenses drop constraint if exists shop_expenses_receipt_in_shop;
alter table public.shop_expenses
  add constraint shop_expenses_receipt_in_shop check (
    receipt_path is null
    or (char_length(receipt_path) <= 300 and split_part(receipt_path, '/', 1) = shop_id::text)
  );

insert into storage.buckets (id, name, public)
values ('shop-receipts', 'shop-receipts', false)
on conflict (id) do nothing;

drop policy if exists "shop owners manage receipts" on storage.objects;
create policy "shop owners manage receipts" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'shop-receipts'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_manage_shop(s.id)
    )
  )
  with check (
    bucket_id = 'shop-receipts'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_manage_shop(s.id)
    )
  );

notify pgrst, 'reload schema';
