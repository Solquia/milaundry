import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AdminToast, HeroIconButton, HeroSegments } from '@/components/admin-pulse';
import { AdminShopDetails } from '@/components/admin-shop-details';
import { AdminShopServices } from '@/components/admin-shop-services';
import { AdminShopTeam } from '@/components/admin-shop-team';
import { AdminHero, adminColors } from '@/components/admin-ui';
import { Loading } from '@/components/ui-kit';
import { adminRecentOrders, adminSetShopActive, getAllShops } from '@/lib/api';
import { friendlyAdminError } from '@/lib/domain/admin-error';
import { platformPulse, shopActivityLine } from '@/lib/domain/platform-pulse';
import { useViewAsShop } from '@/lib/view-as-shop-context';

type Tab = 'details' | 'team' | 'services';

const TABS: { value: Tab; label: string }[] = [
  { value: 'details', label: 'Details' },
  { value: 'team', label: 'Team' },
  { value: 'services', label: 'Services' },
];

type Toast = { message: string; tone: 'success' | 'error' };

const NO_TOAST: Toast = { message: '', tone: 'success' };

export default function AdminShopDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const shopId = id!;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openShopAsMerchant } = useViewAsShop();

  const [tab, setTab] = useState<Tab>('details');
  const [toast, setToast] = useState<Toast>(NO_TOAST);
  const dismissToast = useCallback(() => setToast(NO_TOAST), []);

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });
  const { data: orders } = useQuery({
    queryKey: ['admin-recent-orders'],
    queryFn: adminRecentOrders,
  });
  const shop = shops?.find((candidate) => candidate.id === shopId);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-shop-members', shopId] });
    queryClient.invalidateQueries({ queryKey: ['admin-shops'] });
  };

  const showMessage = (message: string) => setToast({ message, tone: 'success' });
  const report = (err: Error, contextPhone: string) =>
    setToast({ message: friendlyAdminError(err.message, contextPhone), tone: 'error' });

  const toggleActive = useMutation({
    mutationFn: () => adminSetShopActive(shopId, !shop!.is_active),
    onSuccess: () => {
      showMessage(shop!.is_active ? 'Shop switched off.' : 'Shop is taking bookings again.');
      refresh();
    },
    onError: (err: Error) => report(err, ''),
  });

  if (isLoading || !shop) return <Loading />;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/(admin)/shops'));
  const activity = orders
    ? shopActivityLine(platformPulse([shop], orders).activityByShop[shop.id])
    : null;

  return (
    <View style={styles.screen}>
      <AdminHero
        title={shop.name}
        subtitle={shop.address || `/${shop.slug}`}
        onBack={goBack}
        backLabel="Shops"
        action={
          <HeroIconButton
            icon="storefront-outline"
            label={`Open ${shop.name} as the shop`}
            onPress={() => {
              openShopAsMerchant(shop);
              router.push('/(merchant)/orders');
            }}
          />
        }
      >
        <View style={styles.statusLine}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: shop.is_active ? '#4ADE80' : adminColors.onHeroSoft },
            ]}
          />
          <Text style={styles.statusText}>{shop.is_active ? 'Live' : 'Switched off'}</Text>
          {activity ? <Text style={styles.statusText}>· {activity}</Text> : null}
        </View>
        <HeroSegments value={tab} onChange={setTab} options={TABS} />
      </AdminHero>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        // A fresh scroll per tab, so a new tab opens at its top.
        key={tab}
      >
        {tab === 'details' ? (
          <AdminShopDetails
            key={shop.id}
            shop={shop}
            onError={(err) => report(err, '')}
            onSaved={(message) => {
              showMessage(message);
              refresh();
            }}
            onToggleActive={() => toggleActive.mutate()}
            isTogglingActive={toggleActive.isPending}
          />
        ) : null}
        {tab === 'team' ? (
          <AdminShopTeam
            shopId={shopId}
            shopName={shop.name}
            onError={report}
            onMessage={showMessage}
            refresh={refresh}
          />
        ) : null}
        {tab === 'services' ? (
          <AdminShopServices
            shopId={shopId}
            onError={(err) => report(err, '')}
            onMessage={showMessage}
          />
        ) : null}
      </ScrollView>

      <AdminToast message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 96,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600', color: adminColors.onHeroSoft },
});
