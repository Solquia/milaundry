/**
 * Getting a picture off the phone and into ImageKit.
 *
 * Three steps, and the middle one is the point: the app asks the
 * `imagekit-media` Edge Function for a one-use upload token, and that function
 * — the only holder of the ImageKit private key — decides the folder and the
 * file name and signs them into the token. The app then posts the bytes with
 * exactly those fields. It cannot upload anywhere it was not sent.
 *
 * The read is guarded and platform-specific, because both ways of doing it are
 * wrong on the other platform. On a device it uses `expo-file-system`'s
 * `File`: `fetch(file://…)` goes through a polyfill that once returned the
 * 14-byte text "File not found" instead of a photo, so the upload "succeeded",
 * the order carried a valid-looking path, and the customer's ticket rendered an
 * empty frame with nothing anywhere to say why. In a browser it uses `fetch`,
 * because the picker hands back a `blob:` URL that `File` cannot open at all.
 * Either way `ensurePhotoBytes` checks what came back. See
 * `domain/photo-upload.ts`.
 */

import { Platform } from 'react-native';

import {
  IMAGEKIT_UPLOAD_URL,
  parseUploadCredentials,
  parseUploadResponse,
  uploadFormFields,
  uploadTokenRequest,
  type ImageTarget,
  type UploadedImage,
} from './domain/imagekit';
import { ensurePhotoBytes, extensionOf } from './domain/photo-upload';
import { readImage } from './read-image';
import { supabase } from './supabase';

/** Uploads one image and reports where it landed. */
export async function uploadImage(
  target: ImageTarget,
  localUri: string
): Promise<UploadedImage> {
  const { bytes, contentType } = await readImage(localUri);
  ensurePhotoBytes(bytes.byteLength);

  const credentials = parseUploadCredentials(
    await callImagekitMedia(uploadTokenRequest(target, extensionOf(localUri)))
  );

  const form = new FormData();
  for (const [name, value] of uploadFormFields(credentials)) {
    form.append(name, value);
  }

  // The file part is named for the token's fileName so nothing downstream can
  // infer a different one from the multipart part itself.
  //
  // How the bytes get attached differs by platform, and not for tidiness:
  // React Native's Blob cannot be built from an ArrayBuffer — it accepts only
  // strings and other Blobs, and quietly stringifies anything else. That is the
  // same shape of failure as the 14-byte photo, so on a device the file is
  // handed to the native networking layer by uri and it streams it itself. The
  // read above still happens, because it is what makes an unreadable file loud.
  const fileName = credentials.uploadPayload.fileName;
  if (Platform.OS === 'web') {
    form.append('file', new Blob([bytes], { type: contentType }), fileName);
  } else {
    form.append('file', {
      uri: localUri,
      name: fileName,
      type: contentType,
    } as unknown as Blob);
  }

  const response = await fetch(IMAGEKIT_UPLOAD_URL, { method: 'POST', body: form });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      typeof body?.message === 'string'
        ? body.message
        : 'That image could not be uploaded. Please try again.'
    );
  }
  return parseUploadResponse(body);
}

/**
 * A viewable link for a private order photo. Signed by the Edge Function, good
 * for an hour, and refused outright unless the caller may see the order — which
 * the function works out from the path itself, since a photo's path names the
 * order it belongs to.
 */
export async function signedOrderPhotoUrl(filePath: string): Promise<string> {
  const body = (await callImagekitMedia({
    action: 'view-url',
    file_path: filePath,
  })) as { url?: unknown } | null;
  if (typeof body?.url !== 'string') {
    throw new Error('That photo could not be opened.');
  }
  return body.url;
}

/**
 * One call to the function, with its error body preferred over the generic
 * message `functions.invoke` produces for any non-2xx.
 */
async function callImagekitMedia(body: Record<string, string>): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('imagekit-media', { body });
  if (error) {
    const detail = await readFunctionError(error);
    throw new Error(detail ?? error.message);
  }
  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error(String((data as { error: unknown }).error));
  }
  return data;
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
