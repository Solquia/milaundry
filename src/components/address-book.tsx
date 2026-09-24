/**
 * The addresses a customer has named, and the sheet that edits one.
 *
 * A laundry goes to the same two or three places for years. Typing the street
 * again on every booking is not just tedious — it is how a rider ends up at the
 * wrong gate, because the ninth copy of an address typed from memory is the one
 * with the typo in it. Saved once, named, and picked from a row after that.
 *
 * The rows are deliberately not cards inside a card: the block they sit in is
 * already a card, and a bordered tile inside a bordered tile is the house style
 * of every settings screen nobody enjoys using. A hairline between rows does
 * the same work.
 */
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BLUE_FIELD,
  ErrorText,
  Field,
  RADII,
  colors,
  elevation,
  space,
  type,
} from './ui-kit';
import {
  formatAddressLine,
  sortAddresses,
  validateAddress,
  type AddressErrors,
  type CleanAddress,
  type SavedAddress,
} from '@/lib/domain/customer-book';

const EMPTY: CleanAddress = {
  label: '',
  address: '',
  notes: '',
  building: '',
  unit: '',
  landmark: '',
};

/** What the card hands back when a row is saved. */
export type AddressDraftOut = CleanAddress & { id?: string; isDefault?: boolean };

interface AddressBookProps {
  addresses: readonly SavedAddress[];
  onSave: (draft: AddressDraftOut) => void;
  onDelete: (id: string) => void;
  onMakeDefault: (id: string) => void;
  isBusy?: boolean;
  error?: string;
}

export function AddressBook({
  addresses,
  onSave,
  onDelete,
  onMakeDefault,
  isBusy,
  error,
}: AddressBookProps) {
  /** The address being edited, the empty draft when adding, or null when shut. */
  const [editing, setEditing] = useState<SavedAddress | 'new' | null>(null);
  const rows = sortAddresses(addresses);

  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>Delivery addresses</Text>
        {rows.length > 0 ? <Text style={styles.cardCount}>{rows.length} saved</Text> : null}
      </View>

      {rows.length === 0 ? (
        <Text style={styles.empty}>
          Save the places your laundry goes and we will fill them in for you at
          booking.
        </Text>
      ) : null}

      {rows.map((row, index) => (
        <View key={row.id} style={[styles.row, index > 0 && styles.rowSeam]}>
          <View style={[styles.pin, row.is_default && styles.pinDefault]}>
            <Ionicons
              name={row.is_default ? 'location' : 'location-outline'}
              size={18}
              color={row.is_default ? colors.onAccent : BLUE_FIELD.mid}
            />
          </View>

          <View style={styles.rowWords}>
            <View style={styles.rowHead}>
              <Text style={styles.rowLabel} numberOfLines={1}>
                {row.label}
              </Text>
              {row.is_default ? (
                <View style={styles.defaultChip}>
                  <Text style={styles.defaultChipText}>Default</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.rowAddress}>{formatAddressLine(row)}</Text>
            {row.notes ? <Text style={styles.rowNotes}>Rider: {row.notes}</Text> : null}
            {/* Offered rather than implied: a row that is already the default
                has nothing to promote, so it carries no dead control. */}
            {!row.is_default ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Use ${row.label} by default`}
                disabled={isBusy}
                onPress={() => onMakeDefault(row.id)}
                hitSlop={space.snug}
                style={({ pressed }) => [styles.makeDefault, pressed && styles.pressed]}
              >
                <Text style={styles.makeDefaultText}>Use by default</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.rowKeys}>
            <IconKey
              glyph="create-outline"
              label={`Edit ${row.label}`}
              onPress={() => setEditing(row)}
            />
            <IconKey
              glyph="trash-outline"
              label={`Delete ${row.label}`}
              tone="danger"
              disabled={isBusy}
              onPress={() => onDelete(row.id)}
            />
          </View>
        </View>
      ))}

      <ErrorText>{error}</ErrorText>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add a delivery address"
        onPress={() => setEditing('new')}
        style={({ pressed }) => [styles.add, pressed && styles.pressed]}
      >
        <Ionicons name="add" size={18} color={colors.onAccent} />
        <Text style={styles.addText}>Add an address</Text>
      </Pressable>

      <AddressSheet
        editing={editing}
        isFirst={rows.length === 0}
        isBusy={Boolean(isBusy)}
        onClose={() => setEditing(null)}
        onSave={(draft) => {
          onSave(draft);
          setEditing(null);
        }}
      />
    </View>
  );
}

/**
 * The saved addresses as a row of chips, over the address field in a booking.
 *
 * The field stays: a customer sending laundry somewhere new must be able to
 * type, and a picker that hides the keyboard behind a menu would make the
 * unusual case the slow one. The chips are the shortcut past it, and the one
 * matching what is in the field reads as chosen.
 */
export function AddressChips({
  addresses,
  value,
  onPick,
}: {
  addresses: readonly SavedAddress[];
  /** What the address field currently holds. */
  value: string;
  onPick: (saved: SavedAddress) => void;
}) {
  if (addresses.length === 0) return null;
  const rows = sortAddresses(addresses);

  return (
    <View style={styles.chips}>
      {rows.map((row) => {
        const isActive = formatAddressLine(row).toLowerCase() === value.trim().toLowerCase();
        return (
          <Pressable
            key={row.id}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={`Send it to ${row.label}, ${formatAddressLine(row)}`}
            onPress={() => onPick(row)}
            style={({ pressed }) => [
              styles.chip,
              isActive && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={isActive ? 'location' : 'location-outline'}
              size={14}
              color={isActive ? colors.onAccent : BLUE_FIELD.mid}
            />
            <Text style={[styles.chipText, isActive && styles.chipTextActive]} numberOfLines={1}>
              {row.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function IconKey({
  glyph,
  label,
  onPress,
  tone = 'ink',
  disabled,
}: {
  glyph: 'create-outline' | 'trash-outline';
  label: string;
  onPress: () => void;
  tone?: 'ink' | 'danger';
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={space.snug}
      style={({ pressed }) => [styles.key, pressed && styles.pressed]}
    >
      <Ionicons
        name={glyph}
        size={18}
        color={tone === 'danger' ? colors.dangerInk : colors.subtle}
      />
    </Pressable>
  );
}

/**
 * The editor. A sheet rather than a screen: an address is three short fields,
 * and pushing a route for it would lose the list behind it for no gain.
 */
function AddressSheet({
  editing,
  isFirst,
  isBusy,
  onClose,
  onSave,
}: {
  editing: SavedAddress | 'new' | null;
  /** The first address a customer saves becomes their default unasked. */
  isFirst: boolean;
  isBusy: boolean;
  onClose: () => void;
  onSave: (draft: AddressDraftOut) => void;
}) {
  if (!editing) return null;
  return (
    <OpenAddressSheet
      // Keyed on the row, so opening a different address starts from its own
      // values instead of an effect chasing the props after the first paint.
      key={editing === 'new' ? 'new' : editing.id}
      editing={editing}
      isFirst={isFirst}
      isBusy={isBusy}
      onClose={onClose}
      onSave={onSave}
    />
  );
}

function OpenAddressSheet({
  editing,
  isFirst,
  isBusy,
  onClose,
  onSave,
}: {
  editing: SavedAddress | 'new';
  isFirst: boolean;
  isBusy: boolean;
  onClose: () => void;
  onSave: (draft: AddressDraftOut) => void;
}) {
  const insets = useSafeAreaInsets();
  const isNew = editing === 'new';
  const [draft, setDraft] = useState<CleanAddress>(() =>
    isNew
      ? EMPTY
      : {
          label: editing.label,
          address: editing.address,
          notes: editing.notes,
          building: editing.building ?? '',
          unit: editing.unit ?? '',
          landmark: editing.landmark ?? '',
        }
  );
  const setField = (field: keyof CleanAddress) => (text: string) =>
    setDraft((prev) => ({ ...prev, [field]: text }));
  const [errors, setErrors] = useState<AddressErrors>({});

  const submit = () => {
    const result = validateAddress(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    onSave({
      ...result.value,
      id: isNew ? undefined : editing.id,
      isDefault: isNew && isFirst,
    });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.scrim}
        />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.room) }]}>
          <View style={styles.grip} />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
            <Text style={styles.sheetTitle}>{isNew ? 'New address' : 'Edit address'}</Text>

            <Field
              label="Name it"
              value={draft.label}
              onChangeText={setField('label')}
              placeholder="Home"
              autoCapitalize="words"
              returnKeyType="next"
            />
            <ErrorText>{errors.label}</ErrorText>

            <Field
              label="Street & city"
              value={draft.address}
              onChangeText={setField('address')}
              placeholder="12 Mabini St, Quezon City"
            />
            <ErrorText>{errors.address}</ErrorText>

            {/* Unit and building side by side: they are one answer, "which
                door", and together they fit a row a phone can hold. */}
            <View style={styles.pair}>
              <View style={styles.pairCell}>
                <Field
                  label="Unit (optional)"
                  value={draft.unit}
                  onChangeText={setField('unit')}
                  placeholder="4B"
                />
                <ErrorText>{errors.unit}</ErrorText>
              </View>
              <View style={styles.pairWide}>
                <Field
                  label="Building (optional)"
                  value={draft.building}
                  onChangeText={setField('building')}
                  placeholder="Tower 2, Sunrise Condo"
                />
                <ErrorText>{errors.building}</ErrorText>
              </View>
            </View>

            <Field
              label="Landmark (optional)"
              value={draft.landmark}
              onChangeText={setField('landmark')}
              placeholder="Across the 7-Eleven"
            />
            <ErrorText>{errors.landmark}</ErrorText>

            <Field
              label="Rider instructions (optional)"
              value={draft.notes}
              onChangeText={setField('notes')}
              placeholder="Green gate, ring twice"
            />
            <ErrorText>{errors.notes}</ErrorText>

            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: isBusy }}
              disabled={isBusy}
              onPress={submit}
              style={({ pressed }) => [styles.save, pressed && styles.pressed]}
            >
              <Text style={styles.saveText}>{isBusy ? 'Saving…' : 'Save address'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.room,
    gap: space.cosy,
    ...elevation.rest,
  },
  cardHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cardTitle: { ...type.section, color: colors.text },
  cardCount: { ...type.caption, color: colors.subtle },
  empty: { ...type.body, color: colors.subtle },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.cosy,
    paddingVertical: space.snug,
  },
  /** A hairline, not a border: these are rows of one list, not stacked cards. */
  rowSeam: { borderTopWidth: 1, borderTopColor: colors.border },
  pin: {
    width: 36,
    height: 36,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  pinDefault: { backgroundColor: BLUE_FIELD.mid },
  rowWords: { flex: 1, gap: 2 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  rowLabel: { ...type.label, fontSize: 16, color: colors.text, flexShrink: 1 },
  defaultChip: {
    paddingHorizontal: space.snug,
    paddingVertical: 1,
    borderRadius: 999,
    backgroundColor: colors.actionSurface,
  },
  defaultChipText: { ...type.caption, fontSize: 11, color: colors.actionInk },
  rowAddress: { ...type.body, fontSize: 15, color: colors.subtle },
  rowNotes: { ...type.caption, color: colors.subtle, fontStyle: 'italic' },
  makeDefault: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
  makeDefaultText: { ...type.label, fontSize: 13, color: colors.actionInk },
  rowKeys: { flexDirection: 'row', gap: space.tight },
  key: {
    width: 36,
    height: 36,
    borderRadius: RADII.control,
    alignItems: 'center',
    justifyContent: 'center',
  },

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: space.cosy,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: BLUE_FIELD.mid, borderColor: BLUE_FIELD.mid },
  chipText: { ...type.label, fontSize: 13, color: colors.text, flexShrink: 1 },
  chipTextActive: { color: colors.onAccent },

  /** The one filled shape in the card, in the profile card's own blue. */
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: BLUE_FIELD.mid,
  },
  addText: { ...type.label, fontSize: 16, color: colors.onAccent },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11, 27, 43, 0.45)' },
  scrim: { flex: 1 },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.room,
    paddingTop: space.snug,
    maxHeight: '86%',
  },
  grip: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    marginBottom: space.cosy,
  },
  sheetBody: { gap: space.snug, paddingBottom: space.room },
  pair: { flexDirection: 'row', gap: space.snug },
  pairCell: { flex: 2 },
  pairWide: { flex: 3 },
  sheetTitle: { ...type.title, color: colors.text, marginBottom: space.tight },
  save: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BLUE_FIELD.mid,
    marginTop: space.cosy,
  },
  saveText: { ...type.label, fontSize: 16, color: colors.onAccent },

  pressed: { opacity: 0.7 },
});
