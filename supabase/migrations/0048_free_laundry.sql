-- 0048_free_laundry.sql
--
-- Free laundry, on the counter's say-so. The loyalty programs of 0046 decide
-- by themselves who has earned a reward; this is the other half — the owner
-- or a staff member looks at the customer and decides this one is on the
-- house. It rides on the same reward columns (kind 'courtesy', benefit
-- 'free', whole order), so the bill, remove_order_reward and the reweigh
-- patch in confirm_order_price all treat it like any reward. It does not use
-- up a stamp, and the visit still counts toward the customer's card.

alter table public.orders drop constraint if exists orders_reward_kind_check;
alter table public.orders add constraint orders_reward_kind_check
  check (reward_kind in ('stamp_card', 'welcome', 'regular', 'courtesy'));

create or replace function public.give_free_laundry(p_order_id uuid)
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
  if v_order.status = 'cancelled' then
    raise exception 'reward: this order was cancelled';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'reward: this order is already paid';
  end if;
  if v_order.payment_proof_path is not null then
    raise exception 'reward: the customer already sent payment for the full amount';
  end if;
  if v_order.reward_kind is not null then
    raise exception 'reward: this order already has a reward. Take it off first';
  end if;

  update public.orders
  set reward_id = null,
      reward_kind = 'courtesy',
      reward_benefit = 'free',
      reward_value = 0,
      reward_estimate_discount = estimated_total,
      reward_discount = coalesce(final_total, 0),
      estimated_total = 0,
      final_total = case when final_total is null then null else 0 end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.give_free_laundry(uuid) from public, anon;
grant execute on function public.give_free_laundry(uuid) to authenticated;
