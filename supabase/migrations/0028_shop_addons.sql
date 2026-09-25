-- 0028 — A shop's own add-ons: its soaps, its fabcons, its extras, priced.
--
-- The booking offered every customer the same free list of brands, whether or
-- not the shop stocked them. Each shop now keeps its own shelf: a name, the
-- owner's photo of the product, and a flat price charged once per booking.
--
-- Add-ons are deliberately *not* rows in `services`. Every list of services —
-- the shopfront, the web price list, the POS, the admin console — would have
-- had to learn to leave them out, and one that forgot would sell "Downy" as a
-- laundry service. On an order they are ordinary `order_items` lines with no
-- `service_id`, which every ticket, receipt and total already knows how to
-- show, and which "Book again" already skips.
--
-- Prices are the server's. `place_order_with_addons` places the order through
-- the existing `place_order` and then writes the add-on lines itself from
-- these rows, in the same transaction, so a phone cannot send its own price
-- and a failed add-on cannot leave a half-priced order behind.

create table if not exists public.shop_addons (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind text not null check (kind in ('detergent', 'fabcon', 'extra')),
  name text not null check (char_length(btrim(name)) between 1 and 40),
  note text not null default '' check (char_length(note) <= 60),
  price numeric(10, 2) not null default 0 check (price >= 0 and price <= 10000),
  image_url text check (image_url is null or char_length(image_url) <= 1000),
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists shop_addons_shop_idx on public.shop_addons (shop_id, kind, sort_order);

alter table public.shop_addons enable row level security;

-- Anyone signed in may read a shop's shelf, as with its services: a customer
-- has to see the prices before booking.
drop policy if exists "authenticated read shop addons" on public.shop_addons;
create policy "authenticated read shop addons"
  on public.shop_addons for select
  to authenticated
  using (true);

-- Only the owner prices things. Staff run the counter; they do not set prices.
drop policy if exists "owners manage shop addons" on public.shop_addons;
create policy "owners manage shop addons"
  on public.shop_addons for all
  to authenticated
  using (public.can_manage_shop(shop_id))
  with check (public.can_manage_shop(shop_id));

create or replace function public.place_order_with_addons(
  p_shop_id uuid,
  p_items jsonb,
  p_addon_ids uuid[] default '{}',
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
  v_addon public.shop_addons;
  v_ids uuid[] := coalesce(
    (select array_agg(distinct id) from unnest(coalesce(p_addon_ids, '{}')) as id),
    '{}'
  );
  v_found integer;
  v_extra numeric(10, 2) := 0;
begin
  if array_length(v_ids, 1) > 20 then
    raise exception 'too many add-ons';
  end if;

  -- Every id must be this shop's, and on offer.
  select count(*) into v_found
    from public.shop_addons
   where id = any (v_ids) and shop_id = p_shop_id and is_active;
  if v_found <> coalesce(array_length(v_ids, 1), 0) then
    raise exception 'unknown add-on';
  end if;

  -- One soap and one fabcon per load; extras stack.
  if exists (
    select 1
      from public.shop_addons
     where id = any (v_ids) and kind in ('detergent', 'fabcon')
     group by kind
    having count(*) > 1
  ) then
    raise exception 'pick one detergent and one fabcon at most';
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

  for v_addon in
    select *
      from public.shop_addons
     where id = any (v_ids)
     order by case kind when 'detergent' then 0 when 'fabcon' then 1 else 2 end, sort_order, name
  loop
    insert into public.order_items (order_id, service_id, service_name, unit, unit_price, quantity, subtotal)
    values (
      v_order.id,
      null,
      case v_addon.kind
        when 'detergent' then 'Detergent: '
        when 'fabcon' then 'Fabcon: '
        else ''
      end || v_addon.name,
      'flat',
      v_addon.price,
      1,
      v_addon.price
    );
    v_extra := v_extra + v_addon.price;
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
  uuid, jsonb, uuid[], uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz
) from public;
grant execute on function public.place_order_with_addons(
  uuid, jsonb, uuid[], uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz
) to authenticated;
