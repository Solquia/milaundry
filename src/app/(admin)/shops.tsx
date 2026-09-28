import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  HeroIconButton,
  HeroSearch,
  HeroSegments,
  ShopRow,
  listCard,
  type ActivityTone,
} from '@/components/admin-pulse';
import { AdminHero, adminColors } from '@/components/admin-ui';
import { Loading } from '@/components/ui-kit';
import { adminRecentOrders, getAllShops } from '@/lib/api';
import {
  platformPulse,
  shopActivityLine,
  type ShopActivity,
} from '@/lib/domain/platform-pulse';
import type { Shop } from '@/lib/types';
import { useViewAsShop } from '@/lib/view-as-shop-context';

type StatusFilter = 'all' | 'active' | 'inactive';

const NO_ACTIVITY: ShopActivity = { ordersThisWeek: 0, lastOrderAt: null };

function toneFor(isActive: boolean, activity: ShopActivity): ActivityTone {
  if (!isActive) return 'off';
  return activity.ordersThisWeek > 0 ? 'busy' : 'quiet';
}

/** The line under a shop's name: how it is trading, or where it is while orders load. */
function subtitleFor(shop: Shop, activity: ShopActivity, hasOrders: boolean): string {
  if (!shop.is_active) return 'Not taking bookings';
  if (!hasOrders) return shop.address || `/${shop.slug}`;
  return shopActivityLine(activity);
}

export default function AdminShops() {
  const router = useRouter();
  const { openShopAsMerchant } = useViewAsShop();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });
  const { data: orders } = useQuery({
    queryKey: ['admin-recent-orders'],
    queryFn: adminRecentOrders,
  });

  if (isLoading || !shops) return <Loading />;

  const { activityByShop } = platformPulse(shops, orders ?? []);
  const activeCount = shops.filter((shop) => shop.is_active).length;
  const query = search.trim().toLowerCase();
  const visibleShops = shops.filter((shop) => {
    if (statusFilter === 'active' && !shop.is_active) return false;
    if (statusFilter === 'inactive' && shop.is_active) return false;
    if (!query) return true;
    return shop.name.toLowerCase().includes(query) || shop.slug.includes(query);
  });

  return (
    <View style={styles.screen}>
      <AdminHero
        title="Laundry shops"
        action={
          <HeroIconButton
            icon="add"
            label="Add laundry shop"
            onPress={() => router.push('/(admin)/new-shop')}
          />
        }
      >
        <HeroSearch value={search} onChangeText={setSearch} placeholder="Search shops" />
        <HeroSegments
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'All', count: shops.length },
            { value: 'active', label: 'Active', count: activeCount },
            { value: 'inactive', label: 'Inactive', count: shops.length - activeCount },
          ]}
        />
      </AdminHero>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {visibleShops.length === 0 ? (
          <Text style={styles.emptyText}>
            {shops.length === 0
              ? 'No shops yet. Tap + to add the first one.'
              : 'No shops match your search.'}
          </Text>
        ) : (
          <View style={listCard}>
            {visibleShops.map((shop, index) => {
              const activity = activityByShop[shop.id] ?? NO_ACTIVITY;
              return (
                <ShopRow
                  key={shop.id}
                  name={shop.name}
                  logoUrl={shop.logo_url}
                  activity={subtitleFor(shop, activity, orders !== undefined)}
                  tone={toneFor(shop.is_active, activity)}
                  isInactive={!shop.is_active}
                  isFirst={index === 0}
                  onPress={() => router.push(`/(admin)/shop/${shop.id}`)}
                  onOpenStore={() => {
                    openShopAsMerchant(shop);
                    router.push('/(merchant)/orders');
                  }}
                />
              );
            })}
          </View>
        )}
        {visibleShops.length > 0 ? (
          <Text style={styles.footnote}>
            Tap a shop to manage it. The store button opens it the way the shop sees it.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: {
    padding: 16,
    gap: 10,
    paddingBottom: 32,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  emptyText: { textAlign: 'center', color: adminColors.subtle, padding: 24 },
  footnote: { textAlign: 'center', fontSize: 12, color: adminColors.subtle, marginTop: 4 },
});
