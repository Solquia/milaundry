-- A receipt is scanned more than once. The customer who booked in the app
-- scans the docket the shop printed; the one who claimed a walk-in yesterday
-- scans it again today to find the order. Both hold the ticket already, and
-- both used to be told the code was "invalid or already-claimed" — the one
-- message that reads as "not yours" to the person it belongs to.
--
-- So the claim is idempotent for its holder: scanning your own receipt returns
-- your order. A receipt on someone else's account is still refused, and says
-- so in its own words, so the app can tell a stale code from a taken one.
create or replace function public.claim_order(p_order_id uuid, p_token uuid)
returns public.orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_order public.orders;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id and claim_token = p_token;

  if v_order.id is null then
    raise exception 'invalid order QR';
  end if;

  if v_order.customer_id is not null and v_order.customer_id <> auth.uid() then
    raise exception 'order belongs to another account';
  end if;

  if v_order.customer_id is null then
    update public.orders
    set customer_id = auth.uid(), claimed_at = now()
    where id = p_order_id
    returning * into v_order;
  end if;

  insert into public.customer_shops (customer_id, shop_id)
  values (auth.uid(), v_order.shop_id)
  on conflict do nothing;

  return v_order;
end;
$$;
