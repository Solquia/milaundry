import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Card,
  EmptyState,
  ErrorText,
  Loading,
  Screen,
  StatusBadge,
  Subtle,
  colors,
  formatDate,
  formatMoney,
} from '@/components/ui-kit';
import { getMyOrders, type OrderWithDetails } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { TERMINAL_STATUSES } from '@/lib/domain/order-status';
import { washCycleProgress, type WashCycleStep } from '@/lib/domain/wash-cycle';

const QUICK_ACTIONS = [
  { key: 'book', label: 'Book laundry', icon: 'add-circle', tint: '#E0F2FE', fg: '#0284C7' },
  { key: 'scan', label: 'Scan QR', icon: 'qr-code', tint: '#E0E7FF', fg: '#4F46E5' },
  { key: 'shops', label: 'Shops', icon: 'storefront', tint: '#CCFBF1', fg: '#0D9488' },
  { key: 'track', label: 'Track', icon: 'navigate', tint: '#FEF3C7', fg: '#D97706' },
] as const;

export default function CustomerOrders() {
  const { signOut } = useAuth();
  const router = useRouter();

  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['my-orders'],
    queryFn: getMyOrders,
  });

  const { active, past } = useMemo(() => {
    const all = orders ?? [];
    return {
      active: all.filter((order) => !TERMINAL_STATUSES.includes(order.status)),
      past: all.filter((order) => TERMINAL_STATUSES.includes(order.status)),
    };
  }, [orders]);

  const handleQuickAction = (key: (typeof QUICK_ACTIONS)[number]['key']) => {
    if (key === 'scan') router.push('/(customer)/scan' as never);
    else router.push('/(customer)/shops' as never);
  };

  if (isLoading) return <Loading />;

  return (
    <Screen>
      {/* Branded hero — the app's own wordmark, no account number. */}
      <View style={styles.hero}>
        <Text style={styles.heroBrand}>MiLaundry</Text>
        <Text style={styles.heroTagline}>Fresh clothes, handled for you</Text>
        <View style={styles.heroPill}>
          <Ionicons name="shirt" size={14} color="#FFFFFF" />
          <Text style={styles.heroPillText}>
            {active.length === 0
              ? 'No laundry in progress'
              : `${active.length} load${active.length > 1 ? 's' : ''} in progress`}
          </Text>
        </View>
      </View>

      {/* Quick actions grid, in the same tile language as the shop page. */}
      <Card>
        <View style={styles.grid}>
          {QUICK_ACTIONS.map((action) => (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={() => handleQuickAction(action.key)}
              style={({ pressed }) => [styles.tile, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.tileIcon, { backgroundColor: action.tint }]}>
                <Ionicons name={action.icon as never} size={22} color={action.fg} />
              </View>
              <Text style={styles.tileLabel}>{action.label}</Text>
            </Pressable>
          ))}
        </View>
      </Card>

      {error ? <ErrorText>{error.message}</ErrorText> : null}

      {/* Tracking: where each load sits in the washing cycle. */}
      <Text style={styles.sectionTitle}>Track your laundry</Text>
      {active.length === 0 && (
        <Card>
          <EmptyState message="No laundry in the wash right now. Book a service from a shop to start tracking." />
        </Card>
      )}
      {active.map((order) => (
        <TrackerCard
          key={order.id}
          order={order}
          onPress={() => router.push(`/(customer)/order/${order.id}` as never)}
        />
      ))}

      {past.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Past orders</Text>
          {past.map((order) => (
            <Pressable
              key={order.id}
              accessibilityRole="button"
              onPress={() => router.push(`/(customer)/order/${order.id}` as never)}
            >
              <Card compact>
                <Text style={styles.shopName}>{order.shop?.name ?? 'Laundry shop'}</Text>
                <StatusBadge status={order.status} />
                <Subtle>
                  {formatMoney(order.final_total ?? order.estimated_total)} ·{' '}
                  {formatDate(order.created_at)}
                </Subtle>
              </Card>
            </Pressable>
          ))}
        </>
      )}

      <Subtle onPress={() => signOut()}>Sign out</Subtle>
    </Screen>
  );
}

function TrackerCard({
  order,
  onPress,
}: {
  order: OrderWithDetails;
  onPress: () => void;
}) {
  const progress = washCycleProgress(order.status);

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card>
        <View style={styles.trackerHead}>
          <View style={{ flex: 1 }}>
            <Text style={styles.shopName}>{order.shop?.name ?? 'Laundry shop'}</Text>
            <Subtle>
              {formatMoney(order.final_total ?? order.estimated_total)}
              {order.final_total === null ? ' (estimated)' : ''}
            </Subtle>
          </View>
          <StatusBadge status={order.status} />
        </View>

        <View
          style={styles.progressTrack}
          accessibilityRole="progressbar"
          accessibilityValue={{ now: progress.percent, min: 0, max: 100 }}
        >
          <View style={[styles.progressFill, { width: `${progress.percent}%` }]} />
        </View>

        <View style={styles.stageRow}>
          {progress.steps.map((step) => (
            <StageDot key={step.status} step={step} />
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

function StageDot({ step }: { step: WashCycleStep }) {
  const isDone = step.state === 'done';
  const isCurrent = step.state === 'current';
  const background = isDone ? colors.success : isCurrent ? colors.primary : '#E2E8F0';
  const iconColor = isDone || isCurrent ? '#FFFFFF' : colors.subtle;

  return (
    <View style={styles.stage}>
      <View style={[styles.stageDot, { backgroundColor: background }]}>
        <Ionicons
          name={(isDone ? 'checkmark' : step.icon) as never}
          size={16}
          color={iconColor}
        />
      </View>
      <Text
        style={[styles.stageLabel, isCurrent && { color: colors.primary, fontWeight: '700' }]}
        numberOfLines={1}
      >
        {step.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  heroBrand: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroTagline: { color: '#D6ECFF', fontSize: 13 },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  tile: { width: '25%', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  tileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLabel: {
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text, marginTop: 4 },
  shopName: { fontWeight: '600', fontSize: 16, color: colors.text },
  trackerHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  progressFill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  stageRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stage: { flex: 1, alignItems: 'center', gap: 4 },
  stageDot: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stageLabel: { fontSize: 10, color: colors.subtle, textAlign: 'center' },
});
