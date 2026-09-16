import type { PreferredMethod } from './domain/customer-book';
import type { OrderStatus } from './domain/order-status';
import type { OrderType, PaymentStatus } from './domain/order-tags';
import type { PricingUnit } from './domain/pricing';
import type { ServiceCategory } from './domain/service-catalog';
import type { ShopAccountRole } from './domain/shop-account';
import type { Fulfillment, PaymentMethod } from './domain/walk-in-order';

export type Role = 'customer' | 'merchant' | 'superadmin';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  /** Branded login for shop accounts; null for phone-based sign-ups. */
  username: string | null;
  created_at: string;
  /**
   * How this customer usually pays, so a booking arrives with it chosen
   * (migration 0024). Null until they say. Never a card: `card` in this
   * product is the terminal on a counter, and nothing is kept on file.
   */
  preferred_payment_method: PreferredMethod | null;
  /** The GCash or Maya number that method pays from; null for the others. */
  payment_handle: string | null;
}

export interface Shop {
  id: string;
  name: string;
  /** URL-ish identity shown as /sparkle-wash; also brands the login. */
  slug: string;
  logo_url: string;
  /** Photo of the physical shop, behind its name on the shopfront; '' when none. */
  cover_url: string;
  address: string;
  /** Map pin; both null until the shop places one. */
  latitude: number | null;
  longitude: number | null;
  phone: string;
  /** Palette index the shop chose; null falls back to the hashed default. */
  brand_accent: number | null;
  /** One line under the shop's name on its shopfront. */
  tagline: string;
  qr_token: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  /**
   * How the shop takes money from a customer who is not at the counter.
   * Published verbatim — these are the digits already on the tarpaulin above
   * the till. Empty string means "not offered"; see `domain/shop-payment.ts`.
   */
  gcash_number: string;
  gcash_name: string;
  maya_number: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
  /** Whether the shop's public web page at /s/<slug> is switched on. */
  web_enabled: boolean;
}

/** A login account attached to a shop, as returned by admin_list_shop_members. */
export interface ShopMemberRow {
  profile_id: string;
  full_name: string;
  phone: string;
  username: string | null;
  role: ShopAccountRole;
  created_at: string;
}

export interface ServiceRow {
  id: string;
  shop_id: string;
  name: string;
  unit: PricingUnit;
  price: number;
  category: ServiceCategory;
  /** Minimum billable quantity for per-kg services; 0 = no minimum. */
  min_quantity: number;
  description: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface OrderRow {
  id: string;
  shop_id: string;
  customer_id: string | null;
  created_by: string;
  status: OrderStatus;
  order_type: OrderType;
  fulfillment: Fulfillment;
  delivery_address: string;
  /**
   * Who to call about this order. Typed at the counter for a walk-in; stamped
   * from the booker's own profile when a customer books in the app, so the
   * shop never sees a nameless order (see migration 0015).
   */
  customer_name: string;
  customer_phone: string;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at: string | null;
  /** Rider pickup time chosen at booking; null for self drop-off. */
  pickup_at: string | null;
  /** Promised delivery-back time; null for self drop-off. */
  deliver_by: string | null;
  estimated_total: number;
  final_total: number | null;
  /** What the shop's scale actually read; null until they weigh it. */
  actual_weight_kg: number | null;
  /** Private storage key for the photo of the weighed load. */
  weigh_photo_path: string | null;
  weighed_at: string | null;
  /** Private storage key for the receipt the customer uploaded. */
  payment_proof_path: string | null;
  /** The reference number off that receipt, for the shop to match by eye. */
  payment_reference: string | null;
  claim_token: string;
  claimed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  service_id: string | null;
  service_name: string;
  unit: PricingUnit;
  unit_price: number;
  quantity: number;
  subtotal: number;
  created_at: string;
}

export interface StatusHistoryRow {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  shop_id: string;
  customer_id: string;
  order_id: string;
  /** 1–5 stars. */
  rating: number;
  comment: string;
  created_at: string;
  /** Joined reviewer profile; null if the profile is gone. */
  reviewer: { full_name: string } | null;
}

export interface ShopCustomer {
  customer_id: string;
  full_name: string;
  phone: string;
  registered_at: string;
  order_count: number;
  total_spend: number;
  last_order_at: string | null;
}

export interface ShopAnalytics {
  total_orders: number;
  total_revenue: number;
  active_orders: number;
  unique_customers: number;
  repeat_customers: number;
  orders_by_status: Partial<Record<OrderStatus, number>>;
}

/**
 * A shop's public web page, as get_storefront returns it: display fields,
 * the active price list, and the latest reviews. No account is needed to read
 * it, so nothing on it is private — the counter token rides along because the
 * page prints the counter code.
 */
export interface StorefrontShop {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  brand_accent: number | null;
  logo_url: string;
  cover_url: string;
  address: string;
  phone: string;
  latitude: number | null;
  longitude: number | null;
  qr_token: string;
}

export type StorefrontService = Pick<
  ServiceRow,
  'id' | 'name' | 'unit' | 'price' | 'category' | 'min_quantity' | 'description' | 'sort_order'
>;

export interface StorefrontReview {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Storefront {
  shop: StorefrontShop;
  services: StorefrontService[];
  reviews: StorefrontReview[];
}
