/**
 * Four numbers the counter lives by, and the only filter it needs.
 *
 * The first three split the live queue — each order is counted in exactly one,
 * so the numbers add up instead of overlapping. The fourth is money, not
 * orders: what is owed on laundry that is ready or already gone. Colour means
 * one thing each — red overdue, green waiting at the counter, amber money owed
 * — and only while non-zero. The chosen tile inverts to ink rather than going
 * blue, because blue is already the buttons; tap it again to see everything.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoneyCompact } from '@/lib/domain/money';
import type { BoardView } from '@/lib/domain/order-board';
import type { QueueStats } from '@/lib/domain/order-queue';

import { RADII, colors, space, type } from './ui-kit';

type Tone = 'plain' | 'overdue' | 'ready' | 'owed';

interface Tile {
  view: BoardView;
  value: string;
  label: string;
  tone: Tone;
  spoken: string;
}

function tilesFor(stats: QueueStats): Tile[] {
  const owed = formatMoneyCompact(stats.toCollect);
  return [
    {
      view: 'overdue',
      value: String(stats.overdue),
      label: 'Overdue',
      tone: stats.overdue > 0 ? 'overdue' : 'plain',
      spoken: `${stats.overdue} overdue`,
    },
    {
      view: 'working',
      value: String(stats.inProgress),
      label: 'In progress',
      tone: 'plain',
      spoken: `${stats.inProgress} in progress`,
    },
    {
      view: 'ready',
      value: String(stats.ready),
      label: 'Ready',
      tone: stats.ready > 0 ? 'ready' : 'plain',
      spoken: `${stats.ready} ready for pickup`,
    },
    {
      view: 'collect',
      value: owed,
      label: 'To collect',
      tone: stats.toCollect > 0 ? 'owed' : 'plain',
      spoken: `${owed} to collect from ${stats.toCollectCount} orders`,
    },
  ];
}

const INK: Record<Tone, string> = {
  plain: colors.text,
  overdue: colors.dangerInk,
  ready: colors.moneyIn,
  owed: colors.moneyOut,
};

export function QueueTiles({
  stats,
  view,
  onChange,
}: {
  stats: QueueStats;
  view: BoardView;
  /** Called with `active` when the chosen tile is tapped again. */
  onChange: (next: BoardView) => void;
}) {
  return (
    <View style={styles.row} accessibilityRole="tablist">
      {tilesFor(stats).map((tile) => {
        const isSelected = tile.view === view;
        return (
          <Pressable
            key={tile.view}
            accessibilityRole="tab"
            accessibilityLabel={tile.spoken}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(isSelected ? 'active' : tile.view)}
            style={({ pressed }) => [
              styles.tile,
              isSelected && styles.tileOn,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[styles.value, { color: isSelected ? colors.onAccent : INK[tile.tone] }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {tile.value}
            </Text>
            <Text style={[styles.label, isSelected && styles.labelOn]} numberOfLines={1}>
              {tile.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.snug },
  tile: {
    flex: 1,
    minWidth: 0,
    gap: 1,
    paddingVertical: space.snug + 2,
    paddingHorizontal: space.snug + 2,
    borderRadius: RADII.control,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tileOn: { backgroundColor: colors.text, borderColor: colors.text },
  pressed: { opacity: 0.8 },
  value: { ...type.value },
  label: { ...type.caption, color: colors.subtle },
  labelOn: { color: '#C9D3DF' },
});
