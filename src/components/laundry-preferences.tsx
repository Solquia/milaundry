/**
 * How the customer likes their laundry done: the controls, and the settings
 * card that keeps them.
 *
 * One picker, two homes. In settings it edits the customer's usual — every
 * preference, because it is not about any one shop. In a booking it edits
 * this load, and only draws what that shop honours: offering "air dry" at a
 * laundromat with no line is a promise the counter then has to break.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BLUE_FIELD, ErrorText, Field, colors, elevation, space, type } from './ui-kit';
import {
  DETERGENTS,
  DETERGENT_LABELS,
  PREFERENCE_KEYS,
  SOFTENER_CHOICES,
  TOGGLE_LABELS,
  validatePreferences,
  type LaundryPreferences,
  type PreferenceKey,
  type TogglePreference,
} from '@/lib/domain/laundry-preferences';

const SOFTENER_CHIP_LABELS = { with: 'Yes, please', without: 'No softener' } as const;
const TOGGLES = Object.keys(TOGGLE_LABELS) as TogglePreference[];

function Choice({
  label,
  isSelected,
  onPress,
}: {
  label: string;
  isSelected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.choice,
        isSelected && styles.choiceOn,
        pressed && styles.pressed,
      ]}
    >
      <Text style={[styles.choiceText, isSelected && styles.choiceTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ToggleLine({
  label,
  isOn,
  onToggle,
}: {
  label: string;
  isOn: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isOn }}
      onPress={onToggle}
      style={({ pressed }) => [styles.toggle, pressed && styles.pressed]}
    >
      <Ionicons
        name={isOn ? 'checkbox' : 'square-outline'}
        size={22}
        color={isOn ? BLUE_FIELD.mid : colors.subtle}
      />
      <Text style={styles.toggleText}>{label}</Text>
    </Pressable>
  );
}

interface PreferencePickerProps {
  value: LaundryPreferences;
  onChange: (next: LaundryPreferences) => void;
  /** What the shop honours. Omitted in settings, where everything is offered. */
  supported?: readonly PreferenceKey[];
  error?: string;
}

export function PreferencePicker({
  value,
  onChange,
  supported = PREFERENCE_KEYS,
  error,
}: PreferencePickerProps) {
  const offers = (key: PreferenceKey) => supported.includes(key);
  const set = (patch: Partial<LaundryPreferences>) => onChange({ ...value, ...patch });

  return (
    <View style={styles.picker}>
      {offers('detergent') && (
        <View style={styles.group} accessibilityRole="radiogroup" accessibilityLabel="Detergent">
          <Text style={styles.groupLabel}>Detergent</Text>
          <View style={styles.choices}>
            <Choice
              label="Shop's usual"
              isSelected={value.detergent === null}
              onPress={() => set({ detergent: null })}
            />
            {DETERGENTS.map((key) => (
              <Choice
                key={key}
                label={DETERGENT_LABELS[key]}
                isSelected={value.detergent === key}
                onPress={() => set({ detergent: key })}
              />
            ))}
          </View>
        </View>
      )}

      {offers('softener') && (
        <View
          style={styles.group}
          accessibilityRole="radiogroup"
          accessibilityLabel="Fabric softener"
        >
          <Text style={styles.groupLabel}>Fabric softener</Text>
          <View style={styles.choices}>
            <Choice
              label="No preference"
              isSelected={value.softener === null}
              onPress={() => set({ softener: null })}
            />
            {SOFTENER_CHOICES.map((key) => (
              <Choice
                key={key}
                label={SOFTENER_CHIP_LABELS[key]}
                isSelected={value.softener === key}
                onPress={() => set({ softener: key })}
              />
            ))}
          </View>
        </View>
      )}

      {TOGGLES.some(offers) && (
        <View style={styles.group}>
          {TOGGLES.filter(offers).map((key) => (
            <ToggleLine
              key={key}
              label={TOGGLE_LABELS[key]}
              isOn={value[key]}
              onToggle={() => set({ [key]: !value[key] })}
            />
          ))}
        </View>
      )}

      {offers('instructions') && (
        <Field
          label="Special instructions (optional)"
          value={value.instructions}
          onChangeText={(instructions) => set({ instructions })}
          placeholder="Cold wash for the dark jeans"
          multiline
        />
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

interface LaundryPreferencesCardProps {
  value: LaundryPreferences;
  onSave: (next: LaundryPreferences) => void;
  isBusy?: boolean;
  error?: string;
}

/** The customer's usual, on the settings screen. Every booking starts from it. */
export function LaundryPreferencesCard({ value, onSave, isBusy, error }: LaundryPreferencesCardProps) {
  const [draft, setDraft] = useState(value);
  const [draftError, setDraftError] = useState('');
  const isDirty = JSON.stringify(draft) !== JSON.stringify(value);

  const save = () => {
    const result = validatePreferences(draft);
    if (!result.ok) {
      setDraftError(result.errors.instructions ?? '');
      return;
    }
    setDraftError('');
    onSave(result.value);
  };

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Laundry preferences</Text>
      <Text style={styles.cardNote}>
        Filled in on every booking. A shop only sees the ones it offers.
      </Text>
      <PreferencePicker value={draft} onChange={setDraft} error={draftError || error} />
      {isDirty && (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: Boolean(isBusy) }}
          disabled={isBusy}
          onPress={save}
          style={({ pressed }) => [styles.save, pressed && styles.pressed]}
        >
          <Text style={styles.saveText}>{isBusy ? 'Saving…' : 'Save preferences'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: space.cosy },
  group: { gap: space.snug },
  groupLabel: { ...type.label, color: colors.subtle },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  /** 36pt tall with a 4pt slop each side clears the 44pt touch minimum. */
  choice: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.cosy,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  choiceOn: { backgroundColor: BLUE_FIELD.mid, borderColor: BLUE_FIELD.mid },
  choiceText: { ...type.label, fontSize: 13, color: colors.text },
  choiceTextOn: { color: colors.onAccent },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    minHeight: 44,
  },
  toggleText: { ...type.body, color: colors.text },

  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.cosy,
    ...elevation.rest,
  },
  cardTitle: { ...type.section, color: colors.text },
  cardNote: { ...type.caption, color: colors.subtle },
  save: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_FIELD.mid,
  },
  saveText: { ...type.label, fontSize: 16, color: colors.onAccent },
  pressed: { opacity: 0.7 },
});
