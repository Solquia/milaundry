-- SECURITY FIX: `can_operate_shop` returned NULL, so its guards never fired.
--
-- `my_role()` selects from `profiles where id = auth.uid()`. For an anonymous
-- caller that is NULL, so `my_role() = 'superadmin'` is NULL, and
-- `false OR NULL` is NULL — not false. Every guard written as
--
--     if not public.can_operate_shop(p_shop_id) then raise exception ...
--
-- therefore evaluated `if NULL then`, which does not execute. The guard was
-- skipped and the function ran on. Because these are SECURITY DEFINER, RLS did
-- not catch it either: an anonymous caller holding only the publishable key
-- could reach mark_order_paid, weigh_order, set_shop_payment_details and
-- set_shop_branding.
--
-- In RLS policies the same NULL is harmless — a policy predicate that is NULL
-- fails closed. The bug only bites inside plpgsql `if not ...`. So the fix is
-- to make this function total rather than to change my_role(), whose NULL is
-- relied on elsewhere.
create or replace function public.can_operate_shop(p_shop_id uuid)
returns boolean
language sql
stable security definer set search_path = public
as $$
  select coalesce(public.is_shop_member(p_shop_id), false)
      or coalesce(public.my_role() = 'superadmin', false);
$$;

-- Defence in depth for the three functions added in 0011/0012: state the
-- authentication requirement outright rather than inferring it from a helper,
-- the way place_order already does.
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
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;

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

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

create or replace function public.set_shop_branding(
  p_shop_id uuid,
  p_brand_accent smallint default null,
  p_tagline text default '',
  p_logo_url text default null
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
  if not public.can_operate_shop(p_shop_id) then
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
      logo_url = coalesce(nullif(btrim(coalesce(p_logo_url, '')), ''), logo_url)
  where id = p_shop_id
  returning * into v_shop;

  -- A miss used to return a row of nulls, which read to the client as success.
  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;
