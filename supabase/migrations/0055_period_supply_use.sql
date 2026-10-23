-- 0055_period_supply_use.sql
--
-- How much of each free supply the shop's orders used in a window: the
-- detergent, fabcon and bleach behind the "Supplies used" figure on Sales,
-- by the bottle, so an owner away from the shop can tell a normal day from
-- a heavy pour. Reads the supply_use view of 0053, so a load that came with
-- a bought soap, or skipped a linked add-on, uses none of the free one.
--
-- Owner-only, like the rest of 0051.

create or replace function public.get_period_supply_use(
  p_shop_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  supply_id uuid,
  name text,
  unit text,
  pack_size numeric,
  amount numeric,
  cost numeric
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
  select sp.id,
         sp.name,
         sp.unit,
         sp.pack_size,
         round(sum(u.amount), 2),
         round(sum(u.amount * sp.pack_cost / sp.pack_size), 2)
    from public.supply_use u
    join public.orders o on o.id = u.order_id
    join public.shop_supplies sp on sp.id = u.supply_id
   where u.shop_id = p_shop_id
     and o.status <> 'cancelled'
     and o.created_at >= p_from
     and o.created_at < p_to
   group by sp.id, sp.name, sp.unit, sp.pack_size
   order by 6 desc nulls last;
end;
$$;

revoke all on function public.get_period_supply_use(uuid, timestamptz, timestamptz) from public;
grant execute on function public.get_period_supply_use(uuid, timestamptz, timestamptz) to authenticated;
