-- Let a shop brand itself.
--
-- 0008 gave shops a logo, but only a superadmin could set it, and a shop's
-- accent colour was derived from a hash of its id — stable, but nobody's
-- choice. This hands both to the people who actually own the brand.

-- ── shops: the chosen face ──────────────────────────────────────────────
alter table public.shops
  add column if not exists brand_accent smallint,
  add column if not exists tagline text not null default '';

-- Null means "use the hashed default". The ceiling is deliberately looser than
-- today's six-colour palette so the palette can grow without a migration; the
-- client falls back to the hash for anything it cannot render.
alter table public.shops drop constraint if exists shops_brand_accent_check;
alter table public.shops
  add constraint shops_brand_accent_check
  check (brand_accent is null or (brand_accent >= 0 and brand_accent < 12));

-- ── set_shop_branding ───────────────────────────────────────────────────
-- shops rows are otherwise superadmin-only to write. This narrows the opening
-- to the three presentation columns, for people who can already operate the
-- shop — the same shape as set_shop_payment_details in 0011.
create or replace function public.set_shop_branding(
  p_shop_id uuid,
  p_brand_accent smallint default null,
  p_tagline text default '',
  p_logo_url text default null
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
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
      -- Null leaves the existing logo alone, so saving a colour does not wipe
      -- a logo the merchant uploaded on a previous visit.
      logo_url = coalesce(nullif(btrim(coalesce(p_logo_url, '')), ''), logo_url)
  where id = p_shop_id
  returning * into v_shop;

  return v_shop;
end;
$$;

-- ── shop-logos: let a shop manage its own ───────────────────────────────
-- New uploads are keyed `<shop_id>/<file>`, so the first path segment scopes
-- the policy. The old flat `<slug>-<ts>.<ext>` keys stay readable under the
-- existing public-read policy; they simply cannot be written by a merchant,
-- which is correct — a flat key has no shop to check against, and letting one
-- shop's owner overwrite `<other-slug>-....jpg` is exactly the hole this avoids.
--
-- Matched as text against shops.id rather than casting the path segment to
-- uuid: a cast would raise on any object whose folder is not a uuid, and a
-- policy that throws takes down every read of the bucket.
drop policy if exists "shop members manage own logo" on storage.objects;
create policy "shop members manage own logo" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and public.can_operate_shop(s.id)
    )
  )
  with check (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(name))[1]
        and public.can_operate_shop(s.id)
    )
  );
