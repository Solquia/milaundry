-- 0045_sorting_stage.sql
--
-- A shop asked for a Sorting step before the wash:
--   In the shop -> Sorting -> Washing -> Drying -> Folded -> Ready -> Done
--
-- received -> washing stays allowed: app builds from before this step still
-- send it, and a counter that never sorts is not wrong. The payment hold stays
-- on `washing`: sorting a load does not put it in the machines.

alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending', 'received', 'sorting', 'washing', 'drying', 'folded',
                    'ready', 'completed', 'cancelled'));

create or replace function public.update_order_status(p_order_id uuid, p_to text)
returns public.orders
language plpgsql
security definer
set search_path = public
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
    when 'received' then p_to in ('sorting', 'washing', 'cancelled')
    when 'sorting' then p_to in ('washing', 'cancelled')
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

create or replace function public.get_shop_analytics(p_shop_id uuid)
returns json
language plpgsql
stable security definer
set search_path = public
as $$
declare
  v_result json;
begin
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;

  select json_build_object(
    'total_orders', count(*),
    'total_revenue', coalesce(sum(coalesce(final_total, estimated_total))
                       filter (where status = 'completed'), 0),
    'active_orders', count(*) filter (where status in
      ('pending', 'received', 'sorting', 'washing', 'drying', 'folded', 'ready')),
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
