-- ── A booking arrived at the shop with nobody's name on it ──────────────
-- `place_order` only ever wrote `customer_name`/`customer_phone` from the
-- walk-in fields the counter types in. A customer booking from the app types
-- neither — they already gave both when they signed up — so the row landed with
-- two empty strings, and the merchant's order card fell back to
-- "Walk-in customer" with no number under it. The shop could be looking at an
-- online order for a rider pickup with no way to ring the person who booked it.
--
-- The details belong on the order row rather than being joined at read time:
-- `profiles` is readable to a merchant only through the "merchant reads own
-- shop customers" policy, and the name on an order is a fact about the order as
-- taken — it should not change later because someone edited their profile.
--
-- Same body as 0010, with the stamping block below the membership branch, plus
-- a backfill for bookings already placed.
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
  v_profile public.profiles;
  v_name text := btrim(coalesce(p_customer_name, ''));
  v_phone text := btrim(coalesce(p_customer_phone, ''));
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

  -- Whoever the order belongs to, carry their name and number onto it so the
  -- shop can call them. Anything typed at the counter still wins: the person
  -- standing there may be dropping off on someone else's behalf, and theirs is
  -- the number worth ringing. This also covers a merchant placing an order for
  -- a known customer without re-typing details the account already holds.
  if v_customer is not null and (v_name = '' or v_phone = '') then
    select * into v_profile from public.profiles where id = v_customer;
    if v_profile.id is not null then
      if v_name = '' then
        v_name := btrim(coalesce(v_profile.full_name, ''));
      end if;
      if v_phone = '' then
        v_phone := btrim(coalesce(v_profile.phone, ''));
      end if;
    end if;
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
    v_name,
    v_phone,
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

-- ── Backfill: bookings already placed under the old function ────────────
-- Only fills blanks, and only from the account the order already belongs to, so
-- a walk-in whose details the shop typed by hand is left exactly as written.
-- Idempotent — a second run matches nothing.
update public.orders o
set customer_name = case
      when btrim(o.customer_name) = '' then btrim(coalesce(p.full_name, ''))
      else o.customer_name
    end,
    customer_phone = case
      when btrim(o.customer_phone) = '' then btrim(coalesce(p.phone, ''))
      else o.customer_phone
    end
from public.profiles p
where p.id = o.customer_id
  and (btrim(o.customer_name) = '' or btrim(o.customer_phone) = '');

-- ── Claiming a walk-in also names it ────────────────────────────────────
-- `claim_order` (0009) hands an unclaimed walk-in to an account. From that
-- moment the shop should see who holds it, so fill whichever field the counter
-- left blank. A trigger rather than an edit to `claim_order`, so any future
-- path that attaches a customer to an order gets the same treatment.
create or replace function public.stamp_claimed_order_contact()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if new.customer_id is null or new.customer_id is not distinct from old.customer_id then
    return new;
  end if;
  if btrim(coalesce(new.customer_name, '')) <> ''
     and btrim(coalesce(new.customer_phone, '')) <> '' then
    return new;
  end if;

  select * into v_profile from public.profiles where id = new.customer_id;
  if v_profile.id is null then
    return new;
  end if;

  if btrim(coalesce(new.customer_name, '')) = '' then
    new.customer_name := btrim(coalesce(v_profile.full_name, ''));
  end if;
  if btrim(coalesce(new.customer_phone, '')) = '' then
    new.customer_phone := btrim(coalesce(v_profile.phone, ''));
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_claimed_order_contact on public.orders;
create trigger stamp_claimed_order_contact
  before update of customer_id on public.orders
  for each row execute function public.stamp_claimed_order_contact();
