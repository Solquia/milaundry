import type { OrderStatus } from './domain/order-status';
import type { NewShopAccount, ShopAccountRole } from './domain/shop-account';
import type { StarterService } from './domain/service-catalog';
import type { Fulfillment, PaymentMethod } from './domain/walk-in-order';
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

export async function getShop(shopId: string): Promise<Shop> {
  const result = await supabase.from('shops').select('*').eq('id', shopId).single();
  return unwrap(result) as Shop;
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

export interface PlaceOrderOptions {
  customerId?: string;
  notes?: string;
  fulfillment?: Fulfillment;
  deliveryAddress?: string;
  /** Walk-in details jotted down at the POS. */
  customerName?: string;
  customerPhone?: string;
  paymentMethod?: PaymentMethod;
  isPaid?: boolean;
}

export async function placeOrder(
  shopId: string,
  items: PlaceOrderItem[],
  options: PlaceOrderOptions = {}
): Promise<OrderRow> {
  const result = await supabase.rpc('place_order', {
    p_shop_id: shopId,
    p_items: items,
    p_customer_id: options.customerId ?? null,
    p_notes: options.notes ?? '',
    p_fulfillment: options.fulfillment ?? 'pickup',
    p_delivery_address: options.deliveryAddress ?? '',
    p_customer_name: options.customerName ?? '',
    p_customer_phone: options.customerPhone ?? '',
    p_payment_method: options.paymentMethod ?? 'cash',
    p_is_paid: options.isPaid ?? false,
  });
  return unwrap(result) as OrderRow;
}

export async function markOrderPaid(
  orderId: string,
  method?: PaymentMethod
): Promise<OrderRow> {
  const result = await supabase.rpc('mark_order_paid', {
    p_order_id: orderId,
    p_method: method ?? null,
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

export async function updateService(
  serviceId: string,
  patch: Partial<
    Pick<
      ServiceRow,
      'name' | 'unit' | 'price' | 'category' | 'min_quantity' | 'description' | 'is_active'
    >
  >
): Promise<ServiceRow> {
  const result = await supabase
    .from('services')
    .update(patch)
    .eq('id', serviceId)
    .select()
    .single();
  return unwrap(result) as ServiceRow;
}

/** Seeds the starter price list for a shop with no services yet. */
export async function seedStarterServices(
  shopId: string,
  starters: readonly StarterService[]
): Promise<void> {
  const rows = starters.map((starter, index) => ({
    shop_id: shopId,
    name: starter.name,
    unit: starter.unit,
    price: starter.price,
    category: starter.category,
    min_quantity: starter.min_quantity,
    description: starter.description,
    sort_order: index,
  }));
  const { error } = await supabase.from('services').insert(rows);
  if (error) throw new Error(error.message);
}

// ── superadmin: shops ────────────────────────────────────────────────────
export async function adminCreateShop(
  values: ShopFormValues,
  options: { slug?: string; logoUrl?: string } = {}
): Promise<Shop> {
  const result = await supabase.rpc('admin_create_shop', {
    p_name: values.name,
    p_address: values.address,
    p_phone: values.phone,
    p_slug: options.slug ?? null,
    p_logo_url: options.logoUrl ?? '',
  });
  return unwrap(result) as Shop;
}

export async function adminUpdateShop(
  shopId: string,
  values: ShopFormValues,
  options: { logoUrl?: string } = {}
): Promise<Shop> {
  const result = await supabase.rpc('admin_update_shop', {
    p_shop_id: shopId,
    p_name: values.name,
    p_address: values.address,
    p_phone: values.phone,
    p_logo_url: options.logoUrl ?? null,
  });
  return unwrap(result) as Shop;
}

/**
 * Uploads a picked logo image into the public shop-logos bucket and returns
 * its public URL. Superadmin-only by storage policy (0008_shop_branding.sql).
 */
export async function uploadShopLogo(slug: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const body = await response.arrayBuffer();
  const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${slug}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from('shop-logos').upload(path, body, {
    contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from('shop-logos').getPublicUrl(path).data.publicUrl;
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

/** Total shop logins across the platform, for the console overview. */
export async function adminCountShopAccounts(): Promise<number> {
  const { count, error } = await supabase
    .from('shop_members')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
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

/**
 * Provisions the branded owner login generated with a new shop: username +
 * password derived from the shop name, no phone required.
 */
export async function adminCreateBrandedOwner(
  shopId: string,
  account: { fullName: string; username: string; password: string }
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-create-shop-account', {
    body: {
      shop_id: shopId,
      full_name: account.fullName,
      username: account.username,
      password: account.password,
      role: 'owner',
    },
  });

  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
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
