-- The sign on the door: weekly hours, a pause, and days closed ahead.
--
-- A shop had one switch, is_active, and it meant "on MiLaundry at all". There
-- was no way to say "back in an hour", "closed for the fiesta", or "we open at
-- eight", so customers booked into shut doors. This adds all three; the rules
-- for reading them live in src/lib/domain/shop-availability.ts, and the two
-- that refuse orders — a pause, a closure — are enforced here as well.
--
--   hours         7 entries, Sunday first: null (closed that day) or
--                 {"opens": minutes, "closes": minutes} after the shop's
--                 midnight. The column itself null = never set = open all day.
--   paused_until  the sign is flipped to CLOSED until then; 9999-12-31 means
--                 until someone flips it back.
--   pause_note    one line for customers: "Water interruption".
--   closures      [{"from": "2026-12-24", "to": "2026-12-26", "note": "Christmas"}]
--
-- Shop dates are read on Manila's wall clock (+8 all year), as the app does.

alter table public.shops
  add column if not exists hours jsonb,
  add column if not exists paused_until timestamptz,
  add column if not exists pause_note text not null default '',
  add column if not exists closures jsonb not null default '[]'::jsonb;

-- ── validation ──────────────────────────────────────────────────────────────

create or replace function public.is_valid_shop_hours(p_hours jsonb)
returns boolean
language sql
immutable
as $$
  select p_hours is null or (
    jsonb_typeof(p_hours) = 'array'
    and jsonb_array_length(p_hours) = 7
    and not exists (
      select 1 from jsonb_array_elements(p_hours) d
      where jsonb_typeof(d) <> 'null' and not (
        jsonb_typeof(d) = 'object'
        and jsonb_typeof(d -> 'opens') = 'number'
        and jsonb_typeof(d -> 'closes') = 'number'
        and (d ->> 'opens')::numeric >= 0
        and (d ->> 'closes')::numeric <= 1440
        and (d ->> 'opens')::numeric < (d ->> 'closes')::numeric
      )
    )
  );
$$;

create or replace function public.is_valid_shop_closures(p_closures jsonb)
returns boolean
language sql
immutable
as $$
  select jsonb_typeof(p_closures) = 'array'
    and jsonb_array_length(p_closures) <= 60
    and not exists (
      select 1 from jsonb_array_elements(p_closures) c
      where not (
        jsonb_typeof(c) = 'object'
        and coalesce(c ->> 'from', '') ~ '^\d{4}-\d{2}-\d{2}$'
        and coalesce(c ->> 'to', '') ~ '^\d{4}-\d{2}-\d{2}$'
        and (c ->> 'to') >= (c ->> 'from')
        and char_length(coalesce(c ->> 'note', '')) <= 40
      )
    );
$$;

alter table public.shops drop constraint if exists shops_hours_valid;
alter table public.shops
  add constraint shops_hours_valid check (public.is_valid_shop_hours(hours));
alter table public.shops drop constraint if exists shops_closures_valid;
alter table public.shops
  add constraint shops_closures_valid check (public.is_valid_shop_closures(closures));
alter table public.shops drop constraint if exists shops_pause_note_length;
alter table public.shops
  add constraint shops_pause_note_length check (char_length(pause_note) <= 60);

-- ── reading the sign ────────────────────────────────────────────────────────

-- The closure covering a Manila date, or null.
create or replace function public.shop_closure_on(p_closures jsonb, p_day date)
returns jsonb
language sql
immutable
as $$
  select c from jsonb_array_elements(coalesce(p_closures, '[]'::jsonb)) c
  where (c ->> 'from')::date <= p_day and p_day <= (c ->> 'to')::date
  limit 1;
$$;

-- ── flipping the sign (any member: the counter takes lunch too) ─────────────

create or replace function public.set_shop_pause(
  p_shop_id uuid,
  p_until timestamptz,
  p_note text default ''
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if public.my_shop_role(p_shop_id) is null then
    raise exception 'not allowed';
  end if;
  if char_length(v_note) > 60 then
    raise exception 'Keep the note short — 60 characters at most.';
  end if;

  -- A time already gone means "open again": one call both flips and unflips.
  update public.shops
  set paused_until = case when p_until is null or p_until <= now() then null else p_until end,
      pause_note = case when p_until is null or p_until <= now() then '' else v_note end
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

-- ── the hours on the door and days closed ahead (owners) ────────────────────

create or replace function public.set_shop_schedule(
  p_shop_id uuid,
  p_hours jsonb,
  p_closures jsonb
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;
  if not public.is_valid_shop_hours(p_hours) then
    raise exception 'Each open day needs a closing time after its opening time.';
  end if;
  if not public.is_valid_shop_closures(coalesce(p_closures, '[]'::jsonb)) then
    raise exception 'One of the closed dates is not valid.';
  end if;

  update public.shops
  set hours = p_hours,
      closures = coalesce(p_closures, '[]'::jsonb)
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

-- ── the web page reads the sign without reading the whole shop row ──────────

create or replace function public.get_shop_availability(p_shop_id uuid)
returns jsonb
language sql
stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'hours', s.hours,
    'paused_until', s.paused_until,
    'pause_note', s.pause_note,
    'closures', s.closures
  )
  from public.shops s
  where s.id = p_shop_id and s.is_active;
$$;

-- ── orders respect the sign ─────────────────────────────────────────────────

-- Online orders only, and only from outside the shop: a walk-in at the
-- counter, or staff keying one in, goes through whatever the sign says.
create or replace function public.orders_respect_shop_sign()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
  v_today date := (now() at time zone 'Asia/Manila')::date;
begin
  if new.order_type <> 'online' or public.my_shop_role(new.shop_id) is not null then
    return new;
  end if;

  select * into v_shop from public.shops where id = new.shop_id;
  if v_shop.id is null then
    return new;
  end if;

  if v_shop.paused_until is not null and v_shop.paused_until > now() then
    raise exception 'This shop isn''t taking orders right now. Please try again later.';
  end if;

  if public.shop_closure_on(v_shop.closures, v_today) is not null then
    raise exception 'This shop is closed today. Please book another day.';
  end if;

  if new.pickup_at is not null and public.shop_closure_on(
    v_shop.closures, (new.pickup_at at time zone 'Asia/Manila')::date
  ) is not null then
    raise exception 'The shop is closed on your pickup day. Please pick another day.';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_respect_shop_sign on public.orders;
create trigger orders_respect_shop_sign
  before insert on public.orders
  for each row execute function public.orders_respect_shop_sign();

revoke all on function public.set_shop_pause(uuid, timestamptz, text) from public;
revoke all on function public.set_shop_schedule(uuid, jsonb, jsonb) from public;
revoke all on function public.get_shop_availability(uuid) from public;
grant execute on function public.set_shop_pause(uuid, timestamptz, text) to authenticated;
grant execute on function public.set_shop_schedule(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.get_shop_availability(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
