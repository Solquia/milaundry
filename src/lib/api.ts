import type { OrderStatus } from './domain/order-status';
import { supabase } from './supabase';
import type {
  OrderItemRow,
  OrderRow,
  ServiceRow,
  Shop,
  ShopAnalytics,
  ShopCustomer,
  StatusHistoryRow,
} from './types';

export interface OrderWithDetails extends OrderRow {
  shop: Pick<Shop, 'id' | 'name'> | null;
  order_items: OrderItemRow[];
}

const ORDER_SELECT = '*, shop:shops(id, name), order_items(*)';

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  if (result.data === null) throw new Error('No data returned');
  return result.data;
}

// ── shops ────────────────────────────────────────────────────────────────
export async function getRegisteredShops(): Promise<Shop[]> {
  const result = await supabase
    .from('customer_shops')
    .select('shop:shops(*)')
    .order('created_at', { ascending: false });
  return unwrap(result).map((row: any) => row.shop as Shop);
}

export async function getMyMerchantShops(): Promise<Shop[]> {
  const result = await supabase.from('shop_members').select('shop:shops(*)');
  return unwrap(result).map((row: any) => row.shop as Shop);
}

export async function getAllShops(): Promise<Shop[]> {
  const result = await supabase
    .from('shops')
    .select('*')
    .order('created_at', { ascending: false });
  return unwrap(result) as Shop[];
}

export async function getServices(shopId: string): Promise<ServiceRow[]> {
  const result = await supabase
    .from('services')
    .select('*')
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .order('name');
  return unwrap(result) as ServiceRow[];
}

// ── orders ───────────────────────────────────────────────────────────────
export async function getMyOrders(): Promise<OrderWithDetails[]> {
  const { data } = await supabase.auth.getUser();
  const result = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('customer_id', data.user?.id ?? '')
    .order('created_at', { ascending: false });
  return unwrap(result) as unknown as OrderWithDetails[];
}

export async function getShopOrders(shopId: string): Promise<OrderWithDetails[]> {
  const result = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false });
  return unwrap(result) as unknown as OrderWithDetails[];
}

export async function getOrder(orderId: string): Promise<OrderWithDetails> {
  const result = await supabase
    .from('orders')
    .select(ORDER_SELECT)
    .eq('id', orderId)
    .single();
  return unwrap(result) as unknown as OrderWithDetails;
}

export async function getOrderHistory(orderId: string): Promise<StatusHistoryRow[]> {
  const result = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return unwrap(result) as StatusHistoryRow[];
}

export interface PlaceOrderItem {
  service_id: string;
  quantity: number;
}

export async function placeOrder(
  shopId: string,
  items: PlaceOrderItem[],
  options: { customerId?: string; notes?: string } = {}
): Promise<OrderRow> {
  const result = await supabase.rpc('place_order', {
    p_shop_id: shopId,
    p_items: items,
    p_customer_id: options.customerId ?? null,
    p_notes: options.notes ?? '',
  });
  return unwrap(result) as OrderRow;
}

export async function updateOrderStatus(
  orderId: string,
  to: OrderStatus
): Promise<OrderRow> {
  const result = await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_to: to,
  });
  return unwrap(result) as OrderRow;
}

// ── QR flows ─────────────────────────────────────────────────────────────
export async function registerWithShop(shopId: string, token: string): Promise<void> {
  const { error } = await supabase.rpc('register_with_shop', {
    p_shop_id: shopId,
    p_token: token,
  });
  if (error) throw new Error(error.message);
}

export async function claimOrder(orderId: string, token: string): Promise<OrderRow> {
  const result = await supabase.rpc('claim_order', {
    p_order_id: orderId,
    p_token: token,
  });
  return unwrap(result) as OrderRow;
}

// ── merchant CRM & analytics ─────────────────────────────────────────────
export async function getShopCustomers(shopId: string): Promise<ShopCustomer[]> {
  const result = await supabase.rpc('get_shop_customers', { p_shop_id: shopId });
  return unwrap(result) as ShopCustomer[];
}

export async function getShopAnalytics(shopId: string): Promise<ShopAnalytics> {
  const result = await supabase.rpc('get_shop_analytics', { p_shop_id: shopId });
  return unwrap(result) as ShopAnalytics;
}

// ── services management (merchant) ───────────────────────────────────────
export async function upsertService(
  service: Partial<ServiceRow> & { shop_id: string; name: string; unit: string; price: number }
): Promise<ServiceRow> {
  const result = await supabase.from('services').upsert(service).select().single();
  return unwrap(result) as ServiceRow;
}

// ── superadmin ───────────────────────────────────────────────────────────
export async function adminCreateShop(
  name: string,
  address: string,
  phone: string
): Promise<Shop> {
  const result = await supabase.rpc('admin_create_shop', {
    p_name: name,
    p_address: address,
    p_phone: phone,
  });
  return unwrap(result) as Shop;
}

export async function adminAssignMerchant(shopId: string, phone: string): Promise<void> {
  const { error } = await supabase.rpc('admin_assign_merchant', {
    p_shop_id: shopId,
    p_phone: phone,
  });
  if (error) throw new Error(error.message);
}
