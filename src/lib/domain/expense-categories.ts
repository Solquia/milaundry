/**
 * What a laundry shop spends on, in the words an owner already uses.
 *
 * A fixed list rather than free tags: a month's breakdown only means something
 * when "Detergent" and "detergent " and "Ariel" all land in the same bar.
 * "Other" plus a note covers the rest. The keys are stored in the database
 * (0039 checks them), so a key is never renamed — only its label.
 */

export const EXPENSE_CATEGORIES = [
  'supplies',
  'utilities',
  'rent',
  'wages',
  'repairs',
  'delivery',
  'other',
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_PAID_FROM = ['cash', 'gcash', 'bank', 'other'] as const;
export type ExpensePaidFrom = (typeof EXPENSE_PAID_FROM)[number];

export interface CategoryLook {
  label: string;
  /** Ionicons name. */
  icon: string;
  /** What belongs here, shown under the chips once one is picked. */
  hint: string;
}

export const CATEGORY_LOOKS: Record<ExpenseCategory, CategoryLook> = {
  supplies: { label: 'Supplies', icon: 'flask-outline', hint: 'Detergent, fabcon, plastic bags' },
  utilities: { label: 'Utilities', icon: 'flash-outline', hint: 'Electricity, water, LPG, internet' },
  rent: { label: 'Rent', icon: 'home-outline', hint: 'The space, the stall' },
  wages: { label: 'Wages', icon: 'people-outline', hint: 'Staff pay, allowances' },
  repairs: { label: 'Repairs', icon: 'construct-outline', hint: 'Machine parts, technician' },
  delivery: { label: 'Delivery', icon: 'bicycle-outline', hint: 'Fuel, rider fees' },
  other: { label: 'Other', icon: 'ellipsis-horizontal', hint: 'Anything else — add a note' },
};

export const PAID_FROM_LABELS: Record<ExpensePaidFrom, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  bank: 'Bank',
  other: 'Other',
};

export function isExpenseCategory(value: unknown): value is ExpenseCategory {
  return typeof value === 'string' && (EXPENSE_CATEGORIES as readonly string[]).includes(value);
}

export function isExpensePaidFrom(value: unknown): value is ExpensePaidFrom {
  return typeof value === 'string' && (EXPENSE_PAID_FROM as readonly string[]).includes(value);
}
