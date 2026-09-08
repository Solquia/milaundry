-- An owner cuts their own key for the counter.
--
-- Staff logins have existed since 0005, but only a superadmin could create
-- one, so a shop taking on a new hire had to write to us and wait. What
-- actually happens in the meantime is that the owner hands out their own
-- password, which is worse than any risk this function carries.
--
-- The role is not a parameter. `admin_attach_shop_account` takes one because a
-- superadmin may legitimately attach either; an owner may only ever mint
-- staff, and the cheapest way to guarantee that is to give them no way to say
-- otherwise. The Edge Function refuses a non-staff role from a merchant caller
-- and this hardcodes the same word again, so neither layer is load-bearing
-- alone.
create or replace function public.owner_attach_shop_staff(
  p_shop_id uuid,
  p_profile_id uuid
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- can_manage_shop (0021) is already the owner test the settings screen uses,
  -- and it answers true for a superadmin running any shop.
  if not public.can_manage_shop(p_shop_id) then
    raise exception 'not allowed';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'account not found';
  end if;

  -- A brand-new login is created as a customer; joining a shop makes them a
  -- merchant. A superadmin helping out keeps their own role.
  update public.profiles
  set role = 'merchant'
  where id = p_profile_id and role = 'customer';

  -- do nothing, not do update: if this person is already attached — and they
  -- may be attached as an *owner* — re-running must never change their role.
  insert into public.shop_members (shop_id, profile_id, role)
  values (p_shop_id, p_profile_id, 'staff')
  on conflict (shop_id, profile_id) do nothing;
end;
$$;

revoke all on function public.owner_attach_shop_staff(uuid, uuid) from public;
grant execute on function public.owner_attach_shop_staff(uuid, uuid) to authenticated;
