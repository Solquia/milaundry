-- 0054_period_order_costs.sql
--
-- The owner's view of the shop from anywhere: for every order taken in a
-- window, what it cost in supplies and products, and who at the counter took
-- it. get_order_costs (0051, 0053) answers this for one order; the Sales
-- screen needs a whole day, week or month in one call, not one call per order.
--
-- Owner-only, like the rest of 0051: a staff session is refused.

create or replace function public.get_period_order_costs(
  p_shop_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  order_id uuid,
  cost numeric,
  lines integer,
  costed_lines integer,
  taken_by text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;
  if p_to <= p_from or p_to - p_from > interval '400 days' then
    raise exception 'bad range';
  end if;

  return query
  with line_costs as (
    select i.order_id,
           round(case
             when i.service_id is not null then
               case
                 when public.service_supply_cost(i.service_id) is null then null
                 else public.line_supply_cost(i.id)
               end
             when i.addon_id is not null then
               i.quantity * coalesce(
                 (select c.unit_cost from public.shop_addon_costs c
                   where c.addon_id = i.addon_id and c.effective_at <= i.created_at
                   order by c.effective_at desc limit 1),
                 (select c.unit_cost from public.shop_addon_costs c
                   where c.addon_id = i.addon_id
                   order by c.effective_at asc limit 1)
               )
           end, 2) as cost
      from public.order_items i
      join public.orders o on o.id = i.order_id
     where o.shop_id = p_shop_id
       and o.created_at >= p_from
       and o.created_at < p_to
  )
  select o.id,
         (select sum(lc.cost) from line_costs lc where lc.order_id = o.id),
         (select count(*)::integer from line_costs lc where lc.order_id = o.id),
         (select count(lc.cost)::integer from line_costs lc where lc.order_id = o.id),
         -- The person at the counter, for walk-ins; an online order is the customer's own.
         case when o.order_type = 'walk_in' then nullif(p.full_name, '') end
    from public.orders o
    left join public.profiles p on p.id = o.created_by
   where o.shop_id = p_shop_id
     and o.created_at >= p_from
     and o.created_at < p_to;
end;
$$;

revoke all on function public.get_period_order_costs(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_period_order_costs(uuid, timestamptz, timestamptz) to authenticated;
