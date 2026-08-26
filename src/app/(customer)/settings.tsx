import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Button, Screen, colors, elevation, space, type } from '@/components/ui-kit';
import { useAuth } from '@/lib/auth';
import {
  SETTING_SECTIONS,
  toggleStateLabel,
  type SettingRow,
} from '@/lib/domain/app-settings';
import { signOutPrompt } from '@/lib/domain/confirm-prompts';
import { useAppSettings, useHaptic } from '@/lib/use-app-settings';

/**
 * Where the customer's own choices live.
 *
 * Sign-out used to be a grey text link under the last past order, so where it
 * sat on screen depended on how much laundry that person had done — for a new
 * customer it landed right in the thumb arc. It is here now, at the end,
 * behind a confirmation, with the switches that change how the app behaves
 * above it.
 *
 * The two subjects are kept apart on purpose: nothing above the last card
 * ends a session, and the one thing that does is red, alone, and last.
 */
export default function CustomerSettings() {
  const { profile, signOut } = useAuth();
  const { settings, toggle } = useAppSettings();
  const haptic = useHaptic();

  const onToggle = (row: SettingRow) => {
    // The tick fires from the state being left, so turning haptics *off* still
    // answers the finger that turned it off, and turning it on is felt at once.
    haptic('select');
    toggle(row.key);
  };

  const confirmSignOut = () => {
    haptic('warning');
    const prompt = signOutPrompt();
    Alert.alert(prompt.title, prompt.message, [
      { text: prompt.dismissLabel, style: 'cancel' },
      { text: prompt.confirmLabel, style: 'destructive', onPress: () => signOut() },
    ]);
  };

  return (
    <Screen>
      {profile?.full_name || profile?.username ? (
        <View style={styles.who}>
          <Text style={styles.whoLabel}>SIGNED IN AS</Text>
          <Text style={styles.whoName}>{profile.full_name ?? profile.username}</Text>
        </View>
      ) : null}

      {SETTING_SECTIONS.map((section) => (
        <View key={section.title}>
          <Text style={styles.sectionLabel}>{section.title}</Text>
          <View style={styles.group}>
            {section.rows.map((row, index) => (
              <ToggleRow
                key={row.key}
                row={row}
                isOn={settings[row.key]}
                isFirst={index === 0}
                onToggle={() => onToggle(row)}
              />
            ))}
          </View>
        </View>
      ))}

      <View style={styles.signOut}>
        <Button title="Sign out" variant="danger" onPress={confirmSignOut} />
      </View>
    </Screen>
  );
}

/**
 * The whole row is the control, not just the switch: a switch at the far right
 * of a phone is the smallest target on the screen and the furthest from a left
 * thumb. The switch stays, because it is what says "on" at a glance.
 */
function ToggleRow({
  row,
  isOn,
  isFirst,
  onToggle,
}: {
  row: SettingRow;
  isOn: boolean;
  isFirst: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={toggleStateLabel(row.label, isOn)}
      accessibilityHint={row.caption}
      accessibilityState={{ checked: isOn }}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        !isFirst && styles.rowDivided,
        pressed && { backgroundColor: colors.sunken },
      ]}
    >
      <View style={[styles.rowIcon, isOn && styles.rowIconOn]}>
        <Ionicons
          name={row.icon as never}
          size={18}
          color={isOn ? colors.actionInk : colors.subtle}
        />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{row.label}</Text>
        <Text style={styles.rowCaption}>{row.caption}</Text>
      </View>
      {/* The row already announces itself; a second focusable switch would
          make a screen reader read every setting twice. */}
      <Switch
        value={isOn}
        onValueChange={onToggle}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        trackColor={{ false: colors.borderStrong, true: colors.action }}
        thumbColor={colors.card}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  who: {
    paddingBottom: space.section,
  },
  whoLabel: { ...type.label, fontSize: 11, color: colors.subtle, letterSpacing: 0.8 },
  whoName: { ...type.title, color: colors.text, marginTop: space.tight },

  sectionLabel: {
    ...type.label,
    fontSize: 11,
    color: colors.subtle,
    letterSpacing: 0.8,
    marginBottom: space.snug,
    marginTop: space.section,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    ...elevation.rest,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
  },
  // A hairline between rows only — a border around each would turn one group
  // of related switches into three separate objects.
  rowDivided: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunken,
  },
  rowIconOn: { backgroundColor: colors.actionSurface },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { ...type.body, fontWeight: '600', color: colors.text },
  rowCaption: { ...type.caption, color: colors.subtle },

  // Kept well clear of the switches: nothing that ends a session should be
  // reachable by a thumb that was flicking toggles.
  signOut: { marginTop: space.gulf },
});
