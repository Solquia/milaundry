-- MiLaundry core schema
create extension if not exists pgcrypto;

-- â”€â”€ profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer'
    check (role in ('customer', 'merchant', 'superadmin')),
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

-- New auth users always start as customers; merchant/superadmin roles are
-- granted by a superadmin afterwards (never trusted from client metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- â”€â”€ shops â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  phone text not null default '',
  qr_token uuid not null default gen_random_uuid(),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, profile_id)
);

create table public.customer_shops (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, shop_id)
);

-- â”€â”€ services â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('per_kg', 'per_item', 'flat')),
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index services_shop_idx on public.services (shop_id);

-- â”€â”€ orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  status text not null default 'pending'
    check (status in ('pending', 'received', 'in_progress', 'ready', 'completed', 'cancelled')),
  estimated_total numeric(10, 2) not null default 0,
  final_total numeric(10, 2),
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_shop_idx on public.orders (shop_id);
create index orders_customer_idx on public.orders (customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  service_id uuid references public.services (id),
  service_name text not null,
  unit text not null,
  unit_price numeric(10, 2) not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  subtotal numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();
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
-- Security-definer RPCs enforcing MiLaundry business invariants.
-- Totals are always recomputed server-side; QR tokens are validated here.

-- Register the calling customer with a shop via its shop QR token.
create or replace function public.register_with_shop(p_shop_id uuid, p_token uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not exists (
    select 1 from public.shops
    where id = p_shop_id and qr_token = p_token and is_active
  ) then
    raise exception 'invalid shop QR';
  end if;

  insert into public.customer_shops (customer_id, shop_id)
  values (auth.uid(), p_shop_id)
  on conflict do nothing;
end;
$$;

-- Claim an unassigned order via its order QR token. Single-use: only works
-- while customer_id is null. Also registers the customer with the shop.
create or replace function public.claim_order(p_order_id uuid, p_token uuid)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.orders
  set customer_id = auth.uid(), claimed_at = now()
  where id = p_order_id
    and claim_token = p_token
    and customer_id is null
  returning * into v_order;

  if v_order.id is null then
    raise exception 'invalid or already-claimed order QR';
  end if;

  insert into public.customer_shops (customer_id, shop_id)
  values (auth.uid(), v_order.shop_id)
  on conflict do nothing;

  return v_order;
end;
$$;

-- Create an order. Items: [{"service_id": "...", "quantity": 2.5}, ...]
-- Totals are recomputed from the services table (client estimate is advisory).
create or replace function public.place_order(
  p_shop_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_notes text default ''
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_member boolean := public.is_shop_member(p_shop_id);
  v_order public.orders;
  v_item record;
  v_service public.services;
  v_line numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_status text;
  v_customer uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item';
  end if;

  if v_is_member then
    v_status := 'received';
    v_customer := p_customer_id; -- may be null (walk-in, claimable via QR)
  else
    -- customer flow: must be registered with the shop
    if not exists (
      select 1 from public.customer_shops
      where customer_id = auth.uid() and shop_id = p_shop_id
    ) then
      raise exception 'not registered with this shop';
    end if;
    v_status := 'pending';
    v_customer := auth.uid();
  end if;

  insert into public.orders (shop_id, customer_id, created_by, status, notes)
  values (p_shop_id, v_customer, auth.uid(), v_status, coalesce(p_notes, ''))
  returning * into v_order;

  for v_item in
    select (e ->> 'service_id')::uuid as service_id,
           (e ->> 'quantity')::numeric as quantity
    from jsonb_array_elements(p_items) e
  loop
    select * into v_service
    from public.services
    where id = v_item.service_id and shop_id = p_shop_id and is_active;

    if v_service.id is null then
      raise exception 'unknown service %', v_item.service_id;
    end if;
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'invalid quantity for service %', v_item.service_id;
    end if;

    v_line := case
      when v_service.unit = 'flat' then v_service.price
      else round(v_service.price * v_item.quantity, 2)
    end;
    v_total := v_total + v_line;

    insert into public.order_items
      (order_id, service_id, service_name, unit, unit_price, quantity, subtotal)
    values
      (v_order.id, v_service.id, v_service.name, v_service.unit,
       v_service.price, v_item.quantity, v_line);
  end loop;

  update public.orders
  set estimated_total = v_total
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, v_status, auth.uid());

  return v_order;
end;
$$;

-- Move an order through the status lifecycle. Shop members can perform any
-- valid transition; customers may only cancel their own pending orders.
create or replace function public.update_order_status(p_order_id uuid, p_to text)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_from text;
  v_allowed boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  v_from := v_order.status;

  if public.is_shop_member(v_order.shop_id) then
    null; -- members may attempt any transition (validated below)
  elsif v_order.customer_id = auth.uid()
        and v_from = 'pending' and p_to = 'cancelled' then
    null; -- customer cancelling own pending order
  else
    raise exception 'not allowed';
  end if;

  v_allowed := case v_from
    when 'pending' then p_to in ('received', 'cancelled')
    when 'received' then p_to in ('in_progress', 'cancelled')
    when 'in_progress' then p_to in ('ready', 'cancelled')
    when 'ready' then p_to in ('completed', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid transition % -> %', v_from, p_to;
  end if;

  update public.orders
  set status = p_to,
      final_total = case when p_to = 'completed'
                         then coalesce(final_total, estimated_total)
                         else final_total end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, v_from, p_to, auth.uid());

  return v_order;
end;
$$;

-- Merchant analytics: totals, unique/repeat customers, status breakdown.
create or replace function public.get_shop_analytics(p_shop_id uuid)
returns json
language plpgsql
stable
security definer set search_path = public
as $$
declare
  v_result json;
begin
  if not public.is_shop_member(p_shop_id) and public.my_role() <> 'superadmin' then
    raise exception 'not allowed';
  end if;

  select json_build_object(
    'total_orders', count(*),
    'total_revenue', coalesce(sum(coalesce(final_total, estimated_total))
                       filter (where status = 'completed'), 0),
    'active_orders', count(*) filter (where status in ('pending', 'received', 'in_progress', 'ready')),
    'unique_customers', count(distinct customer_id) filter (where customer_id is not null),
    'repeat_customers', (
      select count(*) from (
        select customer_id from public.orders
        where shop_id = p_shop_id and customer_id is not null
        group by customer_id having count(*) > 1
      ) r
    ),
    'orders_by_status', (
      select coalesce(json_object_agg(status, n), '{}'::json)
      from (select status, count(*) n from public.orders
            where shop_id = p_shop_id group by status) s
    )
  )
  into v_result
  from public.orders
  where shop_id = p_shop_id;

  return v_result;
end;
$$;

-- Per-customer stats for the merchant customer list.
create or replace function public.get_shop_customers(p_shop_id uuid)
returns table (
  customer_id uuid,
  full_name text,
  phone text,
  registered_at timestamptz,
  order_count bigint,
  total_spend numeric,
  last_order_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    cs.customer_id,
    p.full_name,
    p.phone,
    cs.created_at as registered_at,
    count(o.id) as order_count,
    coalesce(sum(coalesce(o.final_total, o.estimated_total))
      filter (where o.status = 'completed'), 0) as total_spend,
    max(o.created_at) as last_order_at
  from public.customer_shops cs
  join public.profiles p on p.id = cs.customer_id
  left join public.orders o
    on o.customer_id = cs.customer_id and o.shop_id = cs.shop_id
  where cs.shop_id = p_shop_id
    and public.is_shop_member(p_shop_id)
  group by cs.customer_id, p.full_name, p.phone, cs.created_at;
$$;

-- Superadmin: create a shop.
create or replace function public.admin_create_shop(
  p_name text,
  p_address text default '',
  p_phone text default ''
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  if public.my_role() <> 'superadmin' then
    raise exception 'not allowed';
  end if;
  insert into public.shops (name, address, phone, created_by)
  values (p_name, coalesce(p_address, ''), coalesce(p_phone, ''), auth.uid())
  returning * into v_shop;
  return v_shop;
end;
$$;

-- Superadmin: promote an existing user (by phone) to merchant of a shop.
create or replace function public.admin_assign_merchant(p_shop_id uuid, p_phone text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if public.my_role() <> 'superadmin' then
    raise exception 'not allowed';
  end if;

  select * into v_profile from public.profiles where phone = p_phone;
  if v_profile.id is null then
    raise exception 'no user with phone %', p_phone;
  end if;

  update public.profiles set role = 'merchant'
  where id = v_profile.id and role = 'customer';

  insert into public.shop_members (shop_id, profile_id)
  values (p_shop_id, v_profile.id)
  on conflict do nothing;
end;
$$;
-- Auth now uses synthetic emails (<digits>@phone.milaundry.app) because phone
-- sign-ups require an SMS provider. The real phone number arrives in signup
-- metadata, so the profile trigger must read it from there.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')
  );
  return new;
end;
$$;
