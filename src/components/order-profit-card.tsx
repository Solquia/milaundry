/**
 * What one order made the shop: its lines less the supplies its services used
 * and what its add-ons cost (0050, 0051). The owner's alone; staff never get
 * this card, and the database refuses them the figures.
 */
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { OrderWithDetails } from '@/lib/api';
import { getOrderCosts } from '@/lib/cost-api';
import { formatMoney } from '@/lib/domain/money';
import { orderProfit } from '@/lib/domain/service-costs';

import { Card, colors, fontFor, space, type } from './ui-kit';

export function OrderProfitCard({ order }: { order: OrderWithDetails }) {
  const items = order.order_items ?? [];
  const costs = useQuery({
    queryKey: ['order-costs', order.id, items.map((item) => `${item.id}:${item.subtotal}`).join(',')],
    queryFn: () => getOrderCosts(order.id),
  });

  // A cost that fails to load costs the owner a figure, never the order screen.
  if (!costs.data || items.length === 0) return null;
  const summary = orderProfit(items, costs.data);
  if (summary.uncosted === items.length) return null;

  return (
    <Card>
      <Text style={styles.heading}>Profit · only you see this</Text>
      <View style={styles.row}>
        <Text style={styles.label}>Sales</Text>
        <Text style={styles.value}>{formatMoney(summary.revenue)}</Text>
      </View>
      <View style={styles.row}>
        <Text style={styles.label}>Supplies and products</Text>
        <Text style={styles.value}>{`− ${formatMoney(summary.cost)}`}</Text>
      </View>
      <View style={[styles.row, styles.total]}>
        <Text style={styles.totalLabel}>Profit</Text>
        <Text style={styles.totalValue}>{formatMoney(summary.profit)}</Text>
      </View>
      {summary.uncosted > 0 ? (
        <Text style={styles.note}>
          {summary.uncosted === 1
            ? '1 line has no cost set and is left out.'
            : `${summary.uncosted} lines have no cost set and are left out.`}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { ...type.section, color: colors.text, marginBottom: space.tight },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  label: { ...type.body, color: colors.subtle },
  value: { ...type.body, color: colors.text },
  total: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.subtle, marginTop: 4, paddingTop: 6 },
  totalLabel: { ...type.body, ...fontFor(800), color: colors.text },
  totalValue: { ...type.body, ...fontFor(800), color: colors.text },
  note: { ...type.caption, color: colors.subtle, marginTop: space.tight },
});
