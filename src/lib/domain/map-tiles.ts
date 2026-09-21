/**
 * A map drawn from tiles, for the surfaces that have no map component.
 *
 * The shop's web page cannot use `expo-maps` — it is a native module — and the
 * platform has no Google Maps key to embed one with. A slippy map is only a
 * grid of 256px pictures laid out by arithmetic, so this module owns that
 * arithmetic: which tiles cover a box centred on a pin, where each one sits
 * in it, and where the pin itself lands. What draws them is `components/shop-map`.
 *
 * The projection is Web Mercator, the same one every slippy map uses, which is
 * why a tile from Carto lines up with a pin placed on Apple Maps.
 *
 * OpenStreetMap's own `tile.openstreetmap.org` servers are for osm.org, not
 * for apps: they answer a production shopfront with a "Access blocked" tile.
 * Carto's Voyager raster CDN is OSM data on hosts that allow this use, and
 * the credit in `OSM_ATTRIBUTION` names both.
 */

import type { ShopPin } from './shop-location';

/** Every tile server in this projection serves 256×256 pictures. */
export const TILE_SIZE = 256;

/** The credit Carto asks: OSM for the data, CARTO for the tiles. */
export const OSM_ATTRIBUTION = '© OpenStreetMap © CARTO';

/** Carto's four Voyager hosts; neighbouring tiles fan out across them. */
const CARTO_HOSTS = ['a', 'b', 'c', 'd'] as const;

/**
 * Mercator runs to infinity at the poles, so the projection is cut where every
 * slippy map cuts it — the latitude whose world is exactly square.
 */
const MAX_LATITUDE = 85.05112878;

export interface TileAddress {
  z: number;
  x: number;
  y: number;
}

export interface PlacedTile extends TileAddress {
  /** Stable across a re-render at the same camera, so pictures are not refetched. */
  key: string;
  /** Where this tile's top-left corner sits inside the box, in pixels. */
  left: number;
  top: number;
}

export interface TileMosaic {
  tiles: readonly PlacedTile[];
  /** Where the pin belongs inside the box, in pixels. */
  pin: { left: number; top: number };
  attribution: string;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * A pin as fractional tile coordinates at this zoom: `{ x: 2.5, y: 1.25 }` is
 * the middle of the top edge of tile (2, 1).
 */
export function projectToTile(pin: ShopPin, zoom: number): { x: number; y: number } {
  const scale = 2 ** zoom;
  const latitude = (clamp(pin.latitude, -MAX_LATITUDE, MAX_LATITUDE) * Math.PI) / 180;
  const x = ((pin.longitude + 180) / 360) * scale;
  const y = ((1 - Math.log(Math.tan(latitude) + 1 / Math.cos(latitude)) / Math.PI) / 2) * scale;
  // Floating point can put the clamped pole a hair outside the world; the
  // caller divides by this, so it is held inside it.
  return { x: clamp(x, 0, scale), y: clamp(y, 0, scale) };
}

/** The picture for one tile. Columns wrap around the world; rows never do. */
export function tileUrl({ z, x, y }: TileAddress): string {
  const span = 2 ** z;
  const column = ((x % span) + span) % span;
  const host = CARTO_HOSTS[(Math.abs(x) + y) % CARTO_HOSTS.length];
  return `https://${host}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${column}/${y}.png`;
}

interface MosaicInput {
  pin: ShopPin;
  zoom: number;
  width: number;
  height: number;
}

/** The tiles that cover a `width × height` box centred on `pin`, already placed. */
export function tileMosaic({ pin, zoom, width, height }: MosaicInput): TileMosaic {
  const centre = projectToTile(pin, zoom);
  const half = { x: width / 2, y: height / 2 };
  const pinPlacement = { left: half.x, top: half.y };

  if (width <= 0 || height <= 0) {
    return { tiles: [], pin: pinPlacement, attribution: OSM_ATTRIBUTION };
  }

  // The world pixel the box's top-left corner is looking at.
  const originX = centre.x * TILE_SIZE - half.x;
  const originY = centre.y * TILE_SIZE - half.y;

  const firstColumn = Math.floor(originX / TILE_SIZE);
  const lastColumn = Math.floor((originX + width - 1) / TILE_SIZE);
  const firstRow = Math.floor(originY / TILE_SIZE);
  const lastRow = Math.floor((originY + height - 1) / TILE_SIZE);
  const rows = 2 ** zoom;

  const tiles: PlacedTile[] = [];
  for (let y = firstRow; y <= lastRow; y += 1) {
    // Above the pole or below it there is no picture to ask for; the field
    // colour behind the mosaic shows through instead.
    if (y < 0 || y >= rows) continue;
    for (let x = firstColumn; x <= lastColumn; x += 1) {
      tiles.push({
        z: zoom,
        x,
        y,
        key: `${zoom}/${x}/${y}`,
        left: x * TILE_SIZE - originX,
        top: y * TILE_SIZE - originY,
      });
    }
  }

  return { tiles, pin: pinPlacement, attribution: OSM_ATTRIBUTION };
}
