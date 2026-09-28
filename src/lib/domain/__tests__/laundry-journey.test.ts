import { elapsedLabel, laundryJourney } from '../laundry-journey';

const BOOKED = '2026-09-22T11:10:00.000Z';

function order(status: Parameters<typeof laundryJourney>[0]['status'], fulfillment: 'pickup' | 'delivery' = 'pickup') {
  return { status, fulfillment, created_at: BOOKED };
}

describe('laundryJourney', () => {
  it('walks seven stops and lights the one the laundry is at', () => {
    const journey = laundryJourney(order('drying'), []);
    expect(journey.stops.map((stop) => stop.state)).toEqual([
      'done',
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
    expect(journey.currentIndex).toBe(3);
    expect(journey.current?.label).toBe('Drying');
  });

  it('stamps each stop with the last time the shop moved the order there', () => {
    const journey = laundryJourney(order('washing'), [
      { to_status: 'received', created_at: '2026-09-22T11:20:00.000Z' },
      { to_status: 'washing', created_at: '2026-09-22T11:45:00.000Z' },
    ]);
    const reached = journey.stops.map((stop) => stop.reachedAt);
    expect(reached.slice(0, 4)).toEqual([
      BOOKED,
      '2026-09-22T11:20:00.000Z',
      '2026-09-22T11:45:00.000Z',
      null,
    ]);
    expect(journey.since).toBe('2026-09-22T11:45:00.000Z');
  });

  it('names what comes next, and nothing once the laundry is back', () => {
    expect(laundryJourney(order('washing'), []).nextUp).toBe('Drying');
    expect(laundryJourney(order('ready', 'delivery'), []).nextUp).toBe('Delivered');
    expect(laundryJourney(order('completed'), []).nextUp).toBeNull();
  });

  it('speaks the last legs in terms of how the laundry comes back', () => {
    const pickup = laundryJourney(order('ready'), []);
    expect(pickup.current?.label).toBe('Ready for pickup');
    expect(pickup.current?.icon).toBe('bag-check-outline');
    const delivery = laundryJourney(order('ready', 'delivery'), []);
    expect(delivery.current?.label).toBe('Out for delivery');
    expect(delivery.current?.icon).toBe('bicycle-outline');
  });

  it('has nothing current once finished, and every stop done', () => {
    const journey = laundryJourney(order('completed'), []);
    expect(journey.current).toBeNull();
    expect(journey.stops.every((stop) => stop.state === 'done')).toBe(true);
    expect(journey.isFinished).toBe(true);
  });

  it('gives a cancelled order no road, but still says when it stopped', () => {
    const journey = laundryJourney(order('cancelled'), [
      { to_status: 'cancelled', created_at: '2026-09-22T12:00:00.000Z' },
    ]);
    expect(journey.stops).toEqual([]);
    expect(journey.isCancelled).toBe(true);
    expect(journey.since).toBe('2026-09-22T12:00:00.000Z');
    expect(journey.headline).toBe('This order was cancelled');
  });

  it('counts the wash cycle for the customer, not the seven stops', () => {
    expect(laundryJourney(order('pending'), []).standing).toBe('Not started yet');
    expect(laundryJourney(order('folded'), []).standing).toBe('Step 4 of 5');
  });

  it('explains every stop in words', () => {
    const journey = laundryJourney(order('received', 'delivery'), []);
    for (const stop of journey.stops) expect(stop.blurb.length).toBeGreaterThan(10);
  });
});

describe('elapsedLabel', () => {
  const at = (iso: string) => new Date(iso).getTime();

  it('says just now for under a minute', () => {
    expect(elapsedLabel(BOOKED, at('2026-09-22T11:10:40.000Z'))).toBe('just now');
  });

  it('counts minutes, then hours and minutes, then days', () => {
    expect(elapsedLabel(BOOKED, at('2026-09-22T11:35:00.000Z'))).toBe('25 min');
    expect(elapsedLabel(BOOKED, at('2026-09-22T13:15:00.000Z'))).toBe('2 h 5 min');
    expect(elapsedLabel(BOOKED, at('2026-09-22T13:10:00.000Z'))).toBe('2 h');
    expect(elapsedLabel(BOOKED, at('2026-09-24T12:00:00.000Z'))).toBe('2 days');
    expect(elapsedLabel(BOOKED, at('2026-09-23T12:00:00.000Z'))).toBe('1 day');
  });

  it('says nothing for a missing or unreadable time, or one in the future', () => {
    expect(elapsedLabel(null, at(BOOKED))).toBe('');
    expect(elapsedLabel('garbage', at(BOOKED))).toBe('');
    expect(elapsedLabel('2026-09-23T00:00:00.000Z', at(BOOKED))).toBe('');
  });
});
