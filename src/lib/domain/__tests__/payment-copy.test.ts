import {
  COPY_FEEDBACK_MS,
  copyConfirmation,
  copyPrompt,
  copyableNumber,
} from '../payment-copy';
import type { PaymentRail } from '../shop-payment';

const gcash: PaymentRail = {
  method: 'gcash',
  label: 'GCash',
  accountName: 'Sparcle clean',
  accountNumber: '9855421394',
  icon: 'phone-portrait-outline',
};
const maya: PaymentRail = { ...gcash, method: 'maya', label: 'Maya' };
const bank: PaymentRail = {
  method: 'bank_transfer',
  label: 'BPI',
  accountName: 'Sparcle clean',
  accountNumber: '1234 5678 90',
  icon: 'business-outline',
};

describe('copyableNumber', () => {
  it('strips the spaces a shop typed for readability', () => {
    // The number is printed for a human to read and pasted for a bank to
    // parse. Those are not the same string.
    expect(copyableNumber('0917 123 4567')).toBe('09171234567');
  });

  it('strips dashes, including the ones a paste brings in', () => {
    expect(copyableNumber('1234-5678-90')).toBe('1234567890');
    expect(copyableNumber('0917–123—4567')).toBe('09171234567');
  });

  it('keeps the leading zero every PH mobile number depends on', () => {
    expect(copyableNumber(' 09855421394 ')).toBe('09855421394');
  });

  it('keeps a country-code plus, which is part of the number', () => {
    expect(copyableNumber('+63 917 123 4567')).toBe('+639171234567');
  });

  it('leaves a number that is already clean alone', () => {
    expect(copyableNumber('9855421394')).toBe('9855421394');
  });

  it('returns nothing for a blank number, so nothing is offered to copy', () => {
    expect(copyableNumber('')).toBe('');
    expect(copyableNumber('   ')).toBe('');
  });
});

describe('copyPrompt', () => {
  it('names the wallet and reads the number out', () => {
    // "Copy" alone announces as a button with no object. A customer using a
    // screen reader has to know which of three numbers they are taking.
    expect(copyPrompt(gcash)).toBe('Copy GCash number 9855421394');
  });

  it('calls a bank figure an account number, because that is what it is', () => {
    expect(copyPrompt(bank)).toBe('Copy BPI account number 1234 5678 90');
  });
});

describe('copyConfirmation', () => {
  it('says what was taken, not just that something was', () => {
    expect(copyConfirmation(gcash)).toBe('GCash number copied');
    expect(copyConfirmation(maya)).toBe('Maya number copied');
  });

  it('keeps the bank wording it used on the button', () => {
    expect(copyConfirmation(bank)).toBe('BPI account number copied');
  });
});

describe('COPY_FEEDBACK_MS', () => {
  it('holds the confirmation long enough to read and short enough to leave', () => {
    expect(COPY_FEEDBACK_MS).toBeGreaterThanOrEqual(1500);
    expect(COPY_FEEDBACK_MS).toBeLessThanOrEqual(4000);
  });
});
