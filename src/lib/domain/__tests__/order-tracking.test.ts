import { trackingHeadline, trackingSteps } from '../order-tracking';

describe('trackingSteps', () => {
  it('marks everything before the current status as done', () => {
    const steps = trackingSteps('drying', 'delivery');
    expect(steps.map((step) => step.state)).toEqual([
      'done',
      'done',
      'done',
      'done',
      'current',
      'upcoming',
      'upcoming',
      'upcoming',
    ]);
  });

  it('starts at booked', () => {
    const steps = trackingSteps('pending', 'pickup');
    expect(steps[0]).toEqual({ status: 'pending', label: 'Booked', state: 'current' });
  });

  it('sorts the laundry between the shop taking it and the wash', () => {
    const steps = trackingSteps('sorting', 'pickup');
    expect(steps.slice(1, 4).map((step) => step.status)).toEqual(['received', 'sorting', 'washing']);
    expect(steps[2]).toEqual({ status: 'sorting', label: 'Sorting', state: 'current' });
  });

  it('names the last legs by how the laundry comes back', () => {
    const delivery = trackingSteps('ready', 'delivery').map((step) => step.label);
    expect(delivery.slice(-2)).toEqual(['Out for delivery', 'Delivered']);
    const pickup = trackingSteps('ready', 'pickup').map((step) => step.label);
    expect(pickup.slice(-2)).toEqual(['Ready for pickup', 'Picked up']);
  });

  it('is empty for a cancelled order, which has no path forward', () => {
    expect(trackingSteps('cancelled', 'pickup')).toEqual([]);
  });

  it('finishes with every step done', () => {
    expect(trackingSteps('completed', 'pickup').every((step) => step.state === 'done')).toBe(true);
  });
});

describe('trackingHeadline', () => {
  it('speaks to the customer at each stage', () => {
    expect(trackingHeadline('pending', 'delivery')).toBe('Your booking is in');
    expect(trackingHeadline('received', 'delivery')).toBe('Your laundry is at the shop');
    expect(trackingHeadline('sorting', 'pickup')).toBe('Your laundry is being sorted');
    expect(trackingHeadline('washing', 'pickup')).toBe('Your laundry is being washed');
    expect(trackingHeadline('ready', 'delivery')).toBe('Your laundry is on its way');
    expect(trackingHeadline('ready', 'pickup')).toBe('Your laundry is ready for pickup');
    expect(trackingHeadline('completed', 'pickup')).toBe('All done');
    expect(trackingHeadline('cancelled', 'pickup')).toBe('This order was cancelled');
  });
});
