/**
 * The laundries this customer has actually used, and the fastest way back in.
 *
 * "Your shops" on the home is every laundry the customer ever connected to,
 * in the order they connected — which is not the order they use them in. The
 * one they send a load to every Saturday can sit fourth behind a shop they
 * scanned once at a mall. Recent shops come from the orders instead, newest
 * first, each carrying last time's booking so one tap starts the next.
 */
import { formatQuantity } from './price-label';
import { rebookDraft, rebookHref, type RebookOrder } from './rebook';

export interface RecentShopOrder extends RebookOrder {
  created_at: string;
  /** Null when the shop is no longer visible to customers (switched off). */
  shop: {
    id: string;
    name: string;
    logo_url: string;
    brand_accent: number | null;
  } | null;
}

export interface RecentShop {
  shopId: string;
  name: string;
  logoUrl: string;
  brandAccent: number | null;
  lastOrderAt: string;
  /** "Wash & Fold · 5 kg" — what one tap would book, or null when nothing can be. */
  lastSummary: string | null;
  /** Straight to a filled booking, or null when there is nothing to rebook. */
  rebookHref: string | null;
}

export const RECENT_SHOP_LIMIT = 3;

function summaryOf(order: RecentShopOrder): string | null {
  const draft = rebookDraft(order);
  if (!draft) return null;
  const name = draft.itemNames[draft.serviceId] ?? 'Laundry';
  return `${name} · ${formatQuantity(draft.serviceUnit, draft.weightKg)}`;
}

export function recentShops(
  orders: readonly RecentShopOrder[],
  limit: number = RECENT_SHOP_LIMIT
): RecentShop[] {
  const newestFirst = [...orders].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const byShop = new Map<string, RecentShop>();

  for (const order of newestFirst) {
    // A shop hidden from customers cannot take a booking; offering it would
    // be offering a dead end.
    if (!order.shop) continue;

    const existing = byShop.get(order.shop_id);
    if (existing?.rebookHref) continue;

    const href = order.status === 'cancelled' ? null : rebookHref(order);
    if (existing) {
      if (href) byShop.set(order.shop_id, { ...existing, rebookHref: href, lastSummary: summaryOf(order) });
      continue;
    }
    byShop.set(order.shop_id, {
      shopId: order.shop_id,
      name: order.shop.name,
      logoUrl: order.shop.logo_url,
      brandAccent: order.shop.brand_accent,
      lastOrderAt: order.created_at,
      lastSummary: href ? summaryOf(order) : null,
      rebookHref: href,
    });
  }

  return [...byShop.values()].slice(0, limit);
}

export type QuickBook =
  | { kind: 'rebook'; href: string; shopName: string; summary: string }
  | { kind: 'shop'; href: string; shopName: string }
  | { kind: 'find'; href: '/(customer)/shops' };

/**
 * The one button on the home that books. Last time's load if there is one,
 * the customer's own laundry if they have never ordered, and the directory if
 * they have neither.
 */
export function quickBookTarget(
  recent: readonly RecentShop[],
  connected: readonly { id: string; name: string }[]
): QuickBook {
  const repeat = recent.find((shop) => shop.rebookHref && shop.lastSummary);
  if (repeat?.rebookHref && repeat.lastSummary) {
    return {
      kind: 'rebook',
      href: repeat.rebookHref,
      shopName: repeat.name,
      summary: repeat.lastSummary,
    };
  }

  const shop = connected[0];
  if (shop) return { kind: 'shop', href: `/(customer)/shop/${shop.id}`, shopName: shop.name };

  return { kind: 'find', href: '/(customer)/shops' };
}
