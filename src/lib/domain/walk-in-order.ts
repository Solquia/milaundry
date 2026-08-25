import { normalizePhone } from './phone';

export const PAYMENT_METHODS = ['cash', 'gcash', 'maya', 'card', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

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
}

export type WalkInErrors = Partial<
  Record<'customerName' | 'customerPhone' | 'deliveryAddress' | 'paymentMethod', string>
>;

export type WalkInResult =
  | { ok: true; value: WalkInDetails }
  | { ok: false; errors: WalkInErrors };

export function validateWalkIn(input: WalkInInput): WalkInResult {
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
    },
  };
}
