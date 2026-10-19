/**
 * Adding a service, or changing any part of one, as a screen of its own.
 *
 * The add form used to be the last fold of an accordion, with a dropdown for
 * the category folded inside it, and editing a price opened a second form
 * inside the list that could change only the price and the minimum. A wrong
 * category or a misspelt name meant removing the service and adding it again.
 * Now both are this one form, whole-screen, with every field open to change.
 */
import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { upsertService, updateService } from '@/lib/api';
import { confirmAction } from '@/lib/confirm';
import { removeServicePrompt } from '@/lib/domain/confirm-prompts';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { CATEGORY_LABELS, CATEGORY_ORDER, type ServiceCategory } from '@/lib/domain/service-catalog';
import {
  EMPTY_SERVICE_DRAFT,
  draftFromService,
  loadSizeExample,
  looksLikeAddon,
  takesWeightTable,
  unitHelp,
  validateServiceDraft,
  type ChargeKind,
  type PriceBy,
  type ServiceDraft,
} from '@/lib/domain/service-draft';
import { sceneFor } from '@/lib/domain/service-scene';
import { showcaseTone } from '@/lib/domain/service-showcase';
import {
  readWeightPrices,
  validateWeightPriceDraft,
  type WeightPrice,
  type WeightPriceDraft,
} from '@/lib/domain/weight-prices';
import type { ServiceRow } from '@/lib/types';

import { glassChip, glassPane, useIsGlass } from './glass';
import { Segmented } from './segmented';
import { ServicePhotoPicker } from './service-photo-picker';
import { ServiceScene } from './service-scene';
import { ServiceTileCard, type ShowcaseCardService } from './service-tile-card';
import { Button, ErrorText, Field, RADII, TAG_TONES, colors, fontFor, space, type } from './ui-kit';
import { WeightPriceEditor, draftsFromWeightPrices } from './weight-price-editor';

const UNIT_OPTIONS: { key: ChargeKind; label: string }[] = [
  { key: 'per_kg', label: 'Per kg' },
  { key: 'per_load', label: 'Per load' },
  { key: 'per_item', label: 'Per piece' },
  { key: 'flat', label: 'Flat' },
];

const PRICE_BY_OPTIONS: { key: PriceBy; label: string }[] = [
  { key: 'one', label: 'One price' },
  { key: 'table', label: 'Weight table' },
];

/** The preview never shows a stepper, but the card asks for its colours. */
const PREVIEW_TONE = { bg: colors.action, ink: colors.onAccent };

function priceLabel(unit: ChargeKind | null): string {
  if (unit === 'per_kg') return 'Price per kg (₱)';
  if (unit === 'per_load') return 'Price per load (₱)';
  if (unit === 'per_item') return 'Price per piece (₱)';
  if (unit === 'flat') return 'Price for the whole job (₱)';
  return 'Price (₱)';
}

/** What follows the figure in the price box, so "₱ 35 per kg" reads as one sentence. */
function unitSuffix(unit: ChargeKind | null): string {
  if (unit === 'per_kg') return 'per kg';
  if (unit === 'per_load') return 'per load';
  if (unit === 'per_item') return 'per piece';
  if (unit === 'flat') return 'per job';
  return '';
}

/**
 * The draft as the customer's price board will show it. Blanks fall back to
 * something neutral rather than a guess: no unit shows no unit, no section
 * shows Other, so the preview never states a choice the owner has not made.
 */
function previewService(
  draft: ServiceDraft,
  id: string,
  table: readonly WeightPrice[] | null,
  imageUrl: string
): ShowcaseCardService {
  const price = table ? (table[0]?.price ?? 0) : Number(draft.price.trim());
  const minimum = table ? 0 : Number(draft.minQuantity.trim());
  const loadSize = Number(draft.maxQuantity.trim());
  return {
    id,
    name: draft.name.trim() || 'Your service',
    category: draft.category ?? 'other',
    unit: draft.unit === 'per_load' || !draft.unit ? 'flat' : draft.unit,
    price: Number.isFinite(price) && price > 0 ? price : 0,
    min_quantity: draft.unit === 'per_kg' && Number.isFinite(minimum) ? minimum : 0,
    max_quantity: draft.unit === 'per_load' && Number.isFinite(loadSize) && loadSize > 0 ? loadSize : 0,
    weight_prices: table ?? [],
    description: draft.description,
    image_url: imageUrl,
  };
}

/**
 * Six sections as a 3×2 grid of tiles. As a column of radio rows they took
 * half the screen and pushed the price, the field an owner opens this form
 * for, below the fold.
 */
function CategoryChoice({
  value,
  onChange,
}: {
  value: ServiceCategory | null;
  onChange: (category: ServiceCategory) => void;
}) {
  const isGlass = useIsGlass();
  return (
    <View style={styles.tileGrid} accessibilityRole="radiogroup">
      {CATEGORY_ORDER.map((category) => {
        const isSelected = category === value;
        return (
          <Pressable
            key={category}
            accessibilityRole="radio"
            accessibilityState={{ checked: isSelected }}
            accessibilityLabel={CATEGORY_LABELS[category]}
            onPress={() => onChange(category)}
            style={({ pressed }) => [
              styles.tile,
              isGlass && styles.tileGlass,
              isSelected && styles.tileSelected,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.tileArt} pointerEvents="none">
              <ServiceScene
                scene={sceneFor('', category)}
                brand={showcaseTone(category).bg}
                surface="white"
              />
            </View>
            <Text
              style={[styles.tileText, isSelected && styles.tileTextSelected]}
              numberOfLines={2}
            >
              {CATEGORY_LABELS[category]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The figure the owner came to change, set large with its unit beside it. */
function PriceInput({
  unit,
  value,
  onChange,
}: {
  unit: ChargeKind | null;
  value: string;
  onChange: (price: string) => void;
}) {
  const suffix = unitSuffix(unit);
  const isGlass = useIsGlass();
  return (
    <View style={[styles.priceBox, isGlass && styles.priceBoxGlass]}>
      <Text style={styles.pricePeso}>₱</Text>
      <TextInput
        accessibilityLabel={priceLabel(unit)}
        value={value}
        onChangeText={onChange}
        keyboardType="decimal-pad"
        placeholder="35"
        placeholderTextColor={colors.subtle}
        style={styles.priceText}
      />
      {suffix ? <Text style={styles.priceUnit}>{suffix}</Text> : null}
    </View>
  );
}

/** A white panel on the page field, so the recessed inputs inside read as inputs. */
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const isGlass = useIsGlass();
  return (
    <View style={[styles.panel, isGlass && styles.panelGlass]}>
      <Text style={styles.panelTitle}>{title}</Text>
      {children}
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
  const [weightRows, setWeightRows] = useState<WeightPriceDraft[]>(() =>
    draftsFromWeightPrices(readWeightPrices(service?.weight_prices))
  );
  const [imageUrl, setImageUrl] = useState(service?.image_url ?? '');

  const byTable = draft.priceBy === 'table' && takesWeightTable(draft.unit);
  // One price clears the table: only the table rows are checked, and only when they price it.
  const weightResult = byTable ? validateWeightPriceDraft(weightRows) : null;
  const table = weightResult?.ok ? weightResult.value : [];
  const result = validateServiceDraft(draft, table);
  const errors = hasTried && !result.ok ? result.errors : {};
  const weightError =
    hasTried && weightResult && !weightResult.ok ? weightResult.error : errors.weightPrices;
  const isReady = result.ok && (weightResult?.ok ?? true);
  const update = (patch: Partial<ServiceDraft>) =>
    setDraft((current) => ({ ...current, ...patch }));

  const save = useMutation({
    mutationFn: async () => {
      if (!result.ok || !isReady) throw new Error('The price was not saved.');
      const fields = result.value;
      if (service) return updateService(service.id, fields);
      return upsertService({ shop_id: shopId, ...fields });
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
    if (isReady) save.mutate();
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

      {/* The customer's tile, redrawn on every keystroke: the page's one
          picture, and the answer to "what will they see?" */}
      <View style={styles.preview}>
        <View style={styles.previewTile} pointerEvents="none">
          <ServiceTileCard
            // Keyed on the photo so a broken old URL's fallback does not stick.
            key={imageUrl}
            service={previewService(draft, service?.id ?? 'preview', byTable ? table : null, imageUrl)}
            bookTone={PREVIEW_TONE}
          />
        </View>
        <View style={styles.previewNote}>
          <Text style={styles.previewTitle}>How customers see it</Text>
          <Text style={styles.help}>This tile changes as you type.</Text>
          <ServicePhotoPicker shopId={shopId} service={service} imageUrl={imageUrl} onChange={setImageUrl} />
        </View>
      </View>

      <Panel title="Name and price">
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

        <View style={styles.group}>
          <Text style={styles.groupLabel}>Charge</Text>
          <Segmented
            options={UNIT_OPTIONS}
            value={draft.unit}
            onChange={(unit) => update({ unit })}
            accessibilityRole="radiogroup"
          />
          <ErrorText>{errors.unit}</ErrorText>
        </View>

        {takesWeightTable(draft.unit) ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>Set the price by</Text>
            <Segmented
              options={PRICE_BY_OPTIONS}
              value={byTable ? 'table' : 'one'}
              onChange={(priceBy) => update({ priceBy })}
              accessibilityRole="radiogroup"
            />
          </View>
        ) : null}

        {byTable ? (
          <View style={styles.group}>
            <WeightPriceEditor rows={weightRows} onChange={setWeightRows} error={weightError} />
          </View>
        ) : (
          <View style={styles.group}>
            <PriceInput unit={draft.unit} value={draft.price} onChange={(price) => update({ price })} />
            {draft.unit ? <Text style={styles.help}>{unitHelp(draft.unit)}</Text> : null}
            <ErrorText>{errors.price}</ErrorText>
          </View>
        )}

        {draft.unit === 'per_load' && byTable ? (
          <View style={styles.group}>
            <Field
              label="Kg per load (label only)"
              value={draft.maxQuantity}
              onChangeText={(maxQuantity) => update({ maxQuantity })}
              keyboardType="decimal-pad"
              placeholder="8"
            />
            <Text style={styles.help}>
              Optional. Customers see it as a note, like max 8 kg per load. Your weight table sets
              the price.
            </Text>
            <ErrorText>{errors.maxQuantity}</ErrorText>
          </View>
        ) : null}

        {draft.unit === 'per_load' && !byTable ? (
          <View style={styles.group}>
            <Field
              label="Kg per load"
              value={draft.maxQuantity}
              onChangeText={(maxQuantity) => update({ maxQuantity })}
              keyboardType="decimal-pad"
              placeholder="4"
            />
            <Text style={styles.help}>{loadSizeExample(draft)}</Text>
            <ErrorText>{errors.maxQuantity}</ErrorText>
          </View>
        ) : null}

        {(draft.unit === 'per_kg' || draft.unit === 'flat') && !byTable ? (
          <View style={styles.group}>
            <View style={styles.pair}>
              {draft.unit === 'per_kg' ? (
                <View style={styles.pairItem}>
                  <Field
                    label="Charge at least (kg)"
                    value={draft.minQuantity}
                    onChangeText={(minQuantity) => update({ minQuantity })}
                    keyboardType="decimal-pad"
                    placeholder="5"
                  />
                </View>
              ) : null}
              <View style={styles.pairItem}>
                <Field
                  label="Most per load (kg)"
                  value={draft.maxQuantity}
                  onChangeText={(maxQuantity) => update({ maxQuantity })}
                  keyboardType="decimal-pad"
                  placeholder="6"
                />
              </View>
            </View>
            <Text style={styles.help}>Optional. Leave blank for no limit.</Text>
            <ErrorText>{errors.minQuantity}</ErrorText>
            <ErrorText>{errors.maxQuantity}</ErrorText>
          </View>
        ) : null}
      </Panel>

      <Panel title="Section on your price list">
        <CategoryChoice value={draft.category} onChange={(category) => update({ category })} />
        <ErrorText>{errors.category}</ErrorText>
      </Panel>

      <Panel title="Details">
        <Field
          label="What's included (optional)"
          value={draft.description}
          onChangeText={(description) => update({ description })}
          placeholder="Regular clothes, folded and bagged"
        />
      </Panel>

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
  pressed: { opacity: 0.7 },

  preview: { flexDirection: 'row', alignItems: 'center', gap: space.room },
  /** Half the width, the size the tile has in the customer's two-column grid. */
  previewTile: { width: '50%', maxWidth: 240 },
  previewNote: { flex: 1, minWidth: 0, gap: space.tight },
  previewTitle: { ...type.label, color: colors.text },

  panel: {
    gap: space.cosy,
    padding: space.room,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  panelGlass: { ...glassPane, borderRadius: RADII.card },
  panelTitle: { ...type.label, ...fontFor(700), color: colors.text },

  priceBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    marginTop: space.snug,
    paddingHorizontal: space.room,
    minHeight: 60,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.sunken,
  },
  priceBoxGlass: { ...glassChip },
  pricePeso: { ...type.value, ...fontFor(600), color: colors.subtle },
  priceText: {
    flex: 1,
    minWidth: 0,
    ...type.value,
    fontVariant: ['tabular-nums'],
    color: colors.text,
    paddingVertical: space.snug,
  },
  priceUnit: { ...type.label, color: colors.subtle },

  pair: { flexDirection: 'row', gap: space.cosy },
  pairItem: { flex: 1, minWidth: 0 },

  tileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    alignItems: 'center',
    gap: space.snug,
    minHeight: 92,
    paddingVertical: space.cosy,
    paddingHorizontal: space.tight,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  tileGlass: { ...glassChip, borderWidth: 1.5 },
  tileSelected: { borderColor: colors.action, backgroundColor: colors.actionSurface },
  /** The same drawings the customer's price board uses, so each section looks like its own shelf. */
  tileArt: { width: 56, height: 56 },
  tileText: { ...type.caption, ...fontFor(600), color: colors.text, textAlign: 'center' },
  tileTextSelected: { color: colors.actionInk },

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
