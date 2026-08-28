import { formatKg, weighEvidence } from '../weigh-evidence';

const weighed = {
  final_total: 350,
  actual_weight_kg: 7.5,
  weigh_photo_path: 'abc123/weigh-1.jpg',
};

describe('weighEvidence', () => {
  it('backs the actual price with the photo and what the scale read', () => {
    const evidence = weighEvidence(weighed);

    expect(evidence).not.toBeNull();
    expect(evidence!.photoPath).toBe('abc123/weigh-1.jpg');
    expect(evidence!.caption).toContain('7.5 kg');
  });

  it('shows nothing when the shop took no photo', () => {
    expect(weighEvidence({ ...weighed, weigh_photo_path: null })).toBeNull();
  });

  it('shows nothing while the price is still an estimate', () => {
    // A stray photo with no confirmed price would present evidence for a
    // number the customer has not been given yet.
    expect(weighEvidence({ ...weighed, final_total: null })).toBeNull();
  });

  it('still stands behind the price when the scale reading was not stored', () => {
    const evidence = weighEvidence({ ...weighed, actual_weight_kg: null });

    expect(evidence).not.toBeNull();
    expect(evidence!.caption.length).toBeGreaterThan(0);
    expect(evidence!.caption).not.toContain('null');
  });
});

describe('formatKg', () => {
  it('drops the decimal from a whole-kilo reading', () => {
    expect(formatKg(7)).toBe('7 kg');
  });

  it('keeps the tenths a shop scale actually shows', () => {
    expect(formatKg(7.5)).toBe('7.5 kg');
  });

  it('never prints float drift', () => {
    expect(formatKg(0.1 + 0.2)).toBe('0.3 kg');
  });
});
