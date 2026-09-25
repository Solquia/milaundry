-- 0030 — Every shop opens with a priced shelf of add-ons.
--
-- Until an owner set up add-ons, the booking fell back to a free list of
-- brands: no price, and nothing the counter had agreed to stock. The booking
-- now shows only the shop's own shelf, so every shop needs one from day one.
--
-- `stock_starter_addons` puts the usual soaps and fabcons on a shop's shelf at
-- a going rate — ₱15 a detergent, ₱10 a fabcon — and does nothing to a shop
-- that already has any add-on, so an owner's own shelf is never touched. It
-- runs once here for every existing shop, and on every new shop by trigger.
-- The owner changes prices, photos and limits, or hides what they don't
-- carry, on the Prices tab.
--
-- Keep this list in step with STARTER_ADDONS in src/lib/domain/shop-addons.ts,
-- which the "Add the usual brands" button inserts.

create or replace function public.stock_starter_addons(p_shop_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.shop_addons where shop_id = p_shop_id) then
    return;
  end if;

  insert into public.shop_addons (shop_id, kind, name, note, price, sort_order)
  values
    (p_shop_id, 'detergent', 'Ariel', 'Powder', 15, 0),
    (p_shop_id, 'detergent', 'Tide', 'Powder', 15, 1),
    (p_shop_id, 'detergent', 'Breeze', 'Powder', 15, 2),
    (p_shop_id, 'detergent', 'Surf', 'Powder', 15, 3),
    (p_shop_id, 'detergent', 'Champion', 'Powder', 15, 4),
    (p_shop_id, 'fabcon', 'Downy', 'Fabric conditioner', 10, 5),
    (p_shop_id, 'fabcon', 'Surf Fabcon', 'Fabric conditioner', 10, 6),
    (p_shop_id, 'fabcon', 'Del', 'Fabric conditioner', 10, 7);
end;
$$;

-- Internal only: the trigger and this migration call it, nobody else.
revoke all on function public.stock_starter_addons(uuid) from public;

create or replace function public.stock_new_shop_addons()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.stock_starter_addons(new.id);
  return new;
end;
$$;

revoke all on function public.stock_new_shop_addons() from public;

drop trigger if exists shops_stock_starter_addons on public.shops;
create trigger shops_stock_starter_addons
  after insert on public.shops
  for each row execute function public.stock_new_shop_addons();

-- Every shop that exists today.
select public.stock_starter_addons(id) from public.shops;
