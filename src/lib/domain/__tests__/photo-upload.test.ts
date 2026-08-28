import {
  MIN_PHOTO_BYTES,
  ensurePhotoBytes,
  photoContentType,
  photoObjectPath,
} from '../photo-upload';

describe('ensurePhotoBytes', () => {
  it('rejects the empty body a failed file read hands back', () => {
    // The defect this exists for: `fetch(file://…).arrayBuffer()` returned a
    // 14-byte stub, the upload "succeeded", and the customer's ticket showed
    // a blank frame with nothing to explain it.
    expect(() => ensurePhotoBytes(14)).toThrow(/photo/i);
  });

  it('rejects a zero-length body', () => {
    expect(() => ensurePhotoBytes(0)).toThrow(/photo/i);
  });

  it('accepts a real photo', () => {
    expect(() => ensurePhotoBytes(MIN_PHOTO_BYTES)).not.toThrow();
    expect(() => ensurePhotoBytes(1_500_000)).not.toThrow();
  });

  it('explains itself to whoever is holding the phone', () => {
    // The merchant is at the counter with a customer waiting; "Error 0" would
    // send them nowhere.
    expect(() => ensurePhotoBytes(0)).toThrow(/again/i);
  });
});

describe('photoContentType', () => {
  it('labels a camera JPEG', () => {
    expect(photoContentType('file:///tmp/weigh-1.jpg')).toBe('image/jpeg');
    expect(photoContentType('file:///tmp/weigh-1.jpeg')).toBe('image/jpeg');
  });

  it('labels a screenshot PNG', () => {
    expect(photoContentType('file:///tmp/receipt.png')).toBe('image/png');
  });

  it('is not fooled by an upper-case extension', () => {
    expect(photoContentType('file:///DCIM/IMG_0001.PNG')).toBe('image/png');
  });

  it('falls back to JPEG when there is no extension to read', () => {
    expect(photoContentType('file:///tmp/photo')).toBe('image/jpeg');
  });
});

describe('photoObjectPath', () => {
  it('files the photo under its own order, which is what storage checks', () => {
    const path = photoObjectPath('order-1', 'weigh', 'file:///tmp/a.jpg', 1000);

    // Both storage policies match on the first path segment being the order
    // id; a path that does not start with it is unreadable by anyone.
    expect(path.startsWith('order-1/')).toBe(true);
    expect(path).toContain('weigh');
    expect(path.endsWith('.jpg')).toBe(true);
  });

  it('never overwrites an earlier weighing of the same order', () => {
    const first = photoObjectPath('order-1', 'weigh', 'file:///tmp/a.jpg', 1000);
    const second = photoObjectPath('order-1', 'weigh', 'file:///tmp/a.jpg', 2000);

    expect(first).not.toBe(second);
  });

  it('keeps a receipt and a weighing apart', () => {
    const weigh = photoObjectPath('order-1', 'weigh', 'file:///tmp/a.jpg', 1000);
    const proof = photoObjectPath('order-1', 'proof', 'file:///tmp/a.jpg', 1000);

    expect(weigh).not.toBe(proof);
  });

  it('does not let a query-string on the picker URI into the object key', () => {
    const path = photoObjectPath(
      'order-1',
      'weigh',
      'file:///tmp/a.jpg?width=100',
      1000
    );

    expect(path).not.toContain('?');
    expect(path.endsWith('.jpg')).toBe(true);
  });
});
