-- The shop's add-on shelf for a visitor who is not signed in.
--
-- shop_addons and shop_addon_groups are readable only when signed in (0028),
-- so a guest booking on the web page never saw the soaps, fabcons and extras.
-- 0031 fixed that inside get_storefront, but that replacement builds on 0027,
-- which the live project does not have yet. This carries the same fields in
-- the same shape through its own function, so the web checkout can ask for
-- the shelf directly. Active add-ons of an active, web-enabled shop only.

create or replace function public.get_shop_addon_shelf(p_shop_id uuid)
returns jsonb
language sql
stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'addons', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', a.id,
          'shop_id', a.shop_id,
          'kind', a.kind,
          'name', a.name,
          'note', a.note,
          'price', a.price,
          'image_url', a.image_url,
          'is_active', a.is_active,
          'sort_order', a.sort_order,
          'max_quantity', a.max_quantity
        )
        order by a.sort_order, a.created_at
      )
      from public.shop_addons a
      where a.shop_id = s.id and a.is_active
    ), '[]'::jsonb),
    'addon_groups', coalesce((
      select jsonb_object_agg(g.kind, g.allow_multiple)
      from public.shop_addon_groups g
      where g.shop_id = s.id
    ), '{}'::jsonb)
  )
  from public.shops s
  where s.id = p_shop_id
    and s.is_active
    and s.web_enabled;
$$;

revoke all on function public.get_shop_addon_shelf(uuid) from public;
grant execute on function public.get_shop_addon_shelf(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
