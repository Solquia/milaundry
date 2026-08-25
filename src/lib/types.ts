import type { OrderStatus } from './domain/order-status';
import type { PricingUnit } from './domain/pricing';
import type { ShopAccountRole } from './domain/shop-account';

export type Role = 'customer' | 'merchant' | 'superadmin';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string;
  /** Branded login for shop accounts; null for phone-based sign-ups. */
  username: string | null;
  created_at: string;
}

export interface Shop {
  id: string;
  name: string;
  /** URL-ish identity shown as /sparkle-wash; also brands the login. */
  slug: string;
  logo_url: string;
  address: string;
  phone: string;
  qr_token: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
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
  is_active: boolean;
  created_at: string;
}

export interface OrderRow {
  id: string;
  shop_id: string;
  customer_id: string | null;
  created_by: string;
  status: OrderStatus;
  estimated_total: number;
  final_total: number | null;
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
