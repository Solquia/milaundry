import type { StockLine } from '../addon-inventory';
import type { ShopAddon } from '../shop-addons';
import { stockLeftLabel, supplyFromStock } from '../supply-stock';

function line(overrides: Partial<StockLine> = {}, addon: Partial<ShopAddon> = {}): StockLine {
  return {
    addon: { id: 'a1', name: 'SF Detergent', price: 0, is_active: true, ...addon } as ShopAddon,
    counted: 20,
    left: 12,
    soldSinceCount: 8,
    soldRecent: 8,
    soldTotal: 8,
    revenueRecent: 0,
    unitCost: null,
    profitRecent: null,
    status: 'ok',
    ...overrides,
  };
}

describe('stockLeftLabel', () => {
  it('says how much is on the shelf, or that nobody counted it', () => {
    expect(stockLeftLabel(line())).toBe('12 left');
    expect(stockLeftLabel(line({ left: 1, status: 'low' }))).toBe('1 left');
    expect(stockLeftLabel(line({ left: 0, status: 'out' }))).toBe('Out of stock');
    expect(stockLeftLabel(line({ counted: null, left: null, status: 'untracked' }))).toBe('Not counted');
  });
});

describe('supplyFromStock', () => {
  it('links the supply to the stock item and takes its name', () => {
    expect(supplyFromStock(line())).toEqual({ name: 'SF Detergent', addonId: 'a1', packCost: null });
  });

  it('brings the cost price across when the owner entered one', () => {
    expect(supplyFromStock(line({ unitCost: 42.5 })).packCost).toBe('42.5');
  });
});
