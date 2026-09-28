import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ChipRow } from '@/components/chip-row';
import { CustomerPulse } from '@/components/customer-pulse';
import { CustomerRow } from '@/components/customer-row';
import { SearchField } from '@/components/search-field';
import { ShopQrButton } from '@/components/shop-qr-button';
import {
  EmptyState,
  ErrorState,
  Loading,
  RADII,
  Screen,
  colors,
  space,
  type,
} from '@/components/ui-kit';
import { getShopCustomers, getShopOrders } from '@/lib/api';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SORTS,
  buildCustomerBook,
  filterCustomers,
  nextSort,
  sortCustomers,
  visibleSegments,
  type CustomerSegment,
  type CustomerSort,
} from '@/lib/domain/customer-insights';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { canOpenMerchantRoute } from '@/lib/domain/merchant-access';
import { useActiveShop } from '@/lib/use-active-shop';
import { useNow } from '@/lib/use-now';

/** "2 wks ago" only needs to turn over now and then. */
const CLOCK_TICK_MS = 5 * 60 * 1000;
/** Row padding, avatar and gap: hairlines start under the name, not the avatar. */
const DIVIDER_INSET = space.cosy + 42 + space.cosy;

function emptyCopy(segment: CustomerSegment, hasQuery: boolean, total: number): string {
  if (hasQuery) return 'Nobody matches that search.';
  if (total === 0) {
    return 'No customers yet. Every order you take adds the person to this book, and anyone who scans your QR lands here too.';
  }
  switch (segment) {
    case 'new':
      return 'No first-time customers in the last month.';
    case 'regular':
      return 'Nobody has reached three orders yet.';
    case 'owing':
      return 'Nobody owes you money.';
    case 'lapsed':
      return 'Everyone has been in recently.';
    case 'all':
      return 'No customers yet.';
  }
}

const people = (count: number): string => `${count} ${count === 1 ? 'person' : 'people'}`;

export default function MerchantCustomers() {
  const router = useRouter();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  const now = useNow(CLOCK_TICK_MS);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('all');
  const [sort, setSort] = useState<CustomerSort>('value');

  const {
    data: orders,
    isLoading: isOrdersLoading,
    error,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
  });
  const { data: registered, refetch: refetchRegistered } = useQuery({
    queryKey: ['shop-customers', shop?.id],
    queryFn: () => getShopCustomers(shop!.id),
    enabled: Boolean(shop),
  });

  const book = useMemo(
    () => buildCustomerBook(orders ?? [], registered ?? [], now),
    [orders, registered, now]
  );
  const visible = useMemo(
    () => sortCustomers(filterCustomers(book.customers, segment, query), sort),
    [book, segment, query, sort]
  );
  const segments = useMemo(
    () =>
      visibleSegments(
        CUSTOMER_SEGMENTS.map((option) => ({
          ...option,
          count: filterCustomers(book.customers, option.key, '').length,
        })),
        segment
      ),
    [book, segment]
  );

  if (isShopLoading || isOrdersLoading) return <Loading />;
  // Owner-only. A staff login has no tab for this screen, but a stale link or
  // a typed web address can still land here; the RPCs behind it would refuse
  // them, so send them back to the counter instead of showing an error.
  if (!canOpenMerchantRoute(shopRole, 'customers')) {
    return <Redirect href="/(merchant)/orders" />;
  }
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  const sortLabel = CUSTOMER_SORTS.find((option) => option.key === sort)?.label ?? '';
  const lastIndex = visible.length - 1;

  return (
    <Screen scroll={false}>
      <FlatList
        style={styles.fill}
        data={visible}
        keyExtractor={(customer) => customer.key}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.slot,
              index === 0 && styles.slotFirst,
              index === lastIndex && styles.slotLast,
            ]}
          >
            <CustomerRow
              customer={item}
              now={now}
              isFlush
              onPress={() =>
                router.push(`/(merchant)/customer/${encodeURIComponent(item.key)}` as never)
              }
            />
          </View>
        )}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshing={isRefetching}
        onRefresh={() => {
          refetch();
          refetchRegistered();
        }}
        ListHeaderComponent={
          <View style={styles.header}>
            <CustomerPulse summary={book.summary} onSegment={setSegment} />
            <View style={styles.findRow}>
              <View style={styles.fill}>
                <SearchField
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Name or number"
                  accessibilityLabel="Search customers"
                />
              </View>
              <ShopQrButton shop={shop} />
            </View>
            <ChipRow options={segments} value={segment} onChange={setSegment} label="Show customers" />
            {error ? (
              <ErrorState
                message={friendlyMerchantError('load-shop', error.message)}
                onRetry={() => refetch()}
              />
            ) : null}
            <View style={styles.listHead}>
              <Text style={styles.count}>{people(visible.length)}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Sorted by ${sortLabel}. Change sort`}
                onPress={() => setSort(nextSort)}
                hitSlop={8}
                style={({ pressed }) => [styles.sortKey, pressed && styles.pressed]}
              >
                <Ionicons name="swap-vertical" size={14} color={colors.actionInk} />
                <Text style={styles.sortText}>{sortLabel}</Text>
              </Pressable>
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState message={emptyCopy(segment, query.trim().length > 0, book.summary.total)} />
        }
      />
    </Screen>
  );
}

function Divider() {
  return (
    <View style={styles.dividerSlot}>
      <View style={styles.divider} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { gap: space.cosy, paddingBottom: space.snug },
  findRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  list: { paddingBottom: space.gulf },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.tight,
    paddingHorizontal: space.tight,
  },
  count: { ...type.caption, fontWeight: '600', color: colors.subtle },
  sortKey: { flexDirection: 'row', alignItems: 'center', gap: space.tight, minHeight: 32 },
  sortText: { ...type.caption, fontWeight: '700', color: colors.actionInk },
  pressed: { opacity: 0.7 },
  // Rows sit in one grouped surface: the card belongs to the list, not to
  // each person, so eleven customers read as one book instead of eleven slabs.
  slot: { backgroundColor: colors.card, overflow: 'hidden' },
  slotFirst: { borderTopLeftRadius: RADII.card, borderTopRightRadius: RADII.card },
  slotLast: { borderBottomLeftRadius: RADII.card, borderBottomRightRadius: RADII.card },
  dividerSlot: { backgroundColor: colors.card },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: DIVIDER_INSET,
    backgroundColor: colors.border,
  },
});
