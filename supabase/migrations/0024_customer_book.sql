-- The customer's own book: where their laundry goes, and how they usually pay.
--
-- Until now a delivery address was typed fresh into every booking and thrown
-- away with the order, so the same person retyped the same street on every
-- order they ever placed, and a typo in it was a rider at the wrong gate. The
-- payment method was re-picked every time for the same reason.
--
-- Two things live here and nothing else:
--
--   * addresses the customer named and can reuse, one of them their default;
--   * which payment method they usually use, and the wallet number that goes
--     with it when that method is an e-wallet.
--
-- Deliberately NOT here: card numbers, expiry dates, CVVs, or anything else a
-- card scheme would call cardholder data. MiLaundry does not take card
-- payments online — `card` means the terminal on the counter — and storing a
-- PAN to draw a nice row on a profile screen would put this database inside
-- PCI-DSS scope for a decoration. If card-on-file is ever wanted, it arrives
-- as a processor token from PayMongo or Xendit and holds a brand and a last
-- four; the number never touches this schema.

create table if not exists public.customer_addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  -- What the customer calls it: "Home", "Mum's", "the office".
  label text not null check (length(btrim(label)) between 1 and 40),
  address text not null check (length(btrim(address)) between 1 and 300),
  -- Free text the rider needs: gate codes, landmarks, which floor.
  notes text not null default '' check (length(notes) <= 200),
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists customer_addresses_profile_idx
  on public.customer_addresses (profile_id, created_at desc);

-- At most one default each. A partial unique index rather than a trigger: the
-- rule is a fact about the data, and the database is the only place two phones
-- saving at once can be made to agree about it.
create unique index if not exists customer_addresses_one_default_idx
  on public.customer_addresses (profile_id)
  where is_default;

alter table public.customer_addresses enable row level security;

-- Yours and nobody else's, in every direction. There is no shop-side read:
-- the address a shop needs is the one stamped onto the order it is filling,
-- not the customer's whole book.
drop policy if exists customer_addresses_own_select on public.customer_addresses;
create policy customer_addresses_own_select on public.customer_addresses
  for select using (auth.uid() = profile_id);

drop policy if exists customer_addresses_own_insert on public.customer_addresses;
create policy customer_addresses_own_insert on public.customer_addresses
  for insert with check (auth.uid() = profile_id);

drop policy if exists customer_addresses_own_update on public.customer_addresses;
create policy customer_addresses_own_update on public.customer_addresses
  for update using (auth.uid() = profile_id) with check (auth.uid() = profile_id);

drop policy if exists customer_addresses_own_delete on public.customer_addresses;
create policy customer_addresses_own_delete on public.customer_addresses
  for delete using (auth.uid() = profile_id);

-- Moving the default is two writes that must not be seen apart: clearing the
-- old one and setting the new. Done from the client they would trip the unique
-- index in whichever order they arrived, so the pair is one statement here.
create or replace function public.set_default_address(p_address_id uuid)
returns public.customer_addresses
language plpgsql
security invoker set search_path = public
as $$
declare
  v_address public.customer_addresses;
begin
  update public.customer_addresses
  set is_default = false
  where profile_id = auth.uid() and is_default and id <> p_address_id;

  update public.customer_addresses
  set is_default = true
  where id = p_address_id and profile_id = auth.uid()
  returning * into v_address;

  if v_address.id is null then
    raise exception 'address not found';
  end if;

  return v_address;
end;
$$;

grant execute on function public.set_default_address(uuid) to authenticated;

-- How this customer usually pays, so a booking can arrive with it already
-- chosen. `payment_handle` is the GCash or Maya number the shop would send a
-- request to — a mobile number, which this app already holds for every
-- account, not an instrument.
alter table public.profiles
  add column if not exists preferred_payment_method text
    check (preferred_payment_method in ('cash', 'gcash', 'maya', 'bank_transfer')),
  add column if not exists payment_handle text
    check (payment_handle is null or length(btrim(payment_handle)) <= 40);
