import {
  ORDER_STATUSES,
  TERMINAL_STATUSES,
  canTransition,
  nextStatuses,
  OrderStatus,
} from '../order-status';

describe('order status machine', () => {
  it('defines the expected lifecycle statuses', () => {
    expect(ORDER_STATUSES).toEqual([
      'pending',
      'received',
      'in_progress',
      'ready',
      'completed',
      'cancelled',
    ]);
  });

  it('allows the happy-path progression', () => {
    expect(canTransition('pending', 'received')).toBe(true);
    expect(canTransition('received', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'ready')).toBe(true);
    expect(canTransition('ready', 'completed')).toBe(true);
  });

  it('allows cancellation from any non-terminal status', () => {
    (['pending', 'received', 'in_progress', 'ready'] as OrderStatus[]).forEach(
      (s) => expect(canTransition(s, 'cancelled')).toBe(true)
    );
  });

  it('rejects skipping stages forward', () => {
    expect(canTransition('pending', 'ready')).toBe(false);
    expect(canTransition('received', 'completed')).toBe(false);
  });

  it('rejects moving backwards', () => {
    expect(canTransition('ready', 'in_progress')).toBe(false);
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
    expect(nextStatuses('ready').sort()).toEqual(['cancelled', 'completed']);
    expect(nextStatuses('completed')).toEqual([]);
  });
});
