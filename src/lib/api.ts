import { isImagekitFilePath } from './domain/imagekit';
import { STAFF_ONLY_ROLE } from './domain/staff-invite';
import type { OrderStatus } from './domain/order-status';
import type { PhotoKind } from './domain/photo-upload';
import { signedOrderPhotoUrl, uploadImage } from './imagekit';
import type { ShopPin as ShopLocationPin } from './domain/shop-location';
import type { ShopPaymentDetails } from './domain/shop-payment';
import type { NewShopAccount, ShopAccountRole } from './domain/shop-account';
import type { StarterService } from './domain/service-catalog';
import type { Fulfillment, PaymentMethod } from './domain/walk-in-order';
import { parseGuestSessionResponse } from './domain/guest-identity';
import { phoneToAuthEmail } from './domain/phone-email';
import type { ShopFormValues } from './domain/shop-form';
import type { QrPayloadType } from './domain/qr';
import type { ScannedShop } from './domain/welcome-flow';
import { supabase } from './supabase';
import { clearPasswordPending, markPasswordPending } from './web-guest-state';
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
  Storefront,
} from './types';

export interface OrderWithDetails extends OrderRow {
  shop:
    | Pick<
        Shop,
        | 'id'
        | 'name'
        | 'slug'
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
  '*, shop:shops(id, name, slug, brand_accent, gcash_number, gcash_name, maya_number, bank_name, bank_account_name, bank_account_number), order_items(*)';

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

/** One shop the signed-in merchant belongs to, with their role inside it. */
export interface ShopMembership {
  role: ShopAccountRole;
  shop: Shop;
}

export async function getMyShopMemberships(): Promise<ShopMembership[]> {
  // The membership policy lets a member read every membership of their shop
  // (the owner console lists them), so without this filter a staff login
  // could read the owner's row first and be dressed as an owner in the app.
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const result = await supabase
    .from('shop_members')
    .select('role, shop:shops(*)')
    .eq('profile_id', auth.user.id);
  return unwrap(result).map((row: any) => ({ role: row.role, shop: row.shop as Shop }));
}

export async function getMyMerchantShops(): Promise<Shop[]> {
  return (await getMyShopMemberships()).map((membership) => membership.shop);
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
/** How long a signed link to an order photo left in the old bucket stays good. */
const PHOTO_LINK_TTL_SECONDS = 60 * 60;

/**
 * Uploads an order photo to ImageKit and returns its *path*, not a URL. Unlike
 * a shop's logo these go up as private files: a photo of someone's laundry and
 * a receipt carrying their name are only ever served through a short-lived
 * signed link. See `lib/imagekit.ts`.
 */
async function uploadOrderPhoto(
  orderId: string,
  kind: PhotoKind,
  localUri: string
): Promise<string> {
  const { filePath } = await uploadImage({ purpose: 'order', orderId, kind }, localUri);
  return filePath;
}

/**
 * A viewable link for a private order photo, or null when there is none.
 *
 * Orders taken before the move to ImageKit carry a Supabase object key and are
 * still signed by Storage; there is no migration and none is needed, because
 * the two path shapes tell themselves apart.
 */
export async function orderPhotoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  if (isImagekitFilePath(path)) return signedOrderPhotoUrl(path);

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
/**
 * What a code points at, for someone who is not signed in yet. Token-gated on
 * the server, so a guest learns a laundry's name only from the code printed at
 * its counter. Resolves to null for a code the server would refuse later — an
 * inactive shop, a wrong token, an order already claimed — so the welcome can
 * say so before asking anyone to create an account.
 */
export async function peekScan(
  type: QrPayloadType,
  id: string,
  token: string
): Promise<ScannedShop | null> {
  const { data, error } = await supabase.rpc('peek_scan', {
    p_type: type,
    p_id: id,
    p_token: token,
  });
  if (error) throw new Error(error.message);
  const row = (data as ScannedShop[] | null)?.[0];
  return row ?? null;
}

export async function registerWithShop(shopId: string, token: string): Promise<void> {
  const { error } = await supabase.rpc('register_with_shop', {
    p_shop_id: shopId,
    p_token: token,
  });
  if (error) throw new Error(error.message);
}

/**
 * A session for someone who typed only a name and a number on a shop's web
 * page. Resolves to 'signed-in' with a session in hand, or 'needs-password'
 * when the number already has an account, in which case the caller asks for
 * the password and uses signInGuest. See supabase/functions/web-guest-session.
 */
export async function startGuestSession(
  phone: string,
  fullName: string
): Promise<'signed-in' | 'needs-password'> {
  const { data, error } = await supabase.functions.invoke('web-guest-session', {
    body: { phone, full_name: fullName },
  });
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }

  const answer = parseGuestSessionResponse(data);
  if (answer.kind === 'needs-password') return 'needs-password';

  const verified = await supabase.auth.verifyOtp({
    token_hash: answer.tokenHash,
    type: 'magiclink',
  });
  if (verified.error) throw new Error(verified.error.message);
  markPasswordPending();
  return 'signed-in';
}

/** The password path for a number that already has an account. */
export async function signInGuest(phone: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: phoneToAuthEmail(phone),
    password,
  });
  if (error) throw new Error(error.message);
}

/** Gives a guest account a password it can use in the app. */
export async function setOwnPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
  clearPasswordPending();
}

/**
 * Connects the signed-in customer to the shop whose web page they are on.
 * Idempotent, and refused for a shop that is inactive or off the web.
 */
export async function registerWithShopBySlug(slug: string): Promise<string> {
  const result = await supabase.rpc('register_with_shop_by_slug', { p_slug: slug });
  return unwrap(result) as string;
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

// ── shop branding ────────────────────────────────────────────────────────
/**
 * Uploads a shop's logo, whether the shop chose it or a superadmin did.
 *
 * There used to be two of these, because the two wrote different keys into the
 * bucket and only one of the key shapes could be policed. ImageKit files both
 * under `/shops/<shop_id>`, and the folder is signed into the upload token, so
 * one shop's owner still cannot overwrite another's logo — and a superadmin
 * passes the same check. One function is now enough.
 */
export function uploadBrandLogo(shopId: string, localUri: string): Promise<string> {
  return uploadShopAsset(shopId, localUri, 'logo');
}

/**
 * Uploads the photo of the shop itself, the one behind its name on the
 * shopfront. Same folder as the logo, so the same policy covers it.
 */
export function uploadShopCover(shopId: string, localUri: string): Promise<string> {
  return uploadShopAsset(shopId, localUri, 'cover');
}

/**
 * One shop image into ImageKit, filed `/shops/<shop_id>/<kind>-<ts>.<ext>` and
 * public — a shopfront is meant to be looked at. A fresh name per upload means
 * a fresh URL, so no image cache anywhere can keep showing the old picture.
 *
 * Shops branded before the move keep their Supabase URL in the same column and
 * go on being served from there; the row holds a whole URL, so nothing has to
 * know which of the two it came from.
 */
async function uploadShopAsset(
  shopId: string,
  localUri: string,
  kind: 'logo' | 'cover'
): Promise<string> {
  const { url } = await uploadImage({ purpose: 'shop', shopId, kind }, localUri);
  return url;
}

/**
 * The face the shop shows its customers. A null `logoUrl` or `coverUrl` leaves
 * the existing image alone, so saving a colour never wipes a photo uploaded
 * earlier.
 */
export async function setShopBranding(
  shopId: string,
  branding: {
    accent: number | null;
    tagline: string;
    logoUrl?: string | null;
    coverUrl?: string | null;
  }
): Promise<Shop> {
  const result = await supabase.rpc('set_shop_branding', {
    p_shop_id: shopId,
    p_brand_accent: branding.accent,
    p_tagline: branding.tagline,
    p_logo_url: branding.logoUrl ?? null,
    p_cover_url: branding.coverUrl ?? null,
  });
  return unwrap(result) as Shop;
}

/**
 * Where the shop is on the map. Unlike branding, null here means "remove the
 * pin": clearing a wrong pin is a real thing a shop needs to do.
 */
export async function setShopLocation(
  shopId: string,
  pin: ShopLocationPin | null
): Promise<Shop> {
  const result = await supabase.rpc('set_shop_location', {
    p_shop_id: shopId,
    p_latitude: pin?.latitude ?? null,
    p_longitude: pin?.longitude ?? null,
  });
  return unwrap(result) as Shop;
}

/**
 * The shop's public web page, or null when there is no such page: an unknown
 * slug, an inactive shop, and a shop that switched its page off all answer
 * the same way, so the page cannot be used to tell them apart.
 */
export async function getStorefront(slug: string): Promise<Storefront | null> {
  const { data, error } = await supabase.rpc('get_storefront', { p_slug: slug });
  if (error) throw new Error(error.message);
  return (data as Storefront | null) ?? null;
}

/** Turns the shop's public web page on or off. */
export async function setShopWebEnabled(shopId: string, isEnabled: boolean): Promise<Shop> {
  const result = await supabase.rpc('set_shop_web_enabled', {
    p_shop_id: shopId,
    p_enabled: isEnabled,
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
 * An owner cutting a key for their own counter.
 *
 * Same Edge Function as the superadmin path — creating an auth user needs the
 * service_role key either way — but there is no role to choose. The function
 * refuses anything but staff from a merchant caller, and
 * owner_attach_shop_staff (0022) takes no role argument at all.
 */
export async function createShopStaff(
  shopId: string,
  account: { fullName: string; phone: string; password: string }
): Promise<void> {
  const { data, error } = await supabase.functions.invoke('admin-create-shop-account', {
    body: {
      shop_id: shopId,
      full_name: account.fullName,
      phone: account.phone,
      password: account.password,
      role: STAFF_ONLY_ROLE,
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
