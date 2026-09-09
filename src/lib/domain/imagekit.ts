/**
 * Where the app's pictures live: ImageKit, not Supabase Storage.
 *
 * Two kinds of image pass through here and they are not alike. A shop's logo
 * and the photo behind its name are meant to be seen by anyone who opens the
 * shopfront, so they upload as public files and the shop row keeps the plain
 * CDN URL. A photo of someone's laundry on the scale, and a GCash receipt
 * carrying their name and reference number, are not public objects — those
 * upload as ImageKit *private files*, the order keeps only the path, and every
 * view goes through a short-lived signed URL.
 *
 * Nothing in this module holds a credential or decides who may upload. The app
 * asks the `imagekit-media` Edge Function for a one-use token; that function is
 * the only place the ImageKit private key exists, and it derives the folder and
 * the file name itself from the shop or order it has just authorized. What is
 * left here is the wire shape between the two, which is worth having pure and
 * worth having tested, because an upload field that disagrees with the token by
 * one character is rejected whole.
 */

import type { PhotoKind } from './photo-upload';

/**
 * The v2 upload API, deliberately, even though v1 is the better-trodden path.
 *
 * A v1 signature covers only a token and an expiry, so any signed-in caller who
 * asked for upload credentials could then have written anywhere in the account
 * — including over another shop's logo. v2 signs the whole payload: the folder
 * and file name the server chose are inside the token, and an upload that moves
 * them is refused by ImageKit rather than by us.
 */
export const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v2/files/upload';

/** What is being uploaded, and for whom. */
export type ImageTarget =
  | { purpose: 'shop'; shopId: string; kind: 'logo' | 'cover' }
  | { purpose: 'order'; orderId: string; kind: PhotoKind };

/** The body the app sends to `imagekit-media` to ask for an upload token. */
export function uploadTokenRequest(
  target: ImageTarget,
  extension: string
): Record<string, string> {
  const owner: Record<string, string> =
    target.purpose === 'shop'
      ? { shop_id: target.shopId }
      : { order_id: target.orderId };
  return {
    action: 'upload-token',
    purpose: target.purpose,
    kind: target.kind,
    extension: extension.toLowerCase(),
    ...owner,
  };
}

/** A token, and the exact parameters it was signed over. */
export interface UploadCredentials {
  token: string;
  uploadPayload: Record<string, string>;
}

/** Reads the function's answer, or says plainly that it could not. */
export function parseUploadCredentials(data: unknown): UploadCredentials {
  const body = data as { token?: unknown; upload_payload?: unknown } | null;
  const payload = body?.upload_payload;
  if (
    typeof body?.token !== 'string' ||
    !body.token ||
    typeof payload !== 'object' ||
    payload === null
  ) {
    throw new Error('That image could not be uploaded. Please try again.');
  }
  return { token: body.token, uploadPayload: payload as Record<string, string> };
}

/**
 * Every field of the multipart upload except the file itself.
 *
 * The signed payload is echoed verbatim and in full: ImageKit compares the
 * fields it receives against the ones inside the token, and a missing or
 * renamed field fails the upload rather than quietly ignoring it.
 */
export function uploadFormFields(credentials: UploadCredentials): [string, string][] {
  return [...Object.entries(credentials.uploadPayload), ['token', credentials.token]];
}

/** What ImageKit says about a file it has just stored. */
export interface UploadedImage {
  url: string;
  filePath: string;
}

/** Reads the upload response, insisting on both halves of it. */
export function parseUploadResponse(data: unknown): UploadedImage {
  const body = data as { url?: unknown; filePath?: unknown } | null;
  if (typeof body?.url !== 'string' || typeof body?.filePath !== 'string') {
    throw new Error('That image could not be uploaded. Please try again.');
  }
  return { url: body.url, filePath: body.filePath };
}

/**
 * Whether a stored order-photo reference is an ImageKit file path.
 *
 * Orders taken before the move carry a Supabase object key, `<order_id>/<file>`
 * with no leading slash; ImageKit reports its paths with one. That single
 * character is the whole discriminator, which is why it is tested: last week's
 * orders must keep showing their evidence.
 */
export function isImagekitFilePath(stored: string): boolean {
  return stored.startsWith('/');
}

/**
 * The order an ImageKit photo path belongs to, or null if it belongs to none.
 *
 * The path carries its own owner, so asking for a signed link needs nothing but
 * the path. The Edge Function reads it back out the same way and then checks
 * that the caller may see that order — a caller can therefore only ever get a
 * signature over a photo of an order they could already read.
 */
export function orderIdOfImagePath(filePath: string): string | null {
  return /^\/orders\/([^/]+)\/[^/]+$/.exec(filePath)?.[1] ?? null;
}
