/**
 * The ticket, while it is still being written.
 *
 * The customer's order screen prints a finished docket on paper stock; this is
 * the same slip a step earlier, when every line can still be changed. It is
 * paper for the same reason: an itemised list with a total under it is a
 * receipt, and calling it one tells the merchant exactly what they are looking
 * at before they read a word. The controls are the only thing on it that a
 * printer could not have put there.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ticketCountLabel } from '@/lib/domain/pos-ticket';
import { intakeLines } from '@/lib/domain/service-intake';
import type { ServiceRow } from '@/lib/types';

import { TORN_EDGE_HEIGHT, TicketPerforation, TornEdge } from './torn-edge';
import { colors, formatMoney, mono, space, type } from './ui-kit';

function DottedRule() {
  return <View style={styles.dottedRule} />;
}

/** A square key on the slip: − and + for pieces, the bin for any line. */
function LineKey({
  glyph,
  label,
  onPress,
  disabled,
  tone = 'ink',
}: {
  glyph: 'remove' | 'add' | 'trash-outline';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'ink' | 'danger';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space.tight}
      style={({ pressed }) => [
        styles.key,
        disabled && styles.keyOff,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Ionicons
        name={glyph}
        size={18}
        color={
          disabled ? colors.borderStrong : tone === 'danger' ? colors.dangerInk : colors.actionInk
        }
      />
    </Pressable>
  );
}

export function TicketSlip({
  services,
  quantities,
  total,
  onAdjust,
  onWeigh,
  onRemove,
}: {
  services: readonly ServiceRow[];
  quantities: Readonly<Record<string, number>>;
  /** Null when a price could not be read; the slip then shows no figure. */
  total: number | null;
  onAdjust: (service: ServiceRow, step: number) => void;
  onWeigh: (service: ServiceRow) => void;
  onRemove: (service: ServiceRow) => void;
}) {
  const [width, setWidth] = useState(0);
  const lines = intakeLines(services, quantities);
  const byId = new Map(services.map((service) => [service.id, service]));
  const hasWeighed = lines.some((line) => byId.get(line.serviceId)?.unit === 'per_kg');

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
          <Text style={styles.meta}>WALK-IN TICKET</Text>
          <Text style={styles.meta}>{ticketCountLabel(lines.length).toUpperCase()}</Text>
        </View>
        <DottedRule />

        {lines.map((line) => {
          const service = byId.get(line.serviceId);
          if (!service) return null;
          const quantity = quantities[service.id] ?? 0;
          return (
            <View key={line.serviceId} style={styles.line}>
              <View style={styles.lineTop}>
                <Text style={styles.lineName} numberOfLines={2}>
                  {line.name}
                </Text>
                <View style={styles.leader} />
                <Text style={styles.lineMoney}>{formatMoney(line.subtotal)}</Text>
              </View>

              <View style={styles.lineControls}>
                {service.unit === 'per_item' ? (
                  <View style={styles.counter}>
                    <LineKey
                      glyph="remove"
                      label={`One less ${service.name}`}
                      disabled={quantity <= 1}
                      onPress={() => onAdjust(service, -1)}
                    />
                    <Text style={styles.lineQuantity} accessibilityLiveRegion="polite">
                      {line.quantity}
                    </Text>
                    <LineKey
                      glyph="add"
                      label={`One more ${service.name}`}
                      onPress={() => onAdjust(service, 1)}
                    />
                  </View>
                ) : service.unit === 'per_kg' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${service.name}, ${line.quantity}. Change the weight`}
                    onPress={() => onWeigh(service)}
                    style={({ pressed }) => [styles.weighKey, pressed && styles.pressed]}
                  >
                    <Ionicons name="scale-outline" size={16} color={colors.actionInk} />
                    <Text style={styles.weighText}>{line.quantity}</Text>
                    <Text style={styles.weighChange}>Change</Text>
                  </Pressable>
                ) : (
                  <Text style={styles.lineQuantityQuiet}>Charged once</Text>
                )}
                <View style={styles.spacer} />
                <LineKey
                  glyph="trash-outline"
                  label={`Take ${service.name} off the ticket`}
                  tone="danger"
                  onPress={() => onRemove(service)}
                />
              </View>
            </View>
          );
        })}
      </View>

      <TicketPerforation color={colors.bg} ruleColor={colors.paperRule} />

      <View style={styles.stub}>
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>{hasWeighed ? 'ESTIMATED TOTAL' : 'TOTAL'}</Text>
          <Text style={styles.totalValue}>{total === null ? '—' : formatMoney(total)}</Text>
        </View>
        {hasWeighed ? (
          <Text style={styles.note}>You can set the final price after weighing.</Text>
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

  line: { gap: space.snug },
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
  lineControls: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  spacer: { flex: 1 },

  counter: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  key: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.paperRule,
    backgroundColor: colors.card,
  },
  keyOff: { backgroundColor: 'transparent' },
  /** Wide enough for "12 pieces" so the + key does not walk as the count grows. */
  lineQuantity: {
    minWidth: 76,
    textAlign: 'center',
    fontFamily: mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  lineQuantityQuiet: { fontFamily: mono, fontSize: 13, color: colors.subtle },

  weighKey: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 40,
    paddingHorizontal: space.cosy,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.actionMuted,
    backgroundColor: colors.card,
  },
  weighText: { fontFamily: mono, fontSize: 14, fontWeight: '700', color: colors.text },
  weighChange: { ...type.label, color: colors.actionInk },

  stub: { paddingHorizontal: space.room, paddingTop: space.snug, gap: space.tight },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.cosy,
  },
  totalLabel: { fontFamily: mono, fontSize: 12, letterSpacing: 0.8, color: colors.subtle },
  totalValue: { fontFamily: mono, fontSize: 24, fontWeight: '700', color: colors.text },
  note: { ...type.caption, fontSize: 13, color: colors.subtle },

  pressed: { opacity: 0.7 },
});
