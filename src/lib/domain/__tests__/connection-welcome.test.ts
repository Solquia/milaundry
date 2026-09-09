import {
  CLAIM_RING_STEP_MS,
  claimHaptic,
  claimRingDelays,
  connectionRank,
  parseWelcomeParam,
  welcomeNote,
} from '../connection-welcome';

describe('connectionRank', () => {
  it('calls the very first connection a first', () => {
    expect(connectionRank(0)).toBe('first');
  });

  it('calls every later connection another', () => {
    expect(connectionRank(1)).toBe('another');
    expect(connectionRank(9)).toBe('another');
  });

  // Being wrongly told "your first laundry" on your fifth is worse than being
  // told nothing, so anything that is not exactly zero falls back to the
  // quieter moment.
  it('does not celebrate a first on an unusable count', () => {
    expect(connectionRank(-1)).toBe('another');
    expect(connectionRank(Number.NaN)).toBe('another');
    expect(connectionRank(1.5)).toBe('another');
  });
});

describe('welcomeNote', () => {
  // The milestone belongs in the heading, not in a label above one that says
  // the same thing.
  it('names the milestone in the first laundry heading itself', () => {
    const note = welcomeNote('Sparkle Wash', 0);

    expect(note.rank).toBe('first');
    expect(note.title).toBe('Sparkle Wash is your first laundry');
    expect(note.body).toContain('home screen');
  });

  it('does not call a later connection a first', () => {
    const note = welcomeNote('Sparkle Wash', 3);

    expect(note.rank).toBe('another');
    expect(note.title).toBe("You're connected to Sparkle Wash");
    expect(note.title).not.toContain('first');
  });

  it('counts the laundries already on the home screen', () => {
    expect(welcomeNote('Sparkle Wash', 3).body).toContain('the 3 laundries');
  });

  it('says "the one laundry" rather than "the 1 laundries"', () => {
    const body = welcomeNote('Sparkle Wash', 1).body;

    expect(body).toContain('the one laundry already');
    expect(body).not.toContain('1 laundries');
  });

  it('claims no count it cannot stand behind', () => {
    const body = welcomeNote('Sparkle Wash', Number.NaN).body;

    expect(body).not.toMatch(/\d/);
    expect(body).toContain('price list');
  });

  it('falls back to a name rather than printing an empty title', () => {
    expect(welcomeNote('   ', 0).title).toBe('Laundry shop is your first laundry');
  });
});

describe('claimHaptic', () => {
  it('gives the milestone the success notification', () => {
    expect(claimHaptic('first')).toBe('success');
  });

  // A routine connect is a commit, not an achievement. Firing the success
  // notification on every join is how a haptic stops meaning anything.
  it('gives a routine connect the commit weight', () => {
    expect(claimHaptic('another')).toBe('commit');
  });
});

describe('claimRingDelays', () => {
  it('sends three rings out on the first laundry', () => {
    expect(claimRingDelays('first')).toEqual([
      0,
      CLAIM_RING_STEP_MS,
      CLAIM_RING_STEP_MS * 2,
    ]);
  });

  it('sends one ring out on every later connect', () => {
    expect(claimRingDelays('another')).toEqual([0]);
  });

  it('always starts a ring immediately, so the tap is answered at once', () => {
    expect(claimRingDelays('first')[0]).toBe(0);
    expect(claimRingDelays('another')[0]).toBe(0);
  });
});

describe('parseWelcomeParam', () => {
  it('reads the count a connect carried across the navigation', () => {
    expect(parseWelcomeParam('0')).toBe(0);
    expect(parseWelcomeParam('4')).toBe(4);
  });

  it('is absent when no connect just happened', () => {
    expect(parseWelcomeParam(undefined)).toBeNull();
    expect(parseWelcomeParam('')).toBeNull();
  });

  // Expo Router hands back an array when a key repeats in the query string.
  it('takes the first value of a repeated key', () => {
    expect(parseWelcomeParam(['2', '7'])).toBe(2);
    expect(parseWelcomeParam([])).toBeNull();
  });

  it('refuses anything that is not a whole non-negative count', () => {
    expect(parseWelcomeParam('first')).toBeNull();
    expect(parseWelcomeParam('-1')).toBeNull();
    expect(parseWelcomeParam('1.5')).toBeNull();
    expect(parseWelcomeParam('Infinity')).toBeNull();
  });
});
