-- Staff accounts see the counter, not the books.
--
-- shop_members has carried an owner/staff role since 0005, but every guard
-- asked only "is this person a member?", so a staff login could open the
-- earnings screen, the customer book, and every shop setting. This narrows
-- the owner-only surface: analytics, the customer book, and the shop's own
-- settings (branding, cover, map pin, payment rails, web page, logo uploads).
-- Orders, walk-in orders and the price list stay open to every member.

-- ── helpers ─────────────────────────────────────────────────────────────
-- The caller's role inside one shop: 'owner' or 'staff' for a member, 'owner'
-- for a superadmin (who may run any shop), null for everyone else.
create or replace function public.my_shop_role(p_shop_id uuid)
returns text
language sql
stable security definer set search_path = public
as $$
  select case
    when coalesce(public.my_role() = 'superadmin', false) then 'owner'
    else (
      select sm.role from public.shop_members sm
      where sm.shop_id = p_shop_id and sm.profile_id = auth.uid()
    )
  end;
$$;

-- Total (never null), like can_operate_shop after 0013: `if not ...` in
-- plpgsql must see a real boolean.
create or replace function public.can_manage_shop(p_shop_id uuid)
returns boolean
language sql
stable security definer set search_path = public
as $$
  select coalesce(public.my_shop_role(p_shop_id) = 'owner', false);
$$;

revoke all on function public.my_shop_role(uuid) from public;
revoke all on function public.can_manage_shop(uuid) from public;
grant execute on function public.my_shop_role(uuid) to authenticated;
grant execute on function public.can_manage_shop(uuid) to authenticated;

-- ── earnings: owners only ───────────────────────────────────────────────
create or replace function public.get_shop_analytics(p_shop_id uuid)
returns json
language plpgsql
stable security definer set search_path = public
as $$
declare
  v_result json;
begin
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;

  select json_build_object(
    'total_orders', count(*),
    'total_revenue', coalesce(sum(coalesce(final_total, estimated_total))
                       filter (where status = 'completed'), 0),
    'active_orders', count(*) filter (where status in
      ('pending', 'received', 'washing', 'drying', 'folded', 'ready')),
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

-- ── customer book: owners only ──────────────────────────────────────────
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
stable security definer set search_path = public
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
    and public.can_manage_shop(p_shop_id)
  group by cs.customer_id, p.full_name, p.phone, cs.created_at;
$$;

-- ── shop settings: owners only ──────────────────────────────────────────
create or replace function public.set_shop_branding(
  p_shop_id uuid,
  p_brand_accent smallint default null,
  p_tagline text default '',
  p_logo_url text default null,
  p_cover_url text default null
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;
  if p_brand_accent is not null
     and (p_brand_accent < 0 or p_brand_accent >= 12) then
    raise exception 'invalid accent: %', p_brand_accent;
  end if;
  if length(btrim(coalesce(p_tagline, ''))) > 60 then
    raise exception 'tagline is too long';
  end if;

  update public.shops
  set brand_accent = p_brand_accent,
      tagline = btrim(coalesce(p_tagline, '')),
      logo_url = coalesce(nullif(btrim(coalesce(p_logo_url, '')), ''), logo_url),
      cover_url = coalesce(nullif(btrim(coalesce(p_cover_url, '')), ''), cover_url)
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

create or replace function public.set_shop_location(
  p_shop_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'invalid pin';
  end if;

  update public.shops
  set latitude = p_latitude,
      longitude = p_longitude
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

create or replace function public.set_shop_payment_details(
  p_shop_id uuid,
  p_gcash_number text default '',
  p_gcash_name text default '',
  p_maya_number text default '',
  p_bank_name text default '',
  p_bank_account_name text default '',
  p_bank_account_number text default ''
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;

  update public.shops
  set gcash_number = btrim(coalesce(p_gcash_number, '')),
      gcash_name = btrim(coalesce(p_gcash_name, '')),
      maya_number = btrim(coalesce(p_maya_number, '')),
      bank_name = btrim(coalesce(p_bank_name, '')),
      bank_account_name = btrim(coalesce(p_bank_account_name, '')),
      bank_account_number = btrim(coalesce(p_bank_account_number, ''))
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

create or replace function public.set_shop_web_enabled(p_shop_id uuid, p_enabled boolean)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;
  if p_enabled is null then
    raise exception 'enabled is required';
  end if;

  update public.shops
  set web_enabled = p_enabled
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

-- Direct row updates on shops (the app writes through the RPCs above, but
-- the policy should say the same thing) and logo/cover uploads follow suit.
drop policy if exists "members update own shop" on public.shops;
drop policy if exists "owners update own shop" on public.shops;
create policy "owners update own shop" on public.shops
  for update using (public.can_manage_shop(id));

drop policy if exists "shop members manage own logo" on storage.objects;
drop policy if exists "shop owners manage own logo" on storage.objects;
create policy "shop owners manage own logo" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_manage_shop(s.id)
    )
  )
  with check (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_manage_shop(s.id)
    )
  );
