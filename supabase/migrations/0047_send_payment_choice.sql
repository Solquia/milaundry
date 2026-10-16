-- 0047_send_payment_choice.sql
--
-- The customer tells the shop how they will pay.
--
-- choose_payment_method saved the method on every tap of GCash / Maya / Cash,
-- so the shop could not tell a choice the customer made from a default they
-- never touched, and nothing told them it had happened. Now the pay card picks
-- a method locally and sends it with one button; this stamps when it was sent
-- so the counter can say "Juan will pay cash at pickup" and the shop's bell
-- can ring for it. GCash and Maya still send through submit_payment_proof,
-- with the receipt, which is the shop's signal for those.

alter table public.orders
  add column if not exists payment_choice_sent_at timestamptz;

create or replace function public.send_payment_choice(p_order_id uuid, p_method text)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if v_order.customer_id is distinct from auth.uid() then
    raise exception 'not your order';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'order is cancelled';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'order is already paid';
  end if;
  if p_method not in ('cash', 'gcash', 'maya', 'card', 'bank_transfer', 'other') then
    raise exception 'invalid payment method: %', p_method;
  end if;

  update public.orders
  set payment_method = p_method,
      payment_choice_sent_at = now()
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.send_payment_choice(uuid, text) from public, anon;
grant execute on function public.send_payment_choice(uuid, text) to authenticated;
