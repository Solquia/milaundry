import { METRIC_LOOKS, formatMetric, paceLine, quantityLabel, visibleRange } from '../sales-display';

describe('how the figures read', () => {
  it('formats each metric in its own unit', () => {
    expect(formatMetric('sales', 4860)).toBe('₱4,860');
    expect(formatMetric('sales', 4860.5)).toBe('₱4,860.50');
    expect(formatMetric('orders', 23)).toBe('23');
    expect(formatMetric('kilos', 142.5)).toBe('142.5 kg');
    expect(formatMetric('basket', 211)).toBe('₱211');
  });

  it('names the clock each metric counts by', () => {
    expect(METRIC_LOOKS.sales.clock).toBe('Paid in this period');
    expect(METRIC_LOOKS.orders.clock).toBe('Taken in this period');
  });

  it('says ahead or behind the pace in plain words', () => {
    expect(paceLine('sales', 620, 'yesterday by 2:15 PM')).toEqual({
      text: '₱620 ahead of yesterday by 2:15 PM',
      tone: 'up',
    });
    expect(paceLine('orders', -3, 'last week at this point')).toEqual({
      text: '3 behind last week at this point',
      tone: 'down',
    });
    expect(paceLine('kilos', 0, 'July')).toEqual({ text: 'Level with July', tone: 'flat' });
  });

  it('counts a service the way the counter does', () => {
    expect(quantityLabel(62, 'per_kg')).toBe('62 kg');
    expect(quantityLabel(1, 'per_item')).toBe('1 pc');
    expect(quantityLabel(9, 'per_item')).toBe('9 pcs');
    expect(quantityLabel(4, 'flat')).toBe('4 loads');
  });
});

describe('trimming the day to shop hours', () => {
  const zeros = Array.from({ length: 24 }, () => 0);

  it('shows 7 AM to 9 PM on a quiet day', () => {
    expect(visibleRange('hour', zeros, zeros)).toEqual({ from: 7, to: 22 });
  });

  it('widens to take in an early or late sale', () => {
    const early = zeros.map((value, hour) => (hour === 5 ? 100 : value));
    const late = zeros.map((value, hour) => (hour === 23 ? 100 : value));
    expect(visibleRange('hour', early, zeros)).toEqual({ from: 5, to: 22 });
    expect(visibleRange('hour', zeros, late)).toEqual({ from: 7, to: 24 });
  });

  it('keeps every bucket of a week, month or year', () => {
    expect(visibleRange('day', [1, 2, 3], [0, 0, 0])).toEqual({ from: 0, to: 3 });
  });
});
