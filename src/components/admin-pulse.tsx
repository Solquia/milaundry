import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ShopLogo, adminColors } from '@/components/admin-ui';
import { TAG_TONES, elevation } from '@/components/ui-kit';

// The console's working parts: things an operator reads at a glance or taps
// once. Kept apart from admin-ui.tsx, which holds the shared chrome.

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const SPARK_HEIGHT = 44;

/** Round translucent button that sits on the hero. */
export function HeroIconButton({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.heroIconButton, pressed && { opacity: 0.7 }]}
    >
      <Ionicons name={icon} size={22} color={adminColors.onHero} />
    </Pressable>
  );
}

/** Seven slim bars, today brightest, with the weekday under each. */
export function WeekSparkline({ days, now = new Date() }: { days: number[]; now?: Date }) {
  const peak = Math.max(...days, 1);
  const today = now.getDay();
  return (
    <View style={styles.spark} accessibilityLabel={`Orders per day: ${days.join(', ')}`}>
      {days.map((count, index) => {
        const isToday = index === days.length - 1;
        const letter = DAY_LETTERS[(today - (days.length - 1 - index) + 7) % 7];
        return (
          <View key={index} style={styles.sparkColumn}>
            <View style={styles.sparkTrack}>
              <View
                style={[
                  styles.sparkBar,
                  {
                    height: Math.max((count / peak) * SPARK_HEIGHT, 3),
                    opacity: isToday ? 1 : 0.5,
                  },
                ]}
              />
            </View>
            <Text style={[styles.sparkLetter, isToday && { color: adminColors.onHero }]}>
              {letter}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Figures in one card, split by hairlines instead of boxed separately. */
export function MetricStrip({
  items,
}: {
  items: { label: string; value: string; icon: IconName }[];
}) {
  return (
    <View style={styles.strip}>
      {items.map((item, index) => (
        <View key={item.label} style={[styles.stripCell, index > 0 && styles.stripDivider]}>
          <Ionicons name={item.icon} size={16} color={adminColors.accent} />
          <Text style={styles.stripValue} numberOfLines={1} adjustsFontSizeToFit>
            {item.value}
          </Text>
          <Text style={styles.stripLabel}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="link" onPress={onAction} hitSlop={8} style={styles.sectionAction}>
          <Text style={styles.sectionActionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={adminColors.action} />
        </Pressable>
      ) : null}
    </View>
  );
}

export type ActivityTone = 'busy' | 'quiet' | 'off';

const TONE_COLOR: Record<ActivityTone, string> = {
  busy: adminColors.success,
  quiet: TAG_TONES.owed.ink,
  off: adminColors.subtle,
};

/** A shop in a list: tap the row to manage it, the side button to open its store. */
export function ShopRow({
  name,
  logoUrl,
  activity,
  tone,
  isInactive,
  isFirst,
  onPress,
  onOpenStore,
}: {
  name: string;
  logoUrl?: string;
  activity: string;
  tone: ActivityTone;
  isInactive?: boolean;
  isFirst?: boolean;
  onPress: () => void;
  onOpenStore?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Manage ${name}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowDivider,
        pressed && { backgroundColor: adminColors.paper },
      ]}
    >
      <ShopLogo name={name} logoUrl={logoUrl} size={42} />
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          {isInactive ? (
            <View style={styles.offTag}>
              <Text style={styles.offTagText}>Inactive</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.rowMetaLine}>
          <View style={[styles.toneDot, { backgroundColor: TONE_COLOR[tone] }]} />
          <Text style={styles.rowMeta} numberOfLines={1}>
            {activity}
          </Text>
        </View>
      </View>
      {onOpenStore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Open ${name} as the shop`}
          onPress={onOpenStore}
          hitSlop={6}
          style={({ pressed }) => [styles.storeButton, pressed && { opacity: 0.7 }]}
        >
          <Ionicons name="storefront-outline" size={18} color={adminColors.accentInk} />
        </Pressable>
      ) : (
        <Ionicons name="chevron-forward" size={18} color={adminColors.subtle} />
      )}
    </Pressable>
  );
}

/** One line of the "needs attention" list. */
export function AttentionRow({
  name,
  reason,
  isFirst,
  onPress,
}: {
  name: string;
  reason: 'quiet' | 'inactive';
  isFirst?: boolean;
  onPress: () => void;
}) {
  const isQuiet = reason === 'quiet';
  const tone = isQuiet ? TAG_TONES.owed : TAG_TONES.neutral;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowDivider,
        pressed && { backgroundColor: adminColors.paper },
      ]}
    >
      <View style={[styles.attentionIcon, { backgroundColor: tone.bg }]}>
        <Ionicons name={isQuiet ? 'moon-outline' : 'pause'} size={16} color={tone.ink} />
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowMeta}>
          {isQuiet ? 'No orders this week' : 'Switched off — customers can’t book'}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={adminColors.subtle} />
    </Pressable>
  );
}

/** A leaderboard line: rank, shop, and a bar scaled to the busiest shop. */
export function LeaderRow({
  rank,
  name,
  logoUrl,
  orders,
  share,
  isFirst,
  onPress,
}: {
  rank: number;
  name: string;
  logoUrl?: string;
  orders: number;
  share: number;
  isFirst?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${orders} orders this week`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowDivider,
        pressed && { backgroundColor: adminColors.paper },
      ]}
    >
      <Text style={styles.rank}>{rank}</Text>
      <ShopLogo name={name} logoUrl={logoUrl} size={34} />
      <View style={styles.rowBody}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.leaderTrack}>
          <View style={[styles.leaderFill, { width: `${Math.max(share, 0.04) * 100}%` }]} />
        </View>
      </View>
      <Text style={styles.leaderCount}>{orders}</Text>
    </Pressable>
  );
}

/** Search on the hero's glass, so the list starts right under the header. */
export function HeroSearch({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.heroSearch}>
      <Ionicons name="search" size={18} color={adminColors.onHeroSoft} />
      <TextInput
        style={styles.heroSearchInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={adminColors.onHeroSoft}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={placeholder}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => onChangeText('')} hitSlop={8}>
          <Ionicons name="close-circle" size={18} color={adminColors.onHeroSoft} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * A segmented switch: one track, one lit segment. 'hero' sits on the blue
 * header as frosted glass; 'light' sits inside a white card.
 */
export function HeroSegments<T extends string>({
  options,
  value,
  onChange,
  tone = 'hero',
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (next: T) => void;
  tone?: 'hero' | 'light';
}) {
  const isLight = tone === 'light';
  return (
    <View style={[styles.segments, isLight && styles.segmentsLight]} accessibilityRole="tablist">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            onPress={() => onChange(option.value)}
            style={[styles.segment, isSelected && styles.segmentSelected]}
          >
            <Text
              style={[
                styles.segmentLabel,
                isLight && { color: adminColors.subtle },
                isSelected && styles.segmentLabelSelected,
              ]}
            >
              {option.label}
            </Text>
            {option.count !== undefined ? (
              <Text
                style={[
                  styles.segmentCount,
                  isLight && { color: adminColors.subtle },
                  isSelected && styles.segmentCountSelected,
                ]}
              >
                {option.count}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export const listCard = {
  backgroundColor: adminColors.card,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: adminColors.border,
  overflow: 'hidden' as const,
  ...elevation.rest,
};

const styles = StyleSheet.create({
  heroIconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  sparkColumn: { alignItems: 'center', gap: 4 },
  sparkTrack: { height: SPARK_HEIGHT, justifyContent: 'flex-end' },
  sparkBar: { width: 8, borderRadius: 4, backgroundColor: adminColors.onHero },
  sparkLetter: { fontSize: 10, fontWeight: '600', color: adminColors.onHeroSoft },
  strip: { ...listCard, flexDirection: 'row' },
  stripCell: { flex: 1, paddingVertical: 14, paddingHorizontal: 12, gap: 4 },
  stripDivider: { borderLeftWidth: 1, borderLeftColor: adminColors.border },
  stripValue: { fontSize: 20, fontWeight: '700', color: adminColors.text, letterSpacing: -0.3 },
  stripLabel: { fontSize: 12, color: adminColors.subtle },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: adminColors.subtle, letterSpacing: 0.4 },
  sectionAction: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionActionText: { fontSize: 14, fontWeight: '600', color: adminColors.action },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  rowDivider: { borderTopWidth: 1, borderTopColor: adminColors.border },
  rowBody: { flex: 1, gap: 3 },
  rowTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowName: { flexShrink: 1, fontSize: 16, fontWeight: '600', color: adminColors.text },
  rowMetaLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMeta: { fontSize: 13, color: adminColors.subtle },
  toneDot: { width: 7, height: 7, borderRadius: 4 },
  offTag: {
    backgroundColor: TAG_TONES.neutral.bg,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  offTagText: { fontSize: 11, fontWeight: '700', color: TAG_TONES.neutral.ink },
  storeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: adminColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attentionIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rank: { width: 16, fontSize: 13, fontWeight: '700', color: adminColors.subtle, textAlign: 'center' },
  leaderTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: adminColors.paper,
    overflow: 'hidden',
  },
  leaderFill: { height: 5, borderRadius: 3, backgroundColor: adminColors.accent },
  leaderCount: { fontSize: 16, fontWeight: '700', color: adminColors.text, minWidth: 24, textAlign: 'right' },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  heroSearchInput: { flex: 1, paddingVertical: 11, fontSize: 15, color: adminColors.onHero },
  segments: {
    flexDirection: 'row',
    marginTop: 10,
    padding: 3,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  segmentsLight: { marginTop: 0, backgroundColor: adminColors.paper },
  segmentSelected: { backgroundColor: adminColors.card, ...elevation.rest },
  segmentLabel: { fontSize: 14, fontWeight: '600', color: adminColors.onHeroSoft },
  segmentLabelSelected: { color: adminColors.text },
  segmentCount: { fontSize: 12, fontWeight: '700', color: adminColors.onHeroSoft, opacity: 0.8 },
  segmentCountSelected: { color: adminColors.action, opacity: 1 },
});

/**
 * Feedback that lands where the eye is: pinned to the bottom of the screen,
 * not at the top of a scroll the admin has long since left. Good news fades
 * by itself; a problem stays until it is dismissed.
 */
export function AdminToast({
  message,
  tone,
  onDismiss,
}: {
  message: string;
  tone: 'success' | 'error';
  onDismiss: () => void;
}) {
  React.useEffect(() => {
    if (!message || tone === 'error') return;
    const timer = setTimeout(onDismiss, TOAST_MS);
    return () => clearTimeout(timer);
  }, [message, tone, onDismiss]);

  if (!message) return null;
  const isError = tone === 'error';
  return (
    <View pointerEvents="box-none" style={toastStyles.layer}>
      <View
        accessibilityRole="alert"
        style={[toastStyles.toast, isError && { backgroundColor: adminColors.danger }]}
      >
        <Ionicons
          name={isError ? 'alert-circle' : 'checkmark-circle'}
          size={18}
          color={adminColors.onHero}
        />
        <Text style={toastStyles.text}>{message}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss" onPress={onDismiss} hitSlop={10}>
          <Ionicons name="close" size={18} color={adminColors.onHero} />
        </Pressable>
      </View>
    </View>
  );
}

const TOAST_MS = 3500;

const toastStyles = StyleSheet.create({
  layer: { position: 'absolute', left: 16, right: 16, bottom: 16, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    maxWidth: 560,
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: adminColors.text,
    ...elevation.lift,
  },
  text: { flex: 1, color: adminColors.onHero, fontSize: 14, fontWeight: '600' },
});

/** A white card with a title row, the unit every console panel is built from. */
export function PanelCard({
  title,
  hint,
  action,
  children,
}: {
  title?: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={panelStyles.card}>
      {title ? (
        <View style={panelStyles.head}>
          <View style={{ flex: 1 }}>
            <Text style={panelStyles.title}>{title}</Text>
            {hint ? <Text style={panelStyles.hint}>{hint}</Text> : null}
          </View>
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  card: { ...listCard, padding: 16, gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 16, fontWeight: '700', color: adminColors.text },
  hint: { fontSize: 13, color: adminColors.subtle, marginTop: 2 },
});
