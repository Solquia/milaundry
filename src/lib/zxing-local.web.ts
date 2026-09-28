import { setZXingModuleOverrides } from 'barcode-detector/ponyfill';

let isConfigured = false;

/**
 * Points the browser's QR decoder at the WebAssembly we serve ourselves
 * (copied into public/ on install) instead of the CDN it fetches by default.
 * The same module instance backs expo-camera's scanFromURLAsync on web.
 */
export function configureQrDecoder(): void {
  if (isConfigured) return;
  isConfigured = true;
  setZXingModuleOverrides({
    locateFile: (file: string, prefix: string) => (file.endsWith('.wasm') ? `/${file}` : prefix + file),
  });
}
