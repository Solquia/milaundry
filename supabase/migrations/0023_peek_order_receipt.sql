-- What a scanned receipt may show before it is claimed.
--
-- peek_scan (0016) answers with the shop, which is how the claim page can
-- greet a stranger by the laundry's name. But that is all it answers with, so
-- the page showed a receipt with no receipt on it: somebody holding a printed
-- slip could not check it was theirs, or what it was for, without first
-- attaching it to their account.
--
-- The bound on what this returns is what the paper already says. The load's
-- own lines, its totals and its state, and deliberately NOT customer_name,
-- customer_phone, delivery_address or notes: a receipt dropped in the street
-- must not hand a stranger the person it belongs to.
--
-- Same gate as peek_scan's order branch — the printed token, and only while
-- the load is unclaimed. Once it is on an account, the account is how you
-- read it.
create or replace function public.peek_order(p_id uuid, p_token uuid)
returns jsonb
language sql
stable
security definer set search_path = public
as $$
  select jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'order_type', o.order_type,
    'fulfillment', o.fulfillment,
    'payment_status', o.payment_status,
    'created_at', o.created_at,
    'estimated_total', o.estimated_total,
    'final_total', o.final_total,
    'actual_weight_kg', o.actual_weight_kg,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'service_name', i.service_name,
        'unit', i.unit,
        'quantity', i.quantity,
        'subtotal', i.subtotal
      ) order by i.created_at)
      from public.order_items i
      where i.order_id = o.id
    ), '[]'::jsonb)
  )
  from public.orders o
  where o.id = p_id
    and o.claim_token = p_token
    and o.customer_id is null;
$$;

revoke all on function public.peek_order(uuid, uuid) from public;
grant execute on function public.peek_order(uuid, uuid) to anon, authenticated;
