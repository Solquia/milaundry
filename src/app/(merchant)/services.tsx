import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  ErrorText,
  Field,
  Loading,
  Screen,
  Subtle,
  colors,
  space,
  type,
  CROWN,
  RADII,
  fontFor,
} from '@/components/ui-kit';
import { getServices, seedStarterServices, updateService, upsertService } from '@/lib/api';
import { removeServicePrompt } from '@/lib/domain/confirm-prompts';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { nextOpenCategory } from '@/lib/domain/price-accordion';
import { formatPriceLine } from '@/lib/domain/price-label';
import { categoryPriceSummary, selectedCategoryLabel } from '@/lib/domain/price-sections';
import type { PricingUnit } from '@/lib/domain/pricing';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  STARTER_SERVICES,
  groupServicesByCategory,
  type ServiceCategory,
  type ServiceGroup,
} from '@/lib/domain/service-catalog';
import { categoryIcon } from '@/lib/domain/shop-home';
import type { ServiceRow as ServiceRecord } from '@/lib/types';
import { useActiveShop } from '@/lib/use-active-shop';

const UNIT_OPTIONS: { value: PricingUnit; label: string }[] = [
  { value: 'per_kg', label: 'Per kg' },
  { value: 'per_item', label: 'Per piece' },
  { value: 'flat', label: 'Flat rate' },
];

/**
 * The one control shape this screen uses for "there is more behind this".
 *
 * Every price section, the add-service form, and the category picker open the
 * same way, so an owner learns the chevron once rather than three times.
 */
function Disclosure({ isOpen }: { isOpen: boolean }) {
  return (
    <Ionicons
      name={isOpen ? 'chevron-up' : 'chevron-down'}
      size={20}
      color={colors.borderStrong}
    />
  );
}

/**
 * Which category a new service goes into, as a picker rather than a chip field.
 *
 * Six chips wrapped to three rows, all equally loud, and the chosen one could
 * end up alone on the last row where it read as a separate control rather than
 * as the answer. Closed, this is one line that states the answer. Open, it is a
 * single column of full-width choices — a list has one reading direction, a
 * wrapped chip grid has two.
 */
function CategoryPicker({
  value,
  onChange,
}: {
  value: ServiceCategory;
  onChange: (category: ServiceCategory) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>Category</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Category: ${selectedCategoryLabel(value)}`}
        accessibilityHint={isOpen ? 'Closes the category list' : 'Opens the category list'}
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((open) => !open)}
        style={({ pressed }) => [styles.pickerValue, pressed && styles.pressed]}
      >
        <Ionicons name={categoryIcon(value) as never} size={18} color={colors.actionInk} />
        <Text style={styles.pickerValueText}>{selectedCategoryLabel(value)}</Text>
        <Disclosure isOpen={isOpen} />
      </Pressable>

      {isOpen && (
        <View style={styles.pickerList}>
          {CATEGORY_ORDER.map((category, index) => {
            const isSelected = category === value;
            return (
              <Pressable
                key={category}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                onPress={() => {
                  onChange(category);
                  // Choosing is the whole reason it opened, so it closes on the
                  // choice: leaving six rows open afterwards pushes the form's
                  // remaining questions below the fold for no gain.
                  setIsOpen(false);
                }}
                style={({ pressed }) => [
                  styles.pickerOption,
                  index > 0 && styles.pickerOptionDivided,
                  isSelected && styles.pickerOptionSelected,
                  pressed && styles.pressed,
                ]}
              >
                <Ionicons
                  name={categoryIcon(category) as never}
                  size={18}
                  color={isSelected ? colors.actionInk : colors.subtle}
                />
                <Text
                  style={[
                    styles.pickerOptionText,
                    isSelected && styles.pickerOptionTextSelected,
                  ]}
                >
                  {CATEGORY_LABELS[category]}
                </Text>
                {isSelected && (
                  <Ionicons name="checkmark" size={18} color={colors.actionInk} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

/**
 * One price, as a band inside its category's sheet.
 *
 * Each service used to be its own floating card, so a shop with ten prices was
 * ten boxes with ten gaps and the add-service form sat below all of it. Bands
 * separated by a hairline are how a printed price board does it — one sheet per
 * section, ruled lines inside.
 */
function PriceBand({
  service,
  isFirst,
  onSaved,
}: {
  service: ServiceRecord;
  isFirst: boolean;
  onSaved: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState(String(service.price));
  const [minQuantity, setMinQuantity] = useState(String(service.min_quantity));
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: (patch: Parameters<typeof updateService>[1]) =>
      updateService(service.id, patch),
    onSuccess: () => {
      setIsEditing(false);
      setError('');
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleSave = () => {
    const parsedPrice = Number(price);
    const parsedMin = Number(minQuantity);
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid price.');
      return;
    }
    if (!Number.isFinite(parsedMin) || parsedMin < 0) {
      setError('Enter a valid minimum.');
      return;
    }
    mutation.mutate({ price: parsedPrice, min_quantity: parsedMin });
  };

  const confirmRemove = () => {
    const prompt = removeServicePrompt(service.name);
    Alert.alert(prompt.title, prompt.message, [
      { text: prompt.dismissLabel, style: 'cancel' },
      {
        text: prompt.confirmLabel,
        style: 'destructive',
        onPress: () => mutation.mutate({ is_active: false }),
      },
    ]);
  };

  return (
    <View style={[styles.band, !isFirst && styles.bandDivided]}>
      <View style={styles.bandHead}>
        <View style={styles.bandText}>
          <Text style={styles.bandName}>{service.name}</Text>
          <Text style={styles.bandPrice}>{formatPriceLine(service)}</Text>
          {service.description ? <Subtle>{service.description}</Subtle> : null}
        </View>
        {/* A Pressable, not a Text with onPress: the old one was invisible to
            TalkBack as a control and offered a ~17pt tap target. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isEditing ? `Close ${service.name}` : `Edit ${service.name}`}
          accessibilityState={{ expanded: isEditing }}
          onPress={() => setIsEditing((editing) => !editing)}
          hitSlop={12}
        >
          <Text style={styles.bandAction}>{isEditing ? 'Close' : 'Edit'}</Text>
        </Pressable>
      </View>

      {isEditing && (
        <View style={styles.bandForm}>
          <Field label="Price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" />
          {service.unit === 'per_kg' && (
            <Field
              label="Smallest load you charge for, in kg"
              value={minQuantity}
              onChangeText={setMinQuantity}
              keyboardType="decimal-pad"
            />
          )}
          <ErrorText>{error}</ErrorText>
          <Button
            title={mutation.isPending ? 'Saving…' : 'Save changes'}
            onPress={handleSave}
            disabled={mutation.isPending}
          />
          {/* One tap used to delete a price permanently. */}
          <Button
            title="Remove from price list"
            variant="danger"
            onPress={confirmRemove}
            disabled={mutation.isPending}
          />
        </View>
      )}
    </View>
  );
}

/**
 * One category of the owner's price list, open or closed.
 *
 * The closed state is not a hidden section: it states how many prices are
 * inside and the spread they cover, which is what an owner scans this screen to
 * check. Opening is for changing one.
 */
function PriceSection({
  group,
  isOpen,
  onToggle,
  onSaved,
}: {
  group: ServiceGroup<ServiceRecord>;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const label = CATEGORY_LABELS[group.category];
  const summary = categoryPriceSummary(group.services);

  return (
    <View style={styles.sheet}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${summary}.`}
        accessibilityHint={isOpen ? 'Closes this section' : 'Opens this section'}
        accessibilityState={{ expanded: isOpen }}
        onPress={onToggle}
        style={({ pressed }) => [styles.sheetHead, pressed && styles.pressed]}
      >
        <Ionicons
          name={categoryIcon(group.category) as never}
          size={20}
          color={colors.actionInk}
        />
        <View style={styles.sheetHeadText}>
          <Text style={styles.sheetName}>{label}</Text>
          <Text style={styles.sheetSummary}>{summary}</Text>
        </View>
        <Disclosure isOpen={isOpen} />
      </Pressable>

      {isOpen &&
        group.services.map((service, index) => (
          <PriceBand
            key={service.id}
            service={service}
            isFirst={index === 0}
            onSaved={onSaved}
          />
        ))}
    </View>
  );
}

/**
 * Putting a new service on the price list — folded away until it is wanted.
 *
 * Adding is something an owner does at setup and then rarely again, yet the
 * open form was the tallest thing on the screen and sat permanently under every
 * price. Closed, it is one line that says what it is for.
 */
function AddServiceForm({ shopId, onSaved }: { shopId: string; onSaved: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState<PricingUnit>('per_kg');
  const [category, setCategory] = useState<ServiceCategory>('wash_fold');
  const [minQuantity, setMinQuantity] = useState('0');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      upsertService({
        shop_id: shopId,
        name: name.trim(),
        unit,
        price: Number(price),
        category,
        min_quantity: unit === 'per_kg' ? Number(minQuantity) || 0 : 0,
        description: description.trim(),
      }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setDescription('');
      setMinQuantity('0');
      setError('');
      // Folded away again on success: the owner's next question is whether the
      // service landed in the list above, not what to type next.
      setIsOpen(false);
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  const handleAdd = () => {
    const parsedPrice = Number(price);
    if (!name.trim()) {
      setError('Enter a service name.');
      return;
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setError('Enter a valid price.');
      return;
    }
    mutation.mutate();
  };

  return (
    <View style={styles.sheet}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add something you offer"
        accessibilityHint={isOpen ? 'Closes the new service form' : 'Opens the new service form'}
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen((open) => !open)}
        style={({ pressed }) => [styles.sheetHead, pressed && styles.pressed]}
      >
        <Ionicons name="add-circle" size={22} color={colors.action} />
        <View style={styles.sheetHeadText}>
          <Text style={styles.sheetName}>Add something you offer</Text>
          <Text style={styles.sheetSummary}>A new service on your price list</Text>
        </View>
        <Disclosure isOpen={isOpen} />
      </Pressable>

      {isOpen && (
        <View style={styles.addForm}>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Wash, Dry & Fold" />
          <CategoryPicker value={category} onChange={setCategory} />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>How is it priced?</Text>
            <View style={styles.unitRow}>
              {UNIT_OPTIONS.map((option) => (
                <View key={option.value} style={{ flex: 1 }}>
                  <Button
                    title={option.label}
                    variant={unit === option.value ? 'primary' : 'outline'}
                    onPress={() => setUnit(option.value)}
                  />
                </View>
              ))}
            </View>
          </View>
          <Field
            label={
              unit === 'per_kg'
                ? 'Price per kg'
                : unit === 'per_item'
                  ? 'Price per piece'
                  : 'Flat price'
            }
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="35.00"
          />
          {unit === 'per_kg' && (
            <Field
              label="Smallest load you charge for, in kg"
              value={minQuantity}
              onChangeText={setMinQuantity}
              keyboardType="decimal-pad"
              placeholder="5"
            />
          )}
          <Field
            label="Description (optional)"
            value={description}
            onChangeText={setDescription}
            placeholder="Regular clothes, 5 kg minimum"
          />
          <ErrorText>{error}</ErrorText>
          <Button
            title={mutation.isPending ? 'Saving…' : 'Add service'}
            onPress={handleAdd}
            disabled={mutation.isPending}
          />
        </View>
      )}
    </View>
  );
}

export default function MerchantServices() {
  const queryClient = useQueryClient();
  const { shop, isLoading: isShopLoading } = useActiveShop();
  const [seedError, setSeedError] = useState('');
  // `undefined` means "nobody has touched the accordion yet", which is not the
  // same as `null`: the first section opens on arrival so the screen is never a
  // wall of closed doors, but tapping that section still closes it.
  const [openCategory, setOpenCategory] = useState<string | null | undefined>(undefined);

  // `error` was previously never destructured, so a failed fetch rendered as
  // an empty list under the "Start your price list" card — a network problem
  // shown to the owner as though their shop had no prices.
  const { data: services, isLoading, error, refetch } = useQuery({
    queryKey: ['services', shop?.id],
    queryFn: () => getServices(shop!.id),
    enabled: Boolean(shop),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['services', shop?.id] });

  const seedMutation = useMutation({
    mutationFn: () => seedStarterServices(shop!.id, STARTER_SERVICES),
    onSuccess: refresh,
    onError: (err: Error) => setSeedError(err.message),
  });

  if (isShopLoading || isLoading) return <Loading />;
  if (!shop) {
    return (
      <EmptyState message="Your account is not connected to a shop yet. Ask your administrator to add you." />
    );
  }

  const groups = groupServicesByCategory(services ?? []);
  const openOrFirst =
    openCategory === undefined ? (groups[0]?.category ?? null) : openCategory;

  if (error) {
    return (
      <Screen>
        <ErrorState
          message={friendlyMerchantError('load-prices', error.message)}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {services?.length === 0 && (
        <Card>
          <Text style={type.section}>Start your price list</Text>
          <Subtle>
            We can fill this in with the usual laundry shop prices — wash and fold by the kilo,
            ironing and dry cleaning by the piece, comforters, curtains and self-service loads.
            Change any price afterwards to match your shop.
          </Subtle>
          <ErrorText>{seedError}</ErrorText>
          <Button
            title={seedMutation.isPending ? 'Adding prices…' : 'Use the usual prices'}
            onPress={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
          />
        </Card>
      )}

      {/* One section open at a time. Every price in every category used to be
          printed at once, so a shop with a full list scrolled for a screen and
          a half before reaching the form — and each closed section still quotes
          what it holds. */}
      {groups.map((group) => (
        <PriceSection
          key={group.category}
          group={group}
          isOpen={openOrFirst === group.category}
          onToggle={() => setOpenCategory(nextOpenCategory(openOrFirst, group.category))}
          onSaved={refresh}
        />
      ))}

      <AddServiceForm shopId={shop.id} onSaved={refresh} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  /** A category of the price list, or the add form: one sheet, ruled inside. */
  sheet: {
    backgroundColor: colors.card,
    ...CROWN,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.room,
  },
  sheetHeadText: { flex: 1, minWidth: 0 },
  sheetName: { ...type.section, color: colors.text },
  sheetSummary: { ...type.caption, color: colors.subtle, marginTop: 2 },
  pressed: { backgroundColor: colors.sunken },

  band: { paddingHorizontal: space.room, paddingBottom: space.cosy },
  /** Rules between prices, and beneath the header that revealed them. */
  bandDivided: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.cosy },
  bandHead: { flexDirection: 'row', alignItems: 'flex-start', gap: space.snug },
  bandText: { flex: 1, minWidth: 0, gap: 2 },
  bandName: { ...type.body, fontFamily: fontFor(600), color: colors.text },
  bandPrice: { ...type.caption, color: colors.subtle },
  bandAction: { ...type.label, color: colors.actionInk },
  bandForm: { gap: space.snug, marginTop: space.cosy },

  addForm: {
    paddingHorizontal: space.room,
    paddingBottom: space.room,
    paddingTop: space.room,
    gap: space.cosy,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },

  field: { gap: space.tight },
  fieldLabel: { ...type.label, color: colors.subtle },
  unitRow: { flexDirection: 'row', gap: space.snug },

  /** The closed picker wears the shape of the inputs it sits among. */
  pickerValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.control,
    paddingHorizontal: space.cosy,
    paddingVertical: space.cosy,
  },
  pickerValueText: { flex: 1, minWidth: 0, ...type.body, color: colors.text },
  pickerList: {
    marginTop: space.tight,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.control,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    // 44pt minimum: six choices read and tapped at a counter.
    paddingVertical: space.cosy,
    minHeight: 44,
  },
  pickerOptionDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  pickerOptionSelected: { backgroundColor: colors.actionSurface },
  pickerOptionText: { flex: 1, minWidth: 0, ...type.body, color: colors.text },
  pickerOptionTextSelected: { fontWeight: '600', color: colors.actionInk },
});
