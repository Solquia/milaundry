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
import { ProductCard, ProductGrid } from './product-grid';
import { SoapArt } from './soap-art';
import { BLUE_FIELD, ErrorText, Field, colors, elevation, space, type } from './ui-kit';
import {
  DETERGENT_LABELS,
  PREFERENCE_KEYS,
  TOGGLE_LABELS,
  validatePreferences,
  type Detergent,
  type LaundryPreferences,
  type PreferenceKey,
  type SoftenerChoice,
  type TogglePreference,
} from '@/lib/domain/laundry-preferences';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * What a tile shows above its name: a drawn soap, or a plain icon.
 *
 * The brands are drawn as generic packs in a colour a shopper would associate
 * with the shelf, never as their logos — the name under the drawing does the
 * naming. The non-brand choices are ideas, not products, so they get an icon.
 */
type TileArt =
  | { kind: 'powder' | 'bar' | 'bottle'; color: string }
  | { kind: 'icon'; icon: IconName; color: string };

interface TileOption<T> {
  value: T;
  label: string;
  note: string;
  art: TileArt;
}

const USUAL_ART: TileArt = { kind: 'icon', icon: 'sparkles-outline', color: BLUE_FIELD.mid };

/**
 * Most-asked first. "Regular" is left off the board — every brand is regular
 * somewhere — but it stays in the domain so an old ticket still reads back.
 */
const DETERGENT_TILES: readonly TileOption<Detergent | null>[] = [
  { value: null, label: "Shop's usual", note: 'Their pick', art: USUAL_ART },
  { value: 'ariel', label: DETERGENT_LABELS.ariel, note: 'Powder', art: { kind: 'powder', color: '#1F9D63' } },
  { value: 'tide', label: DETERGENT_LABELS.tide, note: 'Powder', art: { kind: 'powder', color: '#F26B1D' } },
  { value: 'breeze', label: DETERGENT_LABELS.breeze, note: 'Powder', art: { kind: 'powder', color: '#2F7BD8' } },
  { value: 'surf', label: DETERGENT_LABELS.surf, note: 'Powder', art: { kind: 'powder', color: '#E0457B' } },
  { value: 'champion', label: DETERGENT_LABELS.champion, note: 'Powder', art: { kind: 'powder', color: '#E9A21B' } },
  { value: 'pride', label: DETERGENT_LABELS.pride, note: 'Powder', art: { kind: 'powder', color: '#7B5CE5' } },
  { value: 'perla', label: DETERGENT_LABELS.perla, note: 'Bar · gentle', art: { kind: 'bar', color: '#9FB3C8' } },
  {
    value: 'unscented',
    label: DETERGENT_LABELS.unscented,
    note: 'No perfume',
    art: { kind: 'icon', icon: 'leaf-outline', color: '#1F9D63' },
  },
  {
    value: 'hypoallergenic',
    label: 'Sensitive',
    note: 'Hypoallergenic',
    art: { kind: 'icon', icon: 'shield-checkmark-outline', color: '#2F7BD8' },
  },
  {
    value: 'own',
    label: 'My own',
    note: "I'll bring it",
    art: { kind: 'icon', icon: 'bag-handle-outline', color: '#6B7C93' },
  },
];

const SOFTENER_TILES: readonly TileOption<SoftenerChoice | null>[] = [
  { value: null, label: 'No preference', note: 'Up to the shop', art: USUAL_ART },
  { value: 'downy', label: 'Downy', note: 'Fabcon', art: { kind: 'bottle', color: '#4F6FE0' } },
  { value: 'surf_fabcon', label: 'Surf', note: 'Fabcon', art: { kind: 'bottle', color: '#E26BA6' } },
  { value: 'del', label: 'Del', note: 'Fabcon', art: { kind: 'bottle', color: '#9B6BD6' } },
  {
    value: 'with',
    label: "Shop's fabcon",
    note: 'Any brand',
    art: { kind: 'icon', icon: 'water-outline', color: BLUE_FIELD.mid },
  },
  {
    value: 'without',
    label: 'None',
    note: 'No softener',
    art: { kind: 'icon', icon: 'close-circle-outline', color: '#6B7C93' },
  },
];

const TOGGLE_ICONS: Record<TogglePreference, IconName> = {
  separate_whites: 'shirt-outline',
  delicates: 'flower-outline',
  air_dry: 'sunny-outline',
};
const TOGGLE_NOTES: Record<TogglePreference, string> = {
  separate_whites: 'Washed alone',
  delicates: 'Gentle cycle',
  air_dry: 'No tumble dryer',
};
const TOGGLES = Object.keys(TOGGLE_LABELS) as TogglePreference[];

const ART_SIZE = 56;

/** Fills a product card's photo well: the drawn pack, or the idea's icon. */
function Art({ art }: { art: TileArt }) {
  if (art.kind !== 'icon') return <SoapArt shape={art.kind} color={art.color} size={ART_SIZE} />;
  return (
    <View style={styles.iconArt}>
      <Ionicons name={art.icon} size={30} color={art.color} />
    </View>
  );
}

/**
 * One choice as a product card, so a shop with no shelf of its own still
 * books like a store. Radio or checkbox by role — the look is the same,
 * because to the customer both are "put this on my laundry".
 */
function Tile({
  label,
  note,
  art,
  isOn,
  role,
  onPress,
}: {
  label: string;
  note: string;
  art: TileArt;
  isOn: boolean;
  role: 'radio' | 'checkbox';
  onPress: () => void;
}) {
  return (
    <ProductCard
      picture={<Art art={art} />}
      name={label}
      note={note}
      isOn={isOn}
      role={role}
      onPress={onPress}
    />
  );
}

function GroupHead({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.groupHead}>
      <Text style={styles.groupTitle}>{title}</Text>
      <Text style={styles.groupNote}>{note}</Text>
    </View>
  );
}

interface PreferencePickerProps {
  value: LaundryPreferences;
  onChange: (next: LaundryPreferences) => void;
  /** What the shop honours. Omitted in settings, where everything is offered. */
  supported?: readonly PreferenceKey[];
  error?: string;
  /** "Gentle cycle" for a wash, "Low heat" at the ironing board. */
  delicatesNote?: string;
  /** The example in the empty notes field, worded for the service being booked. */
  instructionsExample?: string;
}

export function PreferencePicker({
  value,
  onChange,
  supported = PREFERENCE_KEYS,
  error,
  delicatesNote,
  instructionsExample = 'Cold wash for the dark jeans',
}: PreferencePickerProps) {
  const offers = (key: PreferenceKey) => supported.includes(key);
  const set = (patch: Partial<LaundryPreferences>) => onChange({ ...value, ...patch });
  return (
    <View style={styles.picker}>
      {offers('detergent') && (
        <View style={styles.group}>
          <GroupHead title="Sabon · Detergent" note="The shop uses your pick when they have it." />
          <ProductGrid
            items={DETERGENT_TILES}
            keyOf={(option) => option.value ?? 'usual'}
            accessibilityRole="radiogroup"
            accessibilityLabel="Detergent"
            renderItem={(option) => (
              <Tile
                {...option}
                role="radio"
                isOn={value.detergent === option.value}
                onPress={() => set({ detergent: option.value })}
              />
            )}
          />
        </View>
      )}

      {offers('softener') && (
        <View style={styles.group}>
          <GroupHead title="Fabcon · Fabric conditioner" note="For that just-bought smell." />
          <ProductGrid
            items={SOFTENER_TILES}
            keyOf={(option) => option.value ?? 'any'}
            accessibilityRole="radiogroup"
            accessibilityLabel="Fabric conditioner"
            renderItem={(option) => (
              <Tile
                {...option}
                role="radio"
                isOn={value.softener === option.value}
                onPress={() => set({ softener: option.value })}
              />
            )}
          />
        </View>
      )}

      {TOGGLES.some(offers) && (
        <View style={styles.group}>
          <GroupHead title="Personal touches" note="Tap any that apply." />
          <ProductGrid
            items={TOGGLES.filter(offers)}
            keyOf={(key) => key}
            renderItem={(key) => (
              <Tile
                label={TOGGLE_LABELS[key].replace(' / hang dry', '')}
                note={key === 'delicates' && delicatesNote ? delicatesNote : TOGGLE_NOTES[key]}
                art={{ kind: 'icon', icon: TOGGLE_ICONS[key], color: BLUE_FIELD.mid }}
                role="checkbox"
                isOn={value[key]}
                onPress={() => set({ [key]: !value[key] })}
              />
            )}
          />
        </View>
      )}

      {offers('instructions') && (
        <Field
          label="Special instructions (optional)"
          value={value.instructions}
          onChangeText={(instructions) => set({ instructions })}
          placeholder={instructionsExample}
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
  picker: { gap: space.room },
  group: { gap: space.snug },
  groupHead: { gap: 2 },
  groupTitle: { ...type.label, fontSize: 15, color: colors.text },
  groupNote: { ...type.caption, color: colors.subtle },
  iconArt: {
    width: ART_SIZE,
    height: ART_SIZE,
    borderRadius: ART_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },

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
