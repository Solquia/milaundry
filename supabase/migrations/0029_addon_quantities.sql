-- 0029 — Add-ons by the count, and the shop decides pick-one or pick-several.
--
-- 0028 put a shop's own soaps, fabcons and extras on the booking, one of each
-- at most, with the "one soap, one fabcon, extras stack" rule fixed in code.
-- Shops asked for two things that rule could not say:
--
--   * "Up to 3 plastic bags" — so each add-on now carries `max_quantity`, the
--     most of that one item a booking may take (1..20, default 1, which is
--     exactly how every existing row behaved).
--   * "Let them pick two soaps" — so each shop can set, per kind, whether a
--     customer may pick more than one product of it (`shop_addon_groups`).
--     A kind with no row lets the customer pick several; the owner can hold
--     any kind to one.
--
-- The order function now takes `p_addons`, a list of {id, quantity}, instead
-- of bare ids, and checks both rules itself. Prices are still read from the
-- shop's rows: the phone sends what and how many, never how much.

alter table public.shop_addons
  add column if not exists max_quantity integer not null default 1
    check (max_quantity between 1 and 20);

create table if not exists public.shop_addon_groups (
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind text not null check (kind in ('detergent', 'fabcon', 'extra')),
  allow_multiple boolean not null,
  primary key (shop_id, kind)
);

alter table public.shop_addon_groups enable row level security;

drop policy if exists "authenticated read shop addon groups" on public.shop_addon_groups;
create policy "authenticated read shop addon groups"
  on public.shop_addon_groups for select
  to authenticated
  using (true);

drop policy if exists "owners manage shop addon groups" on public.shop_addon_groups;
create policy "owners manage shop addon groups"
  on public.shop_addon_groups for all
  to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

-- The bare-ids version goes: nothing but this app ever called it, and two
-- overloads would let an old build keep skipping the quantity checks.
drop function if exists public.place_order_with_addons(
  uuid, jsonb, uuid[], uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz
);

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
    select a.kind, a.name, a.price, p.quantity
      from jsonb_to_recordset(v_picks) as p(id uuid, quantity integer)
      join public.shop_addons a on a.id = p.id
     order by case a.kind when 'detergent' then 0 when 'fabcon' then 1 else 2 end, a.sort_order, a.name
  loop
    insert into public.order_items (order_id, service_id, service_name, unit, unit_price, quantity, subtotal)
    values (
      v_order.id,
      null,
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

revoke all on function public.place_order_with_addons(
  uuid, jsonb, jsonb, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz
) from public;
grant execute on function public.place_order_with_addons(
  uuid, jsonb, jsonb, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz
) to authenticated;
