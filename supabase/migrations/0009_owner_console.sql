-- Owner console: walk-in intake, fulfillment, payments, laundry-stage
-- pipeline, and richer service pricing (categories + minimum weight).

-- ── orders: intake / fulfillment / payment columns ──────────────────────
alter table public.orders
  add column if not exists order_type text not null default 'online'
    check (order_type in ('walk_in', 'online')),
  add column if not exists fulfillment text not null default 'pickup'
    check (fulfillment in ('pickup', 'delivery')),
  add column if not exists delivery_address text not null default '',
  add column if not exists customer_name text not null default '',
  add column if not exists customer_phone text not null default '',
  add column if not exists payment_method text not null default 'cash'
    check (payment_method in ('cash', 'gcash', 'maya', 'card', 'other')),
  add column if not exists payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid')),
  add column if not exists paid_at timestamptz;

-- Existing merchant-created orders were walk-ins by definition.
update public.orders o
set order_type = 'walk_in'
where exists (
  select 1 from public.shop_members m
  where m.shop_id = o.shop_id and m.profile_id = o.created_by
);

-- Historical completed orders count as settled so receivables start clean.
update public.orders
set payment_status = 'paid', paid_at = updated_at
where status = 'completed' and payment_status = 'unpaid';

-- ── orders: laundry-stage status pipeline ───────────────────────────────
alter table public.orders drop constraint if exists orders_status_check;
update public.orders set status = 'washing' where status = 'in_progress';
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'received', 'washing', 'drying', 'folded',
                    'ready', 'completed', 'cancelled'));

-- ── services: categories + minimum billable quantity ────────────────────
alter table public.services
  add column if not exists category text not null default 'other'
    check (category in ('wash_fold', 'ironing', 'dry_cleaning',
                        'special_items', 'self_service', 'other')),
  add column if not exists min_quantity numeric(10, 2) not null default 0
    check (min_quantity >= 0),
  add column if not exists description text not null default '',
  add column if not exists sort_order integer not null default 0;

-- ── place_order: walk-in details + minimum-weight pricing ───────────────
-- Signature changes, so drop the old overload to avoid RPC ambiguity.
drop function if exists public.place_order(uuid, jsonb, uuid, text);

create or replace function public.place_order(
  p_shop_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_notes text default '',
  p_order_type text default null,
  p_fulfillment text default 'pickup',
  p_delivery_address text default '',
  p_customer_name text default '',
  p_customer_phone text default '',
  p_payment_method text default 'cash',
  p_is_paid boolean default false
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_member boolean := public.can_operate_shop(p_shop_id);
  v_order public.orders;
  v_item record;
  v_service public.services;
  v_line numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_status text;
  v_customer uuid;
  v_order_type text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item';
  end if;
  if p_fulfillment not in ('pickup', 'delivery') then
    raise exception 'invalid fulfillment: %', p_fulfillment;
  end if;
  if p_fulfillment = 'delivery' and length(btrim(coalesce(p_delivery_address, ''))) = 0 then
    raise exception 'delivery orders need an address';
  end if;
  if p_payment_method not in ('cash', 'gcash', 'maya', 'card', 'other') then
    raise exception 'invalid payment method: %', p_payment_method;
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

  v_order_type := coalesce(
    p_order_type,
    case when v_is_member then 'walk_in' else 'online' end
  );
  if v_order_type not in ('walk_in', 'online') then
    raise exception 'invalid order type: %', v_order_type;
  end if;

  insert into public.orders (
    shop_id, customer_id, created_by, status, notes,
    order_type, fulfillment, delivery_address, customer_name, customer_phone,
    payment_method, payment_status, paid_at
  )
  values (
    p_shop_id, v_customer, auth.uid(), v_status, coalesce(p_notes, ''),
    v_order_type,
    p_fulfillment,
    btrim(coalesce(p_delivery_address, '')),
    btrim(coalesce(p_customer_name, '')),
    btrim(coalesce(p_customer_phone, '')),
    p_payment_method,
    case when p_is_paid then 'paid' else 'unpaid' end,
    case when p_is_paid then now() else null end
  )
  returning * into v_order;

  for v_item in
    select * from jsonb_to_recordset(p_items) as x(service_id uuid, quantity numeric)
  loop
    select * into v_service from public.services
    where id = v_item.service_id and shop_id = p_shop_id and is_active;
    if v_service.id is null then
      raise exception 'unknown service: %', v_item.service_id;
    end if;
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'invalid quantity for service %', v_service.name;
    end if;

    if v_service.unit = 'flat' then
      v_line := v_service.price;
    else
      -- Below-minimum loads are billed at the minimum quantity.
      v_line := round(
        v_service.price * greatest(v_item.quantity, coalesce(v_service.min_quantity, 0)),
        2
      );
    end if;

    insert into public.order_items
      (order_id, service_id, service_name, unit, unit_price, quantity, subtotal)
    values
      (v_order.id, v_service.id, v_service.name, v_service.unit,
       v_service.price, v_item.quantity, v_line);
    v_total := v_total + v_line;
  end loop;

  update public.orders
  set estimated_total = v_total,
      final_total = case when p_is_paid then v_total else final_total end
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, v_status, auth.uid());

  return v_order;
end;
$$;

-- ── update_order_status: laundry-stage transitions ──────────────────────
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

  if public.can_operate_shop(v_order.shop_id) then
    null; -- members and superadmin may attempt any transition (validated below)
  elsif v_order.customer_id = auth.uid()
        and v_from = 'pending' and p_to = 'cancelled' then
    null; -- customer cancelling own pending order
  else
    raise exception 'not allowed';
  end if;

  v_allowed := case v_from
    when 'pending' then p_to in ('received', 'cancelled')
    when 'received' then p_to in ('washing', 'cancelled')
    when 'washing' then p_to in ('drying', 'cancelled')
    when 'drying' then p_to in ('folded', 'cancelled')
    when 'folded' then p_to in ('ready', 'cancelled')
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

-- ── mark_order_paid ─────────────────────────────────────────────────────
create or replace function public.mark_order_paid(p_order_id uuid, p_method text default null)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'cannot mark a cancelled order as paid';
  end if;
  if p_method is not null
     and p_method not in ('cash', 'gcash', 'maya', 'card', 'other') then
    raise exception 'invalid payment method: %', p_method;
  end if;

  update public.orders
  set payment_status = 'paid',
      paid_at = coalesce(paid_at, now()),
      payment_method = coalesce(p_method, payment_method),
      final_total = coalesce(final_total, estimated_total)
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ── get_shop_analytics: refresh active-status list ──────────────────────
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
