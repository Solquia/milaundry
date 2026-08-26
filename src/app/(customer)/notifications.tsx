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
  elevation,
  space,
  type,
} from '@/components/ui-kit';
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
  action: { surface: '#FCEFD6', ink: '#8A5606' },
  progress: { surface: colors.actionSurface, ink: colors.actionInk },
  quiet: { surface: colors.bg, ink: colors.subtle },
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
          <Text style={styles.sectionLabel}>NEEDS YOU</Text>
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
          <Text style={styles.sectionLabel}>UPDATES</Text>
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
        notification.needsAction && styles.rowAction,
        pressed && { opacity: 0.85 },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: tone.surface }]}>
        <Ionicons name={notification.icon as never} size={19} color={tone.ink} />
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

      <Ionicons name="chevron-forward" size={18} color={colors.borderStrong} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  /** Tracked caps: a quiet index mark, so the rows carry the weight. */
  sectionLabel: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.subtle,
    marginTop: space.snug,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    ...elevation.rest,
  },
  // A row that wants something is lifted and edged, so it is separable from
  // the news below it without relying on the icon's colour alone.
  rowAction: { borderColor: '#EBD3A6', ...elevation.lift },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  title: { ...type.label, fontSize: 16, color: colors.text, flexShrink: 1 },
  time: { ...type.caption, color: colors.subtle, marginLeft: 'auto' },
  detail: { ...type.caption, fontSize: 13, color: colors.subtle, lineHeight: 18 },
  footnote: { marginTop: space.section, gap: space.cosy },
  footnoteText: { ...type.caption, color: colors.subtle, textAlign: 'center' },
});
