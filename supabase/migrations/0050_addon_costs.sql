-- 0050_addon_costs.sql
--
-- Two things the owner asked for on the Stock screen.
--
-- 1. What each add-on cost the shop, so the screen can say what the shelf
--    actually earned: a pack of Ariel bought at 9 and sold at 15 made 6.
--
--    The cost never goes on shop_addons. Every signed-in account reads that
--    table (staff ring up add-ons, customers pick them), and the selling price
--    is all either should see. Costs live in their own table with no policies,
--    so the only way in is the owner-only functions below.
--
--    Each new cost is a new row, not an overwrite. A delivery bought dearer
--    than the last changes the profit on what sells from then on, never on
--    what already sold: every sale is costed at the price in force when it was
--    made. Sales from before the first cost was ever entered take that first
--    cost, since the owner entering it today is telling us what those cost too.
--
-- 2. A way to take back a count or delivery typed wrong. set_addon_stock now
--    keeps the count it replaces; undo_addon_stock puts the last one back, and
--    pressing it again steps further back.

create table if not exists public.shop_addon_costs (
  id uuid primary key default gen_random_uuid(),
  addon_id uuid not null references public.shop_addons (id) on delete cascade,
  unit_cost numeric(10, 2) not null check (unit_cost between 0 and 100000),
  effective_at timestamptz not null default now()
);

create index if not exists shop_addon_costs_addon_idx
  on public.shop_addon_costs (addon_id, effective_at);

alter table public.shop_addon_costs enable row level security;
revoke all on public.shop_addon_costs from anon, authenticated;

-- The owner's cost per pack, timed by the server like set_addon_stock.
create or replace function public.set_addon_cost(p_addon_id uuid, p_unit_cost numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  select shop_id into v_shop_id from public.shop_addons where id = p_addon_id;
  if v_shop_id is null then
    raise exception 'add-on not found';
  end if;
  if not public.can_manage_shop(v_shop_id) then
    raise exception 'not allowed';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 or p_unit_cost > 100000 then
    raise exception 'enter a cost from 0 to 100000';
  end if;

  insert into public.shop_addon_costs (addon_id, unit_cost)
  values (p_addon_id, round(p_unit_cost, 2));
end;
$$;

revoke all on function public.set_addon_cost(uuid, numeric) from public;
grant execute on function public.set_addon_cost(uuid, numeric) to authenticated;

-- Each add-on's cost now, and what the packs sold in the last `p_days` days
-- cost the shop. Null for an add-on with no cost entered: its profit is
-- unknown, not zero. Owners only, unlike get_addon_sales, which staff read.
create or replace function public.get_addon_costs(p_shop_id uuid, p_days integer default 30)
returns table (
  addon_id uuid,
  unit_cost numeric,
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
  select a.id,
         latest.unit_cost,
         case
           when latest.unit_cost is null then null
           else coalesce(sum(s.quantity * coalesce(at_sale.unit_cost, first_cost.unit_cost)), 0)
         end::numeric
    from public.shop_addons a
    left join lateral (
      select c.unit_cost from public.shop_addon_costs c
       where c.addon_id = a.id
       order by c.effective_at desc limit 1
    ) latest on true
    left join lateral (
      select c.unit_cost from public.shop_addon_costs c
       where c.addon_id = a.id
       order by c.effective_at asc limit 1
    ) first_cost on true
    left join (
      select i.addon_id as sold_addon, i.quantity, i.created_at
        from public.order_items i
        join public.orders o on o.id = i.order_id
       where o.shop_id = p_shop_id
         and o.status <> 'cancelled'
         and i.addon_id is not null
         and i.created_at >= v_from
    ) s on s.sold_addon = a.id
    left join lateral (
      select c.unit_cost from public.shop_addon_costs c
       where c.addon_id = a.id and c.effective_at <= s.created_at
       order by c.effective_at desc limit 1
    ) at_sale on true
   where a.shop_id = p_shop_id
   group by a.id, latest.unit_cost;
end;
$$;

revoke all on function public.get_addon_costs(uuid, integer) from public;
grant execute on function public.get_addon_costs(uuid, integer) to authenticated;

-- The counts set_addon_stock replaced, newest last, for undo.
create table if not exists public.shop_addon_stock_log (
  id bigint generated always as identity primary key,
  addon_id uuid not null references public.shop_addons (id) on delete cascade,
  stock_count integer,
  stock_counted_at timestamptz,
  logged_at timestamptz not null default now()
);

create index if not exists shop_addon_stock_log_addon_idx
  on public.shop_addon_stock_log (addon_id, id);

alter table public.shop_addon_stock_log enable row level security;
revoke all on public.shop_addon_stock_log from anon, authenticated;

-- 0049's count, unchanged but for keeping the count it replaces.
create or replace function public.set_addon_stock(p_addon_id uuid, p_count integer)
returns public.shop_addons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_addon public.shop_addons;
begin
  select * into v_addon from public.shop_addons where id = p_addon_id for update;
  if v_addon.id is null then
    raise exception 'add-on not found';
  end if;
  if not public.can_manage_shop(v_addon.shop_id) then
    raise exception 'not allowed';
  end if;
  if p_count is not null and (p_count < 0 or p_count > 100000) then
    raise exception 'enter a count from 0 to 100000';
  end if;

  insert into public.shop_addon_stock_log (addon_id, stock_count, stock_counted_at)
  values (v_addon.id, v_addon.stock_count, v_addon.stock_counted_at);

  update public.shop_addons
     set stock_count = p_count,
         stock_counted_at = case when p_count is null then null else now() end
   where id = p_addon_id
  returning * into v_addon;
  return v_addon;
end;
$$;

-- Puts back the count from before the last one. With nothing logged, it
-- stops tracking the add-on, which is where every shelf started.
create or replace function public.undo_addon_stock(p_addon_id uuid)
returns public.shop_addons
language plpgsql
security definer
set search_path = public
as $$
declare
  v_addon public.shop_addons;
  v_prev public.shop_addon_stock_log;
begin
  select * into v_addon from public.shop_addons where id = p_addon_id for update;
  if v_addon.id is null then
    raise exception 'add-on not found';
  end if;
  if not public.can_manage_shop(v_addon.shop_id) then
    raise exception 'not allowed';
  end if;

  delete from public.shop_addon_stock_log
   where id = (select max(id) from public.shop_addon_stock_log where addon_id = p_addon_id)
  returning * into v_prev;

  update public.shop_addons
     set stock_count = v_prev.stock_count,
         stock_counted_at = v_prev.stock_counted_at
   where id = p_addon_id
  returning * into v_addon;
  return v_addon;
end;
$$;

revoke all on function public.undo_addon_stock(uuid) from public;
grant execute on function public.undo_addon_stock(uuid) to authenticated;
