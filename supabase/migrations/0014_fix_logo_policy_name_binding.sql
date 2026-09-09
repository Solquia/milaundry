-- ── shop-logos: the policy was checking the wrong `name` ────────────────
-- 0012 wrote the ownership check as
--
--   exists (select 1 from public.shops s
--           where s.id::text = (storage.foldername(name))[1] ...)
--
-- Unqualified `name` inside that subquery binds to `shops.name`, not to
-- `storage.objects.name` — the shop's own trading name, which has no path
-- segments at all. `storage.foldername('Sparkle clean')` is `{}`, so `[1]` is
-- null, `s.id::text = null` is null, and the `exists` is false for every row.
-- The result: no shop member could upload a logo, ever. Only superadmins could,
-- through the separate policy beside it, which is why it survived review.
--
-- The order-photos policies in 0011 were written the same way and are correct
-- by luck: `orders` has no `name` column, so `name` there resolved outward to
-- `storage.objects.name`. Qualifying it explicitly is the only version that a
-- future column cannot silently break.
drop policy if exists "shop members manage own logo" on storage.objects;
create policy "shop members manage own logo" on storage.objects
  for all to authenticated
  using (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_operate_shop(s.id)
    )
  )
  with check (
    bucket_id = 'shop-logos'
    and exists (
      select 1 from public.shops s
      where s.id::text = (storage.foldername(storage.objects.name))[1]
        and public.can_operate_shop(s.id)
    )
  );
