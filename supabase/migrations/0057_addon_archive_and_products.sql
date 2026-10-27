-- 0057_addon_archive_and_products.sql
--
-- Two asks from a shop owner tidying her shelf.
--
-- 1. "Mas maganda po delete para hindi nakakalito": a switched-off add-on
--    still sat in her list. Removing one now archives it: archived_at is set
--    and is_active cleared, so every customer-facing read (they all filter on
--    is_active) drops it, and the owner's list hides it. A hard delete would
--    cut the add-on off its past order lines (order_items.addon_id is set
--    null) and wipe its cost and stock logs, so the row stays.
--
-- 2. Bouquets are not an add-on to a wash ("para hindi awkward"). A new kind,
--    'product', is for things the shop sells on their own; the storefront
--    lists them as "Other items" after Other services. They keep everything an
--    add-on has: photo, price, stock, cost, order lines.
--
-- Owners already write shop_addons directly under "owners manage shop
-- addons" (0028), so no new function is needed.

alter table public.shop_addons
  add column if not exists archived_at timestamptz;

alter table public.shop_addons drop constraint if exists shop_addons_kind_check;
alter table public.shop_addons
  add constraint shop_addons_kind_check
  check (kind in ('detergent', 'fabcon', 'extra', 'product'));

alter table public.shop_addon_groups drop constraint if exists shop_addon_groups_kind_check;
alter table public.shop_addon_groups
  add constraint shop_addon_groups_kind_check
  check (kind in ('detergent', 'fabcon', 'extra', 'product'));

-- An archived add-on is never on sale.
alter table public.shop_addons drop constraint if exists shop_addons_archived_inactive;
alter table public.shop_addons
  add constraint shop_addons_archived_inactive
  check (archived_at is null or not is_active);
