-- Row Level Security policies. All client access goes through these;
-- writes with cross-cutting invariants go through security-definer RPCs
-- (see 0003_functions.sql).

-- Helpers -----------------------------------------------------------------
create or replace function public.my_role()
returns text
language sql stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_shop_member(p_shop_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.shop_members
    where shop_id = p_shop_id and profile_id = auth.uid()
  );
$$;

-- profiles ----------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "own profile read" on public.profiles
  for select using (id = auth.uid());

create policy "own profile update" on public.profiles
  for update using (id = auth.uid())
  with check (id = auth.uid() and role = (select role from public.profiles p where p.id = auth.uid()));

create policy "superadmin reads all profiles" on public.profiles
  for select using (public.my_role() = 'superadmin');

create policy "superadmin updates profiles" on public.profiles
  for update using (public.my_role() = 'superadmin');

create policy "merchant reads own shop customers" on public.profiles
  for select using (
    exists (
      select 1
      from public.customer_shops cs
      join public.shop_members sm on sm.shop_id = cs.shop_id
      where cs.customer_id = profiles.id
        and sm.profile_id = auth.uid()
    )
  );

-- shops -------------------------------------------------------------------
alter table public.shops enable row level security;

create policy "authenticated read active shops" on public.shops
  for select using (auth.uid() is not null);

create policy "superadmin manages shops" on public.shops
  for all using (public.my_role() = 'superadmin');

create policy "members update own shop" on public.shops
  for update using (public.is_shop_member(id));

-- shop_members ------------------------------------------------------------
alter table public.shop_members enable row level security;

create policy "members see own membership" on public.shop_members
  for select using (profile_id = auth.uid() or public.is_shop_member(shop_id));

create policy "superadmin manages memberships" on public.shop_members
  for all using (public.my_role() = 'superadmin');

-- customer_shops ----------------------------------------------------------
alter table public.customer_shops enable row level security;

create policy "customer sees own registrations" on public.customer_shops
  for select using (customer_id = auth.uid());

create policy "merchant sees shop customers" on public.customer_shops
  for select using (public.is_shop_member(shop_id));

-- inserts happen via register_with_shop()/claim_order() RPCs only

-- services ----------------------------------------------------------------
alter table public.services enable row level security;

create policy "authenticated read services" on public.services
  for select using (auth.uid() is not null);

create policy "members manage services" on public.services
  for all using (public.is_shop_member(shop_id))
  with check (public.is_shop_member(shop_id));

-- orders ------------------------------------------------------------------
alter table public.orders enable row level security;

create policy "customer reads own orders" on public.orders
  for select using (customer_id = auth.uid());

create policy "members read shop orders" on public.orders
  for select using (public.is_shop_member(shop_id));

-- inserts and status changes via place_order()/update_order_status() RPCs

-- order_items -------------------------------------------------------------
alter table public.order_items enable row level security;

create policy "read items of visible orders" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_items.order_id
        and (o.customer_id = auth.uid() or public.is_shop_member(o.shop_id))
    )
  );

-- order_status_history ----------------------------------------------------
alter table public.order_status_history enable row level security;

create policy "read history of visible orders" on public.order_status_history
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_status_history.order_id
        and (o.customer_id = auth.uid() or public.is_shop_member(o.shop_id))
    )
  );
