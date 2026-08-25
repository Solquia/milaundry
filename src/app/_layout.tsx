import { Ionicons } from '@expo/vector-icons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';

import { Loading } from '@/components/ui-kit';
import { AuthProvider } from '@/lib/auth';
import { ViewAsShopProvider } from '@/lib/view-as-shop-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
  // Tab bars render Ionicons glyphs; without preloading, the first paint shows
  // empty boxes until the icon font arrives.
  const [areIconsLoaded] = useFonts(Ionicons.font);

  if (!areIconsLoaded) return <Loading />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ViewAsShopProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </ViewAsShopProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
