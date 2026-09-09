-- A guest who scans a laundry's code should see the laundry's name before
-- being asked to create an account: "Sparkle Wash is ready for you" converts;
-- "Laundry found — sign in to see which" does not.
--
-- Shops are readable only by authenticated users, so this is the one
-- token-gated window a guest gets. It returns the display fields only, and
-- only for a code that would actually work once they are in: an active shop's
-- own token, or the claim token of an order nobody has claimed yet. A wrong
-- token returns nothing, which is the same answer an unknown id gives, so the
-- function cannot be used to confirm that a shop or order id exists.

create or replace function public.peek_scan(p_type text, p_id uuid, p_token uuid)
returns table (
  id uuid,
  name text,
  slug text,
  tagline text,
  brand_accent smallint,
  logo_url text
)
language sql
stable
security definer set search_path = public
as $$
  select s.id, s.name, s.slug, s.tagline, s.brand_accent, s.logo_url
  from public.shops s
  where s.is_active
    and (
      (p_type = 'shop' and s.id = p_id and s.qr_token = p_token)
      or (
        p_type = 'order'
        and s.id = (
          select o.shop_id
          from public.orders o
          where o.id = p_id
            and o.claim_token = p_token
            and o.customer_id is null
        )
      )
    );
$$;

revoke all on function public.peek_scan(text, uuid, uuid) from public;
grant execute on function public.peek_scan(text, uuid, uuid) to anon, authenticated;
