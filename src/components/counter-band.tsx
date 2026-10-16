/**
 * The bar across the top of the till.
 *
 * It used to be a full band in the shop's colour — shop name, a two-line
 * question, a step rail — that ate a third of a phone before the first item
 * a counter could tap. Taking in an order is the whole job of this screen, so
 * the chrome is now one slim frosted bar and the items start right under it:
 *
 *   [shop tile] Shop name · Owner        [ Items | Checkout ]  (⚙)
 *
 * The shop's colour survives where it means something — its glossy tile and
 * the step you are on — instead of painting the whole top of the screen. The
 * question ("What came in?") is gone: the lit step already says it. Steps
 * work the way they always did; a step not reached yet cannot be jumped to.
 *
 * It claims the status bar itself, because the screen it heads has no header.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GLASS_EDGE } from './glass';
import { GlyphTile } from './stage-glyph';
import { colors, space, type } from './ui-kit';
import { fontFor } from '@/lib/domain/design-scale';
import { stepAnnouncement, stepRail, type StepSpec } from '@/lib/domain/step-rail';
import type { StorefrontTheme } from '@/lib/domain/web-theme';

const SHOP_TILE = 34;
const SEGMENT_HEIGHT = 34;

interface CounterBandProps<K extends string> {
  theme: StorefrontTheme;
  /** The shop this counter belongs to. */
  shopName: string;
  /** 'Owner' or 'Staff' — see `domain/merchant-access`. */
  roleBadge: string;
  /** The question this step asks; read to a screen reader, no longer printed. */
  title: string;
  steps: readonly StepSpec<K>[];
  current: K;
  onGo: (step: K) => void;
  onSettings: () => void;
}

export function CounterBand<K extends string>({
  theme,
  shopName,
  roleBadge,
  title,
  steps,
  current,
  onGo,
  onSettings,
}: CounterBandProps<K>) {
  const insets = useSafeAreaInsets();
  const tabs = stepRail(steps, current);

  return (
    <View
      style={[styles.bar, { paddingTop: insets.top + space.snug }]}
      accessibilityLabel={title}
    >
      <GlyphTile icon="basket-outline" color={theme.brand} size={SHOP_TILE} isLifted={false} />

      <View style={styles.who}>
        <Text style={styles.shop} numberOfLines={1}>
          {shopName}
        </Text>
        <Text style={styles.role} numberOfLines={1}>
          {roleBadge}
        </Text>
      </View>

      {/* The steps as an iOS segmented control: the one you are on lit in the
          shop's colour, the one behind you tappable, the one ahead held back. */}
      <View
        style={styles.segments}
        accessibilityRole="tablist"
        accessibilityLabel={stepAnnouncement(steps, current)}
      >
        {tabs.map((tab) => {
          const isHere = tab.state === 'current';
          const isDone = tab.state === 'done';
          const canGo = tab.canGo && !isHere;
          return (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={tab.label}
              accessibilityState={{ selected: isHere, disabled: !canGo && !isHere }}
              disabled={!canGo}
              onPress={() => onGo(tab.key)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.segment,
                isHere && [styles.segmentHere, { backgroundColor: theme.brand, shadowColor: theme.brand }],
                pressed && styles.pressed,
              ]}
            >
              {isDone ? <Ionicons name="checkmark" size={13} color={colors.actionInk} /> : null}
              <Text
                numberOfLines={1}
                style={[
                  styles.segmentText,
                  isHere && { color: theme.onBrand },
                  isDone && { color: colors.actionInk },
                  tab.state === 'upcoming' && styles.segmentAhead,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Shop settings"
        onPress={onSettings}
        hitSlop={space.snug}
        style={({ pressed }) => [styles.cog, pressed && styles.pressed]}
      >
        <Ionicons name="settings-outline" size={19} color={colors.text} />
      </Pressable>
    </View>
  );
}

const WEB_BLUR = Platform.select<ViewStyle>({
  web: { backdropFilter: 'blur(24px) saturate(180%)' } as ViewStyle,
  default: {},
});

const styles = StyleSheet.create({
  /** Frosted, like an iOS navigation bar: the page shows faintly through it. */
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug + 2,
    paddingHorizontal: space.room,
    paddingBottom: space.snug + 2,
    backgroundColor: 'rgba(255, 255, 255, 0.74)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(60, 60, 67, 0.16)',
    ...WEB_BLUR,
  },
  who: { flex: 1, minWidth: 0 },
  shop: { ...type.label, fontSize: 15, lineHeight: 19, ...fontFor(600), color: colors.text },
  role: { ...type.caption, fontSize: 12, lineHeight: 15, color: colors.subtle },
  segments: {
    flexDirection: 'row',
    padding: 2,
    borderRadius: SEGMENT_HEIGHT / 2 + 2,
    backgroundColor: 'rgba(118, 118, 128, 0.12)',
  },
  segment: {
    height: SEGMENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: space.cosy,
    borderRadius: SEGMENT_HEIGHT / 2,
    borderCurve: 'continuous',
  },
  segmentHere: {
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  segmentText: { fontSize: 14, lineHeight: 18, letterSpacing: -0.2, ...fontFor(600), color: colors.text },
  segmentAhead: { color: colors.subtle },
  cog: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: GLASS_EDGE,
  },
  pressed: { opacity: 0.7 },
});
