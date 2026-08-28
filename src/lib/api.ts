import type { OrderStatus } from './domain/order-status';
import type { ShopPaymentDetails } from './domain/shop-payment';
import type { NewShopAccount, ShopAccountRole } from './domain/shop-account';
import type { StarterService } from './domain/service-catalog';
import type { Fulfillment, PaymentMethod } from './domain/walk-in-order';
import type { ShopFormValues } from './domain/shop-form';
import { supabase } from './supabase';
import type {
  OrderItemRow,
  OrderRow,
  ReviewRow,
  ServiceRow,
  Shop,
  ShopAnalytics,
  ShopCustomer,
  ShopMemberRow,
  StatusHistoryRow,
} from './types';

export interface OrderWithDetails extends OrderRow {
  shop:
    | Pick<
        Shop,
        | 'id'
        | 'name'
        | 'brand_accent'
        // The rails ride along so the customer's pay screen can say where the
        // money actually goes without a second fetch racing the first.
        | 'gcash_number'
        | 'gcash_name'
        | 'maya_number'
        | 'bank_name'
        | 'bank_account_name'
        | 'bank_account_number'
      >
    | null;
  order_items: OrderItemRow[];
}

// `brand_accent` rides along so an order can be shown in its shop's own colour.
// Without it the order screen falls back to the id hash, and a laundry that had
// chosen teal would be teal everywhere in the app except on its own orders.
const ORDER_SELECT =
  '*, shop:shops(id, name, brand_accent, gcash_number, gcash_name, maya_number, bank_name, bank_account_name, bank_account_number), order_items(*)';

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

/**
 * Every shop a signed-in customer is allowed to see, joined or not. Backs the
 * Shops tab directory so a customer can find a laundry without scanning its
 * QR code first.
 */
export async function getVisibleShops(): Promise<Shop[]> {
  const result = await supabase
    .from('shops')
    .select('*')
    .order('name', { ascending: true });
  return unwrap(result) as Shop[];
}

/** Registers the signed-in customer with a shop picked from the directory. */
export async function joinShop(shopId: string): Promise<void> {
  const shop = await getShop(shopId);
  await registerWithShop(shop.id, shop.qr_token);
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
  /** Rider pickup / delivery-back schedule for online bookings. */
  pickupAt?: Date | null;
  deliverBy?: Date | null;
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
    p_pickup_at: options.pickupAt?.toISOString() ?? null,
    p_deliver_by: options.deliverBy?.toISOString() ?? null,
  });
  return unwrap(result) as OrderRow;
}

// ── weighing & settlement ────────────────────────────────────────────────
/** How long a signed link to a private order photo stays good. */
const PHOTO_LINK_TTL_SECONDS = 60 * 60;

/**
 * Uploads into the private `order-photos` bucket and returns the storage
 * *path*, not a URL. Unlike `shop-logos`, this bucket is not public: a photo of
 * someone's laundry and a receipt carrying their name are only ever served
 * through a short-lived signed link.
 */
async function uploadOrderPhoto(
  orderId: string,
  kind: 'weigh' | 'proof',
  localUri: string
): Promise<string> {
  const response = await fetch(localUri);
  const body = await response.arrayBuffer();
  const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${orderId}/${kind}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from('order-photos').upload(path, body, {
    contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);

  return path;
}

/** A viewable link for a private order photo, or null when there is none. */
export async function orderPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from('order-photos')
    .createSignedUrl(path, PHOTO_LINK_TTL_SECONDS);
  if (error) throw new Error(error.message);
  return data?.signedUrl ?? null;
}

/**
 * Records what the scale said. The photo is uploaded first so that a failed
 * upload never leaves a repriced order with no evidence behind it.
 *
 * The total is recomputed server-side from the `services` table; the figure the
 * merchant saw while typing is advisory, exactly as the booking estimate is.
 */
export async function weighOrder(
  orderId: string,
  weighed: { serviceId: string; weightKg: number; photoUri?: string | null }
): Promise<OrderRow> {
  const photoPath = weighed.photoUri
    ? await uploadOrderPhoto(orderId, 'weigh', weighed.photoUri)
    : null;

  const result = await supabase.rpc('weigh_order', {
    p_order_id: orderId,
    p_service_id: weighed.serviceId,
    p_weight_kg: weighed.weightKg,
    p_photo_path: photoPath,
  });
  return unwrap(result) as OrderRow;
}

/**
 * The customer's claim that they have sent the money. Deliberately does not
 * mark the order paid — only the shop, looking at their own wallet, can do
 * that via `markOrderPaid`.
 */
export async function submitPaymentProof(
  orderId: string,
  proof: { photoUri: string; reference: string; method: PaymentMethod }
): Promise<OrderRow> {
  const path = await uploadOrderPhoto(orderId, 'proof', proof.photoUri);

  const result = await supabase.rpc('submit_payment_proof', {
    p_order_id: orderId,
    p_path: path,
    p_reference: proof.reference,
    p_method: proof.method,
  });
  return unwrap(result) as OrderRow;
}

/** The rails a shop publishes to customers who are not at the counter. */
export async function setShopPaymentDetails(
  shopId: string,
  details: ShopPaymentDetails
): Promise<Shop> {
  const result = await supabase.rpc('set_shop_payment_details', {
    p_shop_id: shopId,
    p_gcash_number: details.gcash_number,
    p_gcash_name: details.gcash_name,
    p_maya_number: details.maya_number,
    p_bank_name: details.bank_name,
    p_bank_account_name: details.bank_account_name,
    p_bank_account_number: details.bank_account_number,
  });
  return unwrap(result) as Shop;
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

/** Customer picks how they'll pay once the shop confirms the actual price. */
export async function choosePaymentMethod(
  orderId: string,
  method: PaymentMethod
): Promise<OrderRow> {
  const result = await supabase.rpc('choose_payment_method', {
    p_order_id: orderId,
    p_method: method,
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

// ── reviews ──────────────────────────────────────────────────────────────
export async function getShopReviews(shopId: string): Promise<ReviewRow[]> {
  const result = await supabase
    .from('reviews')
    .select('*, reviewer:profiles(full_name)')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })
    .limit(30);
  return unwrap(result) as unknown as ReviewRow[];
}

export async function addReview(review: {
  shopId: string;
  orderId: string;
  rating: number;
  comment: string;
}): Promise<void> {
  const { data } = await supabase.auth.getUser();
  const { error } = await supabase.from('reviews').insert({
    shop_id: review.shopId,
    order_id: review.orderId,
    customer_id: data.user?.id,
    rating: review.rating,
    comment: review.comment.trim(),
  });
  if (error) throw new Error(error.message);
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

// ── shop branding (merchant self-serve) ──────────────────────────────────
/**
 * Uploads a logo the shop chose for itself.
 *
 * Keyed `<shop_id>/<ts>.<ext>`, unlike `uploadShopLogo`'s flat `<slug>-<ts>`:
 * the folder is what the storage policy checks, so one shop's owner cannot
 * overwrite another's logo. The superadmin path keeps its flat keys because a
 * superadmin is already trusted across every shop.
 */
export async function uploadBrandLogo(shopId: string, localUri: string): Promise<string> {
  const response = await fetch(localUri);
  const body = await response.arrayBuffer();
  const extension = localUri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${shopId}/${Date.now()}.${extension}`;

  const { error } = await supabase.storage.from('shop-logos').upload(path, body, {
    contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
    upsert: true,
  });
  if (error) throw new Error(error.message);

  return supabase.storage.from('shop-logos').getPublicUrl(path).data.publicUrl;
}

/**
 * The face the shop shows its customers. A null `logoUrl` leaves the existing
 * logo alone, so saving a colour never wipes a logo uploaded earlier.
 */
export async function setShopBranding(
  shopId: string,
  branding: { accent: number | null; tagline: string; logoUrl?: string | null }
): Promise<Shop> {
  const result = await supabase.rpc('set_shop_branding', {
    p_shop_id: shopId,
    p_brand_accent: branding.accent,
    p_tagline: branding.tagline,
    p_logo_url: branding.logoUrl ?? null,
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
