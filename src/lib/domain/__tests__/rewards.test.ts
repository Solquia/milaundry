import {
  appliedReward,
  benefitLabel,
  customerNudge,
  parseStanding,
  programHeadline,
  rewardAmount,
  stampProgress,
  validateRewardDraft,
  type RewardProgram,
  type RewardStanding,
} from '../rewards';

const stamp: RewardProgram = {
  id: 's',
  kind: 'stamp_card',
  visits_needed: 10,
  benefit: 'free',
  benefit_value: 150,
  ready: 0,
};
const welcome: RewardProgram = {
  id: 'w',
  kind: 'welcome',
  visits_needed: 0,
  benefit: 'percent',
  benefit_value: 10,
  ready: 0,
};
const regular: RewardProgram = {
  id: 'r',
  kind: 'regular',
  visits_needed: 20,
  benefit: 'amount',
  benefit_value: 20,
  ready: 0,
};

function standing(visits: number, programs: RewardProgram[]): RewardStanding {
  return { tracked: true, visits, programs };
}

describe('benefitLabel', () => {
  it('names a free wash with and without a cap', () => {
    expect(benefitLabel('free', 150)).toBe('Free wash (up to ₱150)');
    expect(benefitLabel('free', 0)).toBe('Free wash');
  });

  it('names a percentage and a peso amount', () => {
    expect(benefitLabel('percent', 10)).toBe('10% off');
    expect(benefitLabel('amount', 50)).toBe('₱50 off');
    expect(benefitLabel('amount', 50.5)).toBe('₱50.50 off');
  });
});

describe('programHeadline', () => {
  it('says what each program asks and gives', () => {
    expect(programHeadline(stamp)).toBe('Every 10th visit: Free wash (up to ₱150)');
    expect(programHeadline(welcome)).toBe('First visit: 10% off');
    expect(programHeadline(regular)).toBe('After 20 visits: ₱20 off every order');
  });

  it('uses the right ordinal', () => {
    expect(programHeadline({ ...stamp, visits_needed: 2 })).toMatch(/^Every 2nd visit/);
    expect(programHeadline({ ...stamp, visits_needed: 3 })).toMatch(/^Every 3rd visit/);
    expect(programHeadline({ ...stamp, visits_needed: 11 })).toMatch(/^Every 11th visit/);
    expect(programHeadline({ ...stamp, visits_needed: 21 })).toMatch(/^Every 21st visit/);
  });
});

describe('rewardAmount', () => {
  it('matches the database: never more than the bill', () => {
    expect(rewardAmount('free', 150, 320)).toBe(150);
    expect(rewardAmount('free', 150, 90)).toBe(90);
    expect(rewardAmount('free', 0, 320)).toBe(320);
    expect(rewardAmount('percent', 10, 333.33)).toBe(33.33);
    expect(rewardAmount('amount', 500, 120)).toBe(120);
    expect(rewardAmount('amount', 50, 0)).toBe(0);
  });
});

describe('stampProgress', () => {
  it('fills one stamp per finished visit', () => {
    expect(stampProgress(3, 10, 0)).toEqual({ filled: 3, toGo: 7, isReady: false });
  });

  it('shows a full card while a reward waits to be used', () => {
    expect(stampProgress(10, 10, 1)).toEqual({ filled: 10, toGo: 0, isReady: true });
    expect(stampProgress(12, 10, 1)).toEqual({ filled: 10, toGo: 0, isReady: true });
  });

  it('starts a fresh card once the reward is used', () => {
    expect(stampProgress(10, 10, 0)).toEqual({ filled: 0, toGo: 10, isReady: false });
    expect(stampProgress(13, 10, 0)).toEqual({ filled: 3, toGo: 7, isReady: false });
  });
});

describe('customerNudge', () => {
  it('leads with a reward that is ready', () => {
    expect(customerNudge(standing(10, [{ ...stamp, ready: 1 }]))).toBe(
      'Your Free wash (up to ₱150) is ready! Show this at the counter.'
    );
  });

  it('offers the welcome gift to a first-timer', () => {
    expect(customerNudge(standing(0, [stamp, { ...welcome, ready: 1 }]))).toBe(
      'Welcome gift: 10% off your first order.'
    );
  });

  it('counts down to the next stamp reward', () => {
    expect(customerNudge(standing(7, [stamp]))).toBe('3 more visits to a Free wash (up to ₱150).');
    expect(customerNudge(standing(9, [stamp]))).toBe('1 more visit to a Free wash (up to ₱150).');
  });

  it('counts down to regular status when there is no stamp card', () => {
    expect(customerNudge(standing(5, [regular]))).toBe('15 more visits to ₱20 off every order.');
  });

  it('is quiet when nothing is on offer', () => {
    expect(customerNudge(standing(5, []))).toBeNull();
  });
});

describe('validateRewardDraft', () => {
  it('accepts a stamp card', () => {
    expect(
      validateRewardDraft({ kind: 'stamp_card', visits: '10', benefit: 'free', value: '150' })
    ).toEqual({ ok: true, value: { visits_needed: 10, benefit: 'free', benefit_value: 150 } });
  });

  it('reads an empty cap on a free wash as no cap', () => {
    expect(
      validateRewardDraft({ kind: 'stamp_card', visits: '5', benefit: 'free', value: '' })
    ).toEqual({ ok: true, value: { visits_needed: 5, benefit: 'free', benefit_value: 0 } });
  });

  it('ignores visits on a welcome gift', () => {
    expect(
      validateRewardDraft({ kind: 'welcome', visits: 'abc', benefit: 'percent', value: '10' })
    ).toEqual({ ok: true, value: { visits_needed: 0, benefit: 'percent', benefit_value: 10 } });
  });

  it('refuses a card that is too short or too long', () => {
    expect(
      validateRewardDraft({ kind: 'stamp_card', visits: '1', benefit: 'free', value: '' })
    ).toEqual({ ok: false, error: 'Visits must be a whole number from 2 to 50.' });
    expect(
      validateRewardDraft({ kind: 'regular', visits: '200', benefit: 'percent', value: '5' })
    ).toEqual({ ok: false, error: 'Visits must be a whole number from 2 to 100.' });
  });

  it('refuses a percentage outside 1–100 and an empty amount', () => {
    expect(
      validateRewardDraft({ kind: 'welcome', visits: '', benefit: 'percent', value: '150' })
    ).toEqual({ ok: false, error: 'The discount must be from 1% to 100%.' });
    expect(
      validateRewardDraft({ kind: 'welcome', visits: '', benefit: 'amount', value: '' })
    ).toEqual({ ok: false, error: 'Enter how many pesos to take off.' });
  });
});

describe('appliedReward', () => {
  const base = {
    reward_kind: 'stamp_card' as const,
    reward_benefit: 'free' as const,
    reward_value: 150,
    reward_discount: 0,
    reward_estimate_discount: 120,
    final_total: null,
  };

  it('names free laundry the counter gave as on the house', () => {
    expect(
      appliedReward({ ...base, reward_kind: 'courtesy', reward_value: 0, reward_estimate_discount: 210 })
    ).toEqual({ label: 'Free laundry · on the house', discount: 210 });
  });

  it('is null when the order carries no reward', () => {
    expect(appliedReward({ ...base, reward_kind: null })).toBeNull();
  });

  it('shows the discount on the estimate until the order is priced', () => {
    expect(appliedReward(base)).toEqual({
      label: 'Stamp card · Free wash (up to ₱150)',
      discount: 120,
    });
  });

  it('shows the discount on the final price once there is one', () => {
    expect(appliedReward({ ...base, final_total: 30, reward_discount: 150 })).toEqual({
      label: 'Stamp card · Free wash (up to ₱150)',
      discount: 150,
    });
  });
});

describe('parseStanding', () => {
  it('reads what the database sends', () => {
    const parsed = parseStanding({
      tracked: true,
      visits: 4,
      programs: [{ ...stamp, benefit_value: '150.00', ready: 0 }],
    });
    expect(parsed.visits).toBe(4);
    expect(parsed.programs[0].benefit_value).toBe(150);
  });

  it('drops programs it does not understand rather than crash', () => {
    const parsed = parseStanding({ tracked: true, visits: 1, programs: [{ kind: 'lottery' }] });
    expect(parsed.programs).toEqual([]);
  });

  it('treats garbage as an empty, untracked standing', () => {
    expect(parseStanding(null)).toEqual({ tracked: false, visits: 0, programs: [] });
  });
});
