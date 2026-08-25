import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';

import { adminColors } from '@/components/admin-ui';
import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';

export default function AdminLayout() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'superadmin') return <Redirect href="/" />;

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
