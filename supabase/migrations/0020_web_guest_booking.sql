-- A customer on a shop's web page books with a name and a mobile number. The
-- web-guest-session edge function turns those into an account and a session;
-- this migration gives that flow the two things it needs in the database.
--
-- 1. Registration by slug. `register_with_shop` needs the counter token, which
--    the page already prints, but a public page is itself the invitation: a
--    signed-in visitor on /s/<slug> may connect to that shop by naming it.
-- 2. A rate-limit counter for the edge function, so the function cannot be
--    used to mass-create accounts or to probe which numbers have one.

-- ── Registration by slug ────────────────────────────────────────────────────
create or replace function public.register_with_shop_by_slug(p_slug text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_shop_id
  from public.shops
  where slug = p_slug and is_active and web_enabled;
  if v_shop_id is null then
    raise exception 'This laundry is not taking online bookings.';
  end if;

  insert into public.customer_shops (customer_id, shop_id)
  values (auth.uid(), v_shop_id)
  on conflict do nothing;

  return v_shop_id;
end;
$$;

revoke all on function public.register_with_shop_by_slug(text) from public;
grant execute on function public.register_with_shop_by_slug(text) to authenticated;

-- ── Rate limiting for the guest session function ────────────────────────────
-- One row per key ("ip:1.2.3.4", "phone:+63917…") holding a fixed window and
-- a hit count. Only the service role touches it: RLS is on with no policies,
-- and the function is granted to service_role alone. The edge function also
-- charges a 'global' key, because the address key can be chosen by the caller.
create table if not exists public.guest_session_attempts (
  key text primary key,
  window_start timestamptz not null default now(),
  hits integer not null default 0
);

alter table public.guest_session_attempts enable row level security;

create index if not exists guest_session_attempts_window_start_idx
  on public.guest_session_attempts (window_start);

-- Records one attempt and says whether the caller is still within the limit.
-- A window that has expired starts over. Rows older than a day are swept on
-- the way through, so the table never grows past a day's traffic.
create or replace function public.note_guest_attempt(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  v_hits integer;
  v_window interval := make_interval(secs => p_window_seconds);
begin
  if p_key is null or p_limit is null or p_window_seconds is null then
    raise exception 'key, limit and window are required';
  end if;

  -- Sweep old rows now and then rather than on every call: a full-table
  -- delete on each sign-in is a lock and a scan the booking has to wait for.
  if random() < 0.02 then
    delete from public.guest_session_attempts
    where window_start < now() - interval '1 day';
  end if;

  insert into public.guest_session_attempts as a (key, window_start, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case
          when a.window_start < now() - v_window then 1
          else a.hits + 1
        end,
        window_start = case
          when a.window_start < now() - v_window then now()
          else a.window_start
        end
  returning hits into v_hits;

  return v_hits <= p_limit;
end;
$$;

revoke all on function public.note_guest_attempt(text, integer, integer) from public;
grant execute on function public.note_guest_attempt(text, integer, integer) to service_role;
