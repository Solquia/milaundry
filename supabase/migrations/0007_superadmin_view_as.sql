-- Superadmin "open as merchant": the console can open any shop's merchant
-- dashboard using the superadmin's own session (no impersonation, no minted
-- merchant sessions). Permissive policies OR together, so these are additive
-- grants next to the member-scoped ones in 0002_rls.sql.

-- ── helpers ─────────────────────────────────────────────────────────────────
-- Membership-or-superadmin, the operating rule for every merchant surface.
create or replace function public.can_operate_shop(p_shop_id uuid)
returns boolean
language sql stable
security definer set search_path = public
as $$
  select public.is_shop_member(p_shop_id) or public.my_role() = 'superadmin';
$$;

-- ── read access to merchant data ────────────────────────────────────────────
create policy "superadmin reads all orders" on public.orders
  for select using (public.my_role() = 'superadmin');

create policy "superadmin reads all order items" on public.order_items
  for select using (public.my_role() = 'superadmin');

create policy "superadmin reads all order history" on public.order_status_history
  for select using (public.my_role() = 'superadmin');

create policy "superadmin reads all shop registrations" on public.customer_shops
  for select using (public.my_role() = 'superadmin');

-- Services stay manageable so the console can fix a price while checking.
create policy "superadmin manages services" on public.services
  for all using (public.my_role() = 'superadmin')
  with check (public.my_role() = 'superadmin');

-- ── RPCs: treat superadmin like a shop member ───────────────────────────────
-- place_order: same body as 0003, with v_is_member widened to can_operate_shop.
create or replace function public.place_order(
  p_shop_id uuid,
  p_items jsonb,
  p_customer_id uuid default null,
  p_notes text default ''
)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_member boolean := public.can_operate_shop(p_shop_id);
  v_order public.orders;
  v_item record;
  v_service public.services;
  v_line numeric(10, 2);
  v_total numeric(10, 2) := 0;
  v_status text;
  v_customer uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'order must contain at least one item';
  end if;

  if v_is_member then
    v_status := 'received';
    v_customer := p_customer_id; -- may be null (walk-in, claimable via QR)
  else
    -- customer flow: must be registered with the shop
    if not exists (
      select 1 from public.customer_shops
      where customer_id = auth.uid() and shop_id = p_shop_id
    ) then
      raise exception 'not registered with this shop';
    end if;
    v_status := 'pending';
    v_customer := auth.uid();
  end if;

  insert into public.orders (shop_id, customer_id, created_by, status, notes)
  values (p_shop_id, v_customer, auth.uid(), v_status, coalesce(p_notes, ''))
  returning * into v_order;

  for v_item in
    select (e ->> 'service_id')::uuid as service_id,
           (e ->> 'quantity')::numeric as quantity
    from jsonb_array_elements(p_items) e
  loop
    select * into v_service
    from public.services
    where id = v_item.service_id and shop_id = p_shop_id and is_active;

    if v_service.id is null then
      raise exception 'unknown service %', v_item.service_id;
    end if;
    if v_item.quantity is null or v_item.quantity <= 0 then
      raise exception 'invalid quantity for service %', v_item.service_id;
    end if;

    v_line := case
      when v_service.unit = 'flat' then v_service.price
      else round(v_service.price * v_item.quantity, 2)
    end;
    v_total := v_total + v_line;

    insert into public.order_items
      (order_id, service_id, service_name, unit, unit_price, quantity, subtotal)
    values
      (v_order.id, v_service.id, v_service.name, v_service.unit,
       v_service.price, v_item.quantity, v_line);
  end loop;

  update public.orders
  set estimated_total = v_total
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (v_order.id, null, v_status, auth.uid());

  return v_order;
end;
$$;

-- update_order_status: superadmin may perform the same transitions as members.
create or replace function public.update_order_status(p_order_id uuid, p_to text)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
  v_from text;
  v_allowed boolean;
begin
  select * into v_order from public.orders where id = p_order_id;
  if v_order.id is null then
    raise exception 'order not found';
  end if;
  v_from := v_order.status;

  if public.can_operate_shop(v_order.shop_id) then
    null; -- members and superadmin may attempt any transition (validated below)
  elsif v_order.customer_id = auth.uid()
        and v_from = 'pending' and p_to = 'cancelled' then
    null; -- customer cancelling own pending order
  else
    raise exception 'not allowed';
  end if;

  v_allowed := case v_from
    when 'pending' then p_to in ('received', 'cancelled')
    when 'received' then p_to in ('in_progress', 'cancelled')
    when 'in_progress' then p_to in ('ready', 'cancelled')
    when 'ready' then p_to in ('completed', 'cancelled')
    else false
  end;

  if not v_allowed then
    raise exception 'invalid transition % -> %', v_from, p_to;
  end if;

  update public.orders
  set status = p_to,
      final_total = case when p_to = 'completed'
                         then coalesce(final_total, estimated_total)
                         else final_total end
  where id = p_order_id
  returning * into v_order;

  insert into public.order_status_history (order_id, from_status, to_status, changed_by)
  values (p_order_id, v_from, p_to, auth.uid());

  return v_order;
end;
$$;

-- get_shop_customers: same query as 0003 with the membership gate widened.
create or replace function public.get_shop_customers(p_shop_id uuid)
returns table (
  customer_id uuid,
  full_name text,
  phone text,
  registered_at timestamptz,
  order_count bigint,
  total_spend numeric,
  last_order_at timestamptz
)
language sql
stable
security definer set search_path = public
as $$
  select
    cs.customer_id,
    p.full_name,
    p.phone,
    cs.created_at as registered_at,
    count(o.id) as order_count,
    coalesce(sum(coalesce(o.final_total, o.estimated_total))
      filter (where o.status = 'completed'), 0) as total_spend,
    max(o.created_at) as last_order_at
  from public.customer_shops cs
  join public.profiles p on p.id = cs.customer_id
  left join public.orders o
    on o.customer_id = cs.customer_id and o.shop_id = cs.shop_id
  where cs.shop_id = p_shop_id
    and public.can_operate_shop(p_shop_id)
  group by cs.customer_id, p.full_name, p.phone, cs.created_at;
$$;
