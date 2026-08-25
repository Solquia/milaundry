import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Design system for the superadmin console: warm paper background, deep ink
// hero blocks, pill chips and stat tiles — MiLaundry's blue doing the accent
// work. Merchant/customer screens keep the standard ui-kit look.

export const adminColors = {
  ink: '#1C2530', // deep blue-black hero / filled buttons
  inkSoft: '#2A3644',
  paper: '#EFF2F4', // cool-white screen background
  card: '#FFFFFF',
  text: '#18202A',
  subtle: '#6B7684',
  border: '#E2E7EC',
  accent: '#208AEF', // MiLaundry blue
  accentSoft: '#D8EAFC',
  success: '#0FA36B',
  successSoft: '#D9F3E7',
  danger: '#DC2626',
};

export function AdminHero({
  eyebrow = 'PLATFORM',
  title,
  subtitle,
  children,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <SafeAreaView edges={['top']} style={styles.heroSafe}>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>{eyebrow}</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </SafeAreaView>
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
        isFilled && { backgroundColor: adminColors.ink },
        isDanger && { backgroundColor: adminColors.danger },
        variant === 'outline' && styles.pillButtonOutline,
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text
        style={[
          styles.pillButtonText,
          variant === 'outline' && { color: adminColors.text },
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
          value && !disabled && { backgroundColor: adminColors.accent },
        ]}
      >
        <View style={[styles.toggleThumb, value && styles.toggleThumbOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  heroSafe: { backgroundColor: adminColors.ink },
  hero: {
    backgroundColor: adminColors.ink,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 22,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroEyebrow: {
    color: adminColors.accent,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  heroTitle: { color: '#FFFFFF', fontSize: 30, fontWeight: '800', marginTop: 4 },
  heroSubtitle: { color: '#AAB4C0', fontSize: 14, marginTop: 4 },
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
  chipSelected: { backgroundColor: adminColors.ink, borderColor: adminColors.ink },
  chipLabel: { fontWeight: '700', color: adminColors.text, fontSize: 14 },
  chipLabelSelected: { color: '#FFFFFF' },
  chipCount: {
    backgroundColor: adminColors.paper,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  chipCountSelected: { backgroundColor: adminColors.inkSoft },
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
  logoInitials: { fontWeight: '800', color: adminColors.accent },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  statusPillText: { fontSize: 12, fontWeight: '700' },
  pillButton: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: 'center',
  },
  pillButtonOutline: {
    backgroundColor: adminColors.card,
    borderWidth: 1,
    borderColor: adminColors.border,
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
