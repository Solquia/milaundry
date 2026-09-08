/**
 * How a code gets into the app when there is no camera to point.
 *
 * The browser cannot read a QR code: the camera opens, but nothing decodes
 * what it sees. The code is a web link printed under the square, so on the
 * web the person types or pastes that link instead, and the same parser the
 * camera feeds takes it from there.
 */
import { type QrPayload, parseQrPayload } from './qr';

export type ScanEntryMode = 'camera' | 'typed';

export function scanEntryMode(platform: string): ScanEntryMode {
  return platform === 'web' ? 'typed' : 'camera';
}

export function parseTypedCode(raw: string): QrPayload | null {
  return parseQrPayload(raw.trim());
}

export function typedCodeCopy() {
  return {
    title: 'Enter your code',
    hint: 'The link is printed under the square on your receipt or the card at the counter.',
    placeholder: 'https://milaundry.app/…',
    submit: 'Continue',
    invalid: 'That is not a MiLaundry code. Check the link under the square and try again.',
  };
}
