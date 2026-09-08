import { Redirect, Tabs , useSegments } from 'expo-router';
import React from 'react';

import { RaisedTabBar, type TabBarProps } from '@/components/raised-tab-bar';
import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { routeForRole } from '@/lib/domain/route-groups';
import { CUSTOMER_TABS } from '@/lib/domain/tab-config';

// Defined once so the tab bar isn't remounted on every auth state change.
const renderTabBar = (props: TabBarProps) => (
  <RaisedTabBar {...props} tabs={CUSTOMER_TABS} />
);

export default function CustomerLayout() {
  const { session, profile, isLoading } = useAuth();
  const segments = useSegments();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'customer') {
    return <Redirect href={routeForRole(profile.role, segments[1]) as never} />;
  }

  return (
    <Tabs
      screenOptions={{ headerShown: true }}
      tabBar={renderTabBar}
    >
      {CUSTOMER_TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            // The MiLaundry home screen renders its own branded hero, so the
            // native header would just repeat the wordmark.
            headerShown: tab.name !== 'orders',
          }}
        />
      ))}
      <Tabs.Screen name="new-order" options={{ href: null, title: 'New Order' }} />
      {/* Reached from the bell on the home hero, not from the tab bar: it is
          somewhere you go when something has happened, not a place you live. */}
      <Tabs.Screen
        name="notifications"
        options={{ href: null, title: 'Notifications' }}
      />
      {/* Same reasoning as the bell: settings is somewhere you go once and
          leave, so it takes a header and a back arrow rather than a tab. */}
      <Tabs.Screen name="settings" options={{ href: null, title: 'Settings' }} />
      {/* The shopfront paints its own gradient up behind the status bar and
          carries its own back control, so a white header bar above it would
          just be a band of nothing with the shop's name repeated in it. */}
      <Tabs.Screen
        name="shop/[id]"
        options={{ href: null, title: 'Shop', headerShown: false }}
      />
      <Tabs.Screen name="book/[serviceId]" options={{ href: null, title: 'Book service' }} />
      <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order' }} />
    </Tabs>
  );
}
