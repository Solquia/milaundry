import { Redirect, Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RaisedTabBar, type TabBarProps } from '@/components/raised-tab-bar';
import { Loading, colors } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { MERCHANT_TABS } from '@/lib/domain/tab-config';
import {
  canEnterMerchantDashboard,
  viewAsBannerText,
} from '@/lib/domain/view-as-shop';
import { useViewAsShop } from '@/lib/view-as-shop-context';

// Defined once: a fresh function identity here would remount the tab bar on
// every auth/view-as state change.
const renderTabBar = (props: TabBarProps) => (
  <RaisedTabBar {...props} tabs={MERCHANT_TABS} />
);

export default function MerchantLayout() {
  const { session, profile, isLoading } = useAuth();
  const { viewAsShop, exitViewAs } = useViewAsShop();
  const router = useRouter();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && !canEnterMerchantDashboard(profile.role, viewAsShop !== null)) {
    return <Redirect href="/" />;
  }

  const isViewingAs = profile?.role === 'superadmin' && viewAsShop !== null;

  const handleExitViewAs = () => {
    const shopId = viewAsShop?.id;
    exitViewAs();
    if (shopId) router.replace(`/(admin)/shop/${shopId}`);
    else router.replace('/(admin)');
  };

  return (
    <>
      {isViewingAs && viewAsShop && (
        <SafeAreaView edges={['top']} style={styles.bannerSafeArea}>
          <View style={styles.banner}>
          <Text style={styles.bannerText}>{viewAsBannerText(viewAsShop)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Exit merchant view"
            onPress={handleExitViewAs}
            hitSlop={8}
          >
            <Text style={styles.bannerExit}>Exit</Text>
          </Pressable>
          </View>
        </SafeAreaView>
      )}
      <Tabs
        screenOptions={{ headerShown: true }}
        tabBar={renderTabBar}
      >
        {MERCHANT_TABS.map((tab) => (
          <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
        ))}
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order' }} />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  bannerSafeArea: { backgroundColor: colors.primaryDark },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: { color: '#FFFFFF', fontWeight: '600', flex: 1 },
  bannerExit: {
    color: '#FFFFFF',
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginLeft: 12,
  },
});
