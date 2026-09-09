/**
 * Where a shop chooses its own face.
 *
 * This screen is unusual in the merchant app: nothing here changes what the
 * shop *does*, only what a customer sees. So it is built as a preview with
 * controls under it rather than a form with a preview bolted on — the merchant
 * should be looking at their shopfront while they change it, not at six inputs
 * and an imagined result.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  ACCENTS,
  Button,
  Card,
  ErrorText,
  Field,
  Subtle,
  colors,
  space,
  type,
} from '@/components/ui-kit';
import { ShopLogo } from '@/components/shop-logo';
import { setShopBranding, uploadBrandLogo, uploadShopCover } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import {
  MAX_TAGLINE,
  resolveAccent,
  validateTagline,
} from '@/lib/domain/shop-branding';
import {
  COVER_ASPECT,
  COVER_QUALITY,
  coverTooLarge,
  heroBackdrop,
  shopLogoUri,
} from '@/lib/domain/shop-cover';
import { invalidateShopSurfaces } from '@/lib/query-keys';
import type { Shop } from '@/lib/types';

interface BrandingCardProps {
  shop: Shop;
}

export function BrandingCard({ shop }: BrandingCardProps) {
  const queryClient = useQueryClient();
  const [accent, setAccent] = useState<number | null>(shop.brand_accent ?? null);
  const [tagline, setTagline] = useState(shop.tagline ?? '');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');

  // What the customer would see right now, chosen tone or hashed fallback.
  const shownAccent =
    ACCENTS[resolveAccent({ id: shop.id, brand_accent: accent }, ACCENTS.length)];
  const cleanedTagline = validateTagline(tagline);
  const isTaglineTooLong = cleanedTagline === null;

  const mutation = useMutation({
    mutationFn: async () => {
      // Upload first: a failed upload must not leave the row claiming a logo
      // that was never stored.
      const logoUrl = logoUri ? await uploadBrandLogo(shop.id, logoUri) : null;
      const coverUrl = coverUri ? await uploadShopCover(shop.id, coverUri) : null;
      return setShopBranding(shop.id, {
        accent,
        tagline: cleanedTagline ?? '',
        logoUrl,
        coverUrl,
      });
    },
    // The old key here, ['active-shop'], was one no query had ever registered:
    // the merchant saw the file just picked and assumed it had published, while
    // every customer surface kept the old row.
    onSuccess: async (updated) => {
      await invalidateShopSurfaces(queryClient, shop.id, updated);
      setLogoUri(null);
      setCoverUri(null);
      setSaved('Saved. This is what your customers see now.');
    },
    onError: (err: Error) =>
      setError(friendlyMerchantError('save-branding', err.message)),
  });

  const pickLogo = async () => {
    setError('');
    setSaved('');
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Square, because every surface that shows a logo shows it in a circle.
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (!picked.canceled) setLogoUri(picked.assets[0].uri);
  };

  const pickCover = async () => {
    setError('');
    setSaved('');
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // Wide, because it fills the hero behind the shop's name.
      allowsEditing: true,
      aspect: COVER_ASPECT,
      quality: COVER_QUALITY,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (coverTooLarge(asset.fileSize)) {
      setError('That photo is too large. Pick one under 6 MB.');
      return;
    }
    setCoverUri(asset.uri);
  };

  const shownLogo = logoUri ?? shopLogoUri(shop);
  const backdrop = heroBackdrop(shop, coverUri);
  const isPhoto = backdrop.kind === 'photo';

  return (
    <Card>
      <Text style={styles.heading}>Your shopfront</Text>
      <Subtle>How your shop looks to customers browsing the app.</Subtle>

      {/* The same composition the customer gets: the photo of the shop with
          the mark and the name pinned to its foot, or the tone alone until
          there is a photo. */}
      <View style={[styles.preview, { backgroundColor: shownAccent.surface }]}>
        {isPhoto ? (
          <>
            <Image
              source={{ uri: backdrop.uri }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              accessibilityLabel={`Photo of ${shop.name}`}
            />
            <View style={styles.previewScrim} />
          </>
        ) : null}
        <View style={styles.previewFoot}>
          <View style={[styles.mark, { borderColor: isPhoto ? colors.card : shownAccent.ink }]}>
            <ShopLogo name={shop.name} logoUrl={shownLogo} size={MARK} accent={shownAccent} />
          </View>
          <View style={[styles.namePill, !isPhoto && styles.namePillOnTone]}>
            <Text
              style={[styles.previewName, { color: isPhoto ? colors.card : shownAccent.ink }]}
              numberOfLines={1}
            >
              {shop.name}
            </Text>
          </View>
          {cleanedTagline ? (
            <Text
              style={[styles.previewTagline, isPhoto && { color: colors.card }]}
              numberOfLines={1}
            >
              {cleanedTagline}
            </Text>
          ) : (
            <Text
              style={[styles.previewPlaceholder, isPhoto && { color: colors.card }]}
              numberOfLines={1}
            >
              No tagline yet
            </Text>
          )}
        </View>
      </View>

      <View style={styles.pickRow}>
        <View style={styles.pickButton}>
          <Button title="Change shop photo" variant="outline" onPress={pickCover} />
        </View>
        <View style={styles.pickButton}>
          <Button title="Change logo" variant="outline" onPress={pickLogo} />
        </View>
      </View>
      {!isPhoto ? (
        <Subtle>Add a photo of your shop so customers recognise it from the street.</Subtle>
      ) : null}
      {coverUri ? <Subtle>New photo ready — save to publish it.</Subtle> : null}
      {logoUri ? <Subtle>New logo ready — save to publish it.</Subtle> : null}

      <Text style={styles.groupLabel}>Colour</Text>
      <View style={styles.swatchRow}>
        {ACCENTS.map((tone, index) => {
          const isSelected = accent === index;
          return (
            <Pressable
              key={tone.ink}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Colour ${index + 1} of ${ACCENTS.length}`}
              onPress={() => {
                setSaved('');
                setAccent(index);
              }}
              style={[
                styles.swatch,
                { backgroundColor: tone.surface, borderColor: tone.ink },
                isSelected && styles.swatchSelected,
              ]}
            >
              {isSelected && <Ionicons name="checkmark" size={18} color={tone.ink} />}
            </Pressable>
          );
        })}
      </View>
      {/* Clearing the choice is a real option, not an absence of one: it hands
          the shop back the stable colour it had before anyone picked. */}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setSaved('');
          setAccent(null);
        }}
        disabled={accent === null}
      >
        <Text style={[styles.autoLink, accent === null && styles.autoLinkOff]}>
          {accent === null ? 'Using your default colour' : 'Use my default colour'}
        </Text>
      </Pressable>

      <Text style={styles.groupLabel}>Tagline</Text>
      <Field
        label={`One line under your name (${MAX_TAGLINE} characters)`}
        value={tagline}
        onChangeText={(next) => {
          setSaved('');
          setTagline(next);
        }}
        placeholder="Same-day wash, fold & press"
      />
      {isTaglineTooLong && (
        <ErrorText>
          That is {tagline.trim().length} characters — {MAX_TAGLINE} is the most that fits.
        </ErrorText>
      )}

      <ErrorText>{error}</ErrorText>
      {saved ? (
        <Text style={styles.saved} accessibilityLiveRegion="polite">
          {saved}
        </Text>
      ) : null}
      <Button
        title={mutation.isPending ? 'Saving…' : 'Save branding'}
        disabled={isTaglineTooLong || mutation.isPending}
        onPress={() => {
          setError('');
          mutation.mutate();
        }}
      />
    </Card>
  );
}

const MARK = 56;

const styles = StyleSheet.create({
  heading: { ...type.section, color: colors.text },

  preview: {
    // 16:9 like the hero, so the crop the merchant sees is the crop customers get.
    aspectRatio: 16 / 9,
    justifyContent: 'flex-end',
    borderRadius: 14,
    marginTop: space.tight,
    overflow: 'hidden',
  },
  /** Legibility over a photo: darkens the foot where the name sits. */
  previewScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(4,32,63,0.45)',
  },
  previewFoot: {
    alignItems: 'flex-start',
    gap: space.tight,
    paddingVertical: space.cosy,
    paddingHorizontal: space.cosy,
  },
  mark: {
    width: MARK + 4,
    height: MARK + 4,
    borderRadius: (MARK + 4) / 2,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  namePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.cosy,
    paddingVertical: space.tight,
    borderRadius: 999,
    backgroundColor: 'rgba(4,32,63,0.72)',
  },
  namePillOnTone: { backgroundColor: 'rgba(255,255,255,0.55)' },
  previewName: { ...type.section, fontWeight: '700' },
  pickRow: { flexDirection: 'row', gap: space.snug, marginTop: space.tight },
  pickButton: { flex: 1 },
  previewTagline: { ...type.caption, color: colors.text },
  previewPlaceholder: { ...type.caption, color: colors.subtle, fontStyle: 'italic' },

  groupLabel: {
    ...type.caption,
    fontWeight: '600',
    color: colors.subtle,
    marginTop: space.cosy,
  },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  /** 44pt square clears the touch minimum without a hitSlop. */
  swatch: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchSelected: { borderWidth: 3 },

  autoLink: { ...type.label, color: colors.actionInk, marginTop: space.tight },
  autoLinkOff: { color: colors.subtle },
  saved: { ...type.body, color: colors.actionInk },
});
