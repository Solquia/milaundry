import {
  MIN_PHOTO_BYTES,
  ensurePhotoBytes,
  photoContentType,
  photoReaderFor,
  resolvePhotoContentType,
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

describe('photoReaderFor', () => {
  it('reads a picked image in the browser with fetch', () => {
    // The web picker hands back a blob: URL. expo-file-system's File cannot
    // open one at all — it throws "this.validatePath is not a function", which
    // is what broke Save branding on the website.
    expect(photoReaderFor('web')).toBe('fetch');
  });

  it('reads a file on a device with expo-file-system, never fetch', () => {
    // fetch('file://…') on a device goes through a polyfill that once returned
    // the 14-byte string "File not found" instead of a photo, which is the
    // whole reason MIN_PHOTO_BYTES exists.
    expect(photoReaderFor('ios')).toBe('file-system');
    expect(photoReaderFor('android')).toBe('file-system');
  });
});

describe('resolvePhotoContentType', () => {
  it(`trusts the blob own type, because a blob: URL has no extension`, () => {
    expect(resolvePhotoContentType('blob:http://localhost:8081/a-b-c', 'image/png')).toBe(
      'image/png'
    );
  });

  it('ignores a blob type that is not an image', () => {
    // Some browsers hand back an empty string or application/octet-stream for
    // a picked file; the extension rule is a better guess than either.
    expect(resolvePhotoContentType('shot.png', 'application/octet-stream')).toBe(
      'image/png'
    );
    expect(resolvePhotoContentType('shot.png', '')).toBe('image/png');
  });

  it('falls back to the extension when there is no blob at all', () => {
    expect(resolvePhotoContentType('/var/mobile/photo.jpg')).toBe('image/jpeg');
  });
});
