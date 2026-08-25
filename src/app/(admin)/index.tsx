import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  AdminHero,
  ShopLogo,
  StatTile,
  adminColors,
} from '@/components/admin-ui';
import { Loading } from '@/components/ui-kit';
import { adminCountShopAccounts, getAllShops } from '@/lib/api';

export default function AdminOverview() {
  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });
  const { data: accountCount } = useQuery({
    queryKey: ['admin-account-count'],
    queryFn: adminCountShopAccounts,
  });

  if (isLoading || !shops) return <Loading />;

  const activeCount = shops.filter((shop) => shop.is_active).length;
  const inactiveCount = shops.length - activeCount;
  const activeShare = shops.length ? activeCount / shops.length : 0;
  const recentShops = shops.slice(0, 5);

  return (
    <View style={styles.screen}>
      <AdminHero
        title="Overview"
        subtitle={`${shops.length} laundry ${shops.length === 1 ? 'shop' : 'shops'} on MiLaundry`}
      >
        <View style={styles.heroStatRow}>
          <View>
            <Text style={styles.heroBigNumber}>{activeCount}</Text>
            <Text style={styles.heroBigLabel}>Live right now</Text>
          </View>
          <View style={styles.heroProgressColumn}>
            <View style={styles.heroProgressTrack}>
              <View
                style={[styles.heroProgressFill, { flex: Math.max(activeShare, 0.02) }]}
              />
              <View style={{ flex: 1 - Math.max(activeShare, 0.02) }} />
            </View>
            <Text style={styles.heroProgressLabel}>
              {Math.round(activeShare * 100)}% of all shops
            </Text>
          </View>
        </View>
      </AdminHero>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.tileGrid}>
          <StatTile
            label="Shops"
            value={shops.length}
            hint={`${inactiveCount} inactive`}
            dotColor={adminColors.accent}
          />
          <StatTile
            label="Active"
            value={activeCount}
            hint="Accepting customers"
            dotColor={adminColors.success}
          />
          <StatTile
            label="Accounts"
            value={accountCount ?? '—'}
            hint="Shop logins"
            dotColor="#B08CF3"
          />
          <StatTile
            label="Inactive"
            value={inactiveCount}
            hint="Not accepting customers"
            dotColor={adminColors.subtle}
          />
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recently added</Text>
          <Link href="/(admin)/shops" asChild>
            <Pressable accessibilityRole="link" hitSlop={8}>
              <Text style={styles.sectionLink}>See all ›</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.recentCard}>
          {recentShops.length === 0 && (
            <Text style={styles.emptyText}>
              No shops yet — add the first one from the Shops tab.
            </Text>
          )}
          {recentShops.map((shop, index) => (
            <Link key={shop.id} href={`/(admin)/shop/${shop.id}`} asChild>
              <Pressable
                accessibilityRole="button"
                style={StyleSheet.flatten([
                  styles.recentRow,
                  index > 0 && styles.recentRowBorder,
                ])}
              >
                <ShopLogo name={shop.name} logoUrl={shop.logo_url} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.recentName} numberOfLines={1}>
                    {shop.name}
                  </Text>
                  <Text style={styles.recentSlug}>/{shop.slug}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  heroStatRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginTop: 16,
  },
  heroBigNumber: { color: '#FFFFFF', fontSize: 52, fontWeight: '800', lineHeight: 54 },
  heroBigLabel: { color: '#AAB4C0', fontSize: 13 },
  heroProgressColumn: { flex: 1, gap: 6, paddingBottom: 8 },
  heroProgressTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    backgroundColor: adminColors.inkSoft,
    overflow: 'hidden',
  },
  heroProgressFill: { backgroundColor: adminColors.accent, borderRadius: 999 },
  heroProgressLabel: { color: '#AAB4C0', fontSize: 12 },
  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sectionTitle: { fontSize: 20, fontWeight: '800', color: adminColors.text },
  sectionLink: { fontSize: 14, fontWeight: '700', color: adminColors.accent },
  recentCard: {
    backgroundColor: adminColors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: adminColors.border,
    paddingHorizontal: 14,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  recentRowBorder: { borderTopWidth: 1, borderTopColor: adminColors.border },
  recentName: { fontSize: 16, fontWeight: '700', color: adminColors.text },
  recentSlug: { fontSize: 13, color: adminColors.subtle },
  chevron: { fontSize: 22, color: adminColors.subtle },
  emptyText: { padding: 16, color: adminColors.subtle },
});
