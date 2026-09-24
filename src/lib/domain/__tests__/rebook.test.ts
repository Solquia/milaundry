import { NO_PREFERENCES } from '../laundry-preferences';
import {
  canBookAgain,
  hasBookableItem,
  rebookDraft,
  rebookHref,
  reconcileRebook,
  type RebookOrder,
} from '../rebook';

const washFold = { service_id: 's-wash', service_name: 'Wash & Fold', unit: 'per_kg' as const, quantity: 6 };
const comforter = { service_id: 's-comf', service_name: 'Comforter', unit: 'per_item' as const, quantity: 2 };

const order: RebookOrder = {
  id: 'o1',
  shop_id: 'shop-1',
  status: 'completed',
  fulfillment: 'delivery',
  delivery_address: 'Unit 4B, 12 Mabini St, Quezon City',
  notes: 'Detergent: Unscented\nSeparate whites\nRider: Green gate',
  order_items: [comforter, washFold],
};

describe('hasBookableItem / canBookAgain', () => {
  it('offers Book Again on a completed order with a service still named', () => {
    expect(canBookAgain(order)).toBe(true);
  });

  it('does not offer it before the order is done', () => {
    expect(canBookAgain({ ...order, status: 'washing' })).toBe(false);
  });

  it('does not offer it for a cancelled order', () => {
    expect(canBookAgain({ ...order, status: 'cancelled' })).toBe(false);
  });

  it('needs at least one line still tied to a service', () => {
    const orphaned = { ...order, order_items: [{ ...washFold, service_id: null }] };
    expect(hasBookableItem(orphaned)).toBe(false);
    expect(canBookAgain(orphaned)).toBe(false);
  });
});

describe('rebookDraft', () => {
  it('reuses the shop, the per-kilo service as main, the rest as add-ons', () => {
    const draft = rebookDraft(order);
    expect(draft).toMatchObject({
      orderId: 'o1',
      shopId: 'shop-1',
      serviceId: 's-wash',
      weightKg: 6,
      addOns: { 's-comf': 2 },
      fulfillment: 'delivery',
      deliveryAddress: 'Unit 4B, 12 Mabini St, Quezon City',
      riderNotes: 'Green gate',
    });
    expect(draft?.preferences).toEqual({
      ...NO_PREFERENCES,
      detergent: 'unscented',
      separate_whites: true,
    });
  });

  it('falls back to the first service line when nothing is per kilo', () => {
    const draft = rebookDraft({ ...order, order_items: [comforter] });
    expect(draft).toMatchObject({ serviceId: 's-comf', weightKg: 2, addOns: {} });
  });

  it('snaps an over-the-limit weight back to what one booking takes', () => {
    const heavy = { ...order, order_items: [{ ...washFold, quantity: 42 }] };
    expect(rebookDraft(heavy)?.weightKg).toBe(30);
  });

  it('drops the address for a self drop-off', () => {
    const draft = rebookDraft({ ...order, fulfillment: 'pickup', delivery_address: '' });
    expect(draft).toMatchObject({ fulfillment: 'pickup', deliveryAddress: '' });
  });

  it('is null when there is nothing left to rebook', () => {
    expect(rebookDraft({ ...order, order_items: [] })).toBeNull();
  });

  it('remembers what each line was called', () => {
    expect(rebookDraft(order)?.itemNames).toEqual({
      's-wash': 'Wash & Fold',
      's-comf': 'Comforter',
    });
  });
});

describe('rebookHref', () => {
  it('opens the booking screen on the old service, carrying the order', () => {
    expect(rebookHref(order)).toBe('/(customer)/book/s-wash?shopId=shop-1&rebook=o1');
  });

  it('is null for an order with nothing to rebook', () => {
    expect(rebookHref({ ...order, order_items: [] })).toBeNull();
  });
});

describe('reconcileRebook', () => {
  const draft = rebookDraft(order)!;

  it('keeps everything the shop still offers', () => {
    const result = reconcileRebook(draft, ['s-wash', 's-comf']);
    expect(result).toEqual({ draft, droppedNames: [], isMainOffered: true });
  });

  it('drops an add-on the shop no longer offers and names it', () => {
    const result = reconcileRebook(draft, ['s-wash']);
    expect(result.draft.addOns).toEqual({});
    expect(result.droppedNames).toEqual(['Comforter']);
    expect(result.isMainOffered).toBe(true);
  });

  it('reports a main service that is gone', () => {
    expect(reconcileRebook(draft, ['s-comf']).isMainOffered).toBe(false);
  });
});
