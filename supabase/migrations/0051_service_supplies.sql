-- 0051_service_supplies.sql
--
-- What each service costs the shop to do, the way a restaurant costs a dish
-- by its ingredients. A wash-dry-fold load goes out with detergent, fabcon,
-- bleach, colorsafe and odor remover the customer never pays for separately;
-- they are the shop's expense, used by the millilitre.
--
-- The owner lists those supplies once, each with the size and price of the
-- bottle it comes in (1000 ml for ₱120 is ₱0.12 a ml), then says how much of
-- each one service uses. That gives the service a cost, and with its price, a
-- profit, per load and over the month.
--
-- How much a service uses is per load when it is washed in loads (a load size
-- is set, as 0044 bills it), otherwise per kg, per piece or per order, the
-- same unit it is priced in. A line's usage counts the way its bill does.
--
-- Profit is worked out at today's supply prices: a bottle bought dearer next
-- month moves last month's figures with it. Simple, and close enough for a
-- shop deciding what to charge.
--
-- Everything here is the owner's, like the add-on costs of 0050. Staff ring up
-- the price and never see what it costs.

create table if not exists public.shop_supplies (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  unit text not null default 'ml' check (unit in ('ml', 'g', 'pc')),
  pack_size numeric(12, 2) not null check (pack_size > 0 and pack_size <= 1000000),
  pack_cost numeric(10, 2) not null check (pack_cost >= 0 and pack_cost <= 1000000),
  created_at timestamptz not null default now()
);

create index if not exists shop_supplies_shop_idx on public.shop_supplies (shop_id, name);

alter table public.shop_supplies enable row level security;

drop policy if exists "owners manage shop supplies" on public.shop_supplies;
create policy "owners manage shop supplies"
  on public.shop_supplies for all to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

grant select, insert, update, delete on public.shop_supplies to authenticated;

-- How much of one supply one unit of a service uses.
create table if not exists public.service_supplies (
  service_id uuid not null references public.services (id) on delete cascade,
  supply_id uuid not null references public.shop_supplies (id) on delete cascade,
  amount numeric(10, 2) not null check (amount > 0 and amount <= 100000),
  primary key (service_id, supply_id)
);

create index if not exists service_supplies_supply_idx on public.service_supplies (supply_id);

alter table public.service_supplies enable row level security;

-- The service and the supply must be the same shop's, and that shop the owner's.
drop policy if exists "owners manage service supplies" on public.service_supplies;
create policy "owners manage service supplies"
  on public.service_supplies for all to authenticated
  using (
    exists (
      select 1 from public.shop_supplies sp
       where sp.id = supply_id and public.can_manage_shop(sp.shop_id)
    )
  )
  with check (
    exists (
      select 1
        from public.shop_supplies sp
        join public.services sv on sv.shop_id = sp.shop_id
       where sp.id = supply_id
         and sv.id = service_id
         and public.can_manage_shop(sp.shop_id)
    )
  );

grant select, insert, update, delete on public.service_supplies to authenticated;

-- How many of a service's units a line of `p_qty` uses: loads for a service
-- washed in loads, otherwise the line's own quantity.
create or replace function public.supply_units(
  p_unit text, p_max numeric, p_category text, p_qty numeric
)
returns numeric
language sql
immutable
as $$
  select case
    when p_unit in ('flat', 'per_kg')
     and coalesce(p_max, 0) > 0
     and p_category is distinct from 'special_items'
      then public.load_count(p_qty, p_max)::numeric
    else coalesce(p_qty, 0)
  end;
$$;

-- What one unit of a service costs in supplies, or null with none set.
create or replace function public.service_supply_cost(p_service_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select sum(ss.amount * sp.pack_cost / sp.pack_size)
    from public.service_supplies ss
    join public.shop_supplies sp on sp.id = ss.supply_id
   where ss.service_id = p_service_id;
$$;

revoke all on function public.service_supply_cost(uuid) from public;

-- Each service's supply cost per unit, and its sales and supply cost over the
-- last `p_days` days. Cancelled orders sold nothing.
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
         round(
           coalesce(sum(public.supply_units(sv.unit, sv.max_quantity, sv.category, i.quantity)), 0)
             * public.service_supply_cost(sv.id),
           2
         )
    from public.services sv
    left join (
      select i2.service_id as sold_service, i2.quantity, i2.subtotal
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

revoke all on function public.get_service_costs(uuid, integer) from public;
grant execute on function public.get_service_costs(uuid, integer) to authenticated;

-- What each line of one order cost the shop: a service in supplies, an add-on
-- at what the pack cost when it sold (0050). Null where no cost is entered.
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
             public.supply_units(sv.unit, sv.max_quantity, sv.category, i.quantity)
               * public.service_supply_cost(sv.id)
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
    left join public.services sv on sv.id = i.service_id
   where i.order_id = p_order_id;
end;
$$;

revoke all on function public.get_order_costs(uuid) from public;
grant execute on function public.get_order_costs(uuid) to authenticated;
