-- ── Confirm the price, get paid, then wash ────────────────────────────────
-- weigh_order could only re-price a per-kilo line, so an online booking made
-- of flat or per-piece items (a comforter, bedsheets, an add-on) could never
-- be given an actual price — and submit_payment_proof refuses to take money
-- against no price, so that customer could never pay online at all.
--
-- confirm_order_price checks every line: a weighed line takes the scale's
-- reading, a counted line the pieces in the bag, and a line set to 0 pieces
-- (booked, not brought) is taken off the ticket. Lines keep the price the
-- customer booked at; only the counter's quantity changes. Mirrors
-- src/lib/domain/price-check.ts.
--
-- update_order_status then keeps an online order out of the machines until
-- the shop has confirmed the customer's payment (cash on delivery: until the
-- price is agreed). Replaces 0033's weigh-only guard. Mirrors
-- isHeldForPayment in src/lib/domain/order-settlement.ts.

create or replace function public.confirm_order_price(
  p_order_id uuid,
  p_lines jsonb,
  p_photo_path text default null
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_line record;
  v_min numeric;
  v_total numeric(10, 2);
  v_weight numeric(6, 2);
begin
  select * into v_order from public.orders where id = p_order_id for update;
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
    raise exception 'cannot confirm the price of an order that is %', v_order.status;
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'lines must be a list';
  end if;

  for v_line in
    select i.id, i.unit, i.unit_price, i.service_name, e.quantity
    from jsonb_to_recordset(p_lines) as e(item_id uuid, quantity numeric)
    join public.order_items i on i.id = e.item_id and i.order_id = p_order_id
  loop
    if v_line.quantity is null then
      raise exception 'no quantity for %', v_line.service_name;
    end if;

    if v_line.unit = 'per_kg' then
      if v_line.quantity <= 0 or v_line.quantity > 100 then
        raise exception 'invalid weight for %: %', v_line.service_name, v_line.quantity;
      end if;
      select coalesce(s.min_quantity, 0) into v_min
      from public.order_items i join public.services s on s.id = i.service_id
      where i.id = v_line.id;
      update public.order_items
      set quantity = v_line.quantity,
          subtotal = round(unit_price * greatest(v_line.quantity, coalesce(v_min, 0)), 2)
      where id = v_line.id;
    else
      if v_line.quantity < 0 or v_line.quantity > 500 or v_line.quantity <> trunc(v_line.quantity) then
        raise exception 'invalid count for %: %', v_line.service_name, v_line.quantity;
      end if;
      if v_line.quantity = 0 then
        delete from public.order_items where id = v_line.id;
      else
        update public.order_items
        set quantity = v_line.quantity,
            subtotal = round(unit_price * v_line.quantity, 2)
        where id = v_line.id;
      end if;
    end if;
  end loop;

  if not exists (select 1 from public.order_items where order_id = p_order_id) then
    raise exception 'an order needs at least one item';
  end if;

  select round(sum(subtotal), 2) into v_total
  from public.order_items where order_id = p_order_id;
  select sum(quantity) into v_weight
  from public.order_items where order_id = p_order_id and unit = 'per_kg';

  update public.orders
  set final_total = v_total,
      actual_weight_kg = v_weight,
      weigh_photo_path = coalesce(nullif(btrim(coalesce(p_photo_path, '')), ''), weigh_photo_path),
      weighed_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.confirm_order_price(uuid, jsonb, text) from public;
grant execute on function public.confirm_order_price(uuid, jsonb, text) to authenticated;

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

  if p_to = 'washing' and v_order.order_type = 'online' and v_order.payment_status <> 'paid' then
    if v_order.final_total is null then
      raise exception 'Confirm the actual price and send it to the customer before washing.';
    end if;
    if v_order.payment_method <> 'cash' then
      raise exception 'Wait for the customer''s payment and confirm it before washing.';
    end if;
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
