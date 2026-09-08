/**
 * Where a shop's own pictures are filed.
 *
 * Branding briefly went to ImageKit along with order photos, and that broke it
 * for any project without an ImageKit account: `imagekit-media` answers
 * `Function is not configured` and no logo or cover can be saved from anywhere,
 * app or web.
 *
 * A shopfront is meant to be looked at, so there is nothing to sign and nothing
 * ImageKit was buying here. Supabase Storage already holds these — the
 * `shop-logos` bucket is public, its policy already lets an owner write to
 * their own shop's folder, and the URLs currently on live shops point at it.
 * Order photos are a different matter and stay on ImageKit: those are private,
 * and the signed-URL logic is the point of them.
 *
 * The shape of the path is not cosmetic. The storage policy reads
 * `storage.foldername(name)[1]` and checks it against a shop the caller may
 * manage, so the shop id has to be the first segment or the database refuses
 * the write. That rule is why this is a tested function and not string
 * concatenation at the call site.
 */

/** The public bucket a shopfront is served from. */
export const SHOP_ASSET_BUCKET = 'shop-logos';

/** The two pictures a shop has of itself. */
export type ShopAssetKind = 'logo' | 'cover';

/**
 * `<shop_id>/<kind>-<timestamp>.<ext>`.
 *
 * The timestamp is what makes a replacement visible. The old URL is already in
 * every image cache between here and the customer's phone, so reusing the name
 * would leave them looking at the picture the shop just changed.
 */
export function shopAssetPath(
  shopId: string,
  kind: ShopAssetKind,
  extension: string,
  now: Date = new Date()
): string {
  return `${shopId}/${kind}-${now.getTime()}.${extension}`;
}
