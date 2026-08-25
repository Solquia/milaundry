-- Customer online booking: pickup/delivery scheduling, bank transfer,
-- customer-chosen payment method, and shop reviews.

-- ── orders: schedule columns ────────────────────────────────────────────
alter table public.orders
  add column if not exists pickup_at timestamptz,
  add column if not exists deliver_by timestamptz;

-- ── payment methods: allow bank transfer ────────────────────────────────
alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders
  add constraint orders_payment_method_check
  check (payment_method in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other'));

-- ── place_order: accept a pickup/delivery schedule ──────────────────────
-- Signature changes, so drop the old overload to avoid RPC ambiguity.
drop function if exists public.place_order(
  uuid, jsonb, uuid, text, text, text, text, text, text, text, boolean);

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
  p_is_paid boolean default false,
  p_pickup_at timestamptz default null,
  p_deliver_by timestamptz default null
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
  if p_payment_method not in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other') then
    raise exception 'invalid payment method: %', p_payment_method;
  end if;
  if p_pickup_at is not null and p_deliver_by is not null
     and p_deliver_by <= p_pickup_at then
    raise exception 'delivery must come after pickup';
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
    payment_method, payment_status, paid_at, pickup_at, deliver_by
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
    case when p_is_paid then now() else null end,
    p_pickup_at,
    p_deliver_by
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

-- ── mark_order_paid: allow bank transfer ────────────────────────────────
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
     and p_method not in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other') then
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

-- ── choose_payment_method: the customer picks how they'll pay ───────────
-- Runs after the shop confirms the actual price; only the order's customer
-- may call it, and only while the order is still unpaid.
create or replace function public.choose_payment_method(p_order_id uuid, p_method text)
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
  if v_order.customer_id is distinct from auth.uid() then
    raise exception 'not your order';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'order is already paid';
  end if;
  if p_method not in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other') then
    raise exception 'invalid payment method: %', p_method;
  end if;

  update public.orders
  set payment_method = p_method
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ── reviews ─────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now(),
  unique (order_id) -- one review per order
);

create index if not exists reviews_shop_id_created_at_idx
  on public.reviews (shop_id, created_at desc);

alter table public.reviews enable row level security;

-- Anyone signed in can read a shop's reviews (they show on the shop page).
drop policy if exists reviews_select on public.reviews;
create policy reviews_select on public.reviews
  for select to authenticated using (true);

-- Only the customer who had a completed order at the shop may review it.
drop policy if exists reviews_insert on public.reviews;
create policy reviews_insert on public.reviews
  for insert to authenticated
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.orders o
      where o.id = order_id
        and o.customer_id = auth.uid()
        and o.shop_id = reviews.shop_id
        and o.status = 'completed'
    )
  );

-- Reviewers may remove their own review.
drop policy if exists reviews_delete on public.reviews;
create policy reviews_delete on public.reviews
  for delete to authenticated using (customer_id = auth.uid());
