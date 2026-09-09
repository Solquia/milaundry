/**
 * The connected-shop shortcuts shown on the customer's MiLaundry home tab.
 *
 * A customer's shop list comes back from a join (`customer_shops -> shops`), so
 * it can contain holes and repeats: a deleted shop leaves a null row, and
 * re-scanning a shop's QR code can register the same shop twice. The home tab
 * shows a short preview of that list, newest connection first.
 */

export interface ConnectedShop {
  id: string;
  name: string;
  address?: string | null;
  /** Optional: an unbranded shop simply has not chosen a tone. */
  brand_accent?: number | null;
  /** Optional: '' is the column default for a shop with no logo. */
  logo_url?: string | null;
}

export interface ConnectedShopTile {
  id: string;
  name: string;
  address: string | null;
  /** Up to two letters drawn in the shop avatar when there is no logo. */
  initials: string;
  /**
   * The tone the shop chose, carried through so the home tab and the shopfront
   * agree. Hashing a colour here instead would let one laundry wear two.
   */
  brand_accent: number | null;
  /** The logo the shop uploaded, drawn in place of the initials; null when none. */
  logo_url: string | null;
}

/** How many shops the home tab previews before deferring to the Shops tab. */
export const HOME_SHOP_PREVIEW_LIMIT = 3;

const FALLBACK_NAME = 'Laundry shop';

/** Shared with the shop directory and shop page, so one laundry is one mark. */
export function shopInitials(name: string): string {
  // Callers pass a non-blank name (blank ones become FALLBACK_NAME first).
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/**
 * Builds the home-tab preview of the shops a customer has connected to.
 * Returns the visible tiles plus how many connections are not shown, so the
 * screen can offer a "See all" link only when there is more to see.
 */
export function connectedShopTiles(
  shops: readonly (ConnectedShop | null | undefined)[],
  limit: number = HOME_SHOP_PREVIEW_LIMIT
): { tiles: ConnectedShopTile[]; hiddenCount: number } {
  const seen = new Set<string>();
  const tiles: ConnectedShopTile[] = [];

  for (const shop of shops) {
    if (!shop?.id || seen.has(shop.id)) continue;
    seen.add(shop.id);

    const name = shop.name?.trim() ? shop.name.trim() : FALLBACK_NAME;
    tiles.push({
      id: shop.id,
      name,
      address: shop.address?.trim() ? shop.address.trim() : null,
      initials: shopInitials(name),
      brand_accent: shop.brand_accent ?? null,
      logo_url: shop.logo_url?.trim() ? shop.logo_url.trim() : null,
    });
  }

  return {
    tiles: tiles.slice(0, limit),
    hiddenCount: Math.max(0, tiles.length - limit),
  };
}
