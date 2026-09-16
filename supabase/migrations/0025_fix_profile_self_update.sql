-- A customer could never edit their own profile row.
--
-- The `own profile update` policy pinned the role against a subquery that read
-- `public.profiles` — the very table the policy is attached to:
--
--   with check (id = auth.uid() and role = (select p.role from profiles p ...))
--
-- Evaluating the check re-enters the policy, which evaluates the check, which
-- re-enters the policy. Postgres stops it at `42P17: infinite recursion
-- detected in policy for relation "profiles"`, so *every* client-side update to
-- a profile failed with a 500. Nothing in the app had ever written to the row,
-- so the fault sat unseen until the profile screen tried to save how a customer
-- pays (migration 0024).
--
-- The intent was right and is kept exactly: you may edit your own row, and you
-- may not promote yourself. It is spelled through `public.my_role()`, the
-- SECURITY DEFINER helper the superadmin policies already use, which reads the
-- caller's role without going back through this table's policies.
--
-- `is not distinct from` rather than `=`: a null role compared with `=` yields
-- null, which a WITH CHECK treats as a refusal. No row should carry a null
-- role, but a check that failed closed on an impossible value would be one
-- more unexplained 403 rather than an error anybody could read.

drop policy if exists "own profile update" on public.profiles;

create policy "own profile update" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and role is not distinct from public.my_role());
