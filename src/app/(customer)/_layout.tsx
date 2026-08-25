import { Redirect, Tabs } from 'expo-router';
import React from 'react';

import { RaisedTabBar } from '@/components/raised-tab-bar';
import { Loading } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { CUSTOMER_TABS } from '@/lib/domain/tab-config';

export default function CustomerLayout() {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && profile.role !== 'customer') return <Redirect href="/" />;

  return (
    <Tabs
      screenOptions={{ headerShown: true }}
      tabBar={(props) => <RaisedTabBar {...props} tabs={CUSTOMER_TABS} />}
    >
      {CUSTOMER_TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
      <Tabs.Screen name="new-order" options={{ href: null, title: 'New Order' }} />
      <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order' }} />
    </Tabs>
  );
}
