/**
 * The rules for getting a photo off the phone and into storage intact.
 *
 * These exist because a photo once uploaded as *fourteen bytes*. The read had
 * silently returned a stub, `upload()` reported success, the order carried a
 * valid-looking path, and the customer's ticket rendered an empty frame with
 * nothing anywhere to say why. A photo that fails to upload has to fail
 * loudly — the merchant is standing at the counter and can simply retake it,
 * but only if somebody tells them.
 *
 * The object key matters as much as the bytes: both storage policies on
 * `order-photos` match on the first path segment being the order id, so a
 * photo filed anywhere else is unreadable by the shop and the customer alike.
 */

/**
 * Below this, it is not a photo.
 *
 * The smallest plausible camera JPEG is tens of kilobytes; even a heavily
 * recompressed thumbnail clears a kilobyte. The failed read that prompted this
 * produced 14 bytes, so the threshold only has to separate "a file" from
 * "nothing at all" — set low deliberately, to reject the broken case without
 * ever second-guessing a real picture.
 */
export const MIN_PHOTO_BYTES = 1024;

export type PhotoKind = 'weigh' | 'proof';

/** Throws unless the body read off the device is actually a photograph. */
export function ensurePhotoBytes(byteLength: number): void {
  if (byteLength < MIN_PHOTO_BYTES) {
    throw new Error(
      'That photo could not be read from this device. Please take it again.'
    );
  }
}

/** The file extension, lowercased, with any picker query-string discarded. */
function extensionOf(localUri: string): string {
  const withoutQuery = localUri.split('?')[0];
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  if (!lastSegment.includes('.')) return 'jpg';
  return lastSegment.split('.').pop()!.toLowerCase();
}

/** What the bucket should serve the bytes back as. */
export function photoContentType(localUri: string): string {
  return extensionOf(localUri) === 'png' ? 'image/png' : 'image/jpeg';
}

/**
 * Where the photo lives: `<orderId>/<kind>-<stamp>.<ext>`.
 *
 * The timestamp is passed in rather than read here, so the caller owns the
 * clock and this stays a pure function. It also means a reweighing never
 * overwrites the photo that justified the previous price.
 */
export function photoObjectPath(
  orderId: string,
  kind: PhotoKind,
  localUri: string,
  stamp: number
): string {
  return `${orderId}/${kind}-${stamp}.${extensionOf(localUri)}`;
}
