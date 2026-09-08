/**
 * Getting the bytes of a picked image, on whichever platform is asking.
 *
 * Both ways of doing this are wrong on the other platform, which is why this
 * is one shared function rather than a line inside each uploader.
 *
 * On a device: `expo-file-system`'s `File`. `fetch('file://…')` in React
 * Native goes through a polyfill that once returned the 14-byte text
 * "File not found" with a success status, so an upload "succeeded", the order
 * carried a valid-looking path, and the customer's ticket rendered an empty
 * frame with nothing anywhere to say why.
 *
 * In a browser: `fetch`. There is no `file://` and no polyfill — the picker
 * hands back a `blob:` URL, which `File` cannot open at all ("this.validatePath
 * is not a function"). The guard that protects the device is the thing that
 * breaks the web.
 *
 * Either way the caller runs `ensurePhotoBytes` on what comes back.
 */
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { photoReaderFor, resolvePhotoContentType } from './domain/photo-upload';

export interface ReadImage {
  bytes: ArrayBuffer;
  /** What the store should serve the bytes back as. */
  contentType: string;
}

export async function readImage(localUri: string): Promise<ReadImage> {
  if (photoReaderFor(Platform.OS) === 'file-system') {
    return {
      bytes: await new File(localUri).arrayBuffer(),
      contentType: resolvePhotoContentType(localUri),
    };
  }

  const response = await fetch(localUri);
  if (!response.ok) {
    throw new Error('That image could not be read. Please pick it again.');
  }
  const blob = await response.blob();
  return {
    bytes: await blob.arrayBuffer(),
    contentType: resolvePhotoContentType(localUri, blob.type),
  };
}
