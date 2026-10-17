/**
 * Four numbers the counter lives by, and the only filter it needs.
 *
 * The first three split the live queue — each order is counted in exactly one,
 * so the numbers add up instead of overlapping. The fourth is money, not
 * orders: what is owed on laundry that is ready or already gone.
 *
 * Each tile is set like an iOS widget: a glossy symbol tile in its colour, the
 * number large and clean, the label under it. Colour means one thing each —
 * red overdue, blue in the machines, green waiting at the counter, amber money
 * owed — and lives in the symbol and the number, never in a muddy fill: the
 * glass stays near-white so every tile reads crisp. At zero a tile goes calm
 * grey, so the eye lands only on what needs it. The chosen tile wears a ring
 * in its own colour; tap it again to see everything.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatMoneyCompact } from '@/lib/domain/money';
import type { BoardView } from '@/lib/domain/order-board';
import type { QueueStats } from '@/lib/domain/order-queue';
import { fontFor } from '@/lib/domain/design-scale';

import { GLASS_EDGE, GLASS_ELEVATION } from './glass';
import { GlyphTile } from './stage-glyph';
import { colors, space, type } from './ui-kit';

const TILE_RADIUS = 20;
const GLYPH = 26;

interface Tile {
  view: BoardView;
  value: string;
  label: string;
  /** The tile's colour, used only while it has something to count. */
  hue: string;
  /** The number's ink while live: the deeper, readable form of the hue. */
  ink: string;
  icon: string;
  isLive: boolean;
  spoken: string;
}

function tilesFor(stats: QueueStats): Tile[] {
  const owed = formatMoneyCompact(stats.toCollect);
  return [
    {
      view: 'overdue',
      value: String(stats.overdue),
      label: 'Overdue',
      hue: colors.danger,
      ink: colors.dangerInk,
      icon: 'alarm-outline',
      isLive: stats.overdue > 0,
      spoken: `${stats.overdue} overdue`,
    },
    {
      view: 'working',
      value: String(stats.inProgress),
      label: 'In progress',
      hue: colors.action,
      ink: colors.actionInk,
      icon: 'sync-outline',
      isLive: stats.inProgress > 0,
      spoken: `${stats.inProgress} in progress`,
    },
    {
      view: 'ready',
      value: String(stats.ready),
      label: 'Ready',
      hue: colors.success,
      ink: colors.moneyIn,
      icon: 'bag-check-outline',
      isLive: stats.ready > 0,
      spoken: `${stats.ready} ready for pickup`,
    },
    {
      view: 'collect',
      value: owed,
      label: 'To collect',
      hue: '#FF9500',
      ink: colors.moneyOut,
      icon: 'wallet-outline',
      isLive: stats.toCollect > 0,
      spoken: `${owed} to collect from ${stats.toCollectCount} orders`,
    },
  ];
}

/** A #RRGGBB colour at some alpha, as #RRGGBBAA. */
function alpha(hex: string, amount: number): string {
  return `${hex}${Math.round(amount * 255)
    .toString(16)
    .padStart(2, '0')}`;
}

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
              tile.isLive && { shadowColor: tile.hue, shadowOpacity: 0.14 },
              isSelected && {
                borderColor: tile.hue,
                shadowColor: tile.hue,
                shadowOpacity: 0.3,
              },
              pressed && styles.pressed,
            ]}
          >
            {/* The faintest wash of the hue from the top, so a live tile glows
                without its glass going muddy. */}
            {tile.isLive ? (
              <View
                pointerEvents="none"
                style={[styles.glow, { backgroundColor: alpha(tile.hue, isSelected ? 0.1 : 0.06) }]}
              />
            ) : null}
            <GlyphTile
              icon={tile.icon}
              color={tile.hue}
              size={GLYPH}
              isMuted={!tile.isLive}
              isLifted={false}
            />
            <Text
              style={[styles.value, { color: tile.isLive ? tile.ink : colors.subtle }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {tile.value}
            </Text>
            <Text
              style={[styles.label, isSelected && { color: tile.ink }]}
              numberOfLines={1}
            >
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
    gap: 6,
    paddingTop: space.snug + 2,
    paddingBottom: space.snug,
    paddingHorizontal: space.snug + 2,
    borderRadius: TILE_RADIUS,
    borderCurve: 'continuous',
    overflow: 'hidden',
    // Near-white glass: the hue lives in the symbol and the number.
    backgroundColor: 'rgba(255, 255, 255, 0.86)',
    borderWidth: 1.5,
    borderColor: GLASS_EDGE,
    shadowColor: '#1B2559',
    shadowOpacity: 0.07,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: GLASS_ELEVATION,
  },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: '60%' },
  pressed: { transform: [{ scale: 0.97 }] },
  value: {
    ...type.value,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
    ...fontFor(700),
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  label: { ...type.caption, fontSize: 12, lineHeight: 15, ...fontFor(500), color: colors.subtle },
});
