-- Superadmin management of laundry shops and the accounts attached to them.
--
-- Adds an owner/staff distinction to shop_members, and the security-definer
-- RPCs the superadmin console calls. Every RPC re-checks the caller's role in
-- the database; the client-side route gate is convenience, not security.

-- ── shop_members.role ───────────────────────────────────────────────────────
-- Added with default 'owner' so pre-existing memberships (created by the old
-- admin_assign_merchant, which only ever made shop owners) backfill correctly,
-- then switched to 'staff' for anything created from here on.
alter table public.shop_members
  add column if not exists role text not null default 'owner';

alter table public.shop_members
  alter column role set default 'staff';

alter table public.shop_members
  drop constraint if exists shop_members_role_check;

alter table public.shop_members
  add constraint shop_members_role_check check (role in ('owner', 'staff'));

-- ── helpers ─────────────────────────────────────────────────────────────────
create or replace function public.assert_superadmin()
returns void
language plpgsql
stable
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if public.my_role() <> 'superadmin' then
    raise exception 'not allowed';
  end if;
end;
$$;

-- ── shops ───────────────────────────────────────────────────────────────────
create or replace function public.admin_update_shop(
  p_shop_id uuid,
  p_name text,
  p_address text default '',
  p_phone text default ''
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
      phone = coalesce(p_phone, '')
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;

  return v_shop;
end;
$$;

-- Deactivating a shop hides it from new customer registrations (see
-- register_with_shop, which requires is_active) without deleting history.
create or replace function public.admin_set_shop_active(
  p_shop_id uuid,
  p_is_active boolean
)
returns public.shops
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop public.shops;
begin
  perform public.assert_superadmin();

  update public.shops
  set is_active = p_is_active
  where id = p_shop_id
  returning * into v_shop;

  if v_shop.id is null then
    raise exception 'shop not found';
  end if;

  return v_shop;
end;
$$;

-- ── shop accounts ───────────────────────────────────────────────────────────
create or replace function public.admin_list_shop_members(p_shop_id uuid)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
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
    select sm.profile_id, p.full_name, p.phone, sm.role, sm.created_at
    from public.shop_members sm
    join public.profiles p on p.id = sm.profile_id
    where sm.shop_id = p_shop_id
    order by (sm.role = 'owner') desc, p.full_name;
end;
$$;

-- Attach an existing profile to a shop with the given role, promoting it out
-- of 'customer'. Called directly by the console, and by the
-- admin-create-shop-account Edge Function once it has created the auth user.
create or replace function public.admin_attach_shop_account(
  p_shop_id uuid,
  p_profile_id uuid,
  p_role text default 'staff'
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.assert_superadmin();

  if p_role not in ('owner', 'staff') then
    raise exception 'invalid shop role %', p_role;
  end if;
  if not exists (select 1 from public.shops where id = p_shop_id) then
    raise exception 'shop not found';
  end if;
  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'account not found';
  end if;

  -- Never demote a superadmin who is also helping run a shop.
  update public.profiles
  set role = 'merchant'
  where id = p_profile_id and role = 'customer';

  insert into public.shop_members (shop_id, profile_id, role)
  values (p_shop_id, p_profile_id, p_role)
  on conflict (shop_id, profile_id) do update set role = excluded.role;
end;
$$;

-- Replaces the 2-argument version from 0003 (dropped to avoid an ambiguous
-- overload). Assigns by mobile number, defaulting to owner, matching how the
-- console's "assign an existing account" action is used.
drop function if exists public.admin_assign_merchant(uuid, text);

create or replace function public.admin_assign_merchant(
  p_shop_id uuid,
  p_phone text,
  p_role text default 'owner'
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_profile_id uuid;
begin
  perform public.assert_superadmin();

  select id into v_profile_id from public.profiles where phone = p_phone;
  if v_profile_id is null then
    raise exception 'no account with mobile number %', p_phone;
  end if;

  perform public.admin_attach_shop_account(p_shop_id, v_profile_id, p_role);
end;
$$;

-- Mirrors canRemoveMember() in src/lib/domain/shop-member.ts: a shop must keep
-- at least one owner, or nobody can run its dashboard.
create or replace function public.admin_remove_shop_member(
  p_shop_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_role text;
  v_owner_count int;
begin
  perform public.assert_superadmin();

  select role into v_role
  from public.shop_members
  where shop_id = p_shop_id and profile_id = p_profile_id;

  if v_role is null then
    raise exception 'that account is not a member of this shop';
  end if;

  if v_role = 'owner' then
    select count(*) into v_owner_count
    from public.shop_members
    where shop_id = p_shop_id and role = 'owner';

    if v_owner_count <= 1 then
      raise exception 'cannot remove the shop''s only owner';
    end if;
  end if;

  delete from public.shop_members
  where shop_id = p_shop_id and profile_id = p_profile_id;

  -- An account with no remaining shops has no merchant dashboard to visit.
  update public.profiles
  set role = 'customer'
  where id = p_profile_id
    and role = 'merchant'
    and not exists (
      select 1 from public.shop_members where profile_id = p_profile_id
    );
end;
$$;
