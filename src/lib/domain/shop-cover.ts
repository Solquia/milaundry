/**
 * The photo of the shop, and the logo on it.
 *
 * The shopfront hero used to be a coloured field: reliable, and the same for
 * every laundry. A photo of the actual storefront is what a customer walking
 * past would recognise, so when a shop has one it takes the whole field. These
 * are the rules for choosing between the two, and for the photo the merchant
 * is allowed to upload.
 */

/** Wide, because the hero is wide; the picker crops to this. */
export const COVER_ASPECT: [number, number] = [16, 9];
/** Enough for a phone screen; well under a megabyte after the crop. */
export const COVER_QUALITY = 0.7;
/** Past this the upload is a mistake (an original, not a crop): refuse early. */
export const MAX_COVER_BYTES = 6 * 1024 * 1024;

export type HeroBackdrop = { kind: 'photo'; uri: string } | { kind: 'field' };

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * What the hero paints behind the shop's name. A photo the merchant has just
 * picked (still a local file) outranks the one already saved, so the preview
 * shows what will be published, not what was.
 */
export function heroBackdrop(
  shop: { cover_url?: string | null },
  pendingUri?: string | null
): HeroBackdrop {
  const uri = nonEmpty(pendingUri) ?? nonEmpty(shop.cover_url);
  return uri ? { kind: 'photo', uri } : { kind: 'field' };
}

/**
 * The shop's logo, or null. The column defaults to '' rather than null, and
 * '' slipped through `if (logoUrl)` checks inconsistently; every surface
 * should make the same image-or-initials decision, so it is made here.
 */
export function shopLogoUri(shop: { logo_url?: string | null }): string | null {
  return nonEmpty(shop.logo_url);
}

/** Whether a picked photo is too large to upload. An unknown size passes. */
export function coverTooLarge(bytes: number | null | undefined): boolean {
  return typeof bytes === 'number' && bytes > MAX_COVER_BYTES;
}
