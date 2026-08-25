import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  AdminHero,
  Chip,
  PillButton,
  ShopLogo,
  StatusBadgePill,
  adminColors,
} from '@/components/admin-ui';
import { Loading } from '@/components/ui-kit';
import { getAllShops } from '@/lib/api';
import { useViewAsShop } from '@/lib/view-as-shop-context';

type StatusFilter = 'all' | 'active' | 'inactive';

export default function AdminShops() {
  const router = useRouter();
  const { openShopAsMerchant } = useViewAsShop();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-shops'],
    queryFn: getAllShops,
  });

  if (isLoading || !shops) return <Loading />;

  const activeCount = shops.filter((shop) => shop.is_active).length;
  const query = search.trim().toLowerCase();
  const visibleShops = shops.filter((shop) => {
    if (statusFilter === 'active' && !shop.is_active) return false;
    if (statusFilter === 'inactive' && shop.is_active) return false;
    if (!query) return true;
    return (
      shop.name.toLowerCase().includes(query) || shop.slug.includes(query)
    );
  });

  return (
    <View style={styles.screen}>
      <AdminHero
        title="Laundry Shops"
        subtitle={`${visibleShops.length} of ${shops.length} shown`}
      />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by name or slug"
          placeholderTextColor={adminColors.subtle}
          autoCapitalize="none"
          accessibilityLabel="Search shops"
        />

        <Text style={styles.filterLabel}>STATUS</Text>
        <View style={styles.chipRow}>
          <Chip
            label="All"
            count={shops.length}
            isSelected={statusFilter === 'all'}
            onPress={() => setStatusFilter('all')}
          />
          <Chip
            label="Active"
            count={activeCount}
            isSelected={statusFilter === 'active'}
            onPress={() => setStatusFilter('active')}
          />
          <Chip
            label="Inactive"
            count={shops.length - activeCount}
            isSelected={statusFilter === 'inactive'}
            onPress={() => setStatusFilter('inactive')}
          />
        </View>

        <PillButton
          title="+ Add laundry shop"
          onPress={() => router.push('/(admin)/new-shop')}
        />

        {visibleShops.length === 0 && (
          <Text style={styles.emptyText}>
            {shops.length === 0
              ? 'No shops yet. Add the first one above.'
              : 'No shops match your search.'}
          </Text>
        )}

        {visibleShops.map((shop) => (
          <View key={shop.id} style={styles.shopCard}>
            <View style={styles.shopHeader}>
              <ShopLogo name={shop.name} logoUrl={shop.logo_url} size={52} />
              <View style={{ flex: 1 }}>
                <Text style={styles.shopName} numberOfLines={1}>
                  {shop.name}
                </Text>
                <Text style={styles.shopSlug}>/{shop.slug}</Text>
              </View>
              <StatusBadgePill isActive={shop.is_active} />
            </View>
            {shop.address ? (
              <Text style={styles.shopAddress} numberOfLines={1}>
                {shop.address}
              </Text>
            ) : null}
            <View style={styles.buttonRow}>
              <PillButton
                title="Manage"
                onPress={() => router.push(`/(admin)/shop/${shop.id}`)}
              />
              <PillButton
                title="Open store ↗"
                variant="outline"
                onPress={() => {
                  openShopAsMerchant(shop);
                  router.push('/(merchant)/orders');
                }}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: adminColors.paper },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  search: {
    backgroundColor: adminColors.card,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: adminColors.border,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 16,
    color: adminColors.text,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: adminColors.subtle,
    marginTop: 4,
  },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  emptyText: { textAlign: 'center', color: adminColors.subtle, padding: 24 },
  shopCard: {
    backgroundColor: adminColors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 14,
    gap: 10,
  },
  shopHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  shopName: { fontSize: 17, fontWeight: '800', color: adminColors.text },
  shopSlug: { fontSize: 13, color: adminColors.subtle },
  shopAddress: { fontSize: 13, color: adminColors.subtle },
  buttonRow: { flexDirection: 'row', gap: 10 },
});
