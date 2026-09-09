import {
  HOME_SHOP_PREVIEW_LIMIT,
  connectedShopTiles,
  type ConnectedShop,
} from '../connected-shops';

const sparkle: ConnectedShop = {
  id: 'shop-1',
  name: 'SparkleWash Laundry',
  address: '12 Mabini St',
};

const bubbles: ConnectedShop = { id: 'shop-2', name: 'Bubbles', address: null };

describe('connectedShopTiles branding', () => {
  it('carries a tone the shop chose through to the home tab', () => {
    // Without this the home tab would hash its own colour and disagree with
    // the shopfront the customer taps into — one shop wearing two colours.
    const { tiles } = connectedShopTiles([{ ...sparkle, brand_accent: 4 }]);

    expect(tiles[0].brand_accent).toBe(4);
  });

  it('reports no choice as null rather than dropping the field', () => {
    expect(connectedShopTiles([bubbles]).tiles[0].brand_accent).toBeNull();
  });

  it('keeps a chosen zero, which is a real colour', () => {
    const { tiles } = connectedShopTiles([{ ...sparkle, brand_accent: 0 }]);

    expect(tiles[0].brand_accent).toBe(0);
  });
});

describe('connectedShopTiles logo', () => {
  it('carries the logo the shop uploaded through to the home tab', () => {
    // The merchant's logo used to stop at the merchant app: every customer
    // surface drew initials and threw the URL away.
    const { tiles } = connectedShopTiles([{ ...sparkle, logo_url: 'https://cdn/logo.png' }]);

    expect(tiles[0].logo_url).toBe('https://cdn/logo.png');
  });

  it('reports the empty string the database defaults to as null', () => {
    expect(connectedShopTiles([{ ...sparkle, logo_url: '' }]).tiles[0].logo_url).toBeNull();
    expect(connectedShopTiles([bubbles]).tiles[0].logo_url).toBeNull();
  });
});

describe('connectedShopTiles', () => {
  it('shows a shop on the home tab as soon as the customer connects to it', () => {
    const { tiles } = connectedShopTiles([sparkle]);

    expect(tiles).toEqual([
      {
        id: 'shop-1',
        name: 'SparkleWash Laundry',
        address: '12 Mabini St',
        initials: 'SL',
        brand_accent: null,
        logo_url: null,
      },
    ]);
  });

  it('keeps the newest connection first, as the API returns it', () => {
    const { tiles } = connectedShopTiles([bubbles, sparkle]);

    expect(tiles.map((tile) => tile.id)).toEqual(['shop-2', 'shop-1']);
  });

  it('shows a shop once even when its QR code was scanned twice', () => {
    const { tiles, hiddenCount } = connectedShopTiles([sparkle, sparkle]);

    expect(tiles).toHaveLength(1);
    expect(hiddenCount).toBe(0);
  });

  it('skips rows whose shop was deleted rather than rendering a blank card', () => {
    const { tiles } = connectedShopTiles([null, sparkle, undefined]);

    expect(tiles.map((tile) => tile.id)).toEqual(['shop-1']);
  });

  it('previews a few shops and reports the rest for the "See all" link', () => {
    const many = Array.from({ length: 5 }, (_, index) => ({
      id: `shop-${index}`,
      name: `Shop ${index}`,
    }));

    const { tiles, hiddenCount } = connectedShopTiles(many);

    expect(tiles).toHaveLength(HOME_SHOP_PREVIEW_LIMIT);
    expect(hiddenCount).toBe(5 - HOME_SHOP_PREVIEW_LIMIT);
  });

  it('reports nothing hidden when every connected shop fits', () => {
    expect(connectedShopTiles([sparkle, bubbles]).hiddenCount).toBe(0);
  });

  it('returns an empty preview for a customer with no shops yet', () => {
    expect(connectedShopTiles([])).toEqual({ tiles: [], hiddenCount: 0 });
  });
});

describe('shop avatar initials', () => {
  it('uses the first letter of the first two words', () => {
    expect(
      connectedShopTiles([{ id: 'x', name: 'Clean Machine Express' }]).tiles[0].initials
    ).toBe('CM');
  });

  it('falls back to the first two letters of a one-word name', () => {
    expect(connectedShopTiles([bubbles]).tiles[0].initials).toBe('BU');
  });

  it('never renders an empty avatar for an unnamed shop', () => {
    const { tiles } = connectedShopTiles([{ id: 'x', name: '   ' }]);

    expect(tiles[0].name).toBe('Laundry shop');
    expect(tiles[0].initials).toBe('LS');
  });

  it('drops a whitespace-only address instead of leaving a blank line', () => {
    const { tiles } = connectedShopTiles([{ id: 'x', name: 'Bubbles', address: '  ' }]);

    expect(tiles[0].address).toBeNull();
  });
});
