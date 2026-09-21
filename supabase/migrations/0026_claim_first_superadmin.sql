-- The first platform admin is made by hand today (docs/SETUP.md §4): sign up,
-- then `update profiles set role = 'superadmin'`. That second step needs the
-- SQL editor, which is easy to miss, so a signed-in account may claim the
-- role once — and only while no superadmin exists. A second caller is refused.
-- Never trusted from client metadata; the check runs in the database.

create or replace function public.claim_first_superadmin()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'no profile for this account';
  end if;

  if v_profile.role = 'superadmin' then
    return v_profile;
  end if;

  if exists (select 1 from public.profiles where role = 'superadmin') then
    raise exception 'a superadmin already exists';
  end if;

  update public.profiles
  set role = 'superadmin'
  where id = auth.uid()
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.claim_first_superadmin() from public;
grant execute on function public.claim_first_superadmin() to authenticated;

-- The bootstrap login already signed up as a customer. Promote it with the
-- migration so the existing admin console is reachable without a second
-- SQL-editor step.
update public.profiles
set role = 'superadmin'
where phone = '+639170000099';
