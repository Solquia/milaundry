import {
  chargeLabel,
  paymentMethodIcon,
  quickWeights,
  scaleSheetCta,
  tapTile,
  ticketCount,
  ticketCountLabel,
  tileBadge,
  untapTile,
} from '../pos-ticket';
import type { Service } from '../pricing';

const washFold: Service = {
  id: 'wf',
  name: 'Wash, Dry & Fold',
  unit: 'per_kg',
  price: 35,
  min_quantity: 5,
};
const curtains: Service = { id: 'cu', name: 'Curtains', unit: 'per_kg', price: 60 };
const ironing: Service = { id: 'ir', name: 'Ironing only', unit: 'per_item', price: 20 };
const selfWash: Service = { id: 'sw', name: 'Self-service wash', unit: 'flat', price: 75 };

describe('tapTile', () => {
  it('sends a per-kg service to the scale instead of guessing a weight', () => {
    expect(tapTile(washFold, 0)).toEqual({ kind: 'weigh' });
    expect(tapTile(washFold, 5)).toEqual({ kind: 'weigh' });
  });

  it('adds one more piece on every tap of a per-piece tile', () => {
    expect(tapTile(ironing, 0)).toEqual({ kind: 'set', quantity: 1 });
    expect(tapTile(ironing, 4)).toEqual({ kind: 'set', quantity: 5 });
  });

  it('stops counting pieces at the walk-in ceiling', () => {
    expect(tapTile(ironing, 99)).toEqual({ kind: 'set', quantity: 99 });
  });

  it('adds a flat service once and leaves it there on a second tap', () => {
    expect(tapTile(selfWash, 0)).toEqual({ kind: 'set', quantity: 1 });
    expect(tapTile(selfWash, 1)).toEqual({ kind: 'set', quantity: 1 });
  });
});

describe('tileBadge', () => {
  it('is silent on a tile that is not in the order', () => {
    expect(tileBadge(ironing, 0)).toBeNull();
    expect(tileBadge(washFold, undefined)).toBeNull();
  });

  it('counts pieces with a multiplier and weights in kilos', () => {
    expect(tileBadge(ironing, 3)).toBe('×3');
    expect(tileBadge(washFold, 5)).toBe('5 kg');
    expect(tileBadge(washFold, 6.5)).toBe('6.5 kg');
  });

  it('marks a flat service as added rather than counted', () => {
    expect(tileBadge(selfWash, 1)).toBe('Added');
  });
});

describe('quickWeights', () => {
  it('leads with the shop minimum and drops chips below it', () => {
    expect(quickWeights(washFold, 100)).toEqual([5, 8, 12]);
  });

  it('offers the standard loads when there is no minimum', () => {
    expect(quickWeights(curtains, 100)).toEqual([3, 5, 8, 12]);
  });

  it('never offers a chip past the scale', () => {
    expect(quickWeights(curtains, 6)).toEqual([3, 5]);
  });

  it('does not repeat a minimum that is already a standard load', () => {
    expect(quickWeights({ ...curtains, min_quantity: 3 }, 100)).toEqual([3, 5, 8, 12]);
  });
});

describe('scaleSheetCta', () => {
  it('names the weight and the charge it will add', () => {
    expect(scaleSheetCta(washFold, 6, false)).toBe('Add 6 kg · ₱210.00');
  });

  it('quotes the minimum charge when the load is under it', () => {
    expect(scaleSheetCta(washFold, 3, false)).toBe('Add 3 kg · ₱175.00');
  });

  it('says update when the line is already on the ticket', () => {
    expect(scaleSheetCta(washFold, 7, true)).toBe('Update to 7 kg · ₱245.00');
  });

  it('refuses a zero weight in words, not with a dead button', () => {
    expect(scaleSheetCta(washFold, 0, false)).toBe('Set a weight first');
  });
});

describe('ticketCount', () => {
  it('counts the lines with something on them', () => {
    expect(ticketCount({ wf: 5, ir: 0, sw: 1 })).toBe(2);
    expect(ticketCount({})).toBe(0);
  });

  it('ignores garbage quantities', () => {
    expect(ticketCount({ wf: Number.NaN, ir: -1 })).toBe(0);
  });
});

describe('ticketCountLabel', () => {
  it('speaks in items', () => {
    expect(ticketCountLabel(0)).toBe('No items yet');
    expect(ticketCountLabel(1)).toBe('1 item');
    expect(ticketCountLabel(3)).toBe('3 items');
  });
});

describe('chargeLabel', () => {
  it('puts the total on the button once there is one', () => {
    expect(chargeLabel(2, 175)).toBe('Charge ₱175.00');
  });

  it('tells the counter what to do while the ticket is empty', () => {
    expect(chargeLabel(0, null)).toBe('Tap a service to start');
  });

  it('does not print a figure it cannot stand behind', () => {
    expect(chargeLabel(2, null)).toBe('Charge');
  });
});

describe('paymentMethodIcon', () => {
  it('gives every method a glyph', () => {
    expect(paymentMethodIcon('cash')).toBe('cash-outline');
    expect(paymentMethodIcon('gcash')).toBe('phone-portrait-outline');
    expect(paymentMethodIcon('maya')).toBe('wallet-outline');
    expect(paymentMethodIcon('card')).toBe('card-outline');
    expect(paymentMethodIcon('bank_transfer')).toBe('business-outline');
    expect(paymentMethodIcon('other')).toBe('ellipsis-horizontal-circle-outline');
  });
});

describe('untapTile', () => {
  it('takes one piece back off a counted tile', () => {
    expect(untapTile(ironing, 3)).toBe(2);
  });

  it('takes a flat or weighed line off entirely', () => {
    expect(untapTile(selfWash, 1)).toBe(0);
    expect(untapTile(washFold, 6.5)).toBe(0);
  });

  it('never goes below empty', () => {
    expect(untapTile(ironing, 0)).toBe(0);
    expect(untapTile(ironing, 1)).toBe(0);
  });
});
