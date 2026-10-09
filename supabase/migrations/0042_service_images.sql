-- A shop's own photo for each service, for the spotlight storefront.
--
-- The spotlight (0041) shows every service as a product card with a photo.
-- Out of the box that photo is one of the app's own cut-outs, chosen from the
-- service's name; an owner who has photos of their own work can put theirs
-- there instead. Empty means "use ours", so no existing row changes.
--
-- The file lives in the public `shop-logos` bucket under the shop's own
-- folder (`<shop_id>/service-<timestamp>.<ext>`), whose policy (0008) already
-- lets only a shop's managers write there. Saving the URL is an ordinary
-- update to `services`, which RLS limits to the shop's members (the same
-- rule as its prices).
--
-- Every visitor's phone loads this URL, so the column only takes a file from
-- that shop's own folder in Supabase storage: no other host, no tracking
-- pixel, no `http:` or `file:` link typed in by hand.
--
-- Additive only, like 0035/0036: the web page reads the photos through its
-- own small function rather than a new get_storefront, which on the live
-- project still waits on 0027/0031.

alter table public.services
  add column if not exists image_url text not null default '';

alter table public.services
  drop constraint if exists services_image_url_own_folder;
alter table public.services
  add constraint services_image_url_own_folder check (
    image_url = ''
    or image_url ~ (
      '^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/shop-logos/'
      || shop_id::text
      || '/[A-Za-z0-9._-]+$'
    )
  );

-- ── the web page reads the photos without reading the whole service row ────
create or replace function public.get_shop_service_images(p_shop_id uuid)
returns table (service_id uuid, image_url text)
language sql
stable security definer set search_path = public
as $$
  select sv.id, sv.image_url
  from public.services sv
  join public.shops s on s.id = sv.shop_id
  where sv.shop_id = p_shop_id
    and sv.is_active
    and s.is_active
    and sv.image_url <> '';
$$;

revoke all on function public.get_shop_service_images(uuid) from public;
grant execute on function public.get_shop_service_images(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
