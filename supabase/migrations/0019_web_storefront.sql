-- Every laundry gets a public web page at https://<host>/s/<slug>, so a
-- customer with no app can read the price list and, in later phases, book and
-- claim a receipt. Shops and services are readable only by signed-in users, so
-- the page gets one slug-keyed, security-definer read of its own.
--
-- The read includes the shop's qr_token. That token used to be the secret that
-- gated registration to people physically at the counter; on a public page the
-- page itself is the invitation, and the counter code printed on it has to be
-- the same code the app scans. A shop that turns its web page off takes the
-- token off the web with it: the function returns nothing for it. Pages are
-- on by default (a product decision, 2026-09-07): from this migration on the
-- token is no longer proof of standing at the counter, and any account that
-- reads a page can connect to that shop, which is what the page is for.

alter table public.shops
  add column if not exists web_enabled boolean not null default true;

-- ── The storefront, as one document ─────────────────────────────────────────
-- Display fields only: no created_by, no payment rails. The rails are read
-- after sign-in through the order itself, as the app does.
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
      'qr_token', s.qr_token
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
    ), '[]'::jsonb)
  )
  from public.shops s
  where s.slug = p_slug
    and s.is_active
    and s.web_enabled;
$$;

revoke all on function public.get_storefront(text) from public;
grant execute on function public.get_storefront(text) to anon, authenticated;

-- ── The switch ──────────────────────────────────────────────────────────────
create or replace function public.set_shop_web_enabled(p_shop_id uuid, p_enabled boolean)
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
  -- A switch must never default to the more public state.
  if p_enabled is null then
    raise exception 'enabled is required';
  end if;

  update public.shops
  set web_enabled = p_enabled
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;
  return v_shop;
end;
$$;

revoke all on function public.set_shop_web_enabled(uuid, boolean) from public;
grant execute on function public.set_shop_web_enabled(uuid, boolean) to authenticated;
