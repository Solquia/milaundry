import { pickedServiceId, storefrontServiceRows } from '../storefront-booking';

describe('storefrontServiceRows', () => {
  it('turns public price-list rows into bookable service rows for the shop', () => {
    const rows = storefrontServiceRows('shop-1', [
      {
        id: 'svc-1',
        name: 'Wash & fold',
        unit: 'per_kg',
        price: 35,
        category: 'wash_fold',
        min_quantity: 3,
        description: '',
        sort_order: 0,
      },
    ]);

    expect(rows).toEqual([
      {
        id: 'svc-1',
        shop_id: 'shop-1',
        name: 'Wash & fold',
        unit: 'per_kg',
        price: 35,
        category: 'wash_fold',
        min_quantity: 3,
        description: '',
        sort_order: 0,
        is_active: true,
        created_at: '',
      },
    ]);
  });

  it('returns an empty list when the shop has posted no prices', () => {
    expect(storefrontServiceRows('shop-1', [])).toEqual([]);
  });
});

describe('pickedServiceId', () => {
  it('reads a single service from the link', () => {
    expect(pickedServiceId('svc-1')).toBe('svc-1');
  });

  it('takes the first when the link repeats the parameter', () => {
    expect(pickedServiceId(['svc-1', 'svc-2'])).toBe('svc-1');
  });

  it('answers null when no service was picked', () => {
    expect(pickedServiceId(undefined)).toBeNull();
    expect(pickedServiceId('')).toBeNull();
    expect(pickedServiceId([])).toBeNull();
  });
});
