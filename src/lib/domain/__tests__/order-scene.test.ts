import { ORDER_STATUSES } from '../order-status';
import { ORDER_SCENES, orderScene, placedNote, placedScene, placedTitle } from '../order-scene';

describe('orderScene', () => {
  it('puts the laundry in a machine while it is being washed or dried', () => {
    expect(orderScene('washing', 'pickup')).toBe('machine');
    expect(orderScene('drying', 'delivery')).toBe('machine');
  });

  it('shows a basket before the shop has started on it', () => {
    expect(orderScene('pending', 'pickup')).toBe('basket');
    expect(orderScene('received', 'delivery')).toBe('basket');
  });

  it('sends a rider only when the laundry is actually going somewhere', () => {
    expect(orderScene('ready', 'delivery')).toBe('scooter');
    expect(orderScene('ready', 'pickup')).toBe('stack');
  });

  it('rests on folded laundry once the job is finished either way', () => {
    expect(orderScene('completed', 'pickup')).toBe('stack');
    expect(orderScene('completed', 'delivery')).toBe('stack');
  });

  it('draws something for every status an order can hold', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_SCENES).toContain(orderScene(status, 'pickup'));
      expect(ORDER_SCENES).toContain(orderScene(status, 'delivery'));
    }
  });
});

describe('placedScene', () => {
  it('sends a rider on the slip for an order the shop is collecting', () => {
    expect(placedScene('delivery')).toBe('scooter');
  });

  it('shows the basket to a customer who is bringing it in themselves', () => {
    expect(placedScene('pickup')).toBe('basket');
  });

  it('does not just repeat where the laundry is right now', () => {
    // A freshly booked order is 'pending', which `orderScene` draws as a
    // basket for both. The slip has to separate them.
    expect(placedScene('delivery')).not.toBe(orderScene('pending', 'delivery'));
  });
});

describe('placedTitle', () => {
  it('thanks the customer rather than reporting a database write', () => {
    expect(placedTitle()).toBe('Thank you!');
  });
});

describe('placedNote', () => {
  it('says the shop is coming when the shop is coming', () => {
    expect(placedNote('delivery')).toMatch(/collect/i);
  });

  it('says where to bring it when the customer brings it', () => {
    expect(placedNote('pickup')).toMatch(/drop/i);
  });
});
