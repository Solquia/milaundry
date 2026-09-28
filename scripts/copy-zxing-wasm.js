/**
 * Copies the QR decoder's WebAssembly into public/, so the web build serves it
 * from our own origin. Left alone, the decoder fetches it from a CDN, and a
 * blocked or offline CDN means a photo of a code cannot be read at all.
 *
 * Runs on every install, so the file always matches the installed zxing-wasm.
 */
const fs = require('fs');
const path = require('path');

// npm runs install scripts from the project root.
const root = process.cwd();
const source = path.join(root, 'node_modules', 'zxing-wasm', 'dist', 'reader', 'zxing_reader.wasm');
const target = path.join(root, 'public', 'zxing_reader.wasm');

if (!fs.existsSync(source)) {
  console.warn('copy-zxing-wasm: zxing-wasm is not installed; skipping.');
  process.exit(0);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
