/**
 * The Sales screen at a glance: one question — how am I doing? — answered in
 * about five seconds. The period is three tabs, the headline is what the shop
 * kept, and the three tiles underneath are the only other numbers, each of
 * which opens the list behind it. Charts, wallets, bestsellers and rush hours
 * live one tap away on the full analytics screen.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney, formatMoneyCompact } from '@/lib/domain/money';
import { keptHeadline, paceLine, type PaceTone } from '@/lib/domain/sales-display';
import type { PeriodKind } from '@/lib/domain/sales-period';

import { CROWN, RADII, TAG_TONES, colors, elevation, space, type } from './ui-kit';

export const GLANCE_KINDS: readonly { kind: PeriodKind; label: string }[] = [
  { kind: 'day', label: 'Today' },
  { kind: 'week', label: 'Week' },
  { kind: 'month', label: 'Month' },
];

const PACE_TONES: Record<PaceTone, { bg: string; ink: string; icon: string }> = {
  up: { ...TAG_TONES.settled, icon: 'trending-up' },
  down: { ...TAG_TONES.owed, icon: 'trending-down' },
  flat: { ...TAG_TONES.neutral, icon: 'remove' },
};

// The hero's quieter words sit in a green-grey that belongs to its surface.
const HERO_INK = '#3F5546';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export function PeriodTabs({
  value,
  isLive,
  onChange,
}: {
  value: PeriodKind;
  isLive: boolean;
  onChange: (kind: PeriodKind) => void;
}) {
  return (
    <View style={styles.tabRow}>
      <View style={styles.tabs} accessibilityRole="tablist">
        {GLANCE_KINDS.map((option) => {
          const isOn = option.kind === value;
          return (
            <Pressable
              key={option.kind}
              onPress={() => onChange(option.kind)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isOn }}
              style={[styles.tab, isOn && styles.tabOn]}
            >
              <Text style={[styles.tabText, isOn && styles.tabTextOn]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
      {isLive ? (
        <View style={styles.live} accessibilityLabel="Live, updates on its own">
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      ) : null}
    </View>
  );
}

export function KeptHero({
  kind,
  profit,
  spent,
  salesDelta,
  compareLabel,
  isLoading,
}: {
  kind: PeriodKind;
  profit: number;
  spent: number;
  salesDelta: number;
  compareLabel: string;
  isLoading: boolean;
}) {
  const isLoss = profit < 0;
  const pace = paceLine('sales', salesDelta, compareLabel);
  const look = PACE_TONES[pace.tone];
  const paceText = `Money in ${pace.text.charAt(0).toLowerCase()}${pace.text.slice(1)}`;

  return (
    <View style={styles.hero}>
      <Text style={styles.heroLabel}>{keptHeadline(kind, profit)}</Text>
      <Text
        style={[styles.heroFigure, isLoss && { color: colors.moneyOut }]}
        accessibilityRole="header"
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {isLoading ? '…' : formatMoney(Math.abs(profit))}
      </Text>
      <Text style={styles.heroNote}>
        {isLoading ? 'Adding up expenses…' : `after ${formatMoneyCompact(spent)} in expenses`}
      </Text>
      <View style={[styles.pace, { backgroundColor: look.bg }]}>
        <Ionicons name={look.icon as never} size={14} color={look.ink} />
        <Text style={[styles.paceText, { color: look.ink }]} numberOfLines={2}>
          {paceText}
        </Text>
      </View>
    </View>
  );
}

function Tile({
  label,
  value,
  link,
  tone,
  isWarm,
  onPress,
}: {
  label: string;
  value: string;
  link: string;
  tone: string;
  isWarm?: boolean;
  onPress: () => void;
}) {
  const ink = isWarm ? TAG_TONES.owed.ink : colors.actionInk;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}. ${link}`}
      style={({ pressed }) => [styles.tile, isWarm && styles.tileWarm, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.tileLabel, isWarm && { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.tileValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.tileLink, { color: ink }]} numberOfLines={1}>
        {link} ›
      </Text>
    </Pressable>
  );
}

export function MoneyTiles({
  moneyIn,
  payments,
  spent,
  expenses,
  unpaid,
  unpaidOrders,
  onOpenPayments,
  onOpenExpenses,
  onOpenUnpaid,
}: {
  moneyIn: number;
  payments: number;
  spent: number;
  expenses: number;
  unpaid: number;
  unpaidOrders: number;
  onOpenPayments: () => void;
  onOpenExpenses: () => void;
  onOpenUnpaid: () => void;
}) {
  return (
    <View style={styles.tiles}>
      <Tile
        label="Money in"
        value={formatMoneyCompact(moneyIn)}
        link={plural(payments, 'payment')}
        tone={colors.moneyIn}
        onPress={onOpenPayments}
      />
      <Tile
        label="Spent"
        value={formatMoneyCompact(spent)}
        link={plural(expenses, 'expense')}
        tone={colors.moneyOut}
        onPress={onOpenExpenses}
      />
      <Tile
        label="Still unpaid"
        value={formatMoneyCompact(unpaid)}
        link={plural(unpaidOrders, 'order')}
        tone={TAG_TONES.owed.ink}
        isWarm
        onPress={onOpenUnpaid}
      />
    </View>
  );
}

export function GlanceActions({
  canCloseDay,
  closeLabel,
  onAddExpense,
  onCloseDay,
}: {
  canCloseDay: boolean;
  closeLabel: string;
  onAddExpense: () => void;
  onCloseDay: () => void;
}) {
  return (
    <View style={styles.actions}>
      <Pressable
        onPress={onAddExpense}
        accessibilityRole="button"
        style={({ pressed }) => [styles.action, styles.actionPrimary, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={18} color={colors.onAccent} />
        <Text style={[styles.actionText, { color: colors.onAccent }]}>Add expense</Text>
      </Pressable>
      {canCloseDay ? (
        <Pressable
          onPress={onCloseDay}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, styles.actionQuiet, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="wallet-outline" size={18} color={colors.text} />
          <Text style={styles.actionText}>{closeLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function AnalyticsLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.linkIcon}>
        <Ionicons name="bar-chart-outline" size={20} color={colors.actionInk} />
      </View>
      <View style={styles.linkWords}>
        <Text style={styles.linkTitle}>See full analytics</Text>
        <Text style={styles.linkHint}>Charts, wallets, bestsellers, rush hours</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.subtle} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    gap: space.tight,
    padding: space.tight,
    borderRadius: RADII.control,
    backgroundColor: colors.border,
  },
  tab: {
    flex: 1,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.chip,
  },
  tabOn: { backgroundColor: colors.card, ...elevation.rest },
  tabText: { ...type.label, color: colors.subtle },
  tabTextOn: { color: colors.text },
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
  hero: {
    gap: space.snug,
    padding: space.section,
    ...CROWN,
    backgroundColor: colors.takingsSurface,
    borderWidth: 1,
    borderColor: colors.takingsBorder,
  },
  heroLabel: { ...type.label, color: HERO_INK },
  heroFigure: { ...type.hero, fontSize: 44, lineHeight: 50, color: colors.moneyIn },
  heroNote: { ...type.body, color: HERO_INK },
  pace: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    maxWidth: '100%',
    marginTop: space.tight,
    paddingHorizontal: space.cosy,
    paddingVertical: 5,
    borderRadius: RADII.pill,
  },
  paceText: { ...type.caption, fontWeight: '700', flexShrink: 1 },
  tiles: { flexDirection: 'row', gap: space.snug },
  tile: {
    flex: 1,
    minHeight: 92,
    gap: space.tight,
    paddingVertical: 14,
    paddingHorizontal: space.cosy,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  tileWarm: { backgroundColor: TAG_TONES.owed.bg },
  tileLabel: { ...type.caption, fontWeight: '600', color: colors.subtle },
  tileValue: { ...type.value, fontSize: 19 },
  tileLink: { ...type.caption, fontWeight: '700' },
  actions: { flexDirection: 'row', gap: space.snug },
  action: {
    flex: 1,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: RADII.pill,
  },
  actionPrimary: { backgroundColor: colors.action },
  actionQuiet: { backgroundColor: colors.card, borderWidth: 1.5, borderColor: colors.borderStrong },
  actionText: { ...type.label, color: colors.text },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  linkWords: { flex: 1, gap: 2 },
  linkTitle: { ...type.label, color: colors.text },
  linkHint: { ...type.caption, color: colors.subtle },
});
