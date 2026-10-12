import { BUBBLY_GAV_SHOP_ID, guideMenu, priceGuideFor, weightLabel, type PriceGuide } from '../price-guide';
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

  test('drying services are their own list', () => {
    expect(menu.drying.map((row) => row.name)).toEqual(['Dry only', 'Spin + dry']);
  });
});
