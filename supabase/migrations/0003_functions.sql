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
