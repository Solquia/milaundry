-- Auth now uses synthetic emails (<digits>@phone.milaundry.app) because phone
-- sign-ups require an SMS provider. The real phone number arrives in signup
-- metadata, so the profile trigger must read it from there.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone, '')
  );
  return new;
end;
$$;
