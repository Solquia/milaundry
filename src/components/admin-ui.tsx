import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';

import { BLUE_FIELD, colors, elevation } from '@/components/ui-kit';

// Design system for the superadmin console, drawn from the app's own tokens:
// the blue hero gradient, the brand-tinted field, white cards that lift off it,
// and action blue on everything you can press.

export const adminColors = {
  action: colors.action, // filled buttons, selected chips
  paper: colors.bg, // brand-tinted screen field
  card: colors.card,
  text: colors.text,
  subtle: colors.subtle,
  border: colors.border,
  accent: colors.primary, // MiLaundry blue
  accentSoft: colors.actionSurface,
  accentInk: colors.actionInk,
  success: colors.success,
  successSoft: '#DEF3E7',
  danger: colors.danger,
  /** Text on the hero gradient. */
  onHero: '#FFFFFF',
  onHeroSoft: '#DCE8FA',
  onHeroEyebrow: '#BFD9FF',
  onHeroTrack: 'rgba(255,255,255,0.16)',
};

/**
 * The home page's blue field, calmed for the console: the same cobalt ground
 * and the same two blooms (cyan high, violet low), a step deeper and still. An operator's screen should feel steady,
 * not animated. White text clears 4.5:1 on every stop.
 */
const ADMIN_FIELD = {
  deep: '#0D3C9E',
  mid: '#1452BE',
  lit: '#1A60C8',
} as const;

export function AdminHero({
  eyebrow = 'PLATFORM',
  title,
  subtitle,
  action,
  onBack,
  backLabel = 'Back',
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Sits beside the title — one icon button, never a row of them. */
  action?: React.ReactNode;
  /** Replaces the eyebrow with a real back button. */
  onBack?: () => void;
  backLabel?: string;
  children?: React.ReactNode;
}) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  return (
    <View
      style={styles.heroShell}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox({ width, height });
      }}
    >
      {box.width > 0 && (
        // Sized from layout: SVG cannot size in percentages against a flex parent.
        <Svg
          style={StyleSheet.absoluteFill}
          width={box.width}
          height={box.height}
          pointerEvents="none"
        >
          <Defs>
            {/* Lower left to upper right, so the light falls from above. */}
            <LinearGradient id="adminGround" x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor={ADMIN_FIELD.deep} />
              <Stop offset="0.6" stopColor={ADMIN_FIELD.mid} />
              <Stop offset="1" stopColor={ADMIN_FIELD.lit} />
            </LinearGradient>
            <RadialGradient id="adminBloom" cx="88%" cy="0%" rx="60%" ry="90%">
              <Stop offset="0" stopColor={BLUE_FIELD.bloom} stopOpacity={0.34} />
              <Stop offset="1" stopColor={BLUE_FIELD.bloom} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="adminGlow" cx="8%" cy="100%" rx="55%" ry="80%">
              <Stop offset="0" stopColor={BLUE_FIELD.glow} stopOpacity={0.1} />
              <Stop offset="1" stopColor={BLUE_FIELD.glow} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={box.width} height={box.height} fill="url(#adminGround)" />
          <Rect x={0} y={0} width={box.width} height={box.height} fill="url(#adminBloom)" />
          <Rect x={0} y={0} width={box.width} height={box.height} fill="url(#adminGlow)" />
        </Svg>
      )}
      <SafeAreaView edges={['top']}>
        <View style={styles.hero}>
          <View style={styles.heroTitleRow}>
            <View style={{ flex: 1 }}>
              {onBack ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Back to ${backLabel}`}
                  onPress={onBack}
                  hitSlop={10}
                  style={({ pressed }) => [styles.heroBack, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="chevron-back" size={16} color={adminColors.onHeroEyebrow} />
                  <Text style={styles.heroEyebrow}>{backLabel.toUpperCase()}</Text>
                </Pressable>
              ) : (
                <Text style={styles.heroEyebrow}>{eyebrow}</Text>
              )}
              <Text style={styles.heroTitle} numberOfLines={1}>
                {title}
              </Text>
              {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
            </View>
            {action}
          </View>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}

export function Chip({
  label,
  count,
  isSelected,
  onPress,
}: {
  label: string;
  count?: number;
  isSelected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!isSelected }}
      onPress={onPress}
      style={[styles.chip, isSelected && styles.chipSelected]}
    >
      <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
        {label}
      </Text>
      {count !== undefined && (
        <View style={[styles.chipCount, isSelected && styles.chipCountSelected]}>
          <Text
            style={[styles.chipCountText, isSelected && styles.chipLabelSelected]}
          >
            {count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function StatTile({
  label,
  value,
  hint,
  dotColor = adminColors.accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  dotColor?: string;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statLabelRow}>
        <View style={[styles.statDot, { backgroundColor: dotColor }]} />
        <Text style={styles.statLabel}>{label.toUpperCase()}</Text>
      </View>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

/** Shop logo, falling back to branded initials on the accent wash. */
export function ShopLogo({
  name,
  logoUrl,
  size = 48,
}: {
  name: string;
  logoUrl?: string;
  size?: number;
}) {
  const radius = size * 0.28;
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: size, height: size, borderRadius: radius }}
        contentFit="cover"
        accessibilityLabel={`${name} logo`}
      />
    );
  }
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('');
  return (
    <View
      style={[
        styles.logoFallback,
        { width: size, height: size, borderRadius: radius },
      ]}
    >
      <Text style={[styles.logoInitials, { fontSize: size * 0.38 }]}>
        {initials || 'M'}
      </Text>
    </View>
  );
}

export function StatusBadgePill({ isActive }: { isActive: boolean }) {
  return (
    <View
      style={[
        styles.statusPill,
        { backgroundColor: isActive ? adminColors.successSoft : adminColors.border },
      ]}
    >
      <Text
        style={[
          styles.statusPillText,
          { color: isActive ? adminColors.success : adminColors.subtle },
        ]}
      >
        {isActive ? 'Active' : 'Inactive'}
      </Text>
    </View>
  );
}

export function PillButton({
  title,
  onPress,
  variant = 'filled',
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'filled' | 'outline' | 'danger';
  disabled?: boolean;
}) {
  const isFilled = variant === 'filled';
  const isDanger = variant === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.pillButton,
        isFilled && styles.pillButtonFilled,
        isDanger && { backgroundColor: adminColors.danger },
        variant === 'outline' && styles.pillButtonOutline,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        style={[
          styles.pillButtonText,
          variant === 'outline' && { color: adminColors.accentInk },
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

/** Toggle row used by the Features / Integrations / Delivery tabs. */
export function ToggleRow({
  title,
  description,
  value,
  onToggle,
  disabled,
}: {
  title: string;
  description: string;
  value: boolean;
  onToggle?: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      onPress={() => !disabled && onToggle?.(!value)}
      style={styles.toggleRow}
    >
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={[styles.toggleTitle, disabled && { color: adminColors.subtle }]}>
          {title}
        </Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <View
        style={[
          styles.toggleTrack,
          value && !disabled && { backgroundColor: adminColors.action },
        ]}
      >
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroShell: {
    backgroundColor: ADMIN_FIELD.mid,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
    ...elevation.lift,
  },
  hero: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  heroBack: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start', marginLeft: -4 },
  heroTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroEyebrow: {
    color: adminColors.onHeroEyebrow,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: adminColors.onHero,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginTop: 4,
  },
  heroSubtitle: { color: adminColors.onHeroSoft, fontSize: 14, marginTop: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: adminColors.card,
    borderColor: adminColors.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: adminColors.action, borderColor: adminColors.action },
  chipLabel: { fontWeight: '700', color: adminColors.text, fontSize: 14 },
  chipLabelSelected: { color: '#FFFFFF' },
  chipCount: {
    backgroundColor: adminColors.paper,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  chipCountSelected: { backgroundColor: adminColors.onHeroTrack },
  chipCountText: { fontSize: 12, fontWeight: '700', color: adminColors.subtle },
  statTile: {
    flex: 1,
    minWidth: '44%',
    backgroundColor: adminColors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: adminColors.border,
    padding: 14,
    gap: 6,
    ...elevation.rest,
  },
  statLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statDot: { width: 7, height: 7, borderRadius: 4 },
  statLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: adminColors.subtle,
  },
  statValue: { fontSize: 28, fontWeight: '800', color: adminColors.text },
  statHint: { fontSize: 12, color: adminColors.subtle },
  logoFallback: {
    backgroundColor: adminColors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInitials: { fontWeight: '800', color: adminColors.accentInk },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  pillButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pillButtonFilled: { backgroundColor: adminColors.action, ...elevation.rest },
  pillButtonOutline: {
    backgroundColor: adminColors.accentSoft,
    borderWidth: 1,
    borderColor: colors.actionMuted,
  },
  pillButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  toggleTitle: { fontSize: 16, fontWeight: '700', color: adminColors.text },
  toggleDescription: { fontSize: 13, color: adminColors.subtle, marginTop: 2 },
  toggleTrack: {
    width: 46,
    height: 28,
    borderRadius: 999,
    backgroundColor: adminColors.border,
    padding: 3,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },
  toggleThumbOn: { alignSelf: 'flex-end' },
});
