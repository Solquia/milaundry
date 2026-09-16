/**
 * The band across the top of the till.
 *
 * A customer booking on the shop's web page gets a full-bleed band in the
 * shop's colour: where they came from, and the question this step is asking.
 * The counter was asking the same questions under a plain navigator title,
 * with the second step reached by a text link and named nothing at all.
 *
 * This is `web/web-shell.tsx`'s `PageBand`, wearing what a counter needs that a
 * customer does not: whose shop this is and what the person at the till is
 * inside it — an owner, or staff on someone else's counter — and the way to
 * their own settings, which the navigator header used to carry.
 *
 * It claims the status bar itself, because the screen it heads has no header.
 */
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { StepRail } from './step-rail';
import { space, type } from './ui-kit';
import { withAlpha } from '@/lib/domain/brand-gradient';
import type { StepSpec } from '@/lib/domain/step-rail';
import type { StorefrontTheme } from '@/lib/domain/web-theme';

/**
 * The rail, on colour.
 *
 * `RAIL_TONE` is ink on the app's pale field and disappears here. White carries
 * the steps you have reached; the ones ahead are the same white held back far
 * enough to read as unreached and no further — at 0.8 they still clear 4.5:1 on
 * every accent in the palette, which a grey on a coloured ground never does.
 */
function railTone(theme: StorefrontTheme) {
  return {
    reached: theme.onBrand,
    ahead: withAlpha(theme.onBrand, 0.8),
    track: withAlpha(theme.onBrand, 0.45),
  };
}

interface CounterBandProps<K extends string> {
  theme: StorefrontTheme;
  /** The shop this counter belongs to. */
  shopName: string;
  /** 'Owner' or 'Staff' — see `domain/merchant-access`. */
  roleBadge: string;
  /** The question this step asks. */
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

  return (
    <View
      style={[
        styles.band,
        { backgroundColor: theme.brand, paddingTop: insets.top + space.room },
      ]}
    >
      <View style={styles.top}>
        <View style={styles.who}>
          <Text style={[styles.shop, { color: theme.onBrand }]} numberOfLines={1}>
            {shopName}
          </Text>
          <View style={[styles.badge, { backgroundColor: withAlpha(theme.onBrand, 0.18) }]}>
            <Text style={[styles.badgeText, { color: theme.onBrand }]}>{roleBadge}</Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Shop settings"
          onPress={onSettings}
          hitSlop={space.cosy}
          style={({ pressed }) => [styles.cog, pressed && styles.pressed]}
        >
          <Ionicons name="settings-outline" size={20} color={theme.onBrand} />
        </Pressable>
      </View>

      <Text style={[styles.title, { color: theme.onBrand }]}>{title}</Text>

      <StepRail steps={steps} current={current} onGo={onGo} tone={railTone(theme)} />
    </View>
  );
}

const styles = StyleSheet.create({
  band: { paddingHorizontal: space.room, paddingBottom: space.cosy, gap: space.snug },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  who: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.snug },
  shop: { ...type.label, flexShrink: 1, opacity: 0.95 },
  /** The role, said once, where the shop's name is. */
  badge: {
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: 999,
  },
  badgeText: { ...type.caption, fontSize: 12 },
  cog: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { ...type.title, marginBottom: space.tight },
  pressed: { opacity: 0.7 },
});
