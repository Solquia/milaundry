-- A shopfront used to open on a coloured field with the shop's initials. The
-- thing a customer walking past would recognise is the storefront itself, so a
-- shop can now upload a photo of it, and a pin so the app can open directions
-- instead of asking the customer to retype "12 Mabini St" into Maps.
--
-- The photo follows the logo's rules: '' means none, and a save that carries
-- no photo keeps the one already there. The pin is different: both halves or
-- neither, and clearing it is a real thing a shop can do, so it gets its own
-- RPC where null means "remove the pin" rather than "leave it alone".

alter table public.shops
  add column if not exists cover_url text not null default '',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision;

alter table public.shops
  drop constraint if exists shops_pin_both_or_neither,
  drop constraint if exists shops_latitude_range,
  drop constraint if exists shops_longitude_range;

alter table public.shops
  add constraint shops_pin_both_or_neither
    check ((latitude is null) = (longitude is null)),
  add constraint shops_latitude_range
    check (latitude is null or (latitude >= -90 and latitude <= 90)),
  add constraint shops_longitude_range
    check (longitude is null or (longitude >= -180 and longitude <= 180));

-- Replaced rather than overloaded: PostgREST cannot choose between two
-- set_shop_branding signatures when the client omits the trailing argument.
drop function if exists public.set_shop_branding(uuid, smallint, text, text);

create or replace function public.set_shop_branding(
  p_shop_id uuid,
  p_brand_accent smallint default null,
  p_tagline text default '',
  p_logo_url text default null,
  p_cover_url text default null
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
  if not public.can_operate_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;
  if p_brand_accent is not null
     and (p_brand_accent < 0 or p_brand_accent >= 12) then
    raise exception 'invalid accent: %', p_brand_accent;
  end if;
  if length(btrim(coalesce(p_tagline, ''))) > 60 then
    raise exception 'tagline is too long';
  end if;

  update public.shops
  set brand_accent = p_brand_accent,
      tagline = btrim(coalesce(p_tagline, '')),
      logo_url = coalesce(nullif(btrim(coalesce(p_logo_url, '')), ''), logo_url),
      cover_url = coalesce(nullif(btrim(coalesce(p_cover_url, '')), ''), cover_url)
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

create or replace function public.set_shop_location(
  p_shop_id uuid,
  p_latitude double precision default null,
  p_longitude double precision default null
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
  if not public.can_operate_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'invalid pin';
  end if;

  update public.shops
  set latitude = p_latitude,
      longitude = p_longitude
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

grant execute on function public.set_shop_branding(uuid, smallint, text, text, text) to authenticated;
grant execute on function public.set_shop_location(uuid, double precision, double precision) to authenticated;
