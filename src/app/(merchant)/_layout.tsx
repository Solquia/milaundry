import { Redirect, Tabs } from 'expo-router';

import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';

export default function MerchantLayout() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'merchant') return <Redirect href="/" />;

  return (
    <Tabs screenOptions={{ headerShown: true }}>
      <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
      <Tabs.Screen name="pos" options={{ title: 'POS' }} />
      <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
      <Tabs.Screen name="services" options={{ title: 'Services' }} />
      <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order' }} />
    </Tabs>
  );
}
