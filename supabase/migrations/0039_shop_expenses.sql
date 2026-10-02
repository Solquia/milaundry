-- ── What the shop spends ──────────────────────────────────────────────────
-- The Sales screen counted money in and nothing else, so an owner could see a
-- good month and still not know whether it paid the rent. This is the other
-- side of the ledger: one row per expense, dated by the calendar day it was
-- paid (a plain date, so "September's electricity" is September on every
-- phone), in pesos like every other amount (numeric(10,2)).
--
-- Owner-only, read and write. Staff run the counter; the shop's costs and its
-- profit are the owner's business (can_manage_shop, 0021). The categories are
-- mirrored in src/lib/domain/expense-categories.ts; a key is never renamed.
-- A future date is refused by the app (validateExpenseDraft), not here: a
-- CHECK that reads the clock breaks restoring a dump the day after.

create table if not exists public.shop_expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  spent_on date not null default ((now() at time zone 'Asia/Manila')::date),
  amount numeric(10, 2) not null check (amount > 0 and amount <= 1000000),
  category text not null check (
    category in ('supplies', 'utilities', 'rent', 'wages', 'repairs', 'delivery', 'other')
  ),
  note text not null default '' check (char_length(note) <= 200),
  paid_from text not null default 'cash' check (paid_from in ('cash', 'gcash', 'bank', 'other')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists shop_expenses_shop_day_idx
  on public.shop_expenses (shop_id, spent_on desc);

drop trigger if exists shop_expenses_touch on public.shop_expenses;
create trigger shop_expenses_touch
  before update on public.shop_expenses
  for each row execute function public.touch_updated_at();

alter table public.shop_expenses enable row level security;

drop policy if exists "owners manage shop expenses" on public.shop_expenses;
create policy "owners manage shop expenses"
  on public.shop_expenses for all
  to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

notify pgrst, 'reload schema';
