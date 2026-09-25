import { PORTHOLE_IDLE, PORTHOLE_FULL, portholeLevel } from '../porthole';

describe('portholeLevel', () => {
  it('sits at the idle line when nothing is on the ticket', () => {
    expect(portholeLevel('per_kg', 0)).toBe(PORTHOLE_IDLE);
    expect(portholeLevel('per_item', undefined)).toBe(PORTHOLE_IDLE);
    expect(portholeLevel('flat', Number.NaN)).toBe(PORTHOLE_IDLE);
  });

  it('rises with the weight of a load', () => {
    const three = portholeLevel('per_kg', 3);
    const eight = portholeLevel('per_kg', 8);
    expect(three).toBeGreaterThan(PORTHOLE_IDLE);
    expect(eight).toBeGreaterThan(three);
  });

  it('rises with each piece added', () => {
    expect(portholeLevel('per_item', 2)).toBeGreaterThan(portholeLevel('per_item', 1));
  });

  it('never fills past the door, however big the load', () => {
    expect(portholeLevel('per_kg', 400)).toBe(PORTHOLE_FULL);
    expect(portholeLevel('per_item', 90)).toBe(PORTHOLE_FULL);
  });

  it('fills a flat service once, to the same line every time', () => {
    expect(portholeLevel('flat', 1)).toBe(portholeLevel('flat', 3));
    expect(portholeLevel('flat', 1)).toBeGreaterThan(PORTHOLE_IDLE);
  });
});
