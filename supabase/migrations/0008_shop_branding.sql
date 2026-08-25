-- Shop branding: slugs (/sparkle-wash), logos, and username logins so a new
-- laundry shop gets an auto-generated branded account instead of needing a
-- phone number. Client-side slugging lives in src/lib/domain/shop-slug.ts.

-- ── shops: slug + logo ──────────────────────────────────────────────────────
alter table public.shops add column if not exists slug text;
alter table public.shops add column if not exists logo_url text not null default '';

-- Backfill slugs for pre-branding shops, deduping with -2, -3, …
with bases as (
  select id,
         coalesce(
           nullif(
             regexp_replace(
               regexp_replace(lower(name), '[^a-z0-9]+', '-', 'g'),
               '(^-+|-+$)', '', 'g'
             ),
             ''
           ),
           'laundry-shop'
         ) as base
  from public.shops
  where slug is null
),
numbered as (
  select id, base, row_number() over (partition by base order by id) as rn
  from bases
)
update public.shops s
set slug = case when n.rn = 1 then n.base else n.base || '-' || n.rn end
from numbered n
where s.id = n.id;

alter table public.shops alter column slug set not null;
create unique index if not exists shops_slug_key on public.shops (slug);

-- ── profiles: username logins ───────────────────────────────────────────────
alter table public.profiles add column if not exists username text;
create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;

-- Profile trigger now records the username for branded accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone, username)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, ''),
    nullif(new.raw_user_meta_data ->> 'username', '')
  );
  return new;
end;
$$;

-- ── RPCs ────────────────────────────────────────────────────────────────────
-- Recreated with slug + logo. Old signatures dropped to avoid overloads.
drop function if exists public.admin_create_shop(text, text, text);

create or replace function public.admin_create_shop(
  p_name text,
  p_address text default '',
  p_phone text default '',
  p_slug text default null,
  p_logo_url text default ''
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
  v_slug text;
begin
  perform public.assert_superadmin();

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'shop name is required';
  end if;

  v_slug := coalesce(nullif(btrim(p_slug), ''),
    coalesce(nullif(regexp_replace(
      regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'),
      '(^-+|-+$)', '', 'g'), ''), 'laundry-shop'));

  if exists (select 1 from public.shops where slug = v_slug) then
    raise exception 'a shop already uses the link name %', v_slug;
  end if;

  insert into public.shops (name, address, phone, slug, logo_url, created_by)
  values (btrim(p_name), coalesce(p_address, ''), coalesce(p_phone, ''),
          v_slug, coalesce(p_logo_url, ''), auth.uid())
  returning * into v_shop;
  return v_shop;
end;
$$;

drop function if exists public.admin_update_shop(uuid, text, text, text);

create or replace function public.admin_update_shop(
  p_shop_id uuid,
  p_name text,
  p_address text default '',
  p_phone text default '',
  p_logo_url text default null
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  perform public.assert_superadmin();

  if coalesce(btrim(p_name), '') = '' then
    raise exception 'shop name is required';
  end if;

  update public.shops
  set name = btrim(p_name),
      address = coalesce(p_address, ''),
      phone = coalesce(p_phone, ''),
      logo_url = coalesce(p_logo_url, logo_url)
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;

  return v_shop;
end;
$$;

-- Member list now surfaces the username for branded accounts.
drop function if exists public.admin_list_shop_members(uuid);

create or replace function public.admin_list_shop_members(p_shop_id uuid)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  username text,
  role text,
  created_at timestamptz
)
language plpgsql
stable
security definer set search_path = public
as $$
begin
  perform public.assert_superadmin();

  return query
    select sm.profile_id, p.full_name, p.phone, p.username, sm.role, sm.created_at
    from public.shop_members sm
    join public.profiles p on p.id = sm.profile_id
    where sm.shop_id = p_shop_id
    order by (sm.role = 'owner') desc, p.full_name;
end;
$$;

-- ── storage: shop logos ─────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('shop-logos', 'shop-logos', true)
on conflict (id) do nothing;

create policy "public reads shop logos" on storage.objects
  for select using (bucket_id = 'shop-logos');

create policy "superadmin manages shop logos" on storage.objects
  for all
  using (bucket_id = 'shop-logos' and public.my_role() = 'superadmin')
  with check (bucket_id = 'shop-logos' and public.my_role() = 'superadmin');
