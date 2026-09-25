/**
 * The owner's shelf of add-ons: what they stock, their photo of it, its price.
 *
 * Customers see these as product cards when they book; this is the other side
 * of the counter. Each row is the card they will see, small, with a switch to
 * take it off sale and a tap to change its name, price or photo. The photo is
 * the owner's own — the Ariel on their shelf — because a stock brand image
 * would not be theirs to use, and would not show what they actually pour.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import {
  getShopAddonGroups,
  getShopAddons,
  saveShopAddon,
  seedStarterAddons,
  setShopAddonGroup,
  updateShopAddon,
  uploadAddonPhoto,
} from '@/lib/api';
import {
  ADDON_KINDS,
  ADDON_KIND_SHORT,
  ADDON_KIND_TITLES,
  STARTER_ADDONS,
  ADDON_QUANTITY_LIMIT,
  addonPriceLabel,
  allowsMultiple,
  validateAddonDraft,
  type AddonDraftResult,
  type AddonKind,
  type ShopAddon,
} from '@/lib/domain/shop-addons';

import { AddonPicture } from './addon-shelf';
import { Button, ErrorText, Field, RADII, Subtle, colors, fontFor, space, type } from './ui-kit';

const THUMB = 64;

async function pickPhoto(): Promise<string | null> {
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    // Square-ish, like the product cards customers see.
    allowsEditing: true,
    aspect: [5, 4],
    quality: 0.6,
  });
  return picked.canceled ? null : picked.assets[0].uri;
}

function draftError(result: AddonDraftResult): string {
  if (result.ok) return '';
  return result.errors.name ?? result.errors.price ?? result.errors.maxQuantity ?? '';
}

/** "Up to 3 per booking", or nothing for the usual one. */
function limitLabel(maxQuantity: number): string {
  return maxQuantity > 1 ? `Up to ${maxQuantity} per booking` : '';
}

/** Price and limit, side by side: the two numbers a shop sets on every add-on. */
function PriceAndLimit({
  price,
  maxQuantity,
  onPrice,
  onMaxQuantity,
}: {
  price: string;
  maxQuantity: string;
  onPrice: (next: string) => void;
  onMaxQuantity: (next: string) => void;
}) {
  return (
    <View style={styles.numberRow}>
      <View style={styles.numberCell}>
        <Field
          label="Price each (₱)"
          value={price}
          onChangeText={onPrice}
          keyboardType="decimal-pad"
          placeholder="0 = free"
        />
      </View>
      <View style={styles.numberCell}>
        <Field
          label={`Most per booking (1–${ADDON_QUANTITY_LIMIT})`}
          value={maxQuantity}
          onChangeText={onMaxQuantity}
          keyboardType="number-pad"
          placeholder="1"
        />
      </View>
    </View>
  );
}

function AddonRow({
  addon,
  onSaved,
}: {
  addon: ShopAddon;
  onSaved: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState(addon.name);
  const [note, setNote] = useState(addon.note);
  const [price, setPrice] = useState(addon.price ? String(addon.price) : '');
  const [maxQuantity, setMaxQuantity] = useState(String(addon.max_quantity ?? 1));
  const [error, setError] = useState('');

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof updateShopAddon>[1]) => updateShopAddon(addon.id, patch),
    onSuccess: () => {
      setError('');
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  const photo = useMutation({
    mutationFn: async () => {
      const uri = await pickPhoto();
      if (!uri) return;
      const url = await uploadAddonPhoto(addon.shop_id, uri);
      await updateShopAddon(addon.id, { image_url: url });
    },
    onSuccess: onSaved,
    onError: (err: Error) => setError(err.message),
  });

  const submit = () => {
    const result = validateAddonDraft({ name, price, maxQuantity });
    if (!result.ok) {
      setError(draftError(result));
      return;
    }
    save.mutate({ ...result.value, note: note.trim() });
    setIsOpen(false);
  };

  return (
    <View style={[styles.row, !addon.is_active && styles.rowOff]}>
      <View style={styles.rowHead}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Change the photo of ${addon.name}`}
          onPress={() => photo.mutate()}
          disabled={photo.isPending}
          style={styles.thumb}
        >
          <AddonPicture addon={addon} width={THUMB} height={THUMB} />
          <View style={styles.camera}>
            <Ionicons
              name={photo.isPending ? 'hourglass-outline' : 'camera'}
              size={12}
              color={colors.onAccent}
            />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: isOpen }}
          accessibilityLabel={`Edit ${addon.name}, ${addonPriceLabel(addon.price)}`}
          onPress={() => setIsOpen((open) => !open)}
          style={styles.rowText}
        >
          <Text style={styles.rowName} numberOfLines={1}>
            {addon.name}
          </Text>
          <Text style={styles.rowMeta} numberOfLines={1}>
            {ADDON_KIND_SHORT[addon.kind]}
            {addon.note ? ` · ${addon.note}` : ''}
          </Text>
          {!addon.image_url && (
            <Text style={styles.photoHint}>No photo yet — tap the picture to add one</Text>
          )}
          <Text style={[styles.rowPrice, addon.price === 0 && styles.rowFree]}>
            {addonPriceLabel(addon.price)}
            {addon.max_quantity > 1 ? ' each' : ''}
            {limitLabel(addon.max_quantity) ? (
              <Text style={styles.rowLimit}>{`  ·  ${limitLabel(addon.max_quantity)}`}</Text>
            ) : null}
          </Text>
          <View style={styles.editLink}>
            <Ionicons name={isOpen ? 'chevron-up' : 'create-outline'} size={14} color={colors.actionInk} />
            <Text style={styles.editLinkText}>{isOpen ? 'Close' : 'Edit price & limit'}</Text>
          </View>
        </Pressable>
        <View style={styles.switchCol}>
          <Switch
            accessibilityLabel={`${addon.name} on sale`}
            value={addon.is_active}
            onValueChange={(isActive) => save.mutate({ is_active: isActive })}
            trackColor={{ true: colors.action, false: colors.border }}
          />
          <Text style={styles.switchText}>{addon.is_active ? 'On sale' : 'Hidden'}</Text>
        </View>
      </View>

      {isOpen && (
        <View style={styles.editor}>
          <Field label="Name" value={name} onChangeText={setName} maxLength={40} />
          <Field label="Short note (optional)" value={note} onChangeText={setNote} maxLength={60} placeholder="Powder" />
          <PriceAndLimit
            price={price}
            maxQuantity={maxQuantity}
            onPrice={setPrice}
            onMaxQuantity={setMaxQuantity}
          />
          <Button title={save.isPending ? 'Saving…' : 'Save'} onPress={submit} disabled={save.isPending} />
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function AddForm({ shopId, onSaved }: { shopId: string; onSaved: () => void }) {
  const [kind, setKind] = useState<AddonKind>('detergent');
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [price, setPrice] = useState('');
  const [maxQuantity, setMaxQuantity] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [error, setError] = useState('');

  const add = useMutation({
    // The photo goes up first, so a failed upload leaves no product on the
    // shelf without the picture the owner just chose for it.
    mutationFn: async (value: { name: string; price: number; max_quantity: number }) => {
      const imageUrl = photoUri ? await uploadAddonPhoto(shopId, photoUri) : null;
      await saveShopAddon({ shop_id: shopId, kind, note: note.trim(), image_url: imageUrl, ...value });
    },
    onSuccess: () => {
      setName('');
      setNote('');
      setPrice('');
      setMaxQuantity('');
      setPhotoUri(null);
      setError('');
      onSaved();
    },
    onError: (err: Error) => setError(err.message),
  });

  const choosePhoto = async () => {
    try {
      const uri = await pickPhoto();
      if (uri) setPhotoUri(uri);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open your photos.');
    }
  };

  const submit = () => {
    const result = validateAddonDraft({ name, price, maxQuantity });
    if (!result.ok) {
      setError(draftError(result));
      return;
    }
    add.mutate(result.value);
  };

  return (
    <View style={styles.addForm}>
      <Text style={styles.addTitle}>Add an add-on</Text>
      <View style={styles.kindRow} accessibilityRole="radiogroup">
        {ADDON_KINDS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === option }}
            onPress={() => setKind(option)}
            style={[styles.kindChip, kind === option && styles.kindChipOn]}
          >
            <Text style={[styles.kindText, kind === option && styles.kindTextOn]}>
              {ADDON_KIND_SHORT[option]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.photoRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={photoUri ? 'Change the product photo' : 'Add a product photo'}
          onPress={choosePhoto}
          style={styles.photoPick}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} contentFit="cover" />
          ) : (
            <Ionicons name="camera-outline" size={26} color={colors.actionInk} />
          )}
        </Pressable>
        <View style={styles.photoText}>
          <Text style={styles.rowName}>{photoUri ? 'Photo ready' : 'Product photo'}</Text>
          <Subtle>
            {photoUri
              ? 'Tap it to pick another.'
              : 'Optional. A photo of the pack on your shelf sells better than the drawing.'}
          </Subtle>
        </View>
      </View>
      <Field label="Name" value={name} onChangeText={setName} maxLength={40} placeholder="Ariel" />
      <Field label="Short note (optional)" value={note} onChangeText={setNote} maxLength={60} placeholder="Powder" />
      <PriceAndLimit
        price={price}
        maxQuantity={maxQuantity}
        onPrice={setPrice}
        onMaxQuantity={setMaxQuantity}
      />
      <ErrorText>{error}</ErrorText>
      <Button title={add.isPending ? 'Adding…' : 'Add to shelf'} onPress={submit} disabled={add.isPending} />
    </View>
  );
}

export function MerchantAddons({ shopId }: { shopId: string }) {
  const queryClient = useQueryClient();
  const [seedError, setSeedError] = useState('');
  const { data: addons, error } = useQuery({
    queryKey: ['shop-addons', shopId],
    queryFn: () => getShopAddons(shopId),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shop-addons', shopId] });
  const { data: rules = {} } = useQuery({
    queryKey: ['shop-addon-groups', shopId],
    queryFn: () => getShopAddonGroups(shopId),
  });
  const [ruleError, setRuleError] = useState('');
  const setRule = useMutation({
    mutationFn: ({ kind, allowMultiple }: { kind: AddonKind; allowMultiple: boolean }) =>
      setShopAddonGroup(shopId, kind, allowMultiple),
    onSuccess: () => {
      setRuleError('');
      void queryClient.invalidateQueries({ queryKey: ['shop-addon-groups', shopId] });
    },
    onError: (err: Error) => setRuleError(err.message),
  });

  const seed = useMutation({
    mutationFn: () => seedStarterAddons(shopId, STARTER_ADDONS),
    onSuccess: refresh,
    onError: (err: Error) => setSeedError(err.message),
  });

  const rows = addons ?? [];

  return (
    <View style={styles.sheet}>
      <View style={styles.head}>
        <Text style={styles.title}>Add-ons</Text>
        <Subtle>
          Soaps, fabcons and extras customers can add when they book. Each is charged once per
          booking, on top of the wash.
        </Subtle>
      </View>

      {error ? <ErrorText>{error.message}</ErrorText> : null}
      <ErrorText>{ruleError}</ErrorText>

      {addons && rows.length === 0 && (
        <View style={styles.starter}>
          <Text style={styles.addTitle}>Stock the usual shelf</Text>
          <Subtle>
            Adds Ariel, Tide, Breeze, Surf and Champion at ₱15, and Downy, Surf Fabcon and Del at
            ₱10. Change the prices and photos afterwards, and hide any you don&apos;t carry.
          </Subtle>
          <ErrorText>{seedError}</ErrorText>
          <Button
            title={seed.isPending ? 'Adding…' : 'Add the usual brands'}
            onPress={() => seed.mutate()}
            disabled={seed.isPending}
          />
        </View>
      )}

      {ADDON_KINDS.map((kind) => {
        const ofKind = rows.filter((row) => row.kind === kind);
        if (ofKind.length === 0) return null;
        return (
          <View key={kind} style={styles.group}>
            <Text style={styles.groupTitle}>{ADDON_KIND_TITLES[kind]}</Text>
            <View style={styles.ruleRow}>
              <View style={styles.ruleText}>
                <Text style={styles.ruleTitle}>Customers can pick more than one</Text>
                <Text style={styles.rowMeta}>
                  {allowsMultiple(kind, rules)
                    ? 'They can add several of these to one booking.'
                    : 'Picking one replaces the last — one per booking.'}
                </Text>
              </View>
              <Switch
                accessibilityLabel={`Customers can pick more than one ${ADDON_KIND_SHORT[kind]}`}
                value={allowsMultiple(kind, rules)}
                disabled={setRule.isPending}
                onValueChange={(allowMultiple) => setRule.mutate({ kind, allowMultiple })}
                trackColor={{ true: colors.action, false: colors.border }}
              />
            </View>
            {ofKind.map((addon) => (
              <AddonRow key={`${addon.id}:${addon.price}:${addon.name}:${addon.max_quantity}`} addon={addon} onSaved={refresh} />
            ))}
          </View>
        );
      })}

      <AddForm shopId={shopId} onSaved={refresh} />
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.card,
    borderRadius: RADII.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  head: { padding: space.room, gap: space.tight },
  title: { ...type.section, color: colors.text },
  starter: {
    marginHorizontal: space.room,
    marginBottom: space.room,
    padding: space.room,
    gap: space.snug,
    borderRadius: RADII.control,
    backgroundColor: colors.actionSurface,
  },
  group: { gap: space.snug, paddingHorizontal: space.room, paddingBottom: space.cosy },
  groupTitle: { ...type.label, color: colors.subtle },
  row: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADII.control,
    padding: space.snug,
    gap: space.snug,
  },
  rowOff: { opacity: 0.6 },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  thumb: { width: THUMB, height: THUMB, borderRadius: RADII.chip, overflow: 'hidden' },
  camera: {
    position: 'absolute',
    right: 3,
    bottom: 3,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(11,27,43,0.7)',
  },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { ...type.body, fontFamily: fontFor(700), color: colors.text },
  rowMeta: { ...type.caption, color: colors.subtle },
  rowPrice: { ...type.label, fontFamily: fontFor(800), color: colors.text },
  rowFree: { color: '#0B7A4B' },
  switchCol: { alignItems: 'center', gap: 2 },
  switchText: { ...type.caption, fontSize: 11, color: colors.subtle },
  editor: { gap: space.snug },
  rowLimit: { ...type.caption, fontFamily: fontFor(600), color: colors.subtle },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  editLinkText: { ...type.caption, fontFamily: fontFor(700), color: colors.actionInk },
  numberRow: { flexDirection: 'row', gap: space.snug },
  numberCell: { flex: 1, minWidth: 0 },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    padding: space.snug,
    borderRadius: RADII.control,
    backgroundColor: colors.actionSurface,
  },
  ruleText: { flex: 1, minWidth: 0, gap: 1 },
  ruleTitle: { ...type.label, color: colors.text },
  photoHint: { ...type.caption, fontSize: 11, color: colors.actionInk },
  photoRow: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  photoPick: {
    width: THUMB,
    height: THUMB,
    borderRadius: RADII.chip,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.actionMuted,
    backgroundColor: colors.actionSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photoPreview: { width: THUMB, height: THUMB },
  photoText: { flex: 1, minWidth: 0, gap: 2 },
  addForm: {
    padding: space.room,
    gap: space.snug,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  addTitle: { ...type.label, fontSize: 15, color: colors.text },
  kindRow: { flexDirection: 'row', gap: space.snug },
  kindChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  kindChipOn: { backgroundColor: colors.action, borderColor: colors.action },
  kindText: { ...type.label, color: colors.text },
  kindTextOn: { color: colors.onAccent },
});
