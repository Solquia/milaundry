import { ordersTakenIn } from '../clear-orders';

const frame = {
  start: new Date('2026-10-01T00:00:00Z').getTime(),
  end: new Date('2026-11-01T00:00:00Z').getTime(),
};

describe('ordersTakenIn', () => {
  it('keeps only orders taken inside the period, newest first', () => {
    // Arrange
    const orders = [
      { id: 'a', created_at: '2026-10-02T09:00:00Z' },
      { id: 'before', created_at: '2026-09-30T23:59:59Z' },
      { id: 'b', created_at: '2026-10-20T09:00:00Z' },
      { id: 'after', created_at: '2026-11-01T00:00:00Z' },
    ];

    // Act
    const result = ordersTakenIn(orders, frame);

    // Assert
    expect(result.map((order) => order.id)).toEqual(['b', 'a']);
  });

  it('does not reorder the list it was given', () => {
    const orders = [
      { id: 'a', created_at: '2026-10-02T09:00:00Z' },
      { id: 'b', created_at: '2026-10-20T09:00:00Z' },
    ];

    ordersTakenIn(orders, frame);

    expect(orders.map((order) => order.id)).toEqual(['a', 'b']);
  });

  it('returns nothing for an empty period', () => {
    expect(ordersTakenIn([], frame)).toEqual([]);
  });
});
