-- Weigh, photograph, notify, settle.
--
-- Before this migration no function could set `final_total` to anything but a
-- copy of the estimate, so the "Actual total" the customer sees could never
-- differ from the guess they made when booking. This adds the scale reading,
-- the photo that justifies it, and the receipt the customer sends back.

-- ── orders: the weighing and the receipt ────────────────────────────────
alter table public.orders
  add column if not exists actual_weight_kg numeric(6, 2),
  add column if not exists weigh_photo_path text,
  add column if not exists weighed_at timestamptz,
  add column if not exists payment_proof_path text,
  add column if not exists payment_reference text;

-- ── shops: how this shop gets paid ──────────────────────────────────────
-- Published to the customer verbatim. Nothing here is a secret: they are the
-- same digits printed on a tarpaulin above the counter.
alter table public.shops
  add column if not exists gcash_number text not null default '',
  add column if not exists gcash_name text not null default '',
  add column if not exists maya_number text not null default '',
  add column if not exists bank_name text not null default '',
  add column if not exists bank_account_name text not null default '',
  add column if not exists bank_account_number text not null default '';

-- ── weigh_order: the scale reading becomes the bill ─────────────────────
-- Totals are recomputed here from `services`, never trusted from the client,
-- for the same reason place_order does it (see docs/SETUP.md).
create or replace function public.weigh_order(
  p_order_id uuid,
  p_service_id uuid,
  p_weight_kg numeric,
  p_photo_path text default null
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_service public.services;
  v_item public.order_items;
  v_line numeric(10, 2);
  v_total numeric(10, 2);
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;

  -- Mirrors canWeigh() in src/lib/domain/weigh-order.ts. Re-weighing an unpaid
  -- order is a correction; re-weighing a paid one would be raising a bill after
  -- it was settled, which is the case this guard exists for.
  if v_order.payment_status = 'paid' then
    raise exception 'cannot reprice a paid order';
  end if;
  if v_order.status in ('pending', 'completed', 'cancelled') then
    raise exception 'cannot weigh an order that is %', v_order.status;
  end if;
  if p_weight_kg is null or p_weight_kg <= 0 or p_weight_kg > 100 then
    raise exception 'invalid weight: %', p_weight_kg;
  end if;

  select * into v_service from public.services
  where id = p_service_id and shop_id = v_order.shop_id;
  if v_service.id is null then
    raise exception 'unknown service: %', p_service_id;
  end if;
  if v_service.unit <> 'per_kg' then
    raise exception '% is not sold by weight', v_service.name;
  end if;

  select * into v_item from public.order_items
  where order_id = p_order_id and service_id = p_service_id;
  if v_item.id is null then
    raise exception 'this order has no % line', v_service.name;
  end if;

  -- Below-minimum loads are billed at the minimum, exactly as place_order does.
  v_line := round(
    v_service.price * greatest(p_weight_kg, coalesce(v_service.min_quantity, 0)),
    2
  );

  update public.order_items
  set quantity = p_weight_kg,
      unit_price = v_service.price,
      subtotal = v_line
  where id = v_item.id;

  select round(sum(subtotal), 2) into v_total
  from public.order_items where order_id = p_order_id;

  update public.orders
  set final_total = v_total,
      actual_weight_kg = p_weight_kg,
      weigh_photo_path = coalesce(nullif(btrim(coalesce(p_photo_path, '')), ''),
                                  weigh_photo_path),
      weighed_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ── submit_payment_proof: the customer says they have sent it ───────────
-- Records a claim. It deliberately does NOT mark the order paid: only the shop,
-- looking at their own GCash/Maya/bank app, can do that via mark_order_paid.
create or replace function public.submit_payment_proof(
  p_order_id uuid,
  p_path text,
  p_reference text default '',
  p_method text default null
)
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
  if v_order.final_total is null then
    raise exception 'the shop has not confirmed the price yet';
  end if;
  if p_method is not null
     and p_method not in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other') then
    raise exception 'invalid payment method: %', p_method;
  end if;
  if length(btrim(coalesce(p_path, ''))) = 0 then
    raise exception 'a receipt is required';
  end if;

  update public.orders
  set payment_proof_path = btrim(p_path),
      payment_reference = btrim(coalesce(p_reference, '')),
      payment_method = coalesce(p_method, payment_method)
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- ── set_shop_payment_details: the owner publishes their rails ───────────
-- shops rows are otherwise superadmin-only to write; this narrows the opening
-- to the six payment columns, for people who can already operate the shop.
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
  if not public.can_operate_shop(p_shop_id) then
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

  return v_shop;
end;
$$;

-- ── order-photos: private, unlike shop-logos ────────────────────────────
-- A photo of someone's laundry and a GCash receipt carrying their name and
-- reference number are not public objects. Served by signed URL only.
insert into storage.buckets (id, name, public)
values ('order-photos', 'order-photos', false)
on conflict (id) do nothing;

-- Objects are keyed `<order_id>/<file>`, so the first path segment decides who
-- may touch them.
drop policy if exists "shop members read order photos" on storage.objects;
create policy "shop members read order photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'order-photos'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and public.can_operate_shop(o.shop_id)
    )
  );

drop policy if exists "customers read own order photos" on storage.objects;
create policy "customers read own order photos" on storage.objects
  for select to authenticated using (
    bucket_id = 'order-photos'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.customer_id = auth.uid()
    )
  );

drop policy if exists "shop members write order photos" on storage.objects;
create policy "shop members write order photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'order-photos'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and public.can_operate_shop(o.shop_id)
    )
  );

drop policy if exists "customers write own order photos" on storage.objects;
create policy "customers write own order photos" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'order-photos'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[1]
        and o.customer_id = auth.uid()
    )
  );
