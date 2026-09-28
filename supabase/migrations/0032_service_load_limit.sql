-- A per-load price says how much fits in the load.
--
-- Laundromat boards price by the load and cap its weight: "Wash-Dry-Fold,
-- max 6 kg per load, ₱150". The price list could only say "₱150 flat" and put
-- the 6 kg in free text, where the app cannot show it consistently. This adds
-- the cap as its own column, shown beside the price on every surface.
--
-- It is shown, not billed: place_order still prices each line from unit,
-- price and min_quantity, so an order heavier than the cap is the counter's
-- call (another load), not something the server splits on its own.
--
-- Deploy note (2026-09-25): the ALTER TABLE below was run on the live project
-- by hand so the price form could save. The get_storefront replacement was
-- not: it builds on 0027 and 0031, which the live project does not have yet.
-- Run this file in order after them; the ALTER is idempotent.
--
-- get_storefront lists service fields by name, so the web page only sees the
-- cap once it is added there too; the rest of the function is unchanged.

alter table public.services
  add column if not exists max_quantity numeric(10, 2) not null default 0
    check (max_quantity >= 0);

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
          'max_quantity', sv.max_quantity,
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
