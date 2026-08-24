import { Redirect, Stack } from 'expo-router';

import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'superadmin') return <Redirect href="/" />;

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Laundry Shops' }} />
      <Stack.Screen name="shop/[id]" options={{ title: 'Shop' }} />
    </Stack>
  );
}
