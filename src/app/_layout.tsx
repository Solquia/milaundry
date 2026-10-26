import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';

import { Loading } from '@/components/ui-kit';
import { UpdateBanner } from '@/components/update-banner';
import { WebFrame } from '@/components/web-frame';
import { AuthProvider } from '@/lib/auth';
import { AppSettingsProvider } from '@/lib/use-app-settings';
import { ViewAsShopProvider } from '@/lib/view-as-shop-context';
import { claimWebDocument } from '@/lib/web-document';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

// The window background shows wherever the app does not paint — behind the
// system bars, and for the instant between the native splash and the first
// React frame. Left at its default it flashed bright blue under the navigation
// bar; deep navy is the colour the splash opens on, so the seam disappears.
// App-level, so it runs module-side rather than in an effect.
void SystemUI.setBackgroundColorAsync('#F2F2F7');

/**
 * Inter is Android's face only: an iPhone sets every role in San Francisco,
 * and the web reads SF on Apple devices and Inter from its own stylesheet.
 * Bundling it anywhere else would be a download nobody reads.
 */
const ANDROID_FACES: Record<string, number> =
  Platform.OS === 'android'
    ? { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold }
    : {};

// The browser's own half of that: the viewport contract with a phone, and the
// surfaces — selection, caret, scrollbar, focus ring — the document owns
// rather than the app. No-op off the web. See `lib/web-document.ts`.
claimWebDocument();

export default function RootLayout() {
  // Tab bars render Ionicons glyphs; without preloading, the first paint shows
  // empty boxes until the icon font arrives. Never block the app on a failure
  // though — missing icons must not cost the user their way to sign in.
  // On Android, Inter rides along in the same call: every type role names one
  // of its cuts by family, so text painted before it lands would reflow.
  const [areFontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...ANDROID_FACES,
  });

  if (!areFontsLoaded && !fontError) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Above the navigator: a press anywhere in the app can ask for a
            haptic, and the answer has to be the same everywhere. */}
        <AppSettingsProvider>
          <ViewAsShopProvider>
            <WebFrame>
              <Stack screenOptions={{ headerShown: false }} />
              <UpdateBanner />
            </WebFrame>
          </ViewAsShopProvider>
        </AppSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
