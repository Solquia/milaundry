import {
  DELIVERY_TURNAROUND_HOURS,
  defaultSchedule,
  validateBookingSchedule,
} from '../booking-schedule';

const now = new Date('2026-08-26T10:00:00+08:00');

describe('defaultSchedule', () => {
  it('proposes a pickup at the top of the next hour', () => {
    const schedule = defaultSchedule(now);
    expect(schedule.pickupAt.getMinutes()).toBe(0);
    expect(schedule.pickupAt.getTime()).toBeGreaterThan(now.getTime());
    expect(schedule.pickupAt.getTime() - now.getTime()).toBeLessThanOrEqual(
      60 * 60 * 1000
    );
  });

  it('proposes delivery one turnaround after pickup', () => {
    const schedule = defaultSchedule(now);
    expect(schedule.deliverBy.getTime() - schedule.pickupAt.getTime()).toBe(
      DELIVERY_TURNAROUND_HOURS * 60 * 60 * 1000
    );
  });
});

describe('validateBookingSchedule', () => {
  const valid = {
    fulfillment: 'delivery' as const,
    deliveryAddress: '12 Mabini St, Quezon City',
    pickupAt: new Date('2026-08-26T14:00:00+08:00'),
    deliverBy: new Date('2026-08-27T14:00:00+08:00'),
  };

  it('accepts a complete delivery schedule', () => {
    const result = validateBookingSchedule(valid, now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deliveryAddress).toBe('12 Mabini St, Quezon City');
    }
  });

  it('requires an address for delivery', () => {
    const result = validateBookingSchedule({ ...valid, deliveryAddress: '  ' }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.deliveryAddress).toBeTruthy();
  });

  it('rejects a pickup time in the past', () => {
    const result = validateBookingSchedule(
      { ...valid, pickupAt: new Date('2026-08-26T09:00:00+08:00') },
      now
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.pickupAt).toBeTruthy();
  });

  it('rejects delivery scheduled before pickup', () => {
    const result = validateBookingSchedule(
      { ...valid, deliverBy: new Date('2026-08-26T13:00:00+08:00') },
      now
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.deliverBy).toBeTruthy();
  });

  it('lets self drop-off skip address and times', () => {
    const result = validateBookingSchedule(
      {
        fulfillment: 'pickup',
        deliveryAddress: '',
        pickupAt: null,
        deliverBy: null,
      },
      now
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deliveryAddress).toBe('');
      expect(result.value.pickupAt).toBeNull();
      expect(result.value.deliverBy).toBeNull();
    }
  });
});
