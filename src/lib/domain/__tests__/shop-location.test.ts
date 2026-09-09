import {
  PICKER_FALLBACK_CENTER,
  PICKER_FALLBACK_ZOOM,
  SHOP_MAP_ZOOM,
  directionsUrl,
  isValidPin,
  mapMode,
  pinLabel,
  roundPin,
  searchUrl,
  shopPin,
} from '../shop-location';

const manila = { latitude: 14.5995, longitude: 120.9842 };

describe('isValidPin', () => {
  it('accepts a pin inside the world', () => {
    expect(isValidPin(manila)).toBe(true);
    expect(isValidPin({ latitude: -90, longitude: 180 })).toBe(true);
  });

  it('rejects coordinates off the edge of the map', () => {
    expect(isValidPin({ latitude: 90.0001, longitude: 0 })).toBe(false);
    expect(isValidPin({ latitude: 0, longitude: -180.5 })).toBe(false);
  });

  it('rejects numbers that are not numbers', () => {
    expect(isValidPin({ latitude: NaN, longitude: 120 })).toBe(false);
    expect(isValidPin({ latitude: 14, longitude: Infinity })).toBe(false);
    expect(isValidPin({ latitude: '14.5', longitude: 120 })).toBe(false);
    expect(isValidPin(null)).toBe(false);
    expect(isValidPin('14.5,120.9')).toBe(false);
  });

  it('treats null island as no pin at all', () => {
    // (0, 0) is what a failed geocode or an unset form field produces, never
    // where a laundry is. Showing a map of the Gulf of Guinea helps nobody.
    expect(isValidPin({ latitude: 0, longitude: 0 })).toBe(false);
  });
});

describe('shopPin', () => {
  it('reads the pin a shop saved', () => {
    expect(shopPin({ latitude: 14.5995, longitude: 120.9842 })).toEqual(manila);
  });

  it('is null until the shop places one', () => {
    expect(shopPin({ latitude: null, longitude: null })).toBeNull();
    expect(shopPin({})).toBeNull();
  });

  it('refuses half a pin rather than guessing the other half', () => {
    expect(shopPin({ latitude: 14.5995, longitude: null })).toBeNull();
    expect(shopPin({ latitude: null, longitude: 120.9842 })).toBeNull();
  });
});

describe('roundPin', () => {
  it('keeps six decimals, about eleven centimetres', () => {
    expect(roundPin({ latitude: 14.59951234567, longitude: 120.98421234567 })).toEqual({
      latitude: 14.599512,
      longitude: 120.984212,
    });
  });

  it('is stable when applied twice', () => {
    const once = roundPin({ latitude: 14.1234567, longitude: 120.7654321 });
    expect(roundPin(once)).toEqual(once);
  });
});

describe('Google Maps links', () => {
  it('opens directions to the exact pin', () => {
    expect(directionsUrl(manila)).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=14.5995,120.9842'
    );
  });

  it('searches by address when there is no pin, safely encoded', () => {
    expect(searchUrl('12 Mabini St, Quezon City')).toBe(
      'https://www.google.com/maps/search/?api=1&query=12%20Mabini%20St%2C%20Quezon%20City'
    );
  });

  it('trims the address before searching', () => {
    expect(searchUrl('  Bubbles  ')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Bubbles'
    );
  });
});

describe('mapMode', () => {
  const key = 'AIzaSy-real-looking-key';

  it('embeds the map on iOS whenever there is a pin; Apple Maps needs no key', () => {
    expect(mapMode({ pin: manila, address: '', platform: 'ios', androidMapsKey: null })).toBe(
      'map'
    );
  });

  it('embeds the map on Android only with a pin and a Google Maps key', () => {
    expect(mapMode({ pin: manila, address: '', platform: 'android', androidMapsKey: key })).toBe(
      'map'
    );
  });

  it('falls back to the address on Android without a key', () => {
    expect(mapMode({ pin: manila, address: '', platform: 'android', androidMapsKey: null })).toBe(
      'address-only'
    );
    expect(mapMode({ pin: manila, address: '', platform: 'android', androidMapsKey: '' })).toBe(
      'address-only'
    );
  });

  it('falls back to the address on a build that shipped without the maps module', () => {
    // A dev client built before expo-maps was added, or Expo Go, has no
    // ExpoMaps native module. The pin still deserves a link out.
    expect(
      mapMode({ pin: manila, address: '', platform: 'ios', androidMapsKey: null, hasNativeMaps: false })
    ).toBe('address-only');
    expect(
      mapMode({ pin: manila, address: '', platform: 'android', androidMapsKey: key, hasNativeMaps: false })
    ).toBe('address-only');
  });

  it('does not mistake the config placeholder for a key', () => {
    // app.json ships with "<ANDROID_MAPS_KEY>" until the real one is pasted in.
    // A placeholder renders a blank grey map, which is worse than no map.
    expect(
      mapMode({
        pin: manila,
        address: '',
        platform: 'android',
        androidMapsKey: '<ANDROID_MAPS_KEY>',
      })
    ).toBe('address-only');
  });

  it('never embeds a native map on the web', () => {
    expect(mapMode({ pin: manila, address: '', platform: 'web', androidMapsKey: key })).toBe(
      'address-only'
    );
  });

  it('shows the address alone when there is no pin yet', () => {
    expect(
      mapMode({ pin: null, address: '12 Mabini St', platform: 'ios', androidMapsKey: null })
    ).toBe('address-only');
  });

  it('shows nothing when the shop has neither a pin nor an address', () => {
    expect(mapMode({ pin: null, address: '   ', platform: 'ios', androidMapsKey: null })).toBe(
      'hidden'
    );
  });
});

describe('pinLabel', () => {
  it('reads back the pin in four decimals for the merchant', () => {
    expect(pinLabel({ latitude: 14.599512, longitude: 120.984212 })).toBe('14.5995, 120.9842');
  });
});

describe('camera defaults', () => {
  it('opens on the shop at street level, or on the city when there is no pin', () => {
    expect(SHOP_MAP_ZOOM).toBeGreaterThan(PICKER_FALLBACK_ZOOM);
    expect(isValidPin(PICKER_FALLBACK_CENTER)).toBe(true);
  });
});
