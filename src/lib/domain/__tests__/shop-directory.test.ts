import { splitShopsByRegistration } from '../shop-directory';

const sparkle = { id: 'shop-1', name: 'Sparkle Wash Laundry', is_active: true };
const bubbles = { id: 'shop-2', name: 'Bubbles Laundromat', is_active: true };
const closed = { id: 'shop-3', name: 'Closed Cleaners', is_active: false };

describe('splitShopsByRegistration', () => {
  it('lists shops the customer already joined under mine', () => {
    const result = splitShopsByRegistration([sparkle, bubbles], ['shop-1']);
    expect(result.mine).toEqual([sparkle]);
  });

  it('offers the remaining active shops for discovery', () => {
    const result = splitShopsByRegistration([sparkle, bubbles], ['shop-1']);
    expect(result.discoverable).toEqual([bubbles]);
  });

  it('hides deactivated shops from discovery', () => {
    const result = splitShopsByRegistration([sparkle, closed], []);
    expect(result.discoverable).toEqual([sparkle]);
  });

  it('keeps a joined shop visible even after it is deactivated', () => {
    const result = splitShopsByRegistration([closed], ['shop-3']);
    expect(result.mine).toEqual([closed]);
    expect(result.discoverable).toEqual([]);
  });

  it('treats an empty registration list as nothing joined yet', () => {
    const result = splitShopsByRegistration([sparkle, bubbles], []);
    expect(result.mine).toEqual([]);
    expect(result.discoverable).toEqual([sparkle, bubbles]);
  });

  it('preserves the incoming order in both buckets', () => {
    const result = splitShopsByRegistration([bubbles, sparkle], []);
    expect(result.discoverable.map((shop) => shop.id)).toEqual(['shop-2', 'shop-1']);
  });
});
