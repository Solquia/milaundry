-- The web booking page asks the same questions as the app.
--
-- The shop's own web page (/s/<slug>/book) used to run its own, older booking:
-- a cart of services with no add-ons, no heavy items and no wash preferences.
-- It now runs the app's booking flow, and that flow needs three things the
-- storefront never carried:
--
--   * the shop's priced add-on shelf (soaps, fabcons, extras),
--   * whether each shelf kind is pick-one or pick-several, and
--   * which wash preferences the shop honours.
--
-- A visitor on the web page is usually signed out until the last step, and
-- shop_addons / shop_addon_groups are readable only when signed in. So they
-- ride on get_storefront, which already answers anonymously for a shop that
-- is active and has its web page switched on — and only for that shop.
-- Only active add-ons are returned; the server still prices every order from
-- the shop's own rows, so nothing here is trusted on the way back in.

create or replace function public.get_storefront(p_slug text)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'shop', jsonb_build_object(
      'id', s.id,
      'name', s.name,
      'slug', s.slug,
      'tagline', s.tagline,
      'brand_accent', s.brand_accent,
      'logo_url', s.logo_url,
      'cover_url', s.cover_url,
      'address', s.address,
      'phone', s.phone,
      'latitude', s.latitude,
      'longitude', s.longitude,
      'qr_token', s.qr_token,
      'supported_preferences', to_jsonb(s.supported_preferences)
    ),
    'services', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sv.id,
          'name', sv.name,
          'unit', sv.unit,
          'price', sv.price,
          'category', sv.category,
          'min_quantity', sv.min_quantity,
          'description', sv.description,
          'sort_order', sv.sort_order
        )
        order by sv.sort_order, sv.name
      )
      from public.services sv
      where sv.shop_id = s.id and sv.is_active
    ), '[]'::jsonb),
    'reviews', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', r.id,
          'rating', r.rating,
          'comment', r.comment,
          'created_at', r.created_at
        )
        order by r.created_at desc
      )
      from (
        select id, rating, comment, created_at
        from public.reviews
        where shop_id = s.id
        order by created_at desc
        limit 20
      ) r
    ), '[]'::jsonb),
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
  where s.slug = p_slug
    and s.is_active
    and s.web_enabled;
$$;
revoke all on function public.get_storefront(text) from public;
grant execute on function public.get_storefront(text) to anon, authenticated;
