-- Development seed data (synthetic). Run after migrations, on a local stack or
-- a dev project. Creates one shop with a categorized service catalog so the
-- customer shop page renders a proper services grid.
--
-- Users must be created through auth sign-up (phone + password); promote a
-- superadmin manually:
--   update public.profiles set role = 'superadmin' where phone = '+639170000001';
--
-- Safe to re-run: inserts are idempotent on the fixed shop id.

insert into public.shops (id, name, address, phone)
values (
  '11111111-1111-4111-8111-111111111111',
  'Sparkle Wash Laundry',
  '123 Rizal Ave, Quezon City',
  '+639171234567'
)
on conflict (id) do nothing;

insert into public.services
  (shop_id, name, unit, price, category, min_quantity, description, sort_order)
values
  ('11111111-1111-4111-8111-111111111111', 'Wash, Dry & Fold', 'per_kg', 35.00,
   'wash_fold', 5, 'Regular clothes, machine wash and fold. 5 kg minimum.', 0),
  ('11111111-1111-4111-8111-111111111111', 'Wash, Dry & Iron', 'per_kg', 55.00,
   'wash_fold', 5, 'Wash and fold plus pressing. 5 kg minimum.', 1),
  ('11111111-1111-4111-8111-111111111111', 'Ironing only', 'per_item', 20.00,
   'ironing', 0, 'Pressing per garment.', 2),
  ('11111111-1111-4111-8111-111111111111', 'Dry cleaning — Barong / Suit', 'per_item', 280.00,
   'dry_cleaning', 0, 'Delicate garment dry cleaning.', 3),
  ('11111111-1111-4111-8111-111111111111', 'Comforter / Blanket (single)', 'per_item', 180.00,
   'special_items', 0, 'Single-size comforters, blankets, and bed sheets.', 4),
  ('11111111-1111-4111-8111-111111111111', 'Comforter (queen / king, thick)', 'per_item', 280.00,
   'special_items', 0, 'Thick or oversized comforters and duvets.', 5),
  ('11111111-1111-4111-8111-111111111111', 'Curtains', 'per_kg', 60.00,
   'special_items', 3, 'Curtains and heavy drapery, priced by weight. 3 kg minimum.', 6),
  ('11111111-1111-4111-8111-111111111111', 'Self-service wash (per load)', 'flat', 75.00,
   'self_service', 0, 'Customer-operated washer, one load.', 7)
on conflict do nothing;
