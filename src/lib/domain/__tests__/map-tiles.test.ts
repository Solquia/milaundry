import {
  OSM_ATTRIBUTION,
  TILE_SIZE,
  projectToTile,
  tileMosaic,
  tileUrl,
} from '../map-tiles';

const MANILA = { latitude: 14.5995, longitude: 120.9842 };

describe('projectToTile', () => {
  it('puts the prime meridian at the equator in the middle of the world', () => {
    const point = projectToTile({ latitude: 0, longitude: 0 }, 1);
    expect(point.x).toBeCloseTo(1, 6);
    expect(point.y).toBeCloseTo(1, 6);
  });

  it('grows east with longitude and south with falling latitude', () => {
    const west = projectToTile({ latitude: 0, longitude: -90 }, 4);
    const east = projectToTile({ latitude: 0, longitude: 90 }, 4);
    const north = projectToTile({ latitude: 40, longitude: 0 }, 4);
    const south = projectToTile({ latitude: -40, longitude: 0 }, 4);
    expect(east.x).toBeGreaterThan(west.x);
    expect(south.y).toBeGreaterThan(north.y);
  });

  it('clamps past the poles rather than returning infinity', () => {
    const point = projectToTile({ latitude: 89.9999, longitude: 0 }, 3);
    expect(Number.isFinite(point.y)).toBe(true);
    expect(point.y).toBeGreaterThanOrEqual(0);
  });
});

describe('tileUrl', () => {
  it('addresses a Carto Voyager raster tile, not OSM’s volunteer servers', () => {
    expect(tileUrl({ z: 16, x: 3, y: 7 })).toBe(
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/16/3/7.png'
    );
  });

  it('wraps a column that ran off the east edge of the world', () => {
    expect(tileUrl({ z: 2, x: 4, y: 1 })).toBe(
      'https://b.basemaps.cartocdn.com/rastertiles/voyager/2/0/1.png'
    );
    expect(tileUrl({ z: 2, x: -1, y: 1 })).toBe(
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/2/3/1.png'
    );
  });

  it('spreads neighbouring tiles across Carto’s four hosts', () => {
    const hosts = new Set(
      [
        tileUrl({ z: 16, x: 0, y: 0 }),
        tileUrl({ z: 16, x: 1, y: 0 }),
        tileUrl({ z: 16, x: 2, y: 0 }),
        tileUrl({ z: 16, x: 3, y: 0 }),
      ].map((url) => new URL(url).hostname)
    );
    expect(hosts).toEqual(
      new Set([
        'a.basemaps.cartocdn.com',
        'b.basemaps.cartocdn.com',
        'c.basemaps.cartocdn.com',
        'd.basemaps.cartocdn.com',
      ])
    );
  });
});

describe('tileMosaic', () => {
  const mosaic = tileMosaic({ pin: MANILA, zoom: 16, width: 320, height: 200 });

  it('centres the pin in the box it was given', () => {
    expect(mosaic.pin.left).toBeCloseTo(160, 6);
    expect(mosaic.pin.top).toBeCloseTo(100, 6);
  });

  it('covers the whole box with tiles and no gaps', () => {
    const lefts = mosaic.tiles.map((tile) => tile.left);
    const tops = mosaic.tiles.map((tile) => tile.top);
    expect(Math.min(...lefts)).toBeLessThanOrEqual(0);
    expect(Math.min(...tops)).toBeLessThanOrEqual(0);
    expect(Math.max(...lefts) + TILE_SIZE).toBeGreaterThanOrEqual(320);
    expect(Math.max(...tops) + TILE_SIZE).toBeGreaterThanOrEqual(200);
  });

  it('gives every tile a key of its own', () => {
    const keys = new Set(mosaic.tiles.map((tile) => tile.key));
    expect(keys.size).toBe(mosaic.tiles.length);
  });

  it('drops rows above the north pole instead of requesting them', () => {
    const top = tileMosaic({ pin: { latitude: 85, longitude: 0 }, zoom: 2, width: 400, height: 400 });
    expect(top.tiles.every((tile) => tile.y >= 0 && tile.y < 4)).toBe(true);
  });

  it('returns nothing to draw for a box with no area', () => {
    expect(tileMosaic({ pin: MANILA, zoom: 16, width: 0, height: 200 }).tiles).toEqual([]);
  });

  it('credits both the map data and the tile host', () => {
    expect(mosaic.attribution).toBe(OSM_ATTRIBUTION);
    expect(OSM_ATTRIBUTION).toMatch(/OpenStreetMap/);
    expect(OSM_ATTRIBUTION).toMatch(/CARTO/);
  });
});
