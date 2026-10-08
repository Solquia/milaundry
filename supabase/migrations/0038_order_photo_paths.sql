-- ── An order's photos must be that order's photos ─────────────────────────
-- submit_payment_proof, weigh_order and confirm_order_price stored whatever
-- path they were handed, and the view link is authorized by the order id the
-- path names. So a customer could point their "I paid" proof at another
-- order's genuine receipt at the same shop — the shop can read that order, so
-- the link opened and showed a real receipt for money this customer never
-- sent. The same hole let a weigh photo be borrowed from another order.
--
-- One trigger covers every setter: a changed path must live in this order's
-- own folder and be the right kind of photo.
--
--   ImageKit (today)     /orders/<order id>/proof-<ms>.<ext>
--                        /orders/<order id>/weigh-<ms>.<ext>
--   Supabase Storage     <order id>/<file>   (orders from before ImageKit;
--                        the bucket's policies already key on that folder)
--
-- Mirrors orderIdOfPhotoPath in supabase/functions/imagekit-media/index.ts.

create or replace function public.is_order_photo_path(
  p_order_id uuid,
  p_kind text,
  p_path text
)
returns boolean
language sql
immutable
as $$
  select p_path ~ ('^/orders/' || p_order_id::text || '/' || p_kind || '-[0-9]+\.[a-z0-9]+$')
      or p_path ~ ('^' || p_order_id::text || '/[^/]+$');
$$;

create or replace function public.orders_own_their_photos()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.payment_proof_path is distinct from old.payment_proof_path
     and new.payment_proof_path is not null
     and not public.is_order_photo_path(new.id, 'proof', new.payment_proof_path) then
    raise exception 'That receipt does not belong to this order.';
  end if;

  if new.weigh_photo_path is distinct from old.weigh_photo_path
     and new.weigh_photo_path is not null
     and not public.is_order_photo_path(new.id, 'weigh', new.weigh_photo_path) then
    raise exception 'That photo does not belong to this order.';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_own_their_photos on public.orders;
create trigger orders_own_their_photos
  before update of payment_proof_path, weigh_photo_path on public.orders
  for each row execute function public.orders_own_their_photos();

notify pgrst, 'reload schema';
