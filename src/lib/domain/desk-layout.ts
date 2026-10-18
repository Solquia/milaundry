/**
 * The merchant dashboard on a laptop.
 *
 * The app's screens were drawn for a phone, and `web-frame.ts` holds them to a
 * phone-width column in a wide window. A shop owner at a counter laptop or a
 * desk is not holding a phone, though: a 430px strip in the middle of a 1440px
 * screen made them scroll a list that had room to stand side by side. So the
 * merchant dashboard, and only it, takes the window once there is room for a
 * sidebar beside a real working area. Below that it stays the phone column it
 * has always been — a tablet held upright still gets the layout it was tested
 * in.
 */
import { BREAKPOINTS } from '@/lib/domain/web-layout';

/** The narrowest window that gets the desk: a laptop, not a tablet. */
export const DESK_MIN_WIDTH = BREAKPOINTS.laptop;

/** The sidebar's width: wide enough for "New Order" and the shop's name beside an icon. */
export const SIDEBAR_WIDTH = 232;

/**
 * The widest the working area grows. Past this a row of order cards runs so
 * long the eye loses the line between a name and its price, so a large monitor
 * gets margins rather than a stretched list.
 */
export const DESK_MAX_CONTENT_WIDTH = 1240;

export interface DeskLayout {
  /** True when the dashboard draws as a desk: sidebar plus a wide working area. */
  isDesk: boolean;
  /** The width the screens should lay themselves out in. */
  contentWidth: number;
}

export function isDeskWidth(platform: string, width: number): boolean {
  // `>=` on a measured number only: an unmeasured width arrives as 0 or NaN,
  // and the phone layout is the one that fits every window.
  return platform === 'web' && width >= DESK_MIN_WIDTH;
}

export function deskLayout(platform: string, windowWidth: number): DeskLayout {
  if (!isDeskWidth(platform, windowWidth)) {
    return { isDesk: false, contentWidth: windowWidth };
  }
  return {
    isDesk: true,
    contentWidth: Math.min(windowWidth - SIDEBAR_WIDTH, DESK_MAX_CONTENT_WIDTH),
  };
}

/**
 * A form or a settings page read at 1240px is a label at one edge of the
 * monitor and its field at the other. Screens that have not been drawn for
 * the desk keep to this width, which still gives a phone layout some air.
 */
export const DESK_READING_WIDTH = 760;

/**
 * Screens laid out for the desk: they take the whole working area and fill it
 * with columns. Every other screen sits centred at the reading width.
 */
const WIDE_SCREENS: ReadonlySet<string> = new Set(['orders', 'pos', 'customers', 'analytics']);

/** The width one merchant screen is drawn at on the desk. */
export function deskSceneWidth(routeName: string, contentWidth: number): number {
  if (WIDE_SCREENS.has(routeName)) return contentWidth;
  return Math.min(contentWidth, DESK_READING_WIDTH);
}

/**
 * Columns of cards for a list in the working area: one per ~360px, the width
 * an order card was drawn at on a phone, so each card keeps its phone shape.
 */
export function deskColumns(contentWidth: number, minCardWidth = 360, maxColumns = 3): number {
  if (!(contentWidth > 0)) return 1;
  return Math.max(1, Math.min(maxColumns, Math.floor(contentWidth / minCardWidth)));
}

/** A list cut into rows of `columns` items, in reading order. The last row may be short. */
export function chunkRows<T>(items: readonly T[], columns: number): T[][] {
  const size = Math.max(1, Math.floor(columns) || 1);
  const rows: T[][] = [];
  for (let start = 0; start < items.length; start += size) {
    rows.push(items.slice(start, start + size));
  }
  return rows;
}
