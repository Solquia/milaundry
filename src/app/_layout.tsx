import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { AuthProvider } from '@/lib/auth';
import { ViewAsShopProvider } from '@/lib/view-as-shop-context';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function RootLayout() {
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
