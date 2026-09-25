/**
 * The parts of the browser page the app does not draw.
 *
 * A shop's page is served as a single HTML document — `web.output: "single"`,
 * rewritten to `/` by `vercel.json` — and Expo Router's `+html.tsx` only shapes
 * that document for the static and server outputs. So the two things the
 * document has to say are said from here instead, once, on the web only:
 *
 *   the contract with a phone — full-bleed under a notch, and free to zoom;
 *   the surfaces the browser owns — selection, caret, scrollbar, focus ring.
 *
 * Those last four ship with defaults that belong to no design system: a
 * Windows-grey scrollbar beside a navy page, a black caret in a blue field.
 * They are the cheapest thing to claim and the easiest to leave lying around.
 */
import { Platform } from 'react-native';

import { FONT } from './domain/design-scale';

/** The deep navy the splash opens on, and the field around the phone column. */
const BACKDROP = '#04203F';
/** Blue at rule-mark weight, and blue as a filled action. From `ui-kit`. */
const RULE = '#B6D4F2';
const ACTION = '#1370CE';
const INK = '#0B1B2B';

const STYLE_ID = 'milaundry-document';

/**
 * `viewport-fit=cover` lets the hero paint under a notch and the foot bar pay
 * the inset back with `env(safe-area-inset-bottom)`. No `maximum-scale` and no
 * `user-scalable=no`: Expo's default forbids pinch-zoom, and a price list is
 * exactly the kind of page someone with low vision zooms into.
 */
const VIEWPORT = 'width=device-width, initial-scale=1, viewport-fit=cover';

/**
 * The peso sign, borrowed.
 *
 * Figtree ships no ₱ (U+20B1) in any cut. A phone falls back to its system
 * sans on its own, but a browser falls back to its *default* face, which is a
 * serif — so every price on the web wore a Times peso beside Figtree digits.
 * A second face under each Figtree family name, limited to that one code
 * point, hands the sign to a local sans of about the same weight instead.
 */
const PESO_FACES: Record<string, readonly string[]> = {
  [FONT.regular]: ['Segoe UI', 'SegoeUI', 'Roboto', 'Helvetica Neue', 'Arial'],
  [FONT.medium]: ['Segoe UI Semibold', 'SegoeUI-Semibold', 'Roboto Medium', 'Roboto', 'Arial'],
  [FONT.semibold]: ['Segoe UI Semibold', 'SegoeUI-Semibold', 'Roboto Medium', 'Arial'],
  [FONT.bold]: ['Segoe UI Bold', 'SegoeUI-Bold', 'Roboto Bold', 'Roboto-Bold', 'Arial Bold'],
  [FONT.extrabold]: ['Segoe UI Black', 'SegoeUI-Black', 'Segoe UI Bold', 'Roboto Black', 'Arial Black'],
};

const PESO_STYLE = Object.entries(PESO_FACES)
  .map(
    ([family, locals]) =>
      `@font-face { font-family: '${family}'; src: ${locals
        .map((name) => `local('${name}')`)
        .join(', ')}; unicode-range: U+20B1; }`
  )
  .join('\n');

const DOCUMENT_STYLE = `
${PESO_STYLE}
html, body, #root { height: 100%; }
body {
  background-color: ${BACKDROP};
  overscroll-behavior-y: none;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  /* Safari on iOS inflates text when a phone is turned sideways. The layout is
     built for the width it asked for; let it have that width. */
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
/* The shop map's basemap. A residential street at this zoom is almost all
   pale grey, so the tiles are saturated here before shop-map washes them
   in the shop's own colour — parks go green and roofs go warm, and the wash
   then reads as a tint over a living street rather than paint over a
   diagram. A style prop cannot carry this: React Native Web drops filter
   from a style object, so the element marks itself and the sheet paints it. */
/* A card that rises to meet the pointer. Transform and shadow only, so the
   whole thing stays on the compositor; a card that animated its own height
   would reflow the column under it on every mouse move. Touch devices never
   fire hover, and the reduced-motion block below removes the travel. */
[data-lift] {
  transition: transform 180ms cubic-bezier(0.2, 0.7, 0.3, 1), box-shadow 180ms ease;
  will-change: transform;
}
[data-lift]:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 32px rgba(11, 27, 43, 0.15);
}
@media (prefers-reduced-motion: reduce) {
  [data-lift]:hover { transform: none; }
}
[data-maptiles] { filter: saturate(1.45) contrast(1.08) brightness(1.03); }
::selection { background-color: ${RULE}; color: ${INK}; }
:focus-visible { outline: 2px solid ${ACTION}; outline-offset: 2px; border-radius: 6px; }
input, textarea { caret-color: ${ACTION}; }
* { scrollbar-color: ${RULE} transparent; scrollbar-width: thin; }
::-webkit-scrollbar { width: 10px; height: 10px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb {
  background-color: ${RULE};
  border: 3px solid transparent;
  background-clip: content-box;
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover { background-color: ${ACTION}; background-clip: content-box; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

/** The named meta tag, created if the document does not already carry one. */
function meta(name: string, content: string): void {
  const existing = document.querySelector(`meta[name="${name}"]`);
  const tag = existing ?? document.head.appendChild(document.createElement('meta'));
  if (!existing) tag.setAttribute('name', name);
  tag.setAttribute('content', content);
}

/**
 * Called once, module-side, from the root layout. Off the web — and in a test
 * with no document — it does nothing at all.
 */
export function claimWebDocument(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  // Running twice would stack duplicate sheets over a fast refresh.
  if (document.getElementById(STYLE_ID)) return;

  meta('viewport', VIEWPORT);
  // The browser chrome on Android and iOS takes the colour the app opens on.
  meta('theme-color', BACKDROP);

  const sheet = document.createElement('style');
  sheet.id = STYLE_ID;
  sheet.textContent = DOCUMENT_STYLE;
  document.head.appendChild(sheet);
}
