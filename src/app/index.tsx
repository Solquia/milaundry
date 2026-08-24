import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';

export default function Index() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile?.role === 'merchant') return <Redirect href="/(merchant)/orders" />;
  if (profile?.role === 'superadmin') return <Redirect href="/(admin)" />;
  return <Redirect href="/(customer)/orders" />;
}
