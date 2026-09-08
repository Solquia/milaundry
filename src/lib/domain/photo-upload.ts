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
 * Where the photo is filed is no longer decided here. Since the move to
 * ImageKit the `imagekit-media` Edge Function names every file, so the folder
 * that decides who may reach it is signed into the upload token rather than
 * chosen by whoever is holding the phone. See `domain/imagekit.ts`.
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
export function extensionOf(localUri: string): string {
  const withoutQuery = localUri.split('?')[0];
  const lastSegment = withoutQuery.split('/').pop() ?? '';
  if (!lastSegment.includes('.')) return 'jpg';
  return lastSegment.split('.').pop()!.toLowerCase();
}

/** What the CDN should serve the bytes back as. */
export function photoContentType(localUri: string): string {
  return extensionOf(localUri) === 'png' ? 'image/png' : 'image/jpeg';
}

/** How the bytes come off this platform. */
export type PhotoReader = 'fetch' | 'file-system';

/**
 * Which reader can actually open a picked image here.
 *
 * On a device the answer is `expo-file-system`, and the reason is the 14-byte
 * photo above: `fetch('file://…')` in React Native goes through a polyfill
 * that returned the *string* "File not found" with a 200, so the upload
 * succeeded and the ticket rendered an empty frame.
 *
 * In a browser the hazard is reversed. There is no `file://` and no polyfill —
 * the picker hands back a `blob:` URL, which `fetch` reads natively and
 * `expo-file-system`'s `File` cannot open at all: it throws
 * "this.validatePath is not a function", which is what broke Save branding on
 * the website. The guard that protects the device is the thing that breaks the
 * web, so the platform picks the reader and `ensurePhotoBytes` still checks
 * the result either way.
 */
export function photoReaderFor(platformOS: string): PhotoReader {
  return platformOS === 'web' ? 'fetch' : 'file-system';
}

/**
 * What the CDN should serve the bytes back as, given what the browser said.
 *
 * `photoContentType` reads the extension, and a `blob:` URL has none — every
 * picked image on the web would be filed as a JPEG, PNG screenshots included.
 * The Blob knows its own type, so it wins when it is actually an image type;
 * browsers that answer `application/octet-stream` or an empty string are
 * ignored in favour of the extension rule, which is at least a guess made from
 * something.
 */
export function resolvePhotoContentType(localUri: string, blobType?: string): string {
  if (blobType && blobType.startsWith('image/')) return blobType;
  return photoContentType(localUri);
}
