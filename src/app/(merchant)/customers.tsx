import { useQuery } from '@tanstack/react-query';
import { Redirect, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ChipRow } from '@/components/chip-row';
import { CustomerRow } from '@/components/customer-row';
import { SearchField } from '@/components/search-field';
import { ShopQrCard } from '@/components/shop-qr-card';
import { StatGrid, StatTile } from '@/components/stat-tile';
import { EmptyState, ErrorState, Loading, Screen, formatMoney, space } from '@/components/ui-kit';
import { getShopCustomers, getShopOrders } from '@/lib/api';
import {
  CUSTOMER_SEGMENTS,
  CUSTOMER_SORTS,
  buildCustomerBook,
  filterCustomers,
  sortCustomers,
  type CustomerSegment,
  type CustomerSort,
} from '@/lib/domain/customer-insights';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { canOpenMerchantRoute } from '@/lib/domain/merchant-access';
import { useActiveShop } from '@/lib/use-active-shop';

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

export default function MerchantCustomers() {
  const router = useRouter();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  const now = useMemo(() => new Date(), []);
  const [query, setQuery] = useState('');
  const [segment, setSegment] = useState<CustomerSegment>('all');
  const [sort, setSort] = useState<CustomerSort>('value');

  const {
    data: orders,
    isLoading: isOrdersLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['shop-orders', shop?.id],
    queryFn: () => getShopOrders(shop!.id),
    enabled: Boolean(shop),
  });
  const { data: registered } = useQuery({
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
      CUSTOMER_SEGMENTS.map((option) => ({
        ...option,
        count: filterCustomers(book.customers, option.key, '').length,
      })),
    [book]
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

  const { summary } = book;

  return (
    <Screen scroll={false}>
      <FlatList
        style={styles.fill}
        data={visible}
        keyExtractor={(customer) => customer.key}
        renderItem={({ item }) => (
          <CustomerRow
            customer={item}
            now={now}
            onPress={() =>
              router.push(`/(merchant)/customer/${encodeURIComponent(item.key)}` as never)
            }
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.gap} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={
          <View style={styles.header}>
            <ShopQrCard shop={shop} />
            <StatGrid>
              <StatTile
                label="Customers"
                value={String(summary.total)}
                hint={`${summary.ordering} have ordered`}
              />
              <StatTile
                label="Repeat rate"
                value={`${summary.repeatRate}%`}
                hint="Came back at least once"
              />
              <StatTile
                label="Average lifetime value"
                value={formatMoney(summary.averageLifetimeValue)}
                tone="in"
                hint="Per customer who has ordered"
              />
              <StatTile
                label="Not seen lately"
                value={String(summary.lapsed)}
                hint="No order in 45 days · worth a message"
              />
            </StatGrid>
            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Name or number"
              accessibilityLabel="Search customers"
            />
            <ChipRow options={segments} value={segment} onChange={setSegment} label="Show customers" />
            <ChipRow
              options={CUSTOMER_SORTS}
              value={sort}
              onChange={setSort}
              label="Sort customers"
              tone="ghost"
            />
            {error ? (
              <ErrorState
                message={friendlyMerchantError('load-shop', error.message)}
                onRetry={() => refetch()}
              />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          <EmptyState message={emptyCopy(segment, query.trim().length > 0, summary.total)} />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: space.cosy, paddingBottom: space.cosy },
  fill: { flex: 1 },
  list: { paddingBottom: space.gulf },
  gap: { height: space.snug },
});
