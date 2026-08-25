import { estimateLineTotal, estimateOrderTotal, Service } from '../pricing';

const perKgWithMin: Service = {
  id: 'wash',
  name: 'Wash, Dry & Fold',
  unit: 'per_kg',
  price: 35,
  min_quantity: 5,
};

const perItem: Service = {
  id: 'iron',
  name: 'Ironing',
  unit: 'per_item',
  price: 20,
};

describe('minimum-weight pricing', () => {
  it('charges the minimum quantity when below the minimum', () => {
    // 3 kg brought in, but 5 kg minimum applies → 5 × 35
    expect(estimateLineTotal(perKgWithMin, 3)).toBe(175);
  });

  it('charges the exact quantity at the minimum boundary', () => {
    expect(estimateLineTotal(perKgWithMin, 5)).toBe(175);
  });

  it('charges the real quantity above the minimum', () => {
    expect(estimateLineTotal(perKgWithMin, 8)).toBe(280);
  });

  it('applies no minimum when min_quantity is absent', () => {
    expect(estimateLineTotal(perItem, 1)).toBe(20);
  });

  it('ignores min_quantity on flat services', () => {
    const flat: Service = {
      id: 'self',
      name: 'Self-service load',
      unit: 'flat',
      price: 75,
      min_quantity: 5,
    };
    expect(estimateLineTotal(flat, 1)).toBe(75);
  });

  it('applies minimums inside order estimates', () => {
    const estimate = estimateOrderTotal(
      [perKgWithMin, perItem],
      [
        { serviceId: 'wash', quantity: 2 },
        { serviceId: 'iron', quantity: 3 },
      ]
    );
    expect(estimate.total).toBe(175 + 60);
  });

  it('still rejects zero or negative quantities', () => {
    expect(() => estimateLineTotal(perKgWithMin, 0)).toThrow();
    expect(() => estimateLineTotal(perKgWithMin, -2)).toThrow();
  });
});
