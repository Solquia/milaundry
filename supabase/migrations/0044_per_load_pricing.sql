-- A flat price sold per load is charged once for every load the weight fills.
--
-- A service such as "Full Service ₱165, max 8 kg" is booked by weight, but
-- place_order charged its price once whatever the weight: a 16 kg booking
-- came to ₱165 instead of two loads, ₱330. The counter's till already split a
-- weight into loads; the booking and the price check now do the same, from
-- the same rule as `loadsFor` in src/lib/domain/pricing.ts:
--
--   a flat service with a load limit, outside bedding (`special_items`, where
--   the limit is per piece), is charged price × ceil(kg / limit).
--
-- A service with a weight table (0043) is still priced by its table. A till
-- line of one load is sent as quantity 1, which is one load here too.

create or replace function public.load_count(p_kg numeric, p_limit numeric)
returns integer
language sql
immutable
as $$
  select case
    when p_kg is null or p_kg <= 0 or p_limit is null or p_limit <= 0 then 0
    else greatest(1, ceil(p_kg / p_limit))::integer
  end;
$$;

-- The load limit a service charges by, or 0 when it is not sold per load.
create or replace function public.per_load_kg(p_unit text, p_max numeric, p_category text)
returns numeric
language sql
immutable
as $$
  select case
    when p_unit = 'flat' and coalesce(p_max, 0) > 0 and p_category is distinct from 'special_items'
      then p_max
    else 0
  end;
$$;

do $patch$
declare
  v_def text;
  v_from text;
begin
  -- place_order: a per-load service is charged for every load booked.
  v_def := pg_get_functiondef('public.place_order(uuid, jsonb, uuid, text, text, text, text, text, text, text, boolean, timestamptz, timestamptz)'::regprocedure);
  if position('load_count(' in v_def) = 0 then
    v_from := $s$    elsif v_service.unit = 'flat' then
      v_line := v_service.price;$s$;
    if position(v_from in v_def) = 0 then
      raise exception '0044: place_order is not the version this migration patches';
    end if;
    v_def := replace(v_def, v_from, $s$    elsif public.per_load_kg(v_service.unit, v_service.max_quantity, v_service.category) > 0 then
      v_line := round(v_service.price * public.load_count(
        v_item.quantity,
        public.per_load_kg(v_service.unit, v_service.max_quantity, v_service.category)
      ), 2);
    elsif v_service.unit = 'flat' then
      v_line := v_service.price;$s$);
    execute v_def;
  end if;

  -- confirm_order_price: a per-load line takes the scale's kilos, not a count
  -- of pieces, and is charged for the loads they fill.
  v_def := pg_get_functiondef('public.confirm_order_price(uuid, jsonb, text)'::regprocedure);
  if position('load_count(' in v_def) = 0 then
    if position($s$  v_tiers jsonb;$s$ in v_def) = 0
       or position($s$    select s.weight_prices into v_tiers$s$ in v_def) = 0
       or position($s$    elsif v_line.unit = 'per_kg' then$s$ in v_def) = 0 then
      raise exception '0044: confirm_order_price is not the version this migration patches';
    end if;
    v_def := replace(v_def, $s$  v_tiers jsonb;$s$, $s$  v_tiers jsonb;
  v_load_kg numeric;$s$);
    v_def := replace(v_def, $s$    select s.weight_prices into v_tiers$s$,
      $s$    select s.weight_prices, public.per_load_kg(s.unit, s.max_quantity, s.category)
      into v_tiers, v_load_kg$s$);
    v_def := replace(v_def, $s$    elsif v_line.unit = 'per_kg' then$s$, $s$    elsif coalesce(v_load_kg, 0) > 0 then
      if v_line.quantity <= 0 or v_line.quantity > 100 then
        raise exception 'invalid weight for %: %', v_line.service_name, v_line.quantity;
      end if;
      update public.order_items
      set quantity = v_line.quantity,
          subtotal = round(unit_price * public.load_count(v_line.quantity, v_load_kg), 2)
      where id = v_line.id;
    elsif v_line.unit = 'per_kg' then$s$);
    execute v_def;
  end if;
end;
$patch$;
