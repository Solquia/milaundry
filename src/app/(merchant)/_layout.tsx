import { Redirect, Tabs, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Loading, colors } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import {
  canEnterMerchantDashboard,
  viewAsBannerText,
} from '@/lib/domain/view-as-shop';
import { useViewAsShop } from '@/lib/view-as-shop-context';

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
      <Tabs screenOptions={{ headerShown: true }}>
        <Tabs.Screen name="orders" options={{ title: 'Orders' }} />
        <Tabs.Screen name="pos" options={{ title: 'POS' }} />
        <Tabs.Screen name="customers" options={{ title: 'Customers' }} />
        <Tabs.Screen name="analytics" options={{ title: 'Analytics' }} />
        <Tabs.Screen name="services" options={{ title: 'Services' }} />
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
