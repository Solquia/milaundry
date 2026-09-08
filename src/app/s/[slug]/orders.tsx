/**
 * The signed-in visitor's orders at this shop: https://<host>/s/<slug>/orders.
 *
 * A guest who closed the tab has only the shop's page to come back to. This
 * lists what they have booked here and leads to each order's tracking page.
 */
import { useQuery } from '@tanstack/react-query';
import Head from 'expo-router/head';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ACCENTS, Loading, colors, formatWhen, space, type } from '@/components/ui-kit';
import { GuestForm } from '@/components/web/guest-form';
import { WebShell } from '@/components/web/web-shell';
import { getMyOrders, getStorefront } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { actualBill } from '@/lib/domain/actual-bill';
import { STATUS_LABELS } from '@/lib/domain/order-status';
import { docketNumber } from '@/lib/domain/docket';
import { resolveAccent } from '@/lib/domain/shop-branding';
import { storefrontTheme } from '@/lib/domain/web-theme';

export default function ShopOrdersPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();

  const storefront = useQuery({
    queryKey: ['storefront', slug],
    queryFn: () => getStorefront(slug!),
    enabled: Boolean(slug),
  });
  const orders = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
    enabled: Boolean(session),
  });

  if (isAuthLoading || storefront.isLoading) return <Loading />;
  const shop = storefront.data?.shop;
  const theme = storefrontTheme(ACCENTS[shop ? resolveAccent(shop, ACCENTS.length) : 0]);

  const mine = (orders.data ?? []).filter((order) => order.shop_id === shop?.id);

  return (
    <>
      <Head>
        <title>{shop ? `Your orders · ${shop.name}` : 'Your orders'}</title>
      </Head>
      <WebShell>
        <View style={[styles.band, { backgroundColor: theme.brand }]}>
          <Pressable accessibilityRole="link" onPress={() => router.push(`/s/${slug}` as never)}>
            <Text style={[styles.bandBack, { color: theme.onBrand }]}>‹ {shop?.name ?? 'Back'}</Text>
          </Pressable>
          <Text style={[styles.bandTitle, { color: theme.onBrand }]}>Your orders here</Text>
        </View>
        <View style={styles.body}>
          {!session ? (
            <View style={styles.card}>
              <Text style={styles.hint}>Enter the name and number you booked with.</Text>
              <GuestForm
                submitLabel="Show my orders"
                busyLabel="One moment…"
                onSignedIn={async () => {
                  await orders.refetch();
                }}
                theme={theme}
              />
            </View>
          ) : orders.isLoading ? (
            <Loading />
          ) : orders.error ? (
            <Text style={styles.hint}>We could not load your orders. Check your connection and try again.</Text>
          ) : mine.length === 0 ? (
            <Text style={styles.hint}>Nothing booked here yet.</Text>
          ) : (
            mine.map((order) => (
              <Pressable
                key={order.id}
                accessibilityRole="link"
                onPress={() => router.push(`/track/${order.id}` as never)}
                style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              >
                <View style={styles.row}>
                  <Text style={styles.title}>Order {docketNumber(order.id)}</Text>
                  <Text style={[styles.status, { color: theme.brandInk }]}>{STATUS_LABELS[order.status]}</Text>
                </View>
                <Text style={styles.hint}>
                  {formatWhen(order.created_at)} · {actualBill(order).amount}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      </WebShell>
    </>
  );
}

const styles = StyleSheet.create({
  band: { padding: space.room, gap: space.snug },
  bandBack: { ...type.caption, fontWeight: '600', opacity: 0.9 },
  bandTitle: { ...type.title },
  body: { padding: space.room, gap: space.cosy },
  card: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.snug,
  },
  pressed: { opacity: 0.7 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: space.cosy },
  title: { ...type.label, color: colors.text },
  status: { ...type.label },
  hint: { ...type.caption, color: colors.subtle },
});
