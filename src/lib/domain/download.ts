/**
 * What /download has to say, before it is drawn.
 *
 * The page exists so someone holding a phone can put Milaundry on it without
 * being sent to an Expo artifact URL. The copy, the file name, and who is
 * offered the APK live here so a spec can pin them — the view only paints.
 */

export const APP_NAME = 'Milaundry';
export const APK_FILE_NAME = 'Milaundry.apk';
export const APK_VERSION = '1.0.5';

/**
 * The current release APK (production-apk profile). Expo hosts it; the page gives it the product's
 * own file name so a Downloads folder reads as the app, not as a hash.
 */
export const APK_URL =
  'https://expo.dev/artifacts/eas/0N8DL8wvmHsi5cgvrB9w2_Nh8566gfjE_YdeNlqT0eA.apk';

/** The live App Store listing (eas.json ascAppId). iPhones are sent here instead of the APK. */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6814431884';

export type DownloadAudience = 'android' | 'ios' | 'other' | 'installed';

export type DownloadAction =
  | { kind: 'apk'; label: string }
  | { kind: 'store'; label: string; url: string }
  | { kind: 'home'; label: string };

export interface DownloadStep {
  n: number;
  title: string;
  body: string;
}

export interface DownloadPage {
  name: string;
  version: string;
  headline: string;
  lede: string;
  action: DownloadAction;
  apk: { url: string; fileName: string } | null;
  steps: DownloadStep[];
}

export function downloadAudience(input: {
  platform: string;
  userAgent?: string;
}): DownloadAudience {
  if (input.platform === 'ios' || input.platform === 'android') return 'installed';
  const ua = input.userAgent ?? '';
  if (/android/i.test(ua)) return 'android';
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  return 'other';
}

const APK = { url: APK_URL, fileName: APK_FILE_NAME } as const;

const INSTALL_STEPS: DownloadStep[] = [
  {
    n: 1,
    title: 'Download the app',
    body: 'Saves Milaundry.apk to this phone. Stay on this page until it finishes.',
  },
  {
    n: 2,
    title: 'Open the file',
    body: 'Pull down notifications and tap the download, or find it in Files.',
  },
  {
    n: 3,
    title: 'Allow the install',
    body: 'Android will ask once. Allow this source, then open Milaundry.',
  },
];

/** An iPhone installs from the App Store, so its three steps end there instead of in Files. */
const IPHONE_STEPS: DownloadStep[] = [
  {
    n: 1,
    title: 'Download the app',
    body: 'Opens Milaundry in the App Store.',
  },
  {
    n: 2,
    title: 'Tap Get',
    body: 'Confirm with Face ID or your passcode. The app is free.',
  },
  {
    n: 3,
    title: 'Open Milaundry',
    body: 'Find it on your Home Screen once it finishes.',
  },
];

export function downloadPage(audience: DownloadAudience): DownloadPage {
  if (audience === 'installed') {
    return {
      name: APP_NAME,
      version: APK_VERSION,
      headline: APP_NAME,
      lede: 'You are already in the app.',
      action: { kind: 'home', label: 'Open Milaundry' },
      apk: null,
      steps: [],
    };
  }

  if (audience === 'ios') {
    return {
      name: APP_NAME,
      version: APK_VERSION,
      headline: APP_NAME,
      lede: 'Put the laundry app on this phone.',
      action: { kind: 'store', label: 'Download app', url: APP_STORE_URL },
      apk: null,
      steps: IPHONE_STEPS,
    };
  }

  if (audience === 'other') {
    return {
      name: APP_NAME,
      version: APK_VERSION,
      headline: APP_NAME,
      lede: 'The Android app for the shop phone.',
      action: { kind: 'apk', label: 'Download app' },
      apk: APK,
      steps: INSTALL_STEPS,
    };
  }

  return {
    name: APP_NAME,
    version: APK_VERSION,
    headline: APP_NAME,
    lede: 'Put the laundry app on this phone.',
    action: { kind: 'apk', label: 'Download app' },
    apk: APK,
    steps: INSTALL_STEPS,
  };
}
