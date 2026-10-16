import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { REVEAL_STAGGER_MS, Reveal } from '@/components/reveal';
import {
  Button,
  EmptyState,
  ErrorState,
  Loading,
  Screen,
  colors,
  space,
  type,
} from '@/components/ui-kit';
import { glassPane } from '@/components/glass';
import { fontFor } from '@/lib/domain/design-scale';
import { getMyOrders, type OrderWithDetails } from '@/lib/api';
import { formatOrderTime } from '@/lib/domain/order-card';
import {
  buildNotifications,
  enabledNotifications,
  type LaundryNotification,
  type NotificationTone,
} from '@/lib/domain/notifications';
import { supabase } from '@/lib/supabase';
import { useAppSettings, useHaptic } from '@/lib/use-app-settings';

/**
 * Colour by whether the row is a question or an answer.
 *
 * Amber is the app's "money is still owed" tone, and every action row here is
 * ultimately that — a price to settle, a load to collect. Progress rows take
 * the blue that means "in motion", and everything finished recedes to grey, so
 * a long feed still has exactly one thing at the top worth reacting to.
 */
const TONES: Record<NotificationTone, { surface: string; ink: string }> = {
  // Solid tiles with a white glyph, the way iOS draws an app's icon beside its
  // notification: orange for money, the app's blue for progress, grey for news.
  action: { surface: '#FF9500', ink: colors.onAccent },
  progress: { surface: colors.action, ink: colors.onAccent },
  quiet: { surface: '#8E8E93', ink: colors.onAccent },
};

function toNotifiable(order: OrderWithDetails) {
  return {
    id: order.id,
    shopName: order.shop?.name ?? 'Laundry shop',
    status: order.status,
    order_type: order.order_type,
    fulfillment: order.fulfillment,
    payment_status: order.payment_status,
    estimated_total: order.estimated_total,
    final_total: order.final_total,
    updated_at: order.updated_at,
  };
}

export default function CustomerNotifications() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { settings } = useAppSettings();
  const haptic = useHaptic();

  // The same cache key the home screen uses, so opening the bell costs nothing
  // and the two screens can never disagree about what is in the wash.
  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
  });

  // A notification you have to pull down to see is not a notification. Any
  // order row that changes re-derives the feed while the screen is open.
  useEffect(() => {
    const channel = supabase
      .channel('my-order-notifications')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        () => queryClient.invalidateQueries({ queryKey: ['my-orders'] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Filtered by what the customer asked to be told about. Rows that need them
  // survive every setting, so muting quietens the feed without ever hiding a
  // price waiting to be settled.
  const feed = useMemo(
    () =>
      enabledNotifications(
        buildNotifications((orders ?? []).map(toNotifiable)),
        settings
      ),
    [orders, settings]
  );

  const { needsYou, updates } = useMemo(
    () => ({
      needsYou: feed.filter((notification) => notification.needsAction),
      updates: feed.filter((notification) => !notification.needsAction),
    }),
    [feed]
  );

  const open = (notification: LaundryNotification) => {
    haptic('tap');
    router.push(`/(customer)/order/${notification.orderId}` as never);
  };

  if (isLoading) {
    return (
      <Screen>
        <Loading />
      </Screen>
    );
  }

  if (error) {
    return (
      <Screen>
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      </Screen>
    );
  }

  if (feed.length === 0) {
    return (
      <Screen>
        <EmptyState
          message="Nothing to report yet. Book a pickup and we'll tell you the moment your laundry moves — and what it actually costs once it has been weighed."
          actionLabel="Find a laundry shop"
          onAction={() => {
            haptic('tap');
            router.push('/(customer)/shops' as never);
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {needsYou.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Needs You</Text>
          {needsYou.map((notification, index) => (
            <Reveal key={notification.id} delay={index * REVEAL_STAGGER_MS}>
              <NotificationRow
                notification={notification}
                onPress={() => open(notification)}
              />
            </Reveal>
          ))}
        </>
      )}

      {updates.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Updates</Text>
          {updates.map((notification, index) => (
            <Reveal
              key={notification.id}
              delay={(index + needsYou.length) * REVEAL_STAGGER_MS}
            >
              <NotificationRow
                notification={notification}
                onPress={() => open(notification)}
              />
            </Reveal>
          ))}
        </>
      )}

      <View style={styles.footnote}>
        <Text style={styles.footnoteText}>
          Updates come straight from the shop as they work through your load.
        </Text>
        <Button
          title="See all my orders"
          variant="outline"
          onPress={() => router.push('/(customer)/orders' as never)}
        />
      </View>
    </Screen>
  );
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: LaundryNotification;
  onPress: () => void;
}) {
  const tone = TONES[notification.tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notification.title}. ${notification.body}`}
      accessibilityHint="Opens the order"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tone.surface }]}>
        <Ionicons name={notification.icon as never} size={18} color={tone.ink} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          <Text style={styles.time}>
            {formatOrderTime(notification.at, new Date())}
          </Text>
        </View>
        <Text style={styles.detail}>{notification.body}</Text>
      </View>

      {notification.needsAction ? <View style={styles.unread} /> : null}
      <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** A group's title, the way Notification Centre titles a stack. */
  sectionLabel: {
    ...type.section,
    color: colors.text,
    marginTop: space.cosy,
    marginLeft: space.tight,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    ...glassPane,
    borderRadius: 18,
    paddingVertical: space.cosy + 2,
    paddingLeft: space.room,
    paddingRight: space.cosy,
  },
  rowPressed: { backgroundColor: 'rgba(255, 255, 255, 0.6)' },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  title: { ...type.body, fontSize: 15, lineHeight: 20, ...fontFor(600), color: colors.text, flexShrink: 1 },
  time: { ...type.caption, color: colors.subtle, marginLeft: 'auto' },
  detail: { ...type.body, fontSize: 15, lineHeight: 20, color: colors.text },
  /** The unread dot iOS sets on a row that still wants something. */
  unread: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.action },
  footnote: { marginTop: space.section, gap: space.cosy },
  footnoteText: { ...type.caption, color: colors.subtle, textAlign: 'center' },
});
