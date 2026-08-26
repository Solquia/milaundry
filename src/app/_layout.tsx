import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SystemUI from 'expo-system-ui';

import { Loading } from '@/components/ui-kit';
import { AuthProvider } from '@/lib/auth';
import { AppSettingsProvider } from '@/lib/use-app-settings';
import { ViewAsShopProvider } from '@/lib/view-as-shop-context';

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
void SystemUI.setBackgroundColorAsync('#04203F');

export default function RootLayout() {
  // Tab bars render Ionicons glyphs; without preloading, the first paint shows
  // empty boxes until the icon font arrives. Never block the app on a failure
  // though — missing icons must not cost the user their way to sign in.
  const [areIconsLoaded, iconFontError] = useFonts(Ionicons.font);

  if (!areIconsLoaded && !iconFontError) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* Above the navigator: a press anywhere in the app can ask for a
            haptic, and the answer has to be the same everywhere. */}
        <AppSettingsProvider>
          <ViewAsShopProvider>
            <Stack screenOptions={{ headerShown: false }} />
          </ViewAsShopProvider>
        </AppSettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
