import { estimateLineTotal, estimateOrderTotal, Service } from '../pricing';

const wash: Service = { id: 'svc-wash', name: 'Wash & Fold', unit: 'per_kg', price: 35 };
const comforter: Service = { id: 'svc-comf', name: 'Comforter', unit: 'per_item', price: 180 };
const delivery: Service = { id: 'svc-del', name: 'Delivery', unit: 'flat', price: 50 };

describe('estimateLineTotal', () => {
  it('multiplies price by quantity for per_kg services', () => {
    expect(estimateLineTotal(wash, 7.5)).toBe(262.5);
  });

  it('multiplies price by count for per_item services', () => {
    expect(estimateLineTotal(comforter, 2)).toBe(360);
  });

  it('charges flat services once regardless of quantity', () => {
    expect(estimateLineTotal(delivery, 3)).toBe(50);
  });

  it('rounds to 2 decimal places', () => {
    const svc: Service = { id: 's', name: 'x', unit: 'per_kg', price: 33.33 };
    expect(estimateLineTotal(svc, 3)).toBe(99.99);
    const svc2: Service = { id: 's2', name: 'y', unit: 'per_kg', price: 0.1 };
    expect(estimateLineTotal(svc2, 0.3)).toBe(0.03);
  });

  it('throws for zero or negative quantity', () => {
    expect(() => estimateLineTotal(wash, 0)).toThrow();
    expect(() => estimateLineTotal(wash, -1)).toThrow();
  });

  it('throws for non-finite quantity', () => {
    expect(() => estimateLineTotal(wash, NaN)).toThrow();
    expect(() => estimateLineTotal(wash, Infinity)).toThrow();
  });
});

describe('estimateOrderTotal', () => {
  const catalog = [wash, comforter, delivery];

  it('sums line subtotals into a total', () => {
    const result = estimateOrderTotal(catalog, [
      { serviceId: 'svc-wash', quantity: 5 },
      { serviceId: 'svc-comf', quantity: 1 },
      { serviceId: 'svc-del', quantity: 1 },
    ]);
    expect(result.total).toBe(35 * 5 + 180 + 50);
    expect(result.lines).toEqual([
      { serviceId: 'svc-wash', subtotal: 175 },
      { serviceId: 'svc-comf', subtotal: 180 },
      { serviceId: 'svc-del', subtotal: 50 },
    ]);
  });

  it('returns zero total for an empty item list', () => {
    expect(estimateOrderTotal(catalog, []).total).toBe(0);
  });

  it('throws for an unknown service id', () => {
    expect(() =>
      estimateOrderTotal(catalog, [{ serviceId: 'nope', quantity: 1 }])
    ).toThrow(/unknown service/i);
  });

  it('does not mutate its inputs', () => {
    const items = [{ serviceId: 'svc-wash', quantity: 2 }];
    const itemsCopy = JSON.parse(JSON.stringify(items));
    const catalogCopy = JSON.parse(JSON.stringify(catalog));
    estimateOrderTotal(catalog, items);
    expect(items).toEqual(itemsCopy);
    expect(catalog).toEqual(catalogCopy);
  });
});
