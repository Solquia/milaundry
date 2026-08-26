import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  forgetSavedAccount,
  loadSavedAccounts,
  rememberSignIn,
} from '../saved-accounts-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const KEY = 'milaundry.saved-accounts.v1';

/** Backs the mock with a stored value so a round trip can be observed. */
function givenStored(value: string | null) {
  storage.getItem.mockResolvedValue(value);
}

beforeEach(() => {
  jest.clearAllMocks();
  givenStored(null);
  storage.setItem.mockResolvedValue(undefined);
});

describe('rememberSignIn', () => {
  it('stores the login that just worked, under its own key', async () => {
    const accounts = await rememberSignIn('0917 123 4567');

    expect(accounts).toEqual([
      { id: '+639171234567', label: '0917 123 4567', kind: 'phone' },
    ]);
    expect(storage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(accounts));
  });

  it('never writes a password or a token, only the login identifier', async () => {
    await rememberSignIn('sparklewash');

    const [, written] = storage.setItem.mock.calls[0];
    expect(JSON.parse(written)).toEqual([
      { id: 'sparklewash', label: 'sparklewash', kind: 'username' },
    ]);
  });

  it('keeps the account already stored on the device', async () => {
    givenStored(
      JSON.stringify([{ id: 'sparklewash', label: 'sparklewash', kind: 'username' }])
    );

    const accounts = await rememberSignIn('0917 123 4567');

    expect(accounts.map((account) => account.id)).toEqual([
      '+639171234567',
      'sparklewash',
    ]);
  });

  it('still returns the list for this session when the device refuses the write', async () => {
    // A full or locked disk must not turn a successful sign-in into a failure.
    storage.setItem.mockRejectedValue(new Error('disk full'));

    await expect(rememberSignIn('sparklewash')).resolves.toEqual([
      { id: 'sparklewash', label: 'sparklewash', kind: 'username' },
    ]);
  });
});

describe('loadSavedAccounts', () => {
  it('is empty on a device that has never signed in', async () => {
    await expect(loadSavedAccounts()).resolves.toEqual([]);
  });

  it('is empty rather than broken when the read fails', async () => {
    storage.getItem.mockRejectedValue(new Error('storage unavailable'));

    await expect(loadSavedAccounts()).resolves.toEqual([]);
  });
});

describe('forgetSavedAccount', () => {
  it('removes the account and persists what is left', async () => {
    givenStored(
      JSON.stringify([
        { id: '+639171234567', label: '0917 123 4567', kind: 'phone' },
        { id: 'sparklewash', label: 'sparklewash', kind: 'username' },
      ])
    );

    const accounts = await forgetSavedAccount('+639171234567');

    expect(accounts).toEqual([
      { id: 'sparklewash', label: 'sparklewash', kind: 'username' },
    ]);
    expect(storage.setItem).toHaveBeenCalledWith(KEY, JSON.stringify(accounts));
  });
});
