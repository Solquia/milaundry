/**
 * "Stock & supplies" on Sales: the shelf and the bottles, for an owner who is
 * not in the shop. What to restock, which add-ons sold and how many are left,
 * how much of each free supply the period's loads used, and which costs are
 * still missing — with one way through to Prices to fix any of it.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { STOCK_STATUS_LABEL } from '@/lib/domain/addon-inventory';
import { formatMoney } from '@/lib/domain/money';
import { SUPPLY_UNIT_LABEL } from '@/lib/domain/service-costs';
import type { ShopStock } from '@/lib/domain/shop-stock';

import { glassPane } from './glass';
import { RADII, TAG_TONES, colors, space, type } from './ui-kit';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

const amountLabel = (amount: number, unit: keyof typeof SUPPLY_UNIT_LABEL): string =>
  `${amount.toLocaleString('en-PH', { maximumFractionDigits: 1 })} ${SUPPLY_UNIT_LABEL[unit]}`;

function Line({ left, right, tone }: { left: string; right: string; tone?: 'owed' | 'danger' }) {
  const ink = tone === 'danger' ? colors.dangerInk : tone === 'owed' ? TAG_TONES.owed.ink : colors.text;
  return (
    <View style={styles.line} accessible accessibilityLabel={`${left}, ${right}`}>
      <Text style={styles.lineLeft} numberOfLines={1}>
        {left}
      </Text>
      <Text style={[styles.lineRight, { color: ink }]} numberOfLines={1}>
        {right}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

export function ShopStockCard({
  stock,
  isLoading,
  onManage,
}: {
  stock: ShopStock;
  isLoading: boolean;
  onManage: () => void;
}) {
  const hasRestock = stock.restock.length > 0;

  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Stock & supplies</Text>

      <Section title={hasRestock ? `Restock · ${stock.restock.length}` : 'Shelf'}>
        {hasRestock ? (
          stock.restock.map((line) => (
            <Line
              key={line.addon.id}
              left={line.addon.name}
              right={line.status === 'out' ? STOCK_STATUS_LABEL.out : `${line.left} left`}
              tone={line.status === 'out' ? 'danger' : 'owed'}
            />
          ))
        ) : (
          <Text style={styles.quiet}>{isLoading ? 'Checking the shelf…' : 'Nothing is low or out.'}</Text>
        )}
        {stock.uncounted > 0 ? (
          <Text style={styles.quiet}>{plural(stock.uncounted, 'add-on')} not counted yet, so not tracked.</Text>
        ) : null}
      </Section>

      <Section title="Add-ons sold">
        {stock.addonsSold.length === 0 ? (
          <Text style={styles.quiet}>None sold yet.</Text>
        ) : (
          stock.addonsSold.map((row) => (
            <Line
              key={row.id}
              left={`${row.name} ×${row.quantity}`}
              right={row.left === null ? 'not counted' : `${row.left} left`}
              tone={row.status === 'out' ? 'danger' : row.status === 'low' ? 'owed' : undefined}
            />
          ))
        )}
      </Section>

      <Section title={`Supplies used · ${formatMoney(stock.suppliesCost)}`}>
        {stock.supplies.length === 0 ? (
          <Text style={styles.quiet}>
            {isLoading ? 'Adding up supplies…' : 'No free supplies used yet, or none set up in Prices.'}
          </Text>
        ) : (
          stock.supplies.map((row) => (
            <Line
              key={row.id}
              left={`${row.name} · ${amountLabel(row.amount, row.unit)}`}
              right={`${row.packs} ${row.packs === 1 ? 'pack' : 'packs'} · ${formatMoney(row.cost)}`}
            />
          ))
        )}
      </Section>

      {stock.addonsWithoutCost > 0 ? (
        <Text style={styles.warn}>
          {plural(stock.addonsWithoutCost, 'add-on')} on sale with no cost price, so their profit is unknown.
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={onManage}
        hitSlop={6}
        style={({ pressed }) => pressed && styles.pressed}
      >
        <Text style={styles.link}>Manage stock, costs and prices ›</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { ...glassPane, borderRadius: RADII.card, padding: space.room, gap: space.cosy },
  heading: { ...type.section, color: colors.text },
  section: { gap: 4 },
  sectionTitle: {
    ...type.caption,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.subtle,
  },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: space.cosy, paddingVertical: 2 },
  lineLeft: { ...type.body, color: colors.text, flexShrink: 1 },
  lineRight: { ...type.body, fontWeight: '600' },
  quiet: { ...type.caption, color: colors.subtle },
  warn: { ...type.caption, fontWeight: '600', color: TAG_TONES.owed.ink },
  link: { ...type.caption, fontWeight: '700', color: colors.actionInk },
  pressed: { opacity: 0.7 },
});
