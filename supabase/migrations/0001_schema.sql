-- MiLaundry core schema
create extension if not exists pgcrypto;

-- ── profiles ────────────────────────────────────────────────────────────
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role text not null default 'customer'
    check (role in ('customer', 'merchant', 'superadmin')),
  full_name text not null default '',
  phone text not null default '',
  created_at timestamptz not null default now()
);

-- New auth users always start as customers; merchant/superadmin roles are
-- granted by a superadmin afterwards (never trusted from client metadata).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.phone, '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── shops ───────────────────────────────────────────────────────────────
create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  phone text not null default '',
  qr_token uuid not null default gen_random_uuid(),
  is_active boolean not null default true,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.shop_members (
  shop_id uuid not null references public.shops (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (shop_id, profile_id)
);

create table public.customer_shops (
  customer_id uuid not null references public.profiles (id) on delete cascade,
  shop_id uuid not null references public.shops (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, shop_id)
);

-- ── services ────────────────────────────────────────────────────────────
create table public.services (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  name text not null,
  unit text not null check (unit in ('per_kg', 'per_item', 'flat')),
  price numeric(10, 2) not null check (price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index services_shop_idx on public.services (shop_id);

-- ── orders ──────────────────────────────────────────────────────────────
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  customer_id uuid references public.profiles (id),
  created_by uuid not null references public.profiles (id),
  status text not null default 'pending'
    check (status in ('pending', 'received', 'in_progress', 'ready', 'completed', 'cancelled')),
  estimated_total numeric(10, 2) not null default 0,
  final_total numeric(10, 2),
  claim_token uuid not null default gen_random_uuid(),
  claimed_at timestamptz,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_shop_idx on public.orders (shop_id);
create index orders_customer_idx on public.orders (customer_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  service_id uuid references public.services (id),
  service_name text not null,
  unit text not null,
  unit_price numeric(10, 2) not null,
  quantity numeric(10, 2) not null check (quantity > 0),
  subtotal numeric(10, 2) not null,
  created_at timestamptz not null default now()
);

create index order_items_order_idx on public.order_items (order_id);

create table public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create index order_status_history_order_idx on public.order_status_history (order_id);

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();
