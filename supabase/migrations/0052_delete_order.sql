-- 0052_delete_order.sql
--
-- Lets the owner erase an order outright, from a customer's page. Owners try
-- the app on themselves before going live, and those test tickets otherwise
-- sit in Customers, Sales and the stamp cards forever. Cancelling is not the
-- same: a cancelled order still lists, still counts as a visit.
--
-- Everything hanging off the order goes with it (order_items,
-- order_status_history and reviews all cascade). Add-on stock needs no
-- give-back: what is left is the last count minus sales since, so the packs
-- on a deleted ticket return to the shelf on their own. Owners only, like the
-- Customers tab itself; staff can still only cancel.

create or replace function public.delete_order(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop_id uuid;
begin
  select shop_id into v_shop_id from public.orders where id = p_order_id for update;
  if v_shop_id is null then
    raise exception 'order not found';
  end if;
  if not public.can_manage_shop(v_shop_id) then
    raise exception 'not allowed';
  end if;

  delete from public.orders where id = p_order_id;
end;
$$;

revoke all on function public.delete_order(uuid) from public, anon;
grant execute on function public.delete_order(uuid) to authenticated;
