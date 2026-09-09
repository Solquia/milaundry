import { intakeLines, intakeSummary, openingQuantity } from '../service-intake';
import type { Service } from '../pricing';

const washFold: Service = {
  id: 'wf',
  name: 'Wash, Dry & Fold',
  unit: 'per_kg',
  price: 35,
  min_quantity: 5,
};
const washIron: Service = {
  id: 'wi',
  name: 'Wash, Dry & Iron',
  unit: 'per_kg',
  price: 55,
  min_quantity: 5,
};
const ironing: Service = { id: 'ir', name: 'Ironing only', unit: 'per_item', price: 20 };
const selfWash: Service = {
  id: 'sw',
  name: 'Self-service wash',
  unit: 'flat',
  price: 75,
  min_quantity: 3,
};
const curtains: Service = { id: 'cu', name: 'Curtains', unit: 'per_kg', price: 60 };

describe('openingQuantity', () => {
  it('opens a per-kg service at the shop’s own minimum', () => {
    // Starting at 0.5 kg on a 5 kg minimum shows a quantity nobody will be
    // billed; the first honest number is the minimum itself.
    expect(openingQuantity(washFold)).toBe(5);
  });

  it('opens a per-kg service with no minimum at one kilo', () => {
    expect(openingQuantity(curtains)).toBe(1);
  });

  it('opens counted and flat services at one', () => {
    expect(openingQuantity(ironing)).toBe(1);
    expect(openingQuantity(selfWash)).toBe(1);
  });

  it('ignores a nonsense minimum rather than opening at it', () => {
    expect(openingQuantity({ ...washFold, min_quantity: -4 })).toBe(1);
    expect(openingQuantity({ ...washFold, min_quantity: Number.NaN })).toBe(1);
  });
});

describe('intakeSummary', () => {
  it('quotes the spread of a category nothing has been taken from yet', () => {
    expect(intakeSummary([washFold, washIron], {})).toBe('2 services · ₱35–₱55');
  });

  it('collapses the spread to one figure when the ends meet', () => {
    expect(intakeSummary([ironing, { ...ironing, id: 'ir2' }], {})).toBe('2 services · ₱20');
  });

  it('keeps the count when no price is usable', () => {
    // A category of ₱0 services is a price list to go and fix, not a section
    // to go quiet about.
    expect(intakeSummary([{ ...ironing, price: 0 }], {})).toBe('1 service');
  });

  it('reports what was taken once the counter staff choose something', () => {
    // A closed door still has to answer "what did I put in there".
    expect(intakeSummary([washFold, washIron], { wf: 5 })).toBe('1 chosen · ₱175.00');
  });

  it('adds up every chosen service in the category', () => {
    expect(intakeSummary([washFold, washIron], { wf: 5, wi: 2 })).toBe('2 chosen · ₱450.00');
  });

  it('bills a below-minimum quantity at the minimum, as the order will', () => {
    // 2 kg on a 5 kg minimum is billed as 5 kg. The summary quotes the charge,
    // never a recomputed guess.
    expect(intakeSummary([washFold], { wf: 2 })).toBe('1 chosen · ₱175.00');
  });

  it('ignores quantities belonging to other categories', () => {
    expect(intakeSummary([washFold], { ir: 3 })).toBe('1 service · ₱35');
  });

  it('treats a zeroed service as unchosen', () => {
    expect(intakeSummary([washFold, washIron], { wf: 0 })).toBe('2 services · ₱35–₱55');
  });

  it('says nothing about an empty category', () => {
    expect(intakeSummary([], {})).toBe('');
  });
});

describe('intakeLines', () => {
  it('lists what is on the counter in catalog order', () => {
    const lines = intakeLines([washFold, ironing, washIron], { wi: 3, ir: 2 });

    expect(lines).toEqual([
      { serviceId: 'ir', name: 'Ironing only', quantity: '2 pieces', subtotal: 40 },
      { serviceId: 'wi', name: 'Wash, Dry & Iron', quantity: '5 kg', subtotal: 275 },
    ]);
  });

  it('states the billed quantity, not the typed one, when a minimum applies', () => {
    // The row must reconcile with its own figure: "3 kg — ₱175" reads as a
    // pricing bug at the counter.
    expect(intakeLines([washFold], { wf: 3 })).toEqual([
      { serviceId: 'wf', name: 'Wash, Dry & Fold', quantity: '5 kg', subtotal: 175 },
    ]);
  });

  it('charges a flat service once however many times it is added', () => {
    // "4 pieces" against a ₱75 flat charge reads as arithmetic that failed.
    // A flat price is billed once, and the row says so in words.
    expect(intakeLines([selfWash], { sw: 4 })).toEqual([
      { serviceId: 'sw', name: 'Self-service wash', quantity: 'once', subtotal: 75 },
    ]);
  });

  it('is empty before anything is chosen', () => {
    expect(intakeLines([washFold], {})).toEqual([]);
    expect(intakeLines([washFold], { wf: 0 })).toEqual([]);
  });
});
