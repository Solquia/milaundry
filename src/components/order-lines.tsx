/**
 * What is on the ticket, printed on the same paper stock the till writes on.
 *
 * An itemised list with a total under it is a receipt, and drawing it as one
 * tells the owner what they are looking at before they read a word. The
 * figures are monospaced because a thermal printer's are, and that is what
 * makes a column of pesos add up by eye. Nothing here is editable — the
 * weigh sheet under it is where the price changes.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { OrderWithDetails } from '@/lib/api';
import { formatMoneyCompact } from '@/lib/domain/money';
import { shortOrderId } from '@/lib/domain/order-card';
import type { OrderItemRow } from '@/lib/types';

import { TORN_EDGE_HEIGHT, TicketPerforation, TornEdge } from './torn-edge';
import { colors, formatMoney, formatWhen, mono, space } from './ui-kit';

function quantityLine(item: OrderItemRow): string {
  switch (item.unit) {
    case 'per_kg':
      return `${item.quantity} kg × ${formatMoneyCompact(item.unit_price)}`;
    case 'per_item':
      return `${item.quantity} × ${formatMoneyCompact(item.unit_price)}`;
    case 'flat':
      return 'Flat rate';
  }
}

export function OrderLines({ order, now }: { order: OrderWithDetails; now: Date }) {
  const [width, setWidth] = useState(0);
  const total = order.final_total ?? order.estimated_total;
  const isEstimate = (order.final_total ?? null) === null;
  const isWeighed = order.actual_weight_kg !== null;

  return (
    <View
      style={styles.paper}
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        setWidth((current) => (current === next ? current : next));
      }}
    >
      <TornEdge width={width} color={colors.bg} edge="top" />

      <View style={styles.body}>
        <View style={styles.headRow}>
          <Text style={styles.meta}>
            {order.order_type === 'walk_in' ? 'WALK-IN TICKET' : 'ONLINE BOOKING'}
          </Text>
          <Text style={styles.meta}>{shortOrderId(order.id).toUpperCase()}</Text>
        </View>
        <View style={styles.dottedRule} />

        {order.order_items.map((item) => (
          <View key={item.id} style={styles.line}>
            <View style={styles.lineTop}>
              <Text style={styles.lineName} numberOfLines={2}>
                {item.service_name}
              </Text>
              <View style={styles.leader} />
              <Text style={styles.lineMoney}>{formatMoney(item.subtotal)}</Text>
            </View>
            <Text style={styles.lineQuantity}>{quantityLine(item)}</Text>
          </View>
        ))}
      </View>

      <TicketPerforation color={colors.bg} ruleColor={colors.paperRule} />

      <View style={styles.stub}>
        {isWeighed ? (
          <Text style={styles.note}>
            Weighed {order.actual_weight_kg} kg
            {order.weighed_at ? ` · ${formatWhen(order.weighed_at, now)}` : ''}
          </Text>
        ) : null}
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{isEstimate ? 'ESTIMATED TOTAL' : 'TOTAL'}</Text>
          <Text style={styles.totalValue}>{formatMoney(total)}</Text>
        </View>
        {isEstimate && order.status !== 'cancelled' ? (
          <Text style={styles.note}>The final price is set once the load is weighed.</Text>
        ) : null}
      </View>

      <TornEdge width={width} color={colors.bg} edge="bottom" />
    </View>
  );
}

const styles = StyleSheet.create({
  /** Flat on the page, square-cornered, no shadow: a slip, not a card. */
  paper: {
    backgroundColor: colors.paper,
    paddingTop: TORN_EDGE_HEIGHT,
    paddingBottom: TORN_EDGE_HEIGHT,
    overflow: 'hidden',
  },
  body: { paddingHorizontal: space.room, paddingVertical: space.cosy, gap: space.cosy },
  headRow: { flexDirection: 'row', justifyContent: 'space-between', gap: space.snug },
  meta: { fontFamily: mono, fontSize: 11, letterSpacing: 0.8, color: colors.subtle },
  dottedRule: { borderBottomWidth: 1, borderStyle: 'dashed', borderColor: colors.paperRule },
  line: { gap: 2 },
  lineTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.snug },
  lineName: { flexShrink: 1, fontFamily: mono, fontSize: 14, color: colors.text },
  leader: {
    flex: 1,
    minWidth: space.room,
    borderBottomWidth: 1,
    borderStyle: 'dotted',
    borderColor: colors.paperRule,
    marginBottom: 3,
  },
  lineMoney: { fontFamily: mono, fontSize: 14, fontWeight: '700', color: colors.text },
  lineQuantity: { fontFamily: mono, fontSize: 12, color: colors.subtle },
  stub: { paddingHorizontal: space.room, paddingVertical: space.cosy, gap: space.snug },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  totalLabel: { fontFamily: mono, fontSize: 12, letterSpacing: 0.8, color: colors.subtle },
  totalValue: { fontFamily: mono, fontSize: 20, fontWeight: '700', color: colors.text },
  note: { fontFamily: mono, fontSize: 12, color: colors.subtle },
});
