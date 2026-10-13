-- 0046_loyalty_rewards.sql
--
-- Rewards that bring a customer back. An owner turns them on in the Prices
-- tab; the customer sees their stamp card on the shop's page; the counter
-- applies a reward to an order and the bill drops by it.
--
-- Three programs, one row each per shop:
--   stamp_card  every N finished visits earns one reward ("10th wash free")
--   welcome     a first-visit gift, once per customer
--   regular     after N finished visits, every order gets the benefit
--
-- A benefit is one of:
--   free     the order is free, up to benefit_value (0 = no cap)
--   percent  benefit_value % off
--   amount   benefit_value pesos off
--
-- A visit is an order that reached `completed`. A customer is the account on
-- the order, or, for a walk-in with no account, the last ten digits of the
-- phone the counter typed. The two are never mixed: the phone on an account's
-- order is typed by the customer, so matching on it would let anyone collect
-- a stranger's stamps by booking with their number. A walk-in ticket the
-- customer later scans is claimed onto the account and counts from then on.
--
-- Money: estimated_total and final_total stay what the customer pays. The
-- reward is subtracted from both, and the amounts taken off are kept beside
-- them so a removed reward can be put back exactly. confirm_order_price is
-- patched in place to take the reward off the reweighed total.

create table if not exists public.shop_rewards (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  kind text not null check (kind in ('stamp_card', 'welcome', 'regular')),
  visits_needed integer not null default 0,
  benefit text not null check (benefit in ('free', 'percent', 'amount')),
  benefit_value numeric(10, 2) not null default 0 check (benefit_value >= 0 and benefit_value <= 100000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, kind),
  constraint shop_rewards_visits_rule check (
    case kind
      when 'stamp_card' then visits_needed between 2 and 50
      when 'regular' then visits_needed between 2 and 100
      else visits_needed = 0
    end
  ),
  constraint shop_rewards_value_rule check (
    case benefit
      when 'percent' then benefit_value between 1 and 100
      when 'amount' then benefit_value > 0
      else true
    end
  )
);

drop trigger if exists shop_rewards_touch on public.shop_rewards;
create trigger shop_rewards_touch before update on public.shop_rewards
  for each row execute function public.touch_updated_at();

alter table public.shop_rewards enable row level security;

drop policy if exists "anyone reads live rewards" on public.shop_rewards;
create policy "anyone reads live rewards" on public.shop_rewards
  for select to anon, authenticated
  using (is_active or public.can_operate_shop(shop_id));

drop policy if exists "owners manage rewards" on public.shop_rewards;
create policy "owners manage rewards" on public.shop_rewards
  for all to authenticated
  using (public.can_manage_shop(shop_id) or public.my_role() = 'superadmin')
  with check (public.can_manage_shop(shop_id) or public.my_role() = 'superadmin');

grant select on public.shop_rewards to anon, authenticated;
grant insert, update, delete on public.shop_rewards to authenticated;

-- The reward on an order, snapshotted: a later change to the program does
-- not move a bill that was already discounted.
alter table public.orders
  add column if not exists reward_id uuid references public.shop_rewards (id) on delete set null,
  add column if not exists reward_kind text check (reward_kind in ('stamp_card', 'welcome', 'regular')),
  add column if not exists reward_benefit text check (reward_benefit in ('free', 'percent', 'amount')),
  add column if not exists reward_value numeric(10, 2),
  -- Taken off final_total (0 until the order is priced).
  add column if not exists reward_discount numeric(10, 2) not null default 0,
  -- Taken off estimated_total.
  add column if not exists reward_estimate_discount numeric(10, 2) not null default 0;

create index if not exists orders_shop_reward_idx on public.orders (shop_id) where reward_kind is not null;

-- Pesos a benefit takes off a gross amount. Never more than the amount.
create or replace function public.reward_amount(p_benefit text, p_value numeric, p_gross numeric)
returns numeric
language sql
immutable
set search_path = public
as $$
  select greatest(0, least(coalesce(p_gross, 0),
    case p_benefit
      when 'free' then case when coalesce(p_value, 0) > 0 then p_value else coalesce(p_gross, 0) end
      when 'percent' then round(coalesce(p_gross, 0) * coalesce(p_value, 0) / 100, 2)
      when 'amount' then coalesce(p_value, 0)
      else 0
    end));
$$;

-- What the reward on an order takes off a freshly computed gross total.
create or replace function public.order_reward_discount(p_order_id uuid, p_gross numeric)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select public.reward_amount(o.reward_benefit, o.reward_value, p_gross)
    from public.orders o
    where o.id = p_order_id and o.reward_kind is not null
  ), 0);
$$;

revoke all on function public.order_reward_discount(uuid, numeric) from public, anon, authenticated;

-- The last ten digits of a phone, or null when there are not ten to take.
create or replace function public.reward_phone_key(p_phone text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) >= 10
      then right(regexp_replace(p_phone, '\D', '', 'g'), 10)
  end;
$$;

-- When an unpriced order's estimate is copied into final_total (finishing or
-- marking paid), the estimate's discount becomes the final one.
create or replace function public.orders_carry_reward()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reward_kind is not null
     and old.final_total is null
     and new.final_total is not null
     and new.final_total = new.estimated_total
     and new.reward_discount = old.reward_discount then
    new.reward_discount := new.reward_estimate_discount;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_carry_reward on public.orders;
create trigger orders_carry_reward before update of final_total on public.orders
  for each row execute function public.orders_carry_reward();

-- Every live program at a shop, and where one customer stands on each.
-- Internal: callers check who may ask first.
create or replace function public.reward_standing(p_shop_id uuid, p_customer_id uuid, p_phone_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_visits integer := 0;
  v_stamps_used integer := 0;
  v_welcome_used boolean := false;
  v_tracked boolean := p_customer_id is not null or p_phone_key is not null;
  v_programs jsonb;
begin
  if v_tracked then
    select
      count(*) filter (where o.status = 'completed'),
      count(*) filter (where o.reward_kind = 'stamp_card' and o.status <> 'cancelled'),
      coalesce(bool_or(o.reward_kind = 'welcome' and o.status <> 'cancelled'), false)
    into v_visits, v_stamps_used, v_welcome_used
    from public.orders o
    where o.shop_id = p_shop_id
      and case
        when p_customer_id is not null then o.customer_id = p_customer_id
        else o.customer_id is null and public.reward_phone_key(o.customer_phone) = p_phone_key
      end;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id,
      'kind', r.kind,
      'visits_needed', r.visits_needed,
      'benefit', r.benefit,
      'benefit_value', r.benefit_value,
      'ready', case
        when not v_tracked then 0
        when r.kind = 'stamp_card' then greatest(v_visits / r.visits_needed - v_stamps_used, 0)
        when r.kind = 'welcome' then case when v_visits = 0 and not v_welcome_used then 1 else 0 end
        when r.kind = 'regular' then case when v_visits >= r.visits_needed then 1 else 0 end
        else 0
      end
    ) order by array_position(array['stamp_card', 'welcome', 'regular'], r.kind)), '[]'::jsonb)
  into v_programs
  from public.shop_rewards r
  where r.shop_id = p_shop_id and r.is_active;

  return jsonb_build_object('tracked', v_tracked, 'visits', v_visits, 'programs', v_programs);
end;
$$;

revoke all on function public.reward_standing(uuid, uuid, text) from public, anon, authenticated;

-- The counter's view: what the customer on this order can use.
create or replace function public.get_order_rewards(p_order_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;
  return public.reward_standing(
    v_order.shop_id, v_order.customer_id, public.reward_phone_key(v_order.customer_phone));
end;
$$;

revoke all on function public.get_order_rewards(uuid) from public, anon;
grant execute on function public.get_order_rewards(uuid) to authenticated;

create or replace function public.apply_order_reward(p_order_id uuid, p_reward_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_reward public.shop_rewards;
  v_standing jsonb;
  v_ready integer;
  v_est numeric(10, 2);
  v_final numeric(10, 2);
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;
  if v_order.status = 'cancelled' then
    raise exception 'reward: this order was cancelled';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'reward: this order is already paid';
  end if;
  if v_order.payment_proof_path is not null then
    raise exception 'reward: the customer already sent payment for the full amount';
  end if;
  if v_order.reward_kind is not null then
    raise exception 'reward: this order already has a reward';
  end if;
  -- One customer, one reward at a time: two counters applying to two of the
  -- same person's orders would otherwise both see it as still unused.
  perform pg_advisory_xact_lock(hashtext('reward:' || v_order.shop_id || ':' || coalesce(
    v_order.customer_id::text, public.reward_phone_key(v_order.customer_phone), v_order.id::text)));

  select * into v_reward from public.shop_rewards
  where id = p_reward_id and shop_id = v_order.shop_id and is_active;
  if v_reward.id is null then
    raise exception 'reward: that reward is not on offer';
  end if;

  v_standing := public.reward_standing(
    v_order.shop_id, v_order.customer_id, public.reward_phone_key(v_order.customer_phone));
  if not (v_standing ->> 'tracked')::boolean then
    raise exception 'reward: add the customer''s phone number first';
  end if;
  select (p ->> 'ready')::integer into v_ready
  from jsonb_array_elements(v_standing -> 'programs') p
  where p ->> 'id' = v_reward.id::text;
  if coalesce(v_ready, 0) < 1 then
    raise exception 'reward: this customer has not earned it yet';
  end if;

  v_est := public.reward_amount(v_reward.benefit, v_reward.benefit_value, v_order.estimated_total);
  v_final := case when v_order.final_total is null then 0
    else public.reward_amount(v_reward.benefit, v_reward.benefit_value, v_order.final_total) end;

  update public.orders
  set reward_id = v_reward.id,
      reward_kind = v_reward.kind,
      reward_benefit = v_reward.benefit,
      reward_value = v_reward.benefit_value,
      reward_estimate_discount = v_est,
      reward_discount = v_final,
      estimated_total = estimated_total - v_est,
      final_total = case when final_total is null then null else final_total - v_final end
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.apply_order_reward(uuid, uuid) from public, anon;
grant execute on function public.apply_order_reward(uuid, uuid) to authenticated;

create or replace function public.remove_order_reward(p_order_id uuid)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  if not public.can_operate_shop(v_order.shop_id) then
    raise exception 'not allowed';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'reward: this order is already paid';
  end if;
  if v_order.payment_proof_path is not null then
    raise exception 'reward: the customer already sent payment for this amount';
  end if;
  if v_order.reward_kind is null then
    return v_order;
  end if;

  update public.orders
  set estimated_total = estimated_total + reward_estimate_discount,
      final_total = case when final_total is null then null else final_total + reward_discount end,
      reward_id = null,
      reward_kind = null,
      reward_benefit = null,
      reward_value = null,
      reward_discount = 0,
      reward_estimate_discount = 0
  where id = p_order_id
  returning * into v_order;

  return v_order;
end;
$$;

revoke all on function public.remove_order_reward(uuid) from public, anon;
grant execute on function public.remove_order_reward(uuid) to authenticated;

-- The customer's view: their standing at every shop with a live program that
-- they are connected to or have ordered from. p_shop_id narrows it to one.
create or replace function public.get_my_rewards(p_shop_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_result jsonb;
begin
  if v_uid is null then
    return '[]'::jsonb;
  end if;

  -- The account only: a profile phone is the customer's to type.
  select coalesce(jsonb_agg(
      public.reward_standing(s.id, v_uid, null)
        || jsonb_build_object('shop_id', s.id, 'shop_name', s.name)
      order by s.name), '[]'::jsonb)
  into v_result
  from public.shops s
  where (p_shop_id is null or s.id = p_shop_id)
    and exists (select 1 from public.shop_rewards r where r.shop_id = s.id and r.is_active)
    and (exists (select 1 from public.customer_shops c where c.shop_id = s.id and c.customer_id = v_uid)
      or exists (select 1 from public.orders o where o.shop_id = s.id and o.customer_id = v_uid));

  return v_result;
end;
$$;

revoke all on function public.get_my_rewards(uuid) from public, anon;
grant execute on function public.get_my_rewards(uuid) to authenticated;

-- Reweighing an order with a reward on it takes the reward off the new total.
do $patch$
declare
  v_def text;
  v_from constant text := $s$  set final_total = v_total,$s$;
begin
  v_def := pg_get_functiondef('public.confirm_order_price(uuid, jsonb, text)'::regprocedure);
  if position('order_reward_discount' in v_def) = 0 then
    if position(v_from in v_def) = 0 then
      raise exception 'confirm_order_price no longer sets final_total = v_total; patch by hand';
    end if;
    v_def := replace(v_def, v_from, $s$  set final_total = v_total - public.order_reward_discount(p_order_id, v_total),
      reward_discount = public.order_reward_discount(p_order_id, v_total),$s$);
    execute v_def;
  end if;
end;
$patch$;
