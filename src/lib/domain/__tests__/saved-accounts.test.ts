import {
  MAX_SAVED_ACCOUNTS,
  forgetAccount,
  parseSavedAccounts,
  rememberAccount,
  toSavedAccount,
  type SavedAccount,
} from '../saved-accounts';

const phoneAccount: SavedAccount = {
  id: '+639171234567',
  label: '0917 123 4567',
  kind: 'phone',
};

const shopAccount: SavedAccount = {
  id: 'sparklewash',
  label: 'sparklewash',
  kind: 'username',
};

describe('toSavedAccount', () => {
  it('keeps a mobile number in a form the sign-in field can be refilled with', () => {
    expect(toSavedAccount('0917 123 4567')).toEqual(phoneAccount);
  });

  it('recognises the same number however it was typed', () => {
    expect(toSavedAccount('+63 917 123 4567')).toEqual(phoneAccount);
    expect(toSavedAccount('09171234567')).toEqual(phoneAccount);
  });

  it('lowercases a shop username so it matches next time', () => {
    expect(toSavedAccount('  SparkleWash ')).toEqual(shopAccount);
  });

  it('refuses to remember something that is not a login', () => {
    expect(toSavedAccount('')).toBeNull();
    expect(toSavedAccount('   ')).toBeNull();
    expect(toSavedAccount('0917')).toBeNull();
    expect(toSavedAccount('!!')).toBeNull();
  });
});

describe('rememberAccount', () => {
  it('offers the account on the next sign-in', () => {
    expect(rememberAccount([], '0917 123 4567')).toEqual([phoneAccount]);
  });

  it('lists the same account once, however it was typed', () => {
    // The point of the feature: never make someone scan a list of near
    // duplicates of their own number.
    const saved = rememberAccount([phoneAccount], '+639171234567');

    expect(saved).toEqual([phoneAccount]);
  });

  it('moves the account just used back to the top', () => {
    const saved = rememberAccount([shopAccount, phoneAccount], '0917 123 4567');

    expect(saved.map((account) => account.id)).toEqual([
      '+639171234567',
      'sparklewash',
    ]);
  });

  it('drops the oldest account once the list is full', () => {
    let saved: SavedAccount[] = [];
    for (let index = 0; index < MAX_SAVED_ACCOUNTS; index += 1) {
      saved = rememberAccount(saved, `shop${index}`);
    }

    saved = rememberAccount(saved, 'newest');

    expect(saved).toHaveLength(MAX_SAVED_ACCOUNTS);
    expect(saved[0].id).toBe('newest');
    expect(saved.map((account) => account.id)).not.toContain('shop0');
  });

  it('remembers nothing when the sign-in field held junk', () => {
    expect(rememberAccount([phoneAccount], 'nope!')).toEqual([phoneAccount]);
  });

  it('leaves the list it was given untouched', () => {
    const original: SavedAccount[] = [phoneAccount];

    rememberAccount(original, 'sparklewash');

    expect(original).toEqual([phoneAccount]);
  });
});

describe('forgetAccount', () => {
  it('removes the account someone asked to forget', () => {
    expect(forgetAccount([phoneAccount, shopAccount], '+639171234567')).toEqual([
      shopAccount,
    ]);
  });

  it('leaves the list alone when the id is not on it', () => {
    expect(forgetAccount([shopAccount], '+639171234567')).toEqual([shopAccount]);
  });
});

describe('parseSavedAccounts', () => {
  it('reads back what was stored on this device', () => {
    expect(parseSavedAccounts(JSON.stringify([phoneAccount, shopAccount]))).toEqual([
      phoneAccount,
      shopAccount,
    ]);
  });

  it('starts empty on a device that has never signed in', () => {
    expect(parseSavedAccounts(null)).toEqual([]);
  });

  it('never lets damaged storage break the sign-in screen', () => {
    expect(parseSavedAccounts('not json')).toEqual([]);
    expect(parseSavedAccounts('{"id":"x"}')).toEqual([]);
    expect(parseSavedAccounts('[1, "two", null]')).toEqual([]);
  });

  it('discards entries that lost a field, keeping the usable ones', () => {
    const raw = JSON.stringify([{ id: 'sparklewash' }, phoneAccount]);

    expect(parseSavedAccounts(raw)).toEqual([phoneAccount]);
  });

  it('drops anything stored beyond the cap', () => {
    const many = Array.from({ length: MAX_SAVED_ACCOUNTS + 3 }, (_, index) => ({
      id: `shop${index}`,
      label: `shop${index}`,
      kind: 'username' as const,
    }));

    expect(parseSavedAccounts(JSON.stringify(many))).toHaveLength(
      MAX_SAVED_ACCOUNTS
    );
  });
});
