import {
  availableRails,
  hasOnlineRails,
  payableMethods,
  railsNotice,
  type ShopPaymentDetails,
} from '../shop-payment';

const NONE: ShopPaymentDetails = {
  gcash_number: '',
  gcash_name: '',
  maya_number: '',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
};

describe('availableRails', () => {
  it('offers nothing online for a shop that has filled nothing in', () => {
    expect(availableRails(NONE, 'Suds & Co')).toEqual([]);
  });

  it('offers GCash once the shop has saved a number', () => {
    const rails = availableRails(
      { ...NONE, gcash_number: '0917 123 4567', gcash_name: 'Maria Santos' },
      'Suds & Co'
    );

    expect(rails).toEqual([
      {
        method: 'gcash',
        label: 'GCash',
        accountName: 'Maria Santos',
        accountNumber: '0917 123 4567',
        icon: 'phone-portrait-outline',
      },
    ]);
  });

  it('falls back to the shop name when no account name was given', () => {
    // A number with no name attached is the thing that makes someone hesitate
    // before sending money. The shop name is a true, useful stand-in.
    const rails = availableRails({ ...NONE, gcash_number: '09171234567' }, 'Suds & Co');

    expect(rails[0].accountName).toBe('Suds & Co');
  });

  it('treats a whitespace-only number as not configured', () => {
    expect(availableRails({ ...NONE, gcash_number: '   ' }, 'Suds & Co')).toEqual([]);
  });

  it('lists every configured rail in a stable order', () => {
    const rails = availableRails(
      {
        bank_account_number: '1234567890',
        bank_account_name: 'M. Santos',
        bank_name: 'BPI',
        maya_number: '09181234567',
        gcash_number: '09171234567',
        gcash_name: 'Maria Santos',
      },
      'Suds & Co'
    );

    // Order is fixed rather than object-key order, so the customer's payment
    // screen does not reshuffle between visits.
    expect(rails.map((rail) => rail.method)).toEqual(['gcash', 'maya', 'bank_transfer']);
  });

  it('names the bank on the transfer rail', () => {
    const rails = availableRails(
      {
        ...NONE,
        bank_name: 'BPI',
        bank_account_name: 'M. Santos',
        bank_account_number: '1234567890',
      },
      'Suds & Co'
    );

    expect(rails[0].label).toBe('BPI');
    expect(rails[0].accountNumber).toBe('1234567890');
  });

  it('ignores a bank with a name but no account number', () => {
    // Nothing can be sent to a bank name alone, so offering it as a rail
    // would be offering a dead end.
    expect(availableRails({ ...NONE, bank_name: 'BPI' }, 'Suds & Co')).toEqual([]);
  });

  it('labels a bank transfer generically when the bank was not named', () => {
    const rails = availableRails(
      { ...NONE, bank_account_number: '1234567890' },
      'Suds & Co'
    );

    expect(rails[0].label).toBe('Bank transfer');
  });
});

describe('hasOnlineRails', () => {
  it('is false for a cash-only shop', () => {
    expect(hasOnlineRails(NONE, 'Suds & Co')).toBe(false);
  });

  it('is true as soon as one rail is configured', () => {
    expect(hasOnlineRails({ ...NONE, maya_number: '09181234567' }, 'Suds & Co')).toBe(
      true
    );
  });
});

describe('payableMethods', () => {
  it('always offers cash, even for a shop with no online rails', () => {
    // Every laundry takes notes across the counter. Cash is never configured
    // and never absent.
    expect(payableMethods(NONE, 'Suds & Co')).toEqual(['cash']);
  });

  it('puts cash last once online rails exist', () => {
    // The customer is on this screen because they are not at the counter.
    const methods = payableMethods(
      { ...NONE, gcash_number: '09171234567' },
      'Suds & Co'
    );

    expect(methods).toEqual(['gcash', 'cash']);
  });
});

describe('railsNotice', () => {
  it('tells a cash-only shop customer where to pay', () => {
    expect(railsNotice(NONE, 'Suds & Co')).toBe(
      'Suds & Co takes cash only. Pay at the counter when you collect your laundry.'
    );
  });

  it('asks for the exact amount and a receipt when rails exist', () => {
    expect(railsNotice({ ...NONE, gcash_number: '09171234567' }, 'Suds & Co')).toBe(
      'Send the exact amount, then upload your receipt so Suds & Co can confirm it.'
    );
  });
});
