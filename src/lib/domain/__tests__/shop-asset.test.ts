import { SHOP_ASSET_BUCKET, shopAssetPath } from '../shop-asset';

const SHOP = '3e322460-95c8-4c89-a571-8e91bbbc481e';
const AT = new Date('2026-09-09T01:00:00Z');

describe('shopAssetPath', () => {
  it('puts the shop id first, because that is what the storage policy reads', () => {
    // "shop owners manage own logo" checks storage.foldername(name)[1] against
    // a shop the caller can manage. Any other shape is refused by the database,
    // so this is the whole reason the path is built here rather than inline.
    expect(shopAssetPath(SHOP, 'logo', 'png', AT).split('/')[0]).toBe(SHOP);
  });

  it('names the kind, so a logo and a cover never collide', () => {
    const logo = shopAssetPath(SHOP, 'logo', 'png', AT);
    const cover = shopAssetPath(SHOP, 'cover', 'png', AT);
    expect(logo).not.toBe(cover);
    expect(logo).toContain('/logo-');
    expect(cover).toContain('/cover-');
  });

  it('stamps the time, so a new picture gets a new URL', () => {
    // The old URL is already in every image cache between here and the
    // customer's phone. Reusing the name would leave them looking at the
    // picture the shop just replaced.
    const first = shopAssetPath(SHOP, 'logo', 'png', AT);
    const later = shopAssetPath(SHOP, 'logo', 'png', new Date(AT.getTime() + 1000));
    expect(first).not.toBe(later);
  });

  it('keeps the extension, so the CDN serves the right type', () => {
    expect(shopAssetPath(SHOP, 'cover', 'jpg', AT).endsWith('.jpg')).toBe(true);
  });
});

describe('SHOP_ASSET_BUCKET', () => {
  it('is the public bucket the shopfront is already served from', () => {
    // A shopfront is meant to be looked at; there is nothing to sign.
    expect(SHOP_ASSET_BUCKET).toBe('shop-logos');
  });
});
