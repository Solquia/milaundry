import { parseAmount } from './cash-payment';
import { normalizePhone } from './phone';

export const PAYMENT_METHODS = [
  'cash',
  'gcash',
  'maya',
  'card',
  'bank_transfer',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** What an online-booking customer can choose from (cash = on delivery/pickup). */
export const CUSTOMER_PAYMENT_METHODS = [
  'cash',
  'gcash',
  'maya',
  'bank_transfer',
] as const satisfies readonly PaymentMethod[];

export const FULFILLMENTS = ['pickup', 'delivery'] as const;
export type Fulfillment = (typeof FULFILLMENTS)[number];

export interface WalkInInput {
  customerName: string;
  /** Raw phone input; optional for walk-ins without a contact number. */
  customerPhone: string;
  fulfillment: Fulfillment;
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  /**
   * Typed amount when the customer pays only part now; undefined when they pay
   * all now or all later. Ignored once isPaid is set.
   */
  partPaid?: string;
}

export interface WalkInDetails {
  customerName: string;
  /** Normalized E.164 phone, or '' when none was given. */
  customerPhone: string;
  fulfillment: Fulfillment;
  /** Trimmed address for delivery orders; '' for pickup. */
  deliveryAddress: string;
  paymentMethod: PaymentMethod;
  isPaid: boolean;
  /** Paid now, short of the bill; null when not a part payment. */
  partPaid: number | null;
}

export type WalkInErrors = Partial<
  Record<'customerName' | 'customerPhone' | 'deliveryAddress' | 'paymentMethod' | 'partPaid', string>
>;

export type WalkInResult =
  | { ok: true; value: WalkInDetails }
  | { ok: false; errors: WalkInErrors };

/** `total` is the bill on screen, so a part payment can be checked against it. */
export function validateWalkIn(input: WalkInInput, total: number | null = null): WalkInResult {
  const errors: WalkInErrors = {};

  const customerName = input.customerName.trim();
  if (!customerName) {
    errors.customerName = 'Enter the customer name.';
  }

  let customerPhone = '';
  const rawPhone = input.customerPhone.trim();
  if (rawPhone) {
    const normalized = normalizePhone(rawPhone);
    if (normalized === null) {
      errors.customerPhone = 'Enter a valid mobile number.';
    } else {
      customerPhone = normalized;
    }
  }

  const isDelivery = input.fulfillment === 'delivery';
  const deliveryAddress = isDelivery ? input.deliveryAddress.trim() : '';
  if (isDelivery && !deliveryAddress) {
    errors.deliveryAddress = 'Enter the delivery address.';
  }

  if (!PAYMENT_METHODS.includes(input.paymentMethod)) {
    errors.paymentMethod = 'Choose a payment method.';
  }

  const isPart = !input.isPaid && input.partPaid !== undefined;
  const partPaid = isPart ? parseAmount(input.partPaid ?? '') : null;
  if (isPart && (partPaid === null || partPaid <= 0)) {
    errors.partPaid = 'Enter how much they paid now.';
  } else if (isPart && partPaid !== null && total !== null && partPaid >= total) {
    errors.partPaid = 'That is the whole bill. Choose Paid now instead.';
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      customerName,
      customerPhone,
      fulfillment: input.fulfillment,
      deliveryAddress,
      paymentMethod: input.paymentMethod,
      isPaid: input.isPaid,
      partPaid: isPart ? partPaid : null,
    },
  };
}
