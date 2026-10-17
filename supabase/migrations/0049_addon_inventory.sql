-- 0049_addon_inventory.sql
--
-- Stock for the add-on shelf: how many packs of Ariel are in the shop, how
-- many are left, how many went out on orders, and which sells best.
--
-- The owner counts what is on the shelf (or adds a delivery to it); that
-- number and the moment it was taken live on the add-on row. "Left" is never
-- stored: it is the count minus what orders have taken since, read from the
-- order lines themselves. So a reweigh in confirm_order_price, a line removed
-- at the counter, or a cancelled order changes what is left without any
-- bookkeeping of its own, and nothing can drift between two numbers.
--
-- For that the add-on lines need to say which add-on they are. Until now they
-- carried only a name ("Detergent: Ariel"); `order_items.addon_id` now names
-- the row, set by place_order_with_addons, and the lines already sold are
-- matched up by that name below.

alter table public.order_items
  add column if not exists addon_id uuid references public.shop_addons (id) on delete set null;

create index if not exists order_items_addon_idx
  on public.order_items (addon_id, created_at)
  where addon_id is not null;

-- Lines sold before this migration: the add-on of that shop whose ticket
-- name is exactly the line's name (the oldest, if two share a name).
update public.order_items i
   set addon_id = m.addon_id
  from (
    select distinct on (i2.id) i2.id as item_id, a.id as addon_id
      from public.order_items i2
      join public.orders o on o.id = i2.order_id
      join public.shop_addons a
        on a.shop_id = o.shop_id
       and i2.service_name = case a.kind
                               when 'detergent' then 'Detergent: '
                               when 'fabcon' then 'Fabcon: '
                               else ''
                             end || a.name
     where i2.service_id is null
       and i2.addon_id is null
     order by i2.id, a.created_at
  ) m
 where i.id = m.item_id;

-- Null until the owner first counts it: an add-on nobody counts is simply
-- not tracked, and shows its sales without a "left".
alter table public.shop_addons
  add column if not exists stock_count integer
    check (stock_count is null or stock_count between 0 and 100000),
  add column if not exists stock_counted_at timestamptz;

-- The owner's count. The time is the database's, never the phone's, so
-- "sold since" lines up with order times written by the same clock. Null
-- stops tracking the add-on.
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

  update public.shop_addons
     set stock_count = p_count,
         stock_counted_at = case when p_count is null then null else now() end
   where id = p_addon_id
  returning * into v_addon;
  return v_addon;
end;
$$;

revoke all on function public.set_addon_stock(uuid, integer) from public;
grant execute on function public.set_addon_stock(uuid, integer) to authenticated;

-- 0029's order function, unchanged but for naming the add-on on each line.
create or replace function public.place_order_with_addons(
  p_shop_id uuid,
  p_items jsonb,
  p_addons jsonb default '[]',
  p_customer_id uuid default null,
  p_notes text default '',
  p_order_type text default null,
  p_fulfillment text default 'pickup',
  p_delivery_address text default '',
  p_customer_name text default '',
  p_customer_phone text default '',
  p_payment_method text default 'cash',
  p_is_paid boolean default false,
  p_pickup_at timestamptz default null,
  p_deliver_by timestamptz default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_picks jsonb;
  v_line record;
  v_count integer;
  v_found integer;
  v_extra numeric(10, 2) := 0;
begin
  if p_addons is null or jsonb_typeof(p_addons) <> 'array' then
    raise exception 'add-ons must be a list';
  end if;

  -- One entry per add-on, the same id sent twice counted together.
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'quantity', quantity)), '[]'::jsonb)
    into v_picks
    from (
      select entry.id, sum(entry.quantity)::integer as quantity
        from jsonb_to_recordset(p_addons) as entry(id uuid, quantity integer)
       group by entry.id
    ) as merged;

  v_count := jsonb_array_length(v_picks);
  if v_count > 20 then
    raise exception 'too many add-ons';
  end if;

  -- Every id must be this shop's and on offer, and every count within its limit.
  select count(*) into v_found
    from jsonb_to_recordset(v_picks) as p(id uuid, quantity integer)
    join public.shop_addons a on a.id = p.id
   where a.shop_id = p_shop_id
     and a.is_active
     and p.quantity between 1 and a.max_quantity;
  if v_found <> v_count then
    raise exception 'unknown add-on or too many of one';
  end if;

  -- More than one product of a kind unless the shop holds that kind to one.
  -- With no rule set, the customer picks as many as they like.
  if exists (
    select 1
      from jsonb_to_recordset(v_picks) as p(id uuid, quantity integer)
      join public.shop_addons a on a.id = p.id
      left join public.shop_addon_groups g on g.shop_id = a.shop_id and g.kind = a.kind
     group by a.kind, g.allow_multiple
    having count(*) > 1 and not coalesce(g.allow_multiple, true)
  ) then
    raise exception 'this shop allows one of that kind of add-on';
  end if;

  -- The order itself, exactly as before: same checks, same pricing.
  v_order := public.place_order(
    p_shop_id => p_shop_id,
    p_items => p_items,
    p_customer_id => p_customer_id,
    p_notes => p_notes,
    p_order_type => p_order_type,
    p_fulfillment => p_fulfillment,
    p_delivery_address => p_delivery_address,
    p_customer_name => p_customer_name,
    p_customer_phone => p_customer_phone,
    p_payment_method => p_payment_method,
    p_is_paid => p_is_paid,
    p_pickup_at => p_pickup_at,
    p_deliver_by => p_deliver_by
  );

  for v_line in
    select a.id, a.kind, a.name, a.price, p.quantity
      from jsonb_to_recordset(v_picks) as p(id uuid, quantity integer)
      join public.shop_addons a on a.id = p.id
     order by case a.kind when 'detergent' then 0 when 'fabcon' then 1 else 2 end, a.sort_order, a.name
  loop
    insert into public.order_items (order_id, service_id, addon_id, service_name, unit, unit_price, quantity, subtotal)
    values (
      v_order.id,
      null,
      v_line.id,
      case v_line.kind
        when 'detergent' then 'Detergent: '
        when 'fabcon' then 'Fabcon: '
        else ''
      end || v_line.name,
      -- A single one reads as a flat charge; several read as pieces on the ticket.
      case when v_line.quantity > 1 then 'per_item' else 'flat' end,
      v_line.price,
      v_line.quantity,
      v_line.price * v_line.quantity
    );
    v_extra := v_extra + v_line.price * v_line.quantity;
  end loop;

  if v_extra > 0 then
    update public.orders
       set estimated_total = coalesce(estimated_total, 0) + v_extra,
           final_total = case when final_total is null then null else final_total + v_extra end
     where id = v_order.id
    returning * into v_order;
  end if;

  return v_order;
end;
$$;

-- What each add-on has sold, for the Stock screen: since its last count, in
-- the last `p_days` days, and ever. Cancelled orders sold nothing.
create or replace function public.get_addon_sales(p_shop_id uuid, p_days integer default 30)
returns table (
  addon_id uuid,
  sold_since_count integer,
  sold_recent integer,
  sold_total integer,
  revenue_recent numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 366)));
begin
  if not public.can_operate_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;

  return query
  select a.id,
         coalesce(sum(s.quantity) filter (
           where a.stock_counted_at is not null and s.created_at >= a.stock_counted_at
         ), 0)::integer,
         coalesce(sum(s.quantity) filter (where s.created_at >= v_from), 0)::integer,
         coalesce(sum(s.quantity), 0)::integer,
         coalesce(sum(s.subtotal) filter (where s.created_at >= v_from), 0)::numeric
    from public.shop_addons a
    left join (
      select i.addon_id as sold_addon, i.quantity, i.subtotal, i.created_at
        from public.order_items i
        join public.orders o on o.id = i.order_id
       where o.shop_id = p_shop_id
         and o.status <> 'cancelled'
         and i.addon_id is not null
    ) s on s.sold_addon = a.id
   where a.shop_id = p_shop_id
   group by a.id;
end;
$$;

revoke all on function public.get_addon_sales(uuid, integer) from public;
grant execute on function public.get_addon_sales(uuid, integer) to authenticated;
