-- 0053_supply_addons.sql
--
-- Linking the free supplies of 0051 to the shelf, as a shop owner asked.
--
-- One shop puts its free soaps on the add-on shelf at no charge (SF Detergent,
-- free) next to the ones a customer pays for (Ariel, 15). The customer taps the
-- one they want and that takes one off its stock, as 0049 counts. But the
-- supplies on the Costs screen went out with every wash regardless: a load
-- that came with its own Ariel still used, and cost, the free detergent.
--
-- 1. A free supply may name the add-on that hands it out. It is then used
--    only on an order where that add-on was picked: tapped, it costs the shop
--    its ml and comes off the shelf; not tapped, neither.
--
-- 2. A supply with no add-on named still goes out with every load, except
--    that an order which bought a detergent uses none of the free detergent,
--    and one which bought a fabcon none of the free fabcon. Each supply says
--    which it is (`kind`, the add-on kinds of 0028); bleach and the rest are
--    'extra' and always go out.
--
-- Everything here stays the owner's, like the rest of 0051.

alter table public.shop_supplies
  add column if not exists kind text not null default 'extra'
    check (kind in ('detergent', 'fabcon', 'extra')),
  add column if not exists addon_id uuid references public.shop_addons (id) on delete set null;

-- The supplies the names already make plain.
update public.shop_supplies
   set kind = case
                when name ~* 'fab ?con|softener|conditioner|downy' then 'fabcon'
                when name ~* 'detergent|powder|soap' then 'detergent'
                else 'extra'
              end
 where kind = 'extra';

-- What each service line used of each free supply: none where its add-on
-- went unpicked or a bought soap took its place. Only the owner-only
-- functions below read it.
create or replace view public.supply_use as
select i.id as item_id,
       i.order_id,
       o.shop_id,
       o.status,
       i.created_at,
       i.service_id,
       ss.supply_id,
       public.supply_units(sv.unit, sv.max_quantity, sv.category, i.quantity) * ss.amount as amount
  from public.order_items i
  join public.orders o on o.id = i.order_id
  join public.services sv on sv.id = i.service_id
  join public.service_supplies ss on ss.service_id = sv.id
  join public.shop_supplies sp on sp.id = ss.supply_id
 where case
   when sp.addon_id is not null then exists (
     select 1 from public.order_items b
      where b.order_id = i.order_id and b.addon_id = sp.addon_id
   )
   else not (
     sp.kind in ('detergent', 'fabcon')
     and exists (
       select 1
         from public.order_items b
         join public.shop_addons a on a.id = b.addon_id
        where b.order_id = i.order_id
          and a.kind = sp.kind
          and b.subtotal > 0
     )
   )
 end;

revoke all on public.supply_use from public, anon, authenticated;

-- What one line used in supplies, in pesos at today's bottle prices.
create or replace function public.line_supply_cost(p_item_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(u.amount * sp.pack_cost / sp.pack_size), 0)
    from public.supply_use u
    join public.shop_supplies sp on sp.id = u.supply_id
   where u.item_id = p_item_id;
$$;

revoke all on function public.line_supply_cost(uuid) from public;

-- 0051's figures, now with a bought soap taking the free one's place.
create or replace function public.get_service_costs(p_shop_id uuid, p_days integer default 30)
returns table (
  service_id uuid,
  unit_cost numeric,
  units_recent numeric,
  revenue_recent numeric,
  cost_recent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 366)));
begin
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;

  return query
  select sv.id,
         round(public.service_supply_cost(sv.id), 2),
         coalesce(sum(public.supply_units(sv.unit, sv.max_quantity, sv.category, i.quantity)), 0)::numeric,
         coalesce(sum(i.subtotal), 0)::numeric,
         case
           when public.service_supply_cost(sv.id) is null then null
           else round(coalesce(sum(public.line_supply_cost(i.item_id)), 0), 2)
         end
    from public.services sv
    left join (
      select i2.id as item_id, i2.service_id as sold_service, i2.quantity, i2.subtotal
        from public.order_items i2
        join public.orders o on o.id = i2.order_id
       where o.shop_id = p_shop_id
         and o.status <> 'cancelled'
         and i2.created_at >= v_from
    ) i on i.sold_service = sv.id
   where sv.shop_id = p_shop_id
   group by sv.id;
end;
$$;

create or replace function public.get_order_costs(p_order_id uuid)
returns table (
  item_id uuid,
  cost numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  select shop_id into v_shop_id from public.orders where id = p_order_id;
  if v_shop_id is null then
    raise exception 'order not found';
  end if;
  if not public.can_manage_shop(v_shop_id) then
    raise exception 'not allowed';
  end if;

  return query
  select i.id,
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
         end, 2)
    from public.order_items i
   where i.order_id = p_order_id;
end;
$$;
