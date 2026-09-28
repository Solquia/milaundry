-- ── Weigh before wash ─────────────────────────────────────────────────────
-- An online customer booked on an estimated weight and never saw the scale.
-- Once their load is washed it can never be weighed dry again, and
-- `completed` used to copy the estimate into final_total — so an online
-- by-weight order could be finished and billed without anyone weighing it,
-- and the customer could never pay online (payment opens at a confirmed
-- price). The app now asks for the scale first; this refuses the same move
-- for any client that does not.
--
-- Walk-ins are exempt: the customer stood at the counter for the weighing.
-- Identical to 0009's definition apart from the guard.

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

  if p_to = 'washing'
     and v_order.order_type = 'online'
     and v_order.final_total is null
     and v_order.payment_status <> 'paid'
     and exists (
       select 1 from public.order_items
       where order_id = p_order_id and unit = 'per_kg'
     ) then
    raise exception 'Weigh the load and send the actual price before washing this online order.';
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
