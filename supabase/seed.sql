-- Development seed data (synthetic). Run after migrations on a local stack.
-- Creates one shop with a service catalog. Users must be created through
-- auth sign-up (phone + password); promote a superadmin manually:
--   update public.profiles set role = 'superadmin' where phone = '+639170000001';

insert into public.shops (id, name, address, phone)
values (
  '11111111-1111-4111-8111-111111111111',
  'Sparkle Wash Laundry',
  '123 Rizal Ave, Quezon City',
  '+639171234567'
);

insert into public.services (shop_id, name, unit, price) values
  ('11111111-1111-4111-8111-111111111111', 'Wash & Fold', 'per_kg', 35.00),
  ('11111111-1111-4111-8111-111111111111', 'Wash, Dry & Press', 'per_kg', 55.00),
  ('11111111-1111-4111-8111-111111111111', 'Comforter / Blanket', 'per_item', 180.00),
  ('11111111-1111-4111-8111-111111111111', 'Shoes Cleaning', 'per_item', 250.00),
  ('11111111-1111-4111-8111-111111111111', 'Pickup & Delivery', 'flat', 50.00);
