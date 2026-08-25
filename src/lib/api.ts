import type { OrderStatus } from './domain/order-status';
import type { NewShopAccount, ShopAccountRole } from './domain/shop-account';
import type { ShopFormValues } from './domain/shop-form';
import { supabase } from './supabase';
import type {
  OrderItemRow,
  OrderRow,
  ServiceRow,
  Shop,
  ShopAnalytics,
  ShopCustomer,
  ShopMemberRow,
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

// ── superadmin: shops ────────────────────────────────────────────────────
export async function adminCreateShop(values: ShopFormValues): Promise<Shop> {
  const result = await supabase.rpc('admin_create_shop', {
    p_name: values.name,
    p_address: values.address,
    p_phone: values.phone,
  });
  return unwrap(result) as Shop;
}

export async function adminUpdateShop(
  shopId: string,
  values: ShopFormValues
): Promise<Shop> {
  const result = await supabase.rpc('admin_update_shop', {
    p_shop_id: shopId,
    p_name: values.name,
    p_address: values.address,
    p_phone: values.phone,
  });
  return unwrap(result) as Shop;
}

export async function adminSetShopActive(
  shopId: string,
  isActive: boolean
): Promise<Shop> {
  const result = await supabase.rpc('admin_set_shop_active', {
    p_shop_id: shopId,
    p_is_active: isActive,
  });
  return unwrap(result) as Shop;
}

// ── superadmin: shop accounts ────────────────────────────────────────────
export async function adminListShopMembers(shopId: string): Promise<ShopMemberRow[]> {
  const result = await supabase.rpc('admin_list_shop_members', { p_shop_id: shopId });
  return unwrap(result) as ShopMemberRow[];
}

/**
 * Provisions a brand-new login for a shop. Account creation needs the
 * service_role key, so it runs in the admin-create-shop-account Edge Function
 * rather than here; see supabase/functions/admin-create-shop-account.
 */
export async function adminCreateShopAccount(
  shopId: string,
  account: NewShopAccount
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-create-shop-account', {
    body: {
      shop_id: shopId,
      full_name: account.fullName,
      phone: account.phone,
      password: account.password,
      role: account.role,
    },
  });

  // functions.invoke surfaces non-2xx as FunctionsHttpError, whose message is
  // generic — the useful reason is in the JSON body, so prefer that.
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
}

async function readFunctionError(error: unknown): Promise<string | null> {
  const response = (error as { context?: Response }).context;
  if (!response || typeof response.json !== 'function') return null;
  try {
    const body = await response.json();
    return typeof body?.error === 'string' ? body.error : null;
  } catch {
    return null;
  }
}

/** Assign an account that already exists, looked up by mobile number. */
export async function adminAssignMerchant(
  shopId: string,
  phone: string,
  role: ShopAccountRole = 'owner'
): Promise<void> {
  const { error } = await supabase.rpc('admin_assign_merchant', {
    p_shop_id: shopId,
    p_phone: phone,
    p_role: role,
  });
  if (error) throw new Error(error.message);
}

export async function adminRemoveShopMember(
  shopId: string,
  profileId: string
): Promise<void> {
  const { error } = await supabase.rpc('admin_remove_shop_member', {
    p_shop_id: shopId,
    p_profile_id: profileId,
  });
  if (error) throw new Error(error.message);
}
