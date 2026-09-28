/**
 * How a code gets into the app when there is no camera to point.
 *
 * The browser cannot read a QR code: the camera opens, but nothing decodes
 * what it sees. The code is a web link printed under the square, so on the
 * web the person types or pastes that link instead, and the same parser the
 * camera feeds takes it from there.
 *
 * Or, on any platform, they upload a photo or screenshot of the code — a
 * receipt photographed once, a code a friend sent — and it is decoded from the
 * image instead of held up to a live camera.
 */
import { type QrPayload, parseQrPayload, parseTagCode } from './qr';

export type ScanEntryMode = 'camera' | 'typed';

export function scanEntryMode(platform: string): ScanEntryMode {
  return platform === 'web' ? 'typed' : 'camera';
}

export function parseTypedCode(raw: string): QrPayload | null {
  return parseQrPayload(raw.trim());
}

/**
 * The code to act on from a photo of it. A snapshot of a counter can catch a
 * second code (a menu, a Wi-Fi card), so ours wins; a foreign one is still
 * handed back so the caller can say it is not ours rather than "no code".
 */
export function codeFromPhoto(results: readonly { data: string }[]): string | null {
  const codes = results.map((r) => r.data.trim()).filter((data) => data.length > 0);
  const isOurs = (data: string) => parseQrPayload(data) !== null || parseTagCode(data) !== null;
  return codes.find(isOurs) ?? codes[0] ?? null;
}

export function photoCodeCopy() {
  return {
    action: 'Upload a photo of the code',
    busy: 'Reading the photo…',
    none: 'No code found in that photo. Try a closer, sharper shot of the square.',
    unreadable: 'That photo could not be opened. Try another one.',
  };
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
