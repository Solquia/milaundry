/**
 * "In the shop": the owner's line-by-line view of a period, for when they are
 * not standing at the counter. Four figures on top (sold, paid, still unpaid,
 * supplies used), then every order — when, who for, who took it, paid or not,
 * what it used and what it left. Owner-only, like the costs it reads.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoney } from '@/lib/domain/money';
import type { BucketUnit } from '@/lib/domain/sales-period';
import type { LedgerRow, ShopLedger } from '@/lib/domain/shop-ledger';

import { glassPane } from './glass';
import { RADII, TAG_TONES, colors, space, type } from './ui-kit';

/** Enough to read a day at a glance; the rest is one tap away on Orders. */
const SHOWN_ROWS = 12;

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

function whenLabel(iso: string, unit: BucketUnit): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
  if (unit === 'hour') return time;
  return `${date.toLocaleDateString('en-PH', { weekday: 'short', day: 'numeric' })} · ${time}`;
}

function Figure({ label, value, ink }: { label: string; value: string; ink: string }) {
  return (
    <View style={styles.figure} accessible accessibilityLabel={`${label} ${value}`}>
      <Text style={[styles.figureValue, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.figureLabel} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function Row({ row, unit, onOpen }: { row: LedgerRow; unit: BucketUnit; onOpen: () => void }) {
  const who = row.takenBy ? `taken by ${row.takenBy}` : 'online';
  const used =
    row.supplies === null
      ? null
      : `used ${formatMoney(row.supplies)} · left ${formatMoney(row.profit ?? 0)}`;
  const tone = row.isPaid ? TAG_TONES.settled : TAG_TONES.owed;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${row.name}, ${formatMoney(row.total)}, ${row.isPaid ? 'paid' : 'unpaid'}, ${who}${
        used ? `, ${used}` : ''
      }. Open order`}
      onPress={onOpen}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowWords}>
        <Text style={styles.rowName} numberOfLines={1}>
          {row.name}
        </Text>
        <Text style={styles.rowLine} numberOfLines={1}>
          {whenLabel(row.createdAt, unit)} · {who}
        </Text>
        {used ? (
          <Text style={styles.rowLine} numberOfLines={1}>
            {used}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowFigures}>
        <Text style={styles.rowTotal}>{formatMoney(row.total)}</Text>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.pillText, { color: tone.ink }]}>{row.isPaid ? 'Paid' : 'Unpaid'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function ShopLedgerCard({
  ledger,
  unit,
  hasCosts,
  onOpenOrder,
  onOpenAll,
  onSetUpCosts,
}: {
  ledger: ShopLedger;
  unit: BucketUnit;
  /** False while costs load or if they failed; the money still shows. */
  hasCosts: boolean;
  onOpenOrder: (id: string) => void;
  onOpenAll: () => void;
  onSetUpCosts: () => void;
}) {
  const { rows, totals } = ledger;
  const hidden = rows.length - SHOWN_ROWS;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>In the shop · {plural(totals.taken, 'order')} taken</Text>
      <View style={styles.figures}>
        <Figure label="Sold" value={formatMoney(totals.sold)} ink={colors.text} />
        <Figure label="Cash in" value={formatMoney(totals.cashIn)} ink={colors.moneyIn} />
        <Figure
          label="Still unpaid"
          value={formatMoney(totals.toCollect)}
          ink={totals.toCollect > 0 ? colors.moneyOut : colors.subtle}
        />
        <Figure
          label="Supplies used"
          value={hasCosts ? formatMoney(totals.supplies) : '…'}
          ink={colors.text}
        />
      </View>
      <Text style={styles.note}>
        Cash in counts every payment made in this time, including orders from earlier days.
      </Text>
      {totals.uncosted > 0 ? (
        <Pressable accessibilityRole="button" onPress={onSetUpCosts} hitSlop={6}>
          <Text style={styles.link}>
            {plural(totals.uncosted, 'order')} with no supply cost set. Set costs ›
          </Text>
        </Pressable>
      ) : null}

      {rows.length === 0 ? (
        <Text style={styles.empty}>No orders taken yet.</Text>
      ) : (
        <View style={styles.list}>
          {rows.slice(0, SHOWN_ROWS).map((row) => (
            <Row key={row.id} row={row} unit={unit} onOpen={() => onOpenOrder(row.id)} />
          ))}
        </View>
      )}
      {hidden > 0 ? (
        <Pressable accessibilityRole="button" onPress={onOpenAll} hitSlop={6}>
          <Text style={styles.link}>See {plural(hidden, 'more order')} in Orders ›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassPane, borderRadius: RADII.card, padding: space.room, gap: space.snug },
  heading: { ...type.section, color: colors.text },
  figures: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.snug },
  figure: { flexBasis: '50%', flexGrow: 1, minWidth: 120, gap: 2, paddingRight: space.snug },
  figureValue: { ...type.value, fontSize: 20, letterSpacing: -0.3 },
  figureLabel: { ...type.caption, color: colors.subtle },
  note: { ...type.caption, color: colors.subtle },
  link: { ...type.caption, fontWeight: '700', color: colors.actionInk },
  empty: { ...type.body, color: colors.subtle, paddingVertical: space.snug },
  list: { marginTop: space.tight },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.snug,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(60, 60, 67, 0.18)',
  },
  pressed: { opacity: 0.7 },
  rowWords: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { ...type.body, fontWeight: '600', color: colors.text },
  rowLine: { ...type.caption, color: colors.subtle },
  rowFigures: { alignItems: 'flex-end', gap: 3 },
  rowTotal: { ...type.body, fontWeight: '700', color: colors.text },
  pill: { borderRadius: RADII.chip, paddingHorizontal: 6, paddingVertical: 1 },
  pillText: { fontSize: 11, fontWeight: '600' },
});
