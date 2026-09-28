import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AttentionRow,
  HeroIconButton,
  LeaderRow,
  MetricStrip,
  SectionHeader,
  WeekSparkline,
  listCard,
} from '@/components/admin-pulse';
import { AdminHero, adminColors } from '@/components/admin-ui';
import { Loading } from '@/components/ui-kit';
import { adminCountShopAccounts, adminRecentOrders, getAllShops } from '@/lib/api';
import { formatMoneyCompact } from '@/lib/domain/money';
import { platformPulse, weekDelta } from '@/lib/domain/platform-pulse';

const LEADERS_SHOWN = 5;

export default function AdminOverview() {
  const router = useRouter();
  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });
  const { data: orders } = useQuery({
    queryKey: ['admin-recent-orders'],
    queryFn: adminRecentOrders,
  });
  const { data: accountCount } = useQuery({
    queryKey: ['admin-account-count'],
    queryFn: adminCountShopAccounts,
  });

  if (isLoading || !shops) return <Loading />;

  const pulse = platformPulse(shops, orders ?? []);
  const delta = weekDelta(pulse.ordersThisWeek, pulse.ordersLastWeek);
  const isDown = delta?.startsWith('−') ?? false;
  const shopById = new Map(shops.map((shop) => [shop.id, shop]));
  const leaders = pulse.leaders.slice(0, LEADERS_SHOWN);
  const topOrders = leaders[0]?.orders ?? 1;
  const openShop = (id: string) => router.push(`/(admin)/shop/${id}`);

  return (
    <View style={styles.screen}>
      <AdminHero
        eyebrow="PLATFORM · LAST 7 DAYS"
        title="Overview"
        action={
          <HeroIconButton
            icon="add"
            label="Add laundry shop"
            onPress={() => router.push('/(admin)/new-shop')}
          />
        }
      >
        <View style={styles.heroStatRow}>
          <View style={styles.heroFigure}>
            <Text style={styles.heroNumber}>{orders ? pulse.ordersThisWeek : '–'}</Text>
            <View style={styles.heroFigureMeta}>
              <Text style={styles.heroNumberLabel}>orders</Text>
              {delta ? (
                <View style={[styles.deltaPill, isDown && styles.deltaPillDown]}>
                  <Ionicons
                    name={isDown ? 'trending-down' : 'trending-up'}
                    size={12}
                    color={adminColors.onHero}
                  />
                  <Text style={styles.deltaText}>{delta}</Text>
                </View>
              ) : null}
            </View>
          </View>
          <WeekSparkline days={pulse.dailyOrders} />
        </View>
      </AdminHero>

      <ScrollView contentContainerStyle={styles.content}>
        <MetricStrip
          items={[
            {
              icon: 'cash-outline',
              label: 'Takings, 7 days',
              value: orders ? formatMoneyCompact(pulse.revenueThisWeek) : '–',
            },
            {
              icon: 'storefront-outline',
              label: 'Shops live',
              value: `${pulse.liveShops}/${shops.length}`,
            },
            {
              icon: 'people-outline',
              label: 'Shop logins',
              value: accountCount === undefined ? '–' : String(accountCount),
            },
          ]}
        />

        <SectionHeader title="NEEDS ATTENTION" />
        <View style={listCard}>
          {pulse.attention.length === 0 ? (
            <View style={styles.allClear}>
              <Ionicons name="checkmark-circle" size={20} color={adminColors.success} />
              <Text style={styles.allClearText}>Every live shop took orders this week.</Text>
            </View>
          ) : (
            pulse.attention.map((item, index) => (
              <AttentionRow
                key={item.shopId}
                name={shopById.get(item.shopId)?.name ?? 'Shop'}
                reason={item.reason}
                isFirst={index === 0}
                onPress={() => openShop(item.shopId)}
              />
            ))
          )}
        </View>

        <SectionHeader
          title="BUSIEST THIS WEEK"
          actionLabel="All shops"
          onAction={() => router.push('/(admin)/shops')}
        />
        <View style={listCard}>
          {leaders.length === 0 ? (
            <Text style={styles.emptyText}>
              {shops.length === 0
                ? 'No shops yet. Tap + to add the first one.'
                : 'No orders yet this week.'}
            </Text>
          ) : (
            leaders.map((leader, index) => {
              const shop = shopById.get(leader.shopId);
              return (
                <LeaderRow
                  key={leader.shopId}
                  rank={index + 1}
                  name={shop?.name ?? 'Shop'}
                  logoUrl={shop?.logo_url}
                  orders={leader.orders}
                  share={leader.orders / topOrders}
                  isFirst={index === 0}
                  onPress={() => openShop(leader.shopId)}
                />
              );
            })
          )}
        </View>
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
  heroStatRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
    marginTop: 18,
  },
  heroFigure: { gap: 6 },
  heroNumber: {
    color: adminColors.onHero,
    fontSize: 48,
    fontWeight: '700',
    lineHeight: 50,
    letterSpacing: -1,
  },
  heroFigureMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroNumberLabel: { color: adminColors.onHeroSoft, fontSize: 14 },
  deltaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(52,211,153,0.28)',
  },
  deltaPillDown: { backgroundColor: 'rgba(251,191,36,0.28)' },
  deltaText: { color: adminColors.onHero, fontSize: 12, fontWeight: '700' },
  allClear: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 },
  allClearText: { flex: 1, fontSize: 14, color: adminColors.text },
  emptyText: { padding: 16, fontSize: 14, color: adminColors.subtle },
});
