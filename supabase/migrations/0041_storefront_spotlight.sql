-- A third storefront look: the spotlight.
--
-- 0036 let an owner pick between the classic shopfront and the market. The
-- spotlight is a third view over the same price list and the same basket — a
-- food app's photo menu with a carousel of the shop's best prices — so, like
-- the market, nothing about pricing or place_order changes with it. Only the
-- check and the owner's setter learn the new key. The rules for reading the
-- value live in src/lib/domain/storefront-style.ts, which reads any key it
-- does not know as the classic page, so an older app build stays safe.

alter table public.shops drop constraint if exists shops_storefront_style_check;
alter table public.shops
  add constraint shops_storefront_style_check
  check (storefront_style in ('classic', 'market', 'spotlight'));

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
  if p_style is null or p_style not in ('classic', 'market', 'spotlight') then
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

revoke all on function public.set_shop_storefront_style(uuid, text) from public;
grant execute on function public.set_shop_storefront_style(uuid, text) to authenticated;

notify pgrst, 'reload schema';
