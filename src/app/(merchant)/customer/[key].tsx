import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ContactPills } from '@/components/contact-pills';
import { OrderCard } from '@/components/order-card';
import { SectionHeading } from '@/components/section-heading';
import { StatGrid, StatTile } from '@/components/stat-tile';
import {
  ACCENTS,
  EmptyState,
  Loading,
  Screen,
  colors,
  elevation,
  formatMoney,
  formatWhen,
  space,
  type,
} from '@/components/ui-kit';
import { getShopCustomers, getShopOrders } from '@/lib/api';
import { accentIndex } from '@/lib/domain/accent';
import {
  STANDING_LABELS,
  buildCustomerBook,
  customerInitials,
  ordersOfCustomer,
} from '@/lib/domain/customer-insights';
import { useActiveShop } from '@/lib/use-active-shop';

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * One person's history with the shop. Reads from the same two queries the
 * Customers tab already holds, so opening a row is instant and never refetches.
 */
export default function MerchantCustomerDetail() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const now = useMemo(() => new Date(), []);

  const { data: orders, isLoading } = useQuery({
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
  const customer = book.customers.find((entry) => entry.key === key);
  // Every key of theirs, not just the one in the URL: an account's walk-in
  // tickets from before they had the app belong on the same profile.
  const theirOrders = useMemo(
    () => (customer ? ordersOfCustomer(customer, orders ?? []) : []),
    [customer, orders]
  );

  if (isShopLoading || isLoading) return <Loading />;
  if (!customer) {
    return (
      <Screen>
        <EmptyState
          message="This customer is not in your book any more."
          actionLabel="Back to customers"
          onAction={() => router.replace('/(merchant)/customers')}
        />
      </Screen>
    );
  }

  const accent = ACCENTS[accentIndex(customer.key, ACCENTS.length)];
  const hasOwed = customer.owed > 0;

  return (
    <Screen>
      <View style={styles.hero}>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: accent.surface }]}>
            <Text style={[styles.initials, { color: accent.ink }]}>
              {customerInitials(customer.name)}
            </Text>
          </View>
          <View style={styles.words}>
            <Text style={styles.name} numberOfLines={2}>
              {customer.name}
            </Text>
            <Text style={styles.standing}>
              {STANDING_LABELS[customer.standing]}
              {customer.isRegistered ? ' · Has the app' : ''}
            </Text>
          </View>
        </View>
        {customer.phone ? (
          <ContactPills phone={customer.phone} />
        ) : (
          <Text style={styles.noPhone}>No number on file</Text>
        )}
        {customer.firstOrderAt ? (
          <Text style={styles.visits}>
            First order {formatWhen(customer.firstOrderAt, now)} · Last{' '}
            {formatWhen(customer.lastOrderAt, now)}
          </Text>
        ) : null}
      </View>

      <StatGrid>
        <StatTile label="Lifetime value" value={formatMoney(customer.lifetimeValue)} tone="in" />
        <StatTile label="Orders" value={String(customer.orderCount)} />
        <StatTile label="Average order" value={formatMoney(customer.averageOrder)} />
        <StatTile
          label="Still owes"
          value={hasOwed ? formatMoney(customer.owed) : 'Nothing'}
          tone={hasOwed ? 'owed' : 'plain'}
        />
      </StatGrid>

      <SectionHeading
        title="Their orders"
        caption={countLabel(theirOrders.length, 'order')}
      />
      {theirOrders.length === 0 ? (
        <EmptyState message="No orders yet. They connected through your QR but have not booked." />
      ) : (
        theirOrders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            now={now}
            onPress={() => router.push(`/(merchant)/order/${order.id}`)}
          />
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: space.cosy,
    padding: space.section,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...elevation.lift,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  avatar: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  initials: { fontSize: 20, fontWeight: '700', letterSpacing: 0.3 },
  words: { flex: 1, gap: 2 },
  name: { ...type.title, fontSize: 22, color: colors.text },
  standing: { ...type.caption, color: colors.subtle },
  noPhone: { ...type.caption, color: colors.subtle },
  visits: { ...type.caption, color: colors.subtle },
});
