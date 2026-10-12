import {
  BUBBLY_GAV_SHOP_ID,
  dryCleaningHeading,
  guideMenu,
  isFromPrice,
  priceGuideFor,
  weightLabel,
  type PriceGuide,
} from '../price-guide';
import type { ServiceCategory } from '../service-catalog';
import type { PricingUnit } from '../pricing';

function bubblyGav(): PriceGuide {
  const guide = priceGuideFor(BUBBLY_GAV_SHOP_ID);
  if (!guide) throw new Error('Bubbly Gav has no price guide');
  return guide;
}

function service(name: string, category: ServiceCategory, price: number, extra: object = {}) {
  return {
    id: name,
    name,
    category,
    price,
    unit: 'flat' as PricingUnit,
    description: '',
    sort_order: 0,
    weight_prices: [],
    ...extra,
  };
}

const SERVICES = [
  service('Package 2 Wash Dry Fold', 'wash_fold', 210, {
    weight_prices: [
      { up_to_kg: 8, price: 210 },
      { up_to_kg: 10, price: 350 },
    ],
  }),
  service('Package 1 (Maong Pants/Cargo Short/Jackets)', 'wash_fold', 185, { max_quantity: 4 }),
  service('Package 1 Wash Dry Fold', 'wash_fold', 185),
  service('Package 1 Beddings', 'special_items', 185, { max_quantity: 4 }),
  service('Shoe cleaning · Deep', 'special_items', 400, { sort_order: 21 }),
  service('Shoe cleaning · Basic', 'special_items', 250, { sort_order: 20 }),
  service('Helmet cleaning', 'special_items', 200, { sort_order: 24 }),
  service('Long Gown · S', 'dry_cleaning', 400, { sort_order: 100 }),
  service('Long Gown · M', 'dry_cleaning', 500, { sort_order: 101 }),
  service('Wedding Dress · Sweep train', 'dry_cleaning', 700, { sort_order: 130 }),
  service('Leather Jacket · Short', 'dry_cleaning', 200, { sort_order: 150 }),
  service('Dry only', 'other', 90, { sort_order: 40 }),
  service('Spin + dry', 'other', 120, { sort_order: 42 }),
];

describe('priceGuideFor', () => {
  test('returns the custom guide for Bubbly Gav', () => {
    expect(bubblyGav().packages.map((pack) => pack.number)).toEqual([1, 2, 3]);
  });

  test('returns null for every other shop and for no shop at all', () => {
    expect(priceGuideFor('some-other-shop')).toBeNull();
    expect(priceGuideFor(null)).toBeNull();
    expect(priceGuideFor(undefined)).toBeNull();
  });

  test('every package names at least one detergent and one fabcon with a photo', () => {
    for (const pack of bubblyGav().packages) {
      expect(pack.detergents.length).toBeGreaterThan(0);
      expect(pack.fabcons.length).toBeGreaterThan(0);
      for (const product of [...pack.detergents, ...pack.fabcons]) {
        expect(product.photo).toMatch(/^[a-z-]+$/);
      }
    }
  });
});

describe('weightLabel', () => {
  test('reads a band the way the board prints it', () => {
    expect(weightLabel({ from: 0, to: 8 })).toBe('Up to 8 kg');
    expect(weightLabel({ from: 9, to: 9 })).toBe('9 kg');
    expect(weightLabel({ from: 10.5, to: 11 })).toBe('10.5 – 11 kg');
  });
});

describe('guideMenu', () => {
  const menu = guideMenu(SERVICES);

  test('packages are numbered, in order, each with its variants in a fixed order', () => {
    expect(
      menu.packages.map((pack) => [pack.number, pack.variants.map((variant) => [variant.kind, variant.service.name])])
    ).toEqual([
      [
        1,
        [
          ['clothes', 'Package 1 Wash Dry Fold'],
          ['fabrics', 'Package 1 (Maong Pants/Cargo Short/Jackets)'],
          ['beddings', 'Package 1 Beddings'],
        ],
      ],
      [2, [['clothes', 'Package 2 Wash Dry Fold']]],
    ]);
  });

  test("each variant carries its own service's weight table and load size", () => {
    const [two] = menu.packages[1].variants;
    expect(two.weights).toEqual([
      { from: 0, to: 8, price: 210 },
      { from: 8.5, to: 10, price: 350 },
    ]);
    expect(two.perLoadKg).toBe(8);
    const fabrics = menu.packages[0].variants[1];
    expect(fabrics.perLoadKg).toBe(4);
    expect(fabrics.weights).toEqual([]);
  });

  test('other services group their Basic and Deep options under one name', () => {
    expect(
      menu.others.map((group) => [group.name, group.options.map((option) => [option.label, option.service.price])])
    ).toEqual([
      [
        'Shoe cleaning',
        [
          ['Basic', 250],
          ['Deep', 400],
        ],
      ],
      ['Helmet cleaning', [['', 200]]],
    ]);
  });

  test('dry cleaning is grouped under board headings, each item with its sizes', () => {
    expect(
      menu.dryCleaning.map((section) => [
        section.heading,
        section.groups.map((group) => [group.name, group.options.map((option) => option.label)]),
      ])
    ).toEqual([
      ['Gowns', [['Long Gown', ['S', 'M']]]],
      ['Wedding dress', [['Wedding Dress', ['Sweep train']]]],
      ['Leather jackets', [['Leather Jacket', ['Short']]]],
    ]);
  });

  test('a board range reads as a "from" price', () => {
    expect(isFromPrice('₱700 – ₱1,000, depending on size and condition.')).toBe(true);
    expect(isFromPrice('Large is ₱1,000 and up.')).toBe(true);
    expect(isFromPrice('Per piece.')).toBe(false);
  });

  test('dry cleaning headings come from the item name', () => {
    expect(dryCleaningHeading('Winter Hoodie Jacket')).toBe('Jackets');
    expect(dryCleaningHeading('Graduation Toga · Kids')).toBe('Graduation toga');
    expect(dryCleaningHeading('Barong')).toBe('More dry cleaning');
  });

  test('drying services are their own list', () => {
    expect(menu.drying.map((row) => row.name)).toEqual(['Dry only', 'Spin + dry']);
  });
});
