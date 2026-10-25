-- 0056_part_payments.sql
--
-- A customer can pay part of the bill now and the rest at pickup: a ₱165
-- bill, ₱100 handed over today, ₱65 left. Staff remit the day's takings to
-- the owner every evening, so the ₱100 has to count on the day it came in,
-- not wait for the order to be marked paid.
--
-- Each part is kept with its own amount, time and method, so two parts paid
-- on different days each land on their own day. The order stays 'unpaid'
-- until the balance is settled with mark_order_paid; that final payment is
-- worth the bill less the parts already taken.
--
-- Orders are only ever written through functions (no update policy), so the
-- column needs no grant changes.

alter table public.orders
  add column if not exists part_payments jsonb not null default '[]'::jsonb;

-- record_part_payment: money in, short of the full bill.
create or replace function public.record_part_payment(
  p_order_id uuid,
  p_amount numeric,
  p_method text
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_paid numeric;
  v_total numeric;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'cannot take payment on a cancelled order';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'order is already paid';
  end if;
  if p_method is null
     or p_method not in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other') then
    raise exception 'invalid payment method: %', p_method;
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'part payment must be more than zero';
  end if;

  select coalesce(sum((part ->> 'amount')::numeric), 0) into v_paid
  from jsonb_array_elements(v_order.part_payments) as part;
  v_total := coalesce(v_order.final_total, v_order.estimated_total);

  -- The whole balance is a full payment, which mark_order_paid records.
  if v_paid + p_amount >= v_total then
    raise exception 'part payment covers the balance';
  end if;

  update public.orders
  set part_payments = part_payments || jsonb_build_array(jsonb_build_object(
        'amount', round(p_amount, 2),
        'at', now(),
        'method', p_method
      ))
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

-- undo_part_payment: takes back the latest part, for a mistyped amount.
create or replace function public.undo_part_payment(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'order is already paid';
  end if;
  if jsonb_array_length(v_order.part_payments) = 0 then
    raise exception 'no part payment to undo';
  end if;

  update public.orders
  set part_payments = part_payments - (jsonb_array_length(part_payments) - 1)
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.record_part_payment(uuid, numeric, text) from public, anon;
revoke all on function public.undo_part_payment(uuid) from public, anon;
grant execute on function public.record_part_payment(uuid, numeric, text) to authenticated;
grant execute on function public.undo_part_payment(uuid) to authenticated;
