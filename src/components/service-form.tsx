/**
 * Adding a service, or changing any part of one, as a screen of its own.
 *
 * The add form used to be the last fold of an accordion, with a dropdown for
 * the category folded inside it, and editing a price opened a second form
 * inside the list that could change only the price and the minimum. A wrong
 * category or a misspelt name meant removing the service and adding it again.
 * Now both are this one form, whole-screen, with every field open to change.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { upsertService, updateService } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { removeServicePrompt } from '@/lib/domain/confirm-prompts';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import type { PricingUnit } from '@/lib/domain/pricing';
import { CATEGORY_LABELS, CATEGORY_ORDER, type ServiceCategory } from '@/lib/domain/service-catalog';
import {
  EMPTY_SERVICE_DRAFT,
  draftFromService,
  looksLikeAddon,
  unitHelp,
  validateServiceDraft,
  type ServiceDraft,
} from '@/lib/domain/service-draft';
import { categoryIcon } from '@/lib/domain/shop-home';
import type { ServiceRow } from '@/lib/types';

import { Segmented } from './segmented';
import { Button, ErrorText, Field, RADII, TAG_TONES, colors, fontFor, space, type } from './ui-kit';

const UNIT_OPTIONS: { key: PricingUnit; label: string }[] = [
  { key: 'per_kg', label: 'Per kg' },
  { key: 'per_item', label: 'Per piece' },
  { key: 'flat', label: 'Flat price' },
];

function priceLabel(unit: PricingUnit | null): string {
  if (unit === 'per_kg') return 'Price per kg (₱)';
  if (unit === 'per_item') return 'Price per piece (₱)';
  if (unit === 'flat') return 'Price for the whole job (₱)';
  return 'Price (₱)';
}

/** Six categories as one always-open column: nothing to unfold, nothing chosen for the owner. */
function CategoryChoice({
  value,
  onChange,
}: {
  value: ServiceCategory | null;
  onChange: (category: ServiceCategory) => void;
}) {
  return (
    <View style={styles.choiceList} accessibilityRole="radiogroup">
      {CATEGORY_ORDER.map((category, index) => {
        const isSelected = category === value;
        return (
          <Pressable
            key={category}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            onPress={() => onChange(category)}
            style={({ pressed }) => [
              styles.choice,
              index > 0 && styles.choiceDivided,
              isSelected && styles.choiceSelected,
              pressed && styles.pressed,
            ]}
          >
            <Ionicons
              name={categoryIcon(category) as never}
              size={18}
              color={isSelected ? colors.actionInk : colors.subtle}
            />
            <Text style={[styles.choiceText, isSelected && styles.choiceTextSelected]}>
              {CATEGORY_LABELS[category]}
            </Text>
            <Ionicons
              name={isSelected ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={isSelected ? colors.actionInk : colors.subtle}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/** A soap typed in as a service: say where it belongs, and offer to go there. */
function AddonHint({ name, onGoToAddons }: { name: string; onGoToAddons?: () => void }) {
  return (
    <View style={styles.hint}>
      <Text style={styles.hintText}>
        {name.trim()} sounds like something on your shelf. Add-ons let customers pick it with
        any booking — as a service, nobody would book it.
      </Text>
      {onGoToAddons ? (
        <Pressable accessibilityRole="button" onPress={onGoToAddons} hitSlop={8}>
          <Text style={styles.hintAction}>Add it under Add-ons instead</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function FieldGroup({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      {children}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export type ServiceFormOutcome = {
  name: string;
  category: ServiceCategory;
  verb: 'added' | 'saved' | 'removed';
};

type ServiceFormProps = {
  shopId: string;
  /** The service being changed; absent when adding a new one. */
  service?: ServiceRow;
  onDone: (outcome: ServiceFormOutcome) => void;
  onCancel: () => void;
  /** Present only for people who can open the Add-ons shelf. */
  onGoToAddons?: () => void;
};

export function ServiceForm({ shopId, service, onDone, onCancel, onGoToAddons }: ServiceFormProps) {
  const isEditing = Boolean(service);
  const [draft, setDraft] = useState<ServiceDraft>(() =>
    service ? draftFromService(service) : EMPTY_SERVICE_DRAFT
  );
  // Errors wait for the first save attempt, then follow every keystroke.
  const [hasTried, setHasTried] = useState(false);
  const [serverError, setServerError] = useState('');

  const result = validateServiceDraft(draft);
  const errors = hasTried && !result.ok ? result.errors : {};
  const update = (patch: Partial<ServiceDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      if (!result.ok) throw new Error('The price was not saved.');
      if (service) return updateService(service.id, result.value);
      return upsertService({ shop_id: shopId, ...result.value });
    },
    onSuccess: (saved) =>
      onDone({ name: saved.name, category: saved.category, verb: isEditing ? 'saved' : 'added' }),
    onError: (err: Error) => setServerError(friendlyMerchantError('save-price', err.message)),
  });

  const remove = useMutation({
    mutationFn: (target: ServiceRow) => updateService(target.id, { is_active: false }),
    onSuccess: (removed) =>
      onDone({ name: removed.name, category: removed.category, verb: 'removed' }),
    onError: (err: Error) => setServerError(friendlyMerchantError('save-price', err.message)),
  });

  const handleSave = () => {
    setHasTried(true);
    setServerError('');
    if (result.ok) save.mutate();
  };

  const isBusy = save.isPending || remove.isPending;
  const showAddonHint = !isEditing && looksLikeAddon(draft.name);

  return (
    <View style={styles.form}>
      <View style={styles.formHead}>
        <Text style={styles.formTitle} numberOfLines={1}>
          {service ? `Edit ${service.name}` : 'New service'}
        </Text>
        <Pressable accessibilityRole="button" onPress={onCancel} hitSlop={12}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      <View>
        <Field
          label="Name"
          value={draft.name}
          onChangeText={(name) => update({ name })}
          placeholder="Wash, Dry & Fold"
        />
        <ErrorText>{errors.name}</ErrorText>
      </View>
      {showAddonHint ? <AddonHint name={draft.name} onGoToAddons={onGoToAddons} /> : null}

      <FieldGroup label="Where it sits on your price list" error={errors.category}>
        <CategoryChoice value={draft.category} onChange={(category) => update({ category })} />
      </FieldGroup>

      <FieldGroup label="How do you charge for it?" error={errors.unit}>
        <Segmented
          options={UNIT_OPTIONS}
          value={draft.unit}
          onChange={(unit) => update({ unit })}
          accessibilityRole="radiogroup"
        />
        {draft.unit ? <Text style={styles.help}>{unitHelp(draft.unit)}</Text> : null}
      </FieldGroup>

      <View>
        <Field
          label={priceLabel(draft.unit)}
          value={draft.price}
          onChangeText={(price) => update({ price })}
          keyboardType="decimal-pad"
          placeholder="35"
        />
        <ErrorText>{errors.price}</ErrorText>
      </View>

      {draft.unit === 'per_kg' ? (
        <View>
          <Field
            label="Smallest load you charge for, in kg (optional)"
            value={draft.minQuantity}
            onChangeText={(minQuantity) => update({ minQuantity })}
            keyboardType="decimal-pad"
            placeholder="5"
          />
          <ErrorText>{errors.minQuantity}</ErrorText>
        </View>
      ) : null}

      <Field
        label="What's included (optional)"
        value={draft.description}
        onChangeText={(description) => update({ description })}
        placeholder="Regular clothes, folded and bagged"
      />

      <ErrorText>{serverError}</ErrorText>
      <Button
        title={save.isPending ? 'Saving…' : isEditing ? 'Save changes' : 'Add service'}
        onPress={handleSave}
        disabled={isBusy}
      />
      {service ? (
        <Pressable
          accessibilityRole="button"
          disabled={isBusy}
          onPress={() =>
            confirmAction(removeServicePrompt(service.name), () => remove.mutate(service))
          }
          style={styles.removeRow}
          hitSlop={8}
        >
          <Text style={styles.remove}>
            {remove.isPending ? 'Removing…' : 'Remove from price list'}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: space.cosy },
  formHead: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  formTitle: { ...type.section, color: colors.text, flex: 1, minWidth: 0 },
  cancel: { ...type.label, color: colors.actionInk },
  group: { gap: space.tight },
  groupLabel: { ...type.label, color: colors.subtle },
  help: { ...type.caption, color: colors.subtle, marginTop: space.tight },
  pressed: { backgroundColor: colors.sunken },

  choiceList: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.control,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    paddingVertical: space.cosy,
    minHeight: 44,
  },
  choiceDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  choiceSelected: { backgroundColor: colors.actionSurface },
  choiceText: { flex: 1, minWidth: 0, ...type.body, color: colors.text },
  choiceTextSelected: { fontFamily: fontFor(600), color: colors.actionInk },

  hint: {
    gap: space.snug,
    padding: space.cosy,
    borderRadius: RADII.control,
    backgroundColor: TAG_TONES.owed.bg,
  },
  hintText: { ...type.caption, color: TAG_TONES.owed.ink },
  hintAction: { ...type.label, color: TAG_TONES.owed.ink, textDecorationLine: 'underline' },

  // Offered, not urged: a quiet red line under the save button rather than a
  // second full-width button stacked hard against it.
  removeRow: { alignSelf: 'center', paddingVertical: space.snug },
  remove: { ...type.label, color: colors.dangerInk },
});
