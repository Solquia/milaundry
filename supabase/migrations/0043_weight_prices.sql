-- 0043 — A price per weight band, set by the owner.
--
-- Some laundries do not charge one rate per kilo or one flat price per load:
-- their wall says "up to 8 kg ₱185, 8.5 kg ₱200 … 10 kg (2 loads) ₱300". A
-- service can now carry that table as `weight_prices`, a list of
-- {"up_to_kg": n, "price": n}. The first row a load fits under sets its price;
-- a load past the last row costs the last row (src/lib/domain/weight-prices.ts
-- reads it the same way). An empty list keeps the old pricing exactly.
--
-- The server is the price that counts, so the three places it sets one learn
-- the table: place_order (the booking or walk-in), confirm_order_price (the
-- counter's actual weight), and get_storefront (so the web page can show and
-- estimate it). Those functions are patched in place from their live text,
-- and the patch fails loudly if that text is not what it expects, rather than
-- re-creating them from an older copy in this folder.

-- ── The column ─────────────────────────────────────────────────────────────

create or replace function public.is_weight_price_table(p_rows jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_rows) = 'array'
    and jsonb_array_length(p_rows) <= 40
    and not exists (
      select 1 from jsonb_array_elements(p_rows) as r(row)
      where jsonb_typeof(r.row) <> 'object'
         or jsonb_typeof(r.row -> 'up_to_kg') is distinct from 'number'
         or jsonb_typeof(r.row -> 'price') is distinct from 'number'
         or (r.row ->> 'up_to_kg')::numeric <= 0
         or (r.row ->> 'up_to_kg')::numeric > 100
         or (r.row ->> 'price')::numeric < 0
         or (r.row ->> 'price')::numeric > 100000
    );
$$;

alter table public.services
  add column if not exists weight_prices jsonb not null default '[]'::jsonb;

alter table public.services drop constraint if exists services_weight_prices_shape;
alter table public.services
  add constraint services_weight_prices_shape check (public.is_weight_price_table(weight_prices));

-- ── The rule ───────────────────────────────────────────────────────────────

create or replace function public.weight_price(p_rows jsonb, p_kg numeric)
returns numeric
language sql
immutable
as $$
  select coalesce(
    (select (r.row ->> 'price')::numeric
       from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r(row)
       where p_kg <= (r.row ->> 'up_to_kg')::numeric
       order by (r.row ->> 'up_to_kg')::numeric
       limit 1),
    (select (r.row ->> 'price')::numeric
       from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) as r(row)
       order by (r.row ->> 'up_to_kg')::numeric desc
       limit 1)
  );
$$;

-- ── The functions that set a price ─────────────────────────────────────────

do $patch$
declare
  v_def text;
  v_from text;
begin
  -- place_order: a service with a table is priced by the weight booked.
  v_def := pg_get_functiondef('public.place_order(uuid, jsonb, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz)'::regprocedure);
  if position('weight_price(' in v_def) = 0 then
    v_from := $s$    if v_service.unit = 'flat' then
      v_line := v_service.price;
    else$s$;
    if position(v_from in v_def) = 0 then
      raise exception '0043: place_order is not the version this migration patches';
    end if;
    v_def := replace(v_def, v_from, $s$    if jsonb_array_length(coalesce(v_service.weight_prices, '[]'::jsonb)) > 0 then
      v_line := round(public.weight_price(v_service.weight_prices, v_item.quantity), 2);
    elsif v_service.unit = 'flat' then
      v_line := v_service.price;
    else$s$);
    execute v_def;
  end if;

  -- confirm_order_price: a line whose service has a table takes the scale's
  -- kilos and the band's price, not a count of pieces.
  v_def := pg_get_functiondef('public.confirm_order_price(uuid, jsonb, text)'::regprocedure);
  if position('weight_price(' in v_def) = 0 then
    if position($s$  v_weight numeric(6, 2);$s$ in v_def) = 0
       or position($s$    if v_line.unit = 'per_kg' then$s$ in v_def) = 0 then
      raise exception '0043: confirm_order_price is not the version this migration patches';
    end if;
    v_def := replace(v_def, $s$  v_weight numeric(6, 2);$s$, $s$  v_weight numeric(6, 2);
  v_tiers jsonb;$s$);
    v_def := replace(v_def, $s$    if v_line.unit = 'per_kg' then$s$, $s$    select s.weight_prices into v_tiers
    from public.order_items i join public.services s on s.id = i.service_id
    where i.id = v_line.id;

    if jsonb_array_length(coalesce(v_tiers, '[]'::jsonb)) > 0 then
      if v_line.quantity <= 0 or v_line.quantity > 100 then
        raise exception 'invalid weight for %: %', v_line.service_name, v_line.quantity;
      end if;
      update public.order_items
      set quantity = v_line.quantity,
          subtotal = round(public.weight_price(v_tiers, v_line.quantity), 2)
      where id = v_line.id;
    elsif v_line.unit = 'per_kg' then$s$);
    execute v_def;
  end if;

  -- get_storefront: the web page needs the table to show and estimate it.
  v_def := pg_get_functiondef('public.get_storefront(text)'::regprocedure);
  if position('weight_prices' in v_def) = 0 then
    v_from := $s$'max_quantity', sv.max_quantity,$s$;
    if position(v_from in v_def) = 0 then
      raise exception '0043: get_storefront is not the version this migration patches';
    end if;
    v_def := replace(v_def, v_from, $s$'max_quantity', sv.max_quantity,
          'weight_prices', sv.weight_prices,$s$);
    execute v_def;
  end if;
end;
$patch$;
