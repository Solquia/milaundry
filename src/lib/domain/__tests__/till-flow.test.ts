import {
  TILL_STEPS,
  savedSlipNote,
  savedSlipTitle,
  savedScanNote,
  tillCta,
  tillEstimateLabel,
  tillStepTitle,
} from '../till-flow';

describe('TILL_STEPS', () => {
  test('names the two questions a counter asks, in order', () => {
    expect(TILL_STEPS.map((step) => step.key)).toEqual(['items', 'checkout']);
    expect(TILL_STEPS.map((step) => step.label)).toEqual(['Items', 'Checkout']);
  });
});

describe('tillStepTitle', () => {
  test('asks what came in on the menu step', () => {
    expect(tillStepTitle('items')).toBe('What came in?');
  });

  test('asks who it is for on the checkout step', () => {
    expect(tillStepTitle('checkout')).toBe('Who is it for?');
  });
});

describe('tillEstimateLabel', () => {
  test('says nothing is on the ticket rather than quoting an estimate of zero', () => {
    expect(tillEstimateLabel(0)).toBe('No items yet');
  });

  test('counts one item in the singular', () => {
    expect(tillEstimateLabel(1)).toBe('1 item · estimate');
  });

  test('counts several items and names the figure beside it', () => {
    expect(tillEstimateLabel(3)).toBe('3 items · estimate');
  });
});

describe('tillCta', () => {
  test('moves to the next question from the menu', () => {
    expect(tillCta('items', false)).toBe('Continue');
  });

  test('saves from checkout, and says so while it is saving', () => {
    expect(tillCta('checkout', false)).toBe('Save order');
    expect(tillCta('checkout', true)).toBe('Saving…');
  });

  test('never offers Continue as busy: only the saving step can be pending', () => {
    expect(tillCta('items', true)).toBe('Continue');
  });
});

describe('the slip a saved walk-in prints to the screen', () => {
  test('says the order is saved, not thanks: the counter saved it, the customer is standing there', () => {
    expect(savedSlipTitle()).toBe('Order saved');
  });

  test('says what happens to the laundry next, which fulfillment decides', () => {
    expect(savedSlipNote('delivery')).toBe('It goes back out to them when it is done.');
    expect(savedSlipNote('pickup')).toBe('They collect it here once it is ready.');
  });

  test('tells the counter what the code on screen is for', () => {
    expect(savedScanNote()).toBe('They scan this to follow the order');
  });
});
