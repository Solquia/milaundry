import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs , usePathname } from 'expo-router';

import { adminColors } from '@/components/admin-ui';
import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { routeForRole, screenFromPathname } from '@/lib/domain/route-groups';

export default function AdminLayout() {
  const { session, profile, isLoading } = useAuth();
  const pathname = usePathname();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  // A bare `/` would resolve back into this group and loop; the role's own
  // group is named outright.
  if (profile && profile.role !== 'superadmin') {
    return <Redirect href={routeForRole(profile.role, screenFromPathname(pathname)) as never} />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: adminColors.accent,
        tabBarInactiveTintColor: '#8792A0',
        tabBarStyle: { backgroundColor: adminColors.ink, borderTopWidth: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Overview',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="shops"
        options={{
          title: 'Shops',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shirt-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen name="shop/[id]" options={{ href: null }} />
      <Tabs.Screen name="new-shop" options={{ href: null }} />
    </Tabs>
  );
}
