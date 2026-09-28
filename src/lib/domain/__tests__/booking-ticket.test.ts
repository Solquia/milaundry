import { addonSummary, firstPage, placeSummary } from '../booking-ticket';
import type { PickedAddon } from '../shop-addons';

const picked = (name: string, quantity: number): PickedAddon =>
  ({ addon: { id: name, name, price: 20, kind: 'detergent' }, quantity }) as PickedAddon;

describe('firstPage', () => {
  test('starts a fresh booking on the laundry', () => {
    expect(firstPage('items')).toBe('laundry');
  });

  test('starts a book-again on delivery, where it only needs confirming', () => {
    expect(firstPage('schedule')).toBe('delivery');
    expect(firstPage('review')).toBe('delivery');
  });
});

describe('addonSummary', () => {
  test('says none when nothing is picked', () => {
    expect(addonSummary([])).toBe('None');
  });

  test('lists up to two names and counts the rest', () => {
    expect(addonSummary([picked('Ariel', 1), picked('Downy', 2), picked('Zonrox', 1)])).toBe(
      'Ariel, Downy ×2 +1 more'
    );
  });
});

describe('placeSummary', () => {
  test('reads drop-off plainly', () => {
    expect(placeSummary('pickup', '')).toBe('Drop off at shop');
  });

  test('asks for an address when delivery has none', () => {
    expect(placeSummary('delivery', '  ')).toBe('Add your address');
  });

  test('shows the address for delivery', () => {
    expect(placeSummary('delivery', '12 Rizal St, Cuyapo')).toBe('12 Rizal St, Cuyapo');
  });
});
