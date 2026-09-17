import {
  APK_FILE_NAME,
  APK_URL,
  APP_NAME,
  downloadAudience,
  downloadPage,
} from '../download';

describe('downloadAudience', () => {
  test('a browser on Android is the one the APK is for', () => {
    expect(
      downloadAudience({
        platform: 'web',
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/128.0.0.0 Mobile Safari/537.36',
      })
    ).toBe('android');
  });

  test('an iPhone cannot install an Android package, so the page must not pretend it can', () => {
    expect(
      downloadAudience({
        platform: 'web',
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      })
    ).toBe('ios');
  });

  test('a laptop can still take the file, because the APK is for a phone they will pass it to', () => {
    expect(
      downloadAudience({
        platform: 'web',
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
      })
    ).toBe('other');
  });

  test('someone already inside the app is not asked to download it', () => {
    expect(downloadAudience({ platform: 'android' })).toBe('installed');
    expect(downloadAudience({ platform: 'ios' })).toBe('installed');
  });
});

describe('downloadPage', () => {
  test('the product name on this page is Milaundry, with no version in it', () => {
    expect(APP_NAME).toBe('Milaundry');
    expect(APP_NAME).not.toMatch(/3\.0/);
    expect(downloadPage('android').name).toBe('Milaundry');
  });

  test('the file a phone saves is named for the app, not for an Expo artifact id', () => {
    expect(APK_FILE_NAME).toBe('Milaundry.apk');
    expect(APK_URL).toMatch(/^https:\/\//);
    expect(downloadPage('android').apk).toEqual({ url: APK_URL, fileName: APK_FILE_NAME });
  });

  test('Android gets a download, and the three things you do after the file lands', () => {
    const page = downloadPage('android');
    expect(page.action.kind).toBe('apk');
    expect(page.action.label).toBe('Download app');
    expect(page.steps).toHaveLength(3);
    expect(page.steps.map((step) => step.n)).toEqual([1, 2, 3]);
    expect(page.steps[0].title.toLowerCase()).toContain('download');
  });

  test('a laptop offers the same Download app button as a phone', () => {
    expect(downloadPage('other').action.label).toBe('Download app');
  });

  test('iPhone is told this preview is Android, and is offered the web app instead', () => {
    const page = downloadPage('ios');
    expect(page.action.kind).toBe('web');
    expect(page.apk).toBeNull();
    expect(page.lede.toLowerCase()).toMatch(/android/);
    expect(page.steps).toHaveLength(0);
  });

  test('a laptop still offers the APK, and says it installs on a phone', () => {
    const page = downloadPage('other');
    expect(page.action.kind).toBe('apk');
    expect(page.lede.toLowerCase()).toMatch(/phone/);
  });

  test('the installed app sends people home rather than through a sideload', () => {
    const page = downloadPage('installed');
    expect(page.action.kind).toBe('home');
    expect(page.apk).toBeNull();
    expect(page.steps).toHaveLength(0);
  });
});
