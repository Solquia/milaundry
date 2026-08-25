import {
  ORDER_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  nextStatuses,
  OrderStatus,
} from '../order-status';

describe('order status machine (laundry stages)', () => {
  it('defines the laundry lifecycle statuses in processing order', () => {
    expect(ORDER_STATUSES).toEqual([
      'pending',
      'received',
      'washing',
      'drying',
      'folded',
      'ready',
      'completed',
      'cancelled',
    ]);
  });

  it('allows the happy-path progression through every stage', () => {
    expect(canTransition('pending', 'received')).toBe(true);
    expect(canTransition('received', 'washing')).toBe(true);
    expect(canTransition('washing', 'drying')).toBe(true);
    expect(canTransition('drying', 'folded')).toBe(true);
    expect(canTransition('folded', 'ready')).toBe(true);
    expect(canTransition('ready', 'completed')).toBe(true);
  });

  it('allows cancellation from any non-terminal status', () => {
    (
      ['pending', 'received', 'washing', 'drying', 'folded', 'ready'] as OrderStatus[]
    ).forEach((s) => expect(canTransition(s, 'cancelled')).toBe(true));
  });

  it('rejects skipping stages forward', () => {
    expect(canTransition('pending', 'washing')).toBe(false);
    expect(canTransition('received', 'drying')).toBe(false);
    expect(canTransition('washing', 'folded')).toBe(false);
    expect(canTransition('drying', 'ready')).toBe(false);
    expect(canTransition('folded', 'completed')).toBe(false);
  });

  it('rejects moving backwards', () => {
    expect(canTransition('drying', 'washing')).toBe(false);
    expect(canTransition('ready', 'folded')).toBe(false);
    expect(canTransition('received', 'pending')).toBe(false);
  });

  it('freezes terminal statuses', () => {
    expect(TERMINAL_STATUSES).toEqual(['completed', 'cancelled']);
    ORDER_STATUSES.forEach((to) => {
      expect(canTransition('completed', to)).toBe(false);
      expect(canTransition('cancelled', to)).toBe(false);
    });
  });

  it('rejects self-transitions', () => {
    ORDER_STATUSES.forEach((s) => expect(canTransition(s, s)).toBe(false));
  });

  it('lists valid next statuses', () => {
    expect(nextStatuses('pending').sort()).toEqual(['cancelled', 'received']);
    expect(nextStatuses('received').sort()).toEqual(['cancelled', 'washing']);
    expect(nextStatuses('folded').sort()).toEqual(['cancelled', 'ready']);
    expect(nextStatuses('ready').sort()).toEqual(['cancelled', 'completed']);
    expect(nextStatuses('completed')).toEqual([]);
  });
});
