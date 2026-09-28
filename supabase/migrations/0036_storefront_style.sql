-- The shop chooses how its page looks and books.
--
-- Every shop wore one shopfront: a cover, a menu of services, one service per
-- booking. This lets an owner switch their customers to the market instead —
-- a product grid, a basket, one checkout — or back. The two are views over
-- the same price list and the same place_order, so nothing about pricing or
-- the order itself changes with the switch. The rules for reading the value
-- live in src/lib/domain/storefront-style.ts.
--
-- Additive only: it does not replace get_storefront (which on the live
-- project still waits on 0027/0031), so the web page reads the style through
-- its own small function, the way 0035 did for the shop's hours.

alter table public.shops
  add column if not exists storefront_style text not null default 'classic';

alter table public.shops drop constraint if exists shops_storefront_style_check;
alter table public.shops
  add constraint shops_storefront_style_check
  check (storefront_style in ('classic', 'market'));

-- ── set_shop_storefront_style (owners) ──────────────────────────────────────
-- What customers see is the owner's call, not the counter's: the same gate as
-- the hours on the door (0035), not the looser can_operate_shop.
create or replace function public.set_shop_storefront_style(
  p_shop_id uuid,
  p_style text
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
  if p_style is null or p_style not in ('classic', 'market') then
    raise exception 'Pick one of the storefront looks.';
  end if;

  update public.shops
  set storefront_style = p_style
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

-- ── the web page reads the style without reading the whole shop row ─────────
create or replace function public.get_shop_storefront_style(p_shop_id uuid)
returns text
language sql
stable security definer set search_path = public
as $$
  select s.storefront_style
  from public.shops s
  where s.id = p_shop_id and s.is_active;
$$;

revoke all on function public.set_shop_storefront_style(uuid, text) from public;
revoke all on function public.get_shop_storefront_style(uuid) from public;
grant execute on function public.set_shop_storefront_style(uuid, text) to authenticated;
grant execute on function public.get_shop_storefront_style(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
