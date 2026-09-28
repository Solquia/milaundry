/**
 * The takings: the period, the figure, how it is pacing, and the bars.
 *
 * The comparison is worded as a pace — "₱620 ahead of yesterday by 2:15 PM" —
 * because a percentage of a half-finished day told owners they were failing
 * every morning. The period pill opens the picker; the arrows either side of
 * it step through history without opening anything. The figure has a way in:
 * "View 23 payments" lists every peso behind it.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { METRIC_LOOKS, formatMetric, paceLine, type PaceTone } from '@/lib/domain/sales-display';
import type { MetricKey, SalesSummary } from '@/lib/domain/sales-metrics';
import type { PeriodFrame } from '@/lib/domain/sales-period';

import { GoalBar } from './goal-bar';
import { MetricSwitcher } from './metric-switcher';
import { SalesChart } from './sales-chart';
import { CROWN, RADII, TAG_TONES, colors, elevation, space, type } from './ui-kit';

const PACE_TONES: Record<PaceTone, { bg: string; ink: string; icon: string }> = {
  up: { ...TAG_TONES.settled, icon: 'trending-up' },
  down: { ...TAG_TONES.owed, icon: 'trending-down' },
  flat: { ...TAG_TONES.neutral, icon: 'remove' },
};

function StepButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: (() => void) | null }) {
  return (
    <Pressable
      onPress={onPress ?? undefined}
      disabled={!onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !onPress }}
      style={({ pressed }) => [styles.step, !onPress && styles.stepOff, pressed && { opacity: 0.6 }]}
    >
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

export function SalesHero({
  frame,
  sales,
  metric,
  onMetric,
  onOpenPeriods,
  onStepBack,
  onStepForward,
  goal,
  onEditGoal,
  onOpenPayments,
}: {
  frame: PeriodFrame;
  sales: SalesSummary;
  metric: MetricKey;
  onMetric: (next: MetricKey) => void;
  onOpenPeriods: () => void;
  onStepBack: () => void;
  onStepForward: (() => void) | null;
  goal: number | null;
  onEditGoal: () => void;
  onOpenPayments: () => void;
}) {
  const current = sales.metrics[metric];
  const pace = paceLine(metric, current.delta, frame.compareLabel);
  const look = PACE_TONES[pace.tone];
  const isToday = frame.isLive && frame.period.kind === 'day';
  const count = sales.payments.length;

  return (
    <View style={styles.hero}>
      <View style={styles.topRow}>
        <StepButton icon="chevron-back" label="Earlier period" onPress={onStepBack} />
        <Pressable
          onPress={onOpenPeriods}
          accessibilityRole="button"
          accessibilityLabel={`Period: ${frame.title}. Change it.`}
          style={({ pressed }) => [styles.periodPill, pressed && { opacity: 0.75 }]}
        >
          <Text style={styles.periodText} numberOfLines={1}>
            {frame.title}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.text} />
        </Pressable>
        <StepButton icon="chevron-forward" label="Later period" onPress={onStepForward} />
        <View style={styles.spacer} />
        {frame.isLive ? (
          <View style={styles.live} accessibilityLabel="Live, updates on its own">
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.figureBlock}>
        <Text style={styles.label}>
          {METRIC_LOOKS[metric].label} · {frame.caption}
        </Text>
        <Text
          style={[styles.figure, metric !== 'sales' && metric !== 'basket' && { color: colors.text }]}
          accessibilityRole="header"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {formatMetric(metric, current.total)}
        </Text>
        <View style={[styles.pace, { backgroundColor: look.bg }]}>
          <Ionicons name={look.icon as never} size={14} color={look.ink} />
          <Text style={[styles.paceText, { color: look.ink }]} numberOfLines={2}>
            {pace.text}
          </Text>
        </View>
      </View>

      {isToday && metric === 'sales' ? (
        <GoalBar collected={current.total} goal={goal} onEdit={onEditGoal} />
      ) : null}

      <MetricSwitcher metrics={sales.metrics} value={metric} onChange={onMetric} />

      <SalesChart
        buckets={frame.buckets}
        series={current.series}
        compareSeries={current.compareSeries}
        metric={metric}
        unit={frame.unit}
        compareLabel={frame.compareLabel}
      />

      <View style={styles.footer}>
        <Text style={styles.clock}>{METRIC_LOOKS[metric].clock}</Text>
        <Pressable
          onPress={onOpenPayments}
          accessibilityRole="button"
          hitSlop={8}
          style={({ pressed }) => [styles.receipts, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="receipt-outline" size={15} color={colors.actionInk} />
          <Text style={styles.receiptsText}>
            {count === 0 ? 'No payments yet' : `View ${count} payment${count === 1 ? '' : 's'}`}
          </Text>
          {count > 0 ? <Ionicons name="chevron-forward" size={14} color={colors.actionInk} /> : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: space.room,
    padding: space.room,
    ...CROWN,
    backgroundColor: colors.takingsSurface,
    borderWidth: 1,
    borderColor: colors.takingsBorder,
    ...elevation.rest,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.tight },
  step: {
    width: 32,
    height: 32,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  stepOff: { opacity: 0.3 },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 170,
    paddingHorizontal: space.cosy,
    height: 32,
    borderRadius: RADII.pill,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  periodText: { ...type.label, color: colors.text, flexShrink: 1 },
  spacer: { flex: 1 },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.snug,
    paddingVertical: 4,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(11, 122, 69, 0.12)',
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.moneyIn },
  liveText: { fontSize: 12, fontWeight: '700', color: colors.moneyIn },
  figureBlock: { gap: space.tight },
  label: { ...type.label, color: colors.subtle },
  figure: { ...type.hero, fontSize: 40, lineHeight: 46, color: colors.moneyIn },
  pace: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    maxWidth: '100%',
    paddingHorizontal: space.cosy,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  paceText: { ...type.caption, fontWeight: '700', flexShrink: 1 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.snug },
  clock: { ...type.caption, color: colors.subtle, flexShrink: 1 },
  receipts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  receiptsText: { ...type.caption, fontWeight: '700', color: colors.actionInk },
});