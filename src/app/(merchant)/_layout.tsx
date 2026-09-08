import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs, useRouter , usePathname } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RaisedTabBar, type TabBarProps } from '@/components/raised-tab-bar';
import { Loading, colors, space, type } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import { routeForRole, screenFromPathname } from '@/lib/domain/route-groups';
import {
  canOpenMerchantRoute,
  redirectForMerchantScreen,
  tabsForShopRole,
} from '@/lib/domain/merchant-access';
import { MERCHANT_TABS, type TabConfig } from '@/lib/domain/tab-config';
import { useActiveShop } from '@/lib/use-active-shop';
import {
  canEnterMerchantDashboard,
  viewAsBannerText,
} from '@/lib/domain/view-as-shop';
import { useViewAsShop } from '@/lib/view-as-shop-context';

// Built once per tab set: a fresh function identity here would remount the
// tab bar on every auth/view-as state change.
// It is a render function, not a component: React Navigation calls
// `tabBar(props)` directly, and a component-shaped name here had React
// Compiler plant a hook where no component runs.
function makeTabBar(tabs: readonly TabConfig[]) {
  const renderTabBar = (props: TabBarProps) => <RaisedTabBar {...props} tabs={tabs} />;
  return renderTabBar;
}

export default function MerchantLayout() {
  const { session, profile, isLoading } = useAuth();
  const { viewAsShop, exitViewAs } = useViewAsShop();
  // An owner sees the whole dashboard; staff see the counter (orders, a new
  // order, prices). The database refuses the rest to a staff session anyway,
  // so the tabs only hide what would fail.
  const { shopRole, isLoading: isShopLoading } = useActiveShop();
  const tabs = tabsForShopRole(shopRole);
  const renderTabBar = useMemo(() => makeTabBar(tabs), [tabs]);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/sign-in" />;
  if (profile && !canEnterMerchantDashboard(profile.role, viewAsShop !== null)) {
    return <Redirect href={routeForRole(profile.role, screenFromPathname(pathname)) as never} />;
  }

  // A tab dropped from the bar is the whole guard on a phone. On the web the
  // address bar is a second door, so an owner-only path typed or bookmarked by
  // staff is answered with the first screen that is theirs. Waited on rather
  // than guessed: the role reads as staff until the membership lands, and an
  // owner refreshing on /analytics must not be bounced off their own screen.
  const blocked = isShopLoading
    ? null
    : redirectForMerchantScreen(shopRole, screenFromPathname(pathname));
  if (blocked) return <Redirect href={blocked as never} />;

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
        screenOptions={{
          headerShown: true,
          // The title sat hard against the status bar, so the screen opened on a
          // cramped line of text. Padding the status-bar slot past the inset
          // drops the whole title row clear of the notch and lets the header
          // read as its own band rather than an extension of the system bar.
          headerStatusBarHeight: insets.top + space.section,
          headerTitleStyle: styles.headerTitle,
          // The grey circle in the header was the Expo dev-client button, which
          // does not ship in a production build — until now the app had no
          // account affordance at all beyond a text link in the order list.
          headerRight: () => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Shop settings"
              onPress={() => router.push('/(merchant)/settings')}
              hitSlop={12}
              style={styles.headerButton}
            >
              <Ionicons name="settings-outline" size={22} color={colors.subtle} />
            </Pressable>
          ),
        }}
        tabBar={renderTabBar}
      >
        {MERCHANT_TABS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{
              title: tab.title,
              // Every route file must be declared; the ones this role cannot
              // open are declared without a link, so they leave the bar.
              href: canOpenMerchantRoute(shopRole, tab.name) ? undefined : null,
            }}
          />
        ))}
        <Tabs.Screen name="order/[id]" options={{ href: null, title: 'Order' }} />
        <Tabs.Screen name="customer/[key]" options={{ href: null, title: 'Customer' }} />
        <Tabs.Screen
          name="settings"
          options={{ href: null, title: 'Settings', headerRight: undefined }}
        />
      </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  // `type.title`, not the navigator default: the screen name is the largest
  // word on the screen and was rendering a step below the type scale.
  headerTitle: { ...type.title, color: colors.text },
  headerButton: { paddingHorizontal: 16, paddingVertical: 8 },
  bannerSafeArea: { backgroundColor: colors.primaryDark },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  bannerText: { color: colors.onAccent, fontWeight: '600', flex: 1 },
  bannerExit: {
    color: colors.onAccent,
    fontWeight: '700',
    textDecorationLine: 'underline',
    marginLeft: 12,
  },
});
