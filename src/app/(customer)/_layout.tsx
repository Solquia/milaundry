import { Redirect, Tabs } from 'expo-router';

import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';

export default function CustomerLayout() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'customer') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="orders" options={{ title: 'My Laundry' }} />
      <Tabs.Screen name="shops" options={{ title: 'Shops' }} />
      <Tabs.Screen name="scan" options={{ title: 'Scan QR' }} />
      <Tabs.Screen name="new-order" options={{ href: null, title: 'New Order' }} />
      <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order' }} />
    </Tabs>
  );
}
