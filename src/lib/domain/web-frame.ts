/**
 * How the app sits in a browser window.
 *
 * The screens are drawn for a phone. Stretched across a desktop window the
 * buttons ran the full width of the monitor and the tab bar's icons sat a
 * metre apart. On the web the app is held to a phone-width column in the
 * middle of the window instead, on the same deep navy the splash opens on,
 * so it looks like the app and not like a stretched copy of it. A narrow
 * window — a phone's browser — is left alone.
 */

export const FRAME_MAX_WIDTH = 480;

export interface FrameLayout {
  isFramed: boolean;
  width: number;
}

export function frameLayout(input: { platform: string; viewportWidth: number }): FrameLayout {
  if (input.platform !== 'web' || input.viewportWidth <= FRAME_MAX_WIDTH) {
    return { isFramed: false, width: input.viewportWidth };
  }
  return { isFramed: true, width: FRAME_MAX_WIDTH };
}
