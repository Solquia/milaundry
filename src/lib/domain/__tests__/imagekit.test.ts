import {
  IMAGEKIT_UPLOAD_URL,
  isImagekitFilePath,
  orderIdOfImagePath,
  parseUploadCredentials,
  parseUploadResponse,
  uploadFormFields,
  uploadTokenRequest,
  type ImageTarget,
} from '../imagekit';

const LOGO: ImageTarget = { purpose: 'shop', shopId: 'shop-1', kind: 'logo' };
const COVER: ImageTarget = { purpose: 'shop', shopId: 'shop-1', kind: 'cover' };
const WEIGH: ImageTarget = { purpose: 'order', orderId: 'order-9', kind: 'weigh' };

describe('IMAGEKIT_UPLOAD_URL', () => {
  it('points at the v2 endpoint, whose token covers the whole payload', () => {
    // v1 signs only a token and an expiry, so any signed-in caller could have
    // uploaded into another shop's folder. v2 signs the folder too.
    expect(IMAGEKIT_UPLOAD_URL).toBe('https://upload.imagekit.io/api/v2/files/upload');
  });
});

describe('uploadTokenRequest', () => {
  it('names the shop a branding image belongs to', () => {
    expect(uploadTokenRequest(LOGO, 'jpg')).toEqual({
      action: 'upload-token',
      purpose: 'shop',
      kind: 'logo',
      extension: 'jpg',
      shop_id: 'shop-1',
    });
    expect(uploadTokenRequest(COVER, 'jpg').kind).toBe('cover');
  });

  it('names the order a photo is evidence for', () => {
    expect(uploadTokenRequest(WEIGH, 'png')).toEqual({
      action: 'upload-token',
      purpose: 'order',
      kind: 'weigh',
      extension: 'png',
      order_id: 'order-9',
    });
  });

  it('sends the extension lowercased, as a camera does not always', () => {
    expect(uploadTokenRequest(WEIGH, 'JPG').extension).toBe('jpg');
  });

  it('never asks for a folder — the server decides that', () => {
    // The whole point of the v2 token: a client that could choose its own
    // folder could write over another shop's logo.
    expect(Object.keys(uploadTokenRequest(LOGO, 'jpg'))).not.toContain('folder');
  });
});

describe('parseUploadCredentials', () => {
  it('reads a token and the payload it was signed over', () => {
    expect(
      parseUploadCredentials({ token: 'jwt', upload_payload: { fileName: 'logo-1.jpg' } })
    ).toEqual({ token: 'jwt', uploadPayload: { fileName: 'logo-1.jpg' } });
  });

  it('fails loudly on an answer it cannot use', () => {
    // Silence here is how a photo once became fourteen bytes: everything
    // reported success and the customer got an empty frame.
    expect(() => parseUploadCredentials(null)).toThrow(/try again/i);
    expect(() => parseUploadCredentials({ token: '' })).toThrow(/try again/i);
    expect(() => parseUploadCredentials({ token: 'jwt' })).toThrow(/try again/i);
  });
});

describe('uploadFormFields', () => {
  it('echoes every signed parameter, then the token', () => {
    const fields = uploadFormFields({
      token: 'jwt',
      uploadPayload: { fileName: 'logo-1.jpg', folder: '/shops/shop-1' },
    });
    expect(fields).toEqual([
      ['fileName', 'logo-1.jpg'],
      ['folder', '/shops/shop-1'],
      ['token', 'jwt'],
    ]);
  });

  it('drops nothing — a field missing from the form fails the whole upload', () => {
    const uploadPayload = {
      fileName: 'weigh-1.jpg',
      folder: '/orders/order-9',
      useUniqueFileName: 'false',
      overwriteFile: 'true',
      isPrivateFile: 'true',
    };
    const names = uploadFormFields({ token: 'jwt', uploadPayload }).map(([name]) => name);
    expect(names).toEqual([...Object.keys(uploadPayload), 'token']);
  });
});

describe('parseUploadResponse', () => {
  it('keeps both the URL and the path — the two are used for different images', () => {
    expect(
      parseUploadResponse({ url: 'https://ik.imagekit.io/x/shops/s/logo-1.jpg', filePath: '/shops/s/logo-1.jpg' })
    ).toEqual({
      url: 'https://ik.imagekit.io/x/shops/s/logo-1.jpg',
      filePath: '/shops/s/logo-1.jpg',
    });
  });

  it('refuses a response missing either half', () => {
    expect(() => parseUploadResponse({ url: 'https://x/y.jpg' })).toThrow(/try again/i);
    expect(() => parseUploadResponse({ filePath: '/y.jpg' })).toThrow(/try again/i);
  });
});

describe('isImagekitFilePath', () => {
  it('recognises an ImageKit path by its leading slash', () => {
    expect(isImagekitFilePath('/orders/order-9/weigh-1700.jpg')).toBe(true);
  });

  it('leaves an order photo uploaded before the move readable', () => {
    // Supabase keys were `<orderId>/<file>` with no leading slash. Orders taken
    // last week must still show their evidence.
    expect(isImagekitFilePath('c0ffee/weigh-1700.jpg')).toBe(false);
  });

  it('treats nothing as nothing', () => {
    expect(isImagekitFilePath('')).toBe(false);
  });
});

describe('orderIdOfImagePath', () => {
  it('reads the order out of the path that stores its photo', () => {
    expect(orderIdOfImagePath('/orders/order-9/weigh-1700.jpg')).toBe('order-9');
  });

  it('refuses a path that is not an order photo', () => {
    expect(orderIdOfImagePath('/shops/shop-1/logo-1700.jpg')).toBeNull();
    expect(orderIdOfImagePath('/orders/order-9/nested/weigh.jpg')).toBeNull();
    expect(orderIdOfImagePath('order-9/weigh-1700.jpg')).toBeNull();
  });
});
