import { Ionicons } from '@expo/vector-icons';
import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ExpenseBreakdown } from '@/components/expense-breakdown';
import { ExpenseSheet } from '@/components/expense-sheet';
import { PeriodSheet } from '@/components/period-sheet';
import { SectionHeading } from '@/components/section-heading';
import {
  EmptyState,
  ErrorState,
  Loading,
  RADII,
  Screen,
  TAG_TONES,
  colors,
  elevation,
  space,
  type,
} from '@/components/ui-kit';
import { CATEGORY_LOOKS, PAID_FROM_LABELS } from '@/lib/domain/expense-categories';
import { dayLabel, toDateKey, type Expense } from '@/lib/domain/expense-metrics';
import { canOpenMerchantRoute } from '@/lib/domain/merchant-access';
import { formatMoney } from '@/lib/domain/money';
import { frameFor, stepPeriod, type PeriodKind, type SalesPeriod } from '@/lib/domain/sales-period';
import { useActiveShop } from '@/lib/use-active-shop';
import { useHaptic } from '@/lib/use-app-settings';
import { useNow } from '@/lib/use-now';
import { useShopExpenses } from '@/lib/use-shop-expenses';

const KINDS: readonly PeriodKind[] = ['day', 'week', 'month', 'year'];
const THIS_MONTH: SalesPeriod = { kind: 'month', offset: 0 };

/** The period the Sales screen was showing, or this month when opened cold. */
function periodFromParams(kind?: string, offset?: string): SalesPeriod {
  const parsed = Number(offset);
  if (!KINDS.includes(kind as PeriodKind) || !Number.isInteger(parsed) || parsed > 0) return THIS_MONTH;
  return { kind: kind as PeriodKind, offset: parsed };
}

type Editing = { expense: Expense | null } | null;

/**
 * Expenses: what the shop paid out, for the same periods the Sales screen
 * counts money in. The total leads, measured against the period before up to
 * the same point; then where it went; then every expense by day, each one a
 * tap from being corrected. Owner-only, like the takings beside it.
 */
export default function MerchantExpenses() {
  const haptic = useHaptic();
  const params = useLocalSearchParams<{ kind?: string; offset?: string }>();
  const { shop, shopRole, isLoading: isShopLoading } = useActiveShop();
  const now = useNow();
  const [period, setPeriod] = useState<SalesPeriod>(() => periodFromParams(params.kind, params.offset));
  const [isPicking, setIsPicking] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [notice, setNotice] = useState('');

  const frame = useMemo(() => frameFor(period, now), [period, now]);
  const today = toDateKey(now);
  const { summary, isLoading, error, refetch } = useShopExpenses(shop?.id, frame);

  if (isShopLoading) return <Loading />;
  if (!canOpenMerchantRoute(shopRole, 'expenses')) return <Redirect href="/(merchant)/orders" />;
  if (!shop) {
    return <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />;
  }

  const later = stepPeriod(period, 1);
  const choosePeriod = (next: SalesPeriod) => {
    haptic('select');
    setPeriod(next);
    setIsPicking(false);
  };
  const isUp = summary.delta > 0;
  const paceTone = summary.delta === 0 ? TAG_TONES.neutral : isUp ? TAG_TONES.owed : TAG_TONES.settled;
  const paceText =
    summary.compareTotal === 0 && summary.total === 0
      ? `Nothing logged vs ${frame.compareLabel}`
      : `${formatMoney(Math.abs(summary.delta))} ${isUp ? 'more' : 'less'} than ${frame.compareLabel}`;

  return (
    <View style={styles.shell}>
      <Screen>
        {error ? (
          <ErrorState message="Could not load expenses. Check your connection." onRetry={() => refetch()} />
        ) : null}
        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <View style={styles.hero}>
          <View style={styles.topRow}>
            <Pressable
              onPress={() => choosePeriod(stepPeriod(period, -1) ?? period)}
              accessibilityRole="button"
              accessibilityLabel="Earlier period"
              hitSlop={8}
              style={styles.step}
            >
              <Ionicons name="chevron-back" size={18} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={() => setIsPicking(true)}
              accessibilityRole="button"
              accessibilityLabel={`Period: ${frame.title}. Change it.`}
              style={styles.periodPill}
            >
              <Text style={styles.periodText} numberOfLines={1}>
                {frame.title}
              </Text>
              <Ionicons name="chevron-down" size={14} color={colors.text} />
            </Pressable>
            <Pressable
              onPress={later ? () => choosePeriod(later) : undefined}
              disabled={!later}
              accessibilityRole="button"
              accessibilityLabel="Later period"
              accessibilityState={{ disabled: !later }}
              hitSlop={8}
              style={[styles.step, !later && styles.stepOff]}
            >
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          </View>
          <Text style={styles.label}>Spent · {frame.caption}</Text>
          <Text style={styles.figure} accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            {isLoading ? '…' : formatMoney(summary.total)}
          </Text>
          <View style={[styles.pace, { backgroundColor: paceTone.bg }]}>
            <Text style={[styles.paceText, { color: paceTone.ink }]}>{paceText}</Text>
          </View>
        </View>

        {summary.byCategory.length > 0 ? (
          <>
            <SectionHeading title="Where it went" caption={frame.caption} />
            <ExpenseBreakdown shares={summary.byCategory} />
          </>
        ) : null}

        <SectionHeading
          title="Every expense"
          caption={summary.count === 0 ? 'None yet' : `${summary.count} in ${frame.caption}`}
        />
        {summary.days.length === 0 && !isLoading ? (
          <EmptyState
            message="No expenses logged for this period. Log detergent, bills and rent as you pay them to see your real profit."
            actionLabel="Add expense"
            onAction={() => setEditing({ expense: null })}
          />
        ) : null}
        {summary.days.map((day) => (
          <View key={day.date} style={styles.day}>
            <View style={styles.dayHead}>
              <Text style={styles.dayLabel}>{dayLabel(day.date, today)}</Text>
              <Text style={styles.dayTotal}>{formatMoney(day.total)}</Text>
            </View>
            {day.items.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setEditing({ expense: item })}
                accessibilityRole="button"
                accessibilityHint="Edit or delete"
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name={CATEGORY_LOOKS[item.category].icon as never} size={18} color={colors.subtle} />
                <View style={styles.rowWords}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {item.note || CATEGORY_LOOKS[item.category].label}
                  </Text>
                  <Text style={styles.rowHint}>
                    {CATEGORY_LOOKS[item.category].label} · {PAID_FROM_LABELS[item.paid_from]}
                  </Text>
                </View>
                <Text style={styles.rowAmount}>{formatMoney(item.amount)}</Text>
              </Pressable>
            ))}
          </View>
        ))}
        {/* Room so the last row is never under the floating button. */}
        <View style={styles.fabClearance} />
      </Screen>

      <Pressable
        onPress={() => setEditing({ expense: null })}
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={22} color={colors.onAccent} />
        <Text style={styles.fabText}>Add expense</Text>
      </Pressable>

      <PeriodSheet
        visible={isPicking}
        value={period}
        title="Show expenses for"
        onChoose={choosePeriod}
        onClose={() => setIsPicking(false)}
      />
      {/* Mounted per opening, so each form starts from the expense it edits. */}
      {editing ? (
        <ExpenseSheet
          visible
          shopId={shop.id}
          expense={editing.expense}
          today={today}
          onSaved={(message) => {
            haptic('success');
            setNotice(message);
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1, backgroundColor: colors.bg },
  notice: { ...type.caption, color: colors.moneyIn, fontWeight: '700' },
  hero: {
    gap: space.snug,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: space.tight, marginBottom: space.snug },
  step: {
    width: 32,
    height: 32,
    borderRadius: RADII.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
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
    backgroundColor: colors.sunken,
  },
  periodText: { ...type.label, color: colors.text, flexShrink: 1 },
  label: { ...type.label, color: colors.subtle },
  figure: { ...type.hero, fontSize: 40, lineHeight: 46, color: colors.text },
  pace: {
    alignSelf: 'flex-start',
    maxWidth: '100%',
    paddingHorizontal: space.cosy,
    paddingVertical: 4,
    borderRadius: RADII.pill,
  },
  paceText: { ...type.caption, fontWeight: '700' },
  day: {
    gap: space.snug,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.card,
    ...elevation.rest,
  },
  dayHead: { flexDirection: 'row', justifyContent: 'space-between' },
  dayLabel: { ...type.label, color: colors.subtle },
  dayTotal: { ...type.label, color: colors.subtle },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.cosy, paddingVertical: space.tight },
  rowWords: { flex: 1, gap: 2 },
  rowTitle: { ...type.label, color: colors.text },
  rowHint: { ...type.caption, color: colors.subtle },
  rowAmount: { ...type.label, color: colors.text },
  fabClearance: { height: 64 },
  fab: {
    position: 'absolute',
    right: space.room,
    bottom: space.room,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.room,
    height: 48,
    borderRadius: RADII.pill,
    backgroundColor: colors.action,
    ...elevation.rest,
  },
  fabText: { ...type.label, color: colors.onAccent },
});
