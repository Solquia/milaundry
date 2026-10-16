/**
 * How the shop's page looks and books, from the owner's side.
 *
 * Three looks over one price list: the classic shopfront; the market — a
 * product grid with a basket, the way customers already shop on delivery
 * apps; and the spotlight — the same basket under product cards with
 * deal cards of the shop's best prices, the way a food app opens. Each option carries a small drawing of the page it makes, because an
 * owner choosing a look should see the look, not read about it. A tap switches
 * it at once, for the app and the web page together.
 */
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { glassChip, glassPane } from '@/components/glass';
import { GlyphTile } from '@/components/stage-glyph';
import { ACCENTS, ErrorText, colors, space, type } from '@/components/ui-kit';
import { setShopStorefrontStyle } from '@/lib/api';
import { friendlyMerchantError } from '@/lib/domain/merchant-error';
import { resolveAccent } from '@/lib/domain/shop-branding';
import {
  STOREFRONT_STYLE_OPTIONS,
  readStorefrontStyle,
  type StorefrontStyle,
} from '@/lib/domain/storefront-style';
import { invalidateShopSurfaces } from '@/lib/query-keys';
import { SpotlightPhotosPanel } from './spotlight-photos-panel';
import type { Shop } from '@/lib/types';

type Accent = (typeof ACCENTS)[number];

export function StorefrontStyleCard({ shop }: { shop: Shop }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState('');
  const current = readStorefrontStyle(shop.storefront_style);
  const accent = ACCENTS[resolveAccent(shop, ACCENTS.length)];

  const save = useMutation({
    mutationFn: (next: StorefrontStyle) => setShopStorefrontStyle(shop.id, next),
    onSuccess: async (updated) => {
      setError('');
      await Promise.all([
        invalidateShopSurfaces(queryClient, shop.id, updated),
        queryClient.invalidateQueries({ queryKey: ['storefront-style', shop.id] }),
      ]);
    },
    onError: (err: Error) => setError(friendlyMerchantError('save-branding', err.message)),
  });
  // The tile answers the tap before the network does; a failure puts it back.
  const shown = save.isPending && save.variables ? save.variables : current;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <GlyphTile icon="storefront" color={accent.ink} size={40} isLifted={false} />
        <View style={styles.words}>
          <Text style={styles.title}>Storefront look</Text>
          <Text style={styles.caption}>
            How customers browse and book, in the app and on your web page.
          </Text>
        </View>
      </View>

      <View style={styles.options} accessibilityRole="radiogroup">
        {STOREFRONT_STYLE_OPTIONS.map((option) => {
          const isOn = option.key === shown;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ checked: isOn, disabled: save.isPending }}
              accessibilityLabel={`${option.title}. ${option.detail}`}
              disabled={save.isPending}
              onPress={() => {
                if (!isOn) save.mutate(option.key);
              }}
              style={({ pressed }) => [
                styles.option,
                isOn && { borderColor: accent.ink, backgroundColor: accent.surface },
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.preview}>
                <Sketch style={option.key} accent={accent} />
              </View>
              <View style={styles.optionWords}>
                <View style={styles.optionHead}>
                  <Text style={styles.optionTitle}>{option.title}</Text>
                  <Ionicons
                    name={isOn ? 'checkmark-circle' : 'ellipse-outline'}
                    size={20}
                    color={isOn ? accent.ink : colors.borderStrong}
                  />
                </View>
                <Text style={styles.optionDetail}>{option.detail}</Text>
                {option.points.map((point) => (
                  <Text key={point} style={styles.point}>
                    · {point}
                  </Text>
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
      {save.isPending ? <Text style={styles.saving}>Switching…</Text> : null}
      {/* The spotlight's own choice: our photo set, or the shop's own photos. */}
      {shown === 'spotlight' ? <SpotlightPhotosPanel shopId={shop.id} accent={accent} /> : null}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function Sketch({ style, accent }: { style: StorefrontStyle; accent: Accent }) {
  if (style === 'market') return <MarketSketch accent={accent} />;
  if (style === 'spotlight') return <SpotlightSketch accent={accent} />;
  return <ClassicSketch accent={accent} />;
}

/** The classic page in miniature: a cover band, a round logo, a column of rows. */
function ClassicSketch({ accent }: { accent: Accent }) {
  return (
    <View style={sketch.frame}>
      <View style={[sketch.cover, { backgroundColor: accent.ink }]} />
      <View style={[sketch.logo, { borderColor: accent.surface }]} />
      {[0, 1, 2].map((row) => (
        <View key={row} style={sketch.row}>
          <View style={sketch.rowText} />
          <View style={[sketch.rowPrice, { backgroundColor: accent.surface }]} />
        </View>
      ))}
    </View>
  );
}

/** The market in miniature: a search bar, chips, a two-up grid and a basket bar. */
function MarketSketch({ accent }: { accent: Accent }) {
  return (
    <View style={sketch.frame}>
      <View style={sketch.search} />
      <View style={sketch.chips}>
        <View style={[sketch.chip, { backgroundColor: accent.ink }]} />
        <View style={sketch.chip} />
        <View style={sketch.chip} />
      </View>
      <View style={sketch.grid}>
        {[0, 1, 2, 3].map((cell) => (
          <View key={cell} style={sketch.cell}>
            <View style={[sketch.plus, { backgroundColor: accent.ink }]} />
          </View>
        ))}
      </View>
      <View style={[sketch.basket, { backgroundColor: accent.ink }]} />
    </View>
  );
}

/** The spotlight in miniature: a deal card, round category photos, product cards. */
function SpotlightSketch({ accent }: { accent: Accent }) {
  return (
    <View style={sketch.frame}>
      <Image source={SKETCH_PHOTO} style={sketch.photoBanner} contentFit="cover" />
      <View style={sketch.dots}>
        {[0, 1, 2].map((dot) => (
          <View key={dot} style={[sketch.dotTile, dot === 0 && { borderColor: accent.ink }]} />
        ))}
      </View>
      {[0, 1].map((row) => (
        <View key={row} style={sketch.row}>
          <View style={sketch.photoRow} />
          <View style={sketch.rowText} />
          <View style={[sketch.plus, { backgroundColor: accent.ink }]} />
        </View>
      ))}
    </View>
  );
}

const SKETCH_PHOTO = require('../../assets/images/services/stack.webp');

const styles = StyleSheet.create({
  card: {
    ...glassPane,
    borderRadius: 14,
    padding: space.cosy,
    gap: space.cosy,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  words: { flex: 1, gap: 2 },
  title: { ...type.body, fontWeight: '600', color: colors.text },
  caption: { ...type.caption, color: colors.subtle },
  options: { gap: space.snug },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    ...glassChip,
    borderRadius: 12,
    borderWidth: 1.5,
    padding: space.snug,
  },
  pressed: { opacity: 0.85 },
  preview: { width: 92 },
  optionWords: { flex: 1, gap: space.tight },
  optionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionTitle: { ...type.label, color: colors.text },
  optionDetail: { ...type.caption, color: colors.subtle },
  point: { ...type.caption, color: colors.text },
  saving: { ...type.caption, color: colors.subtle },
});

const sketch = StyleSheet.create({
  frame: {
    width: '100%',
    height: 112,
    borderRadius: 8,
    backgroundColor: colors.sunken,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 6,
    gap: 4,
  },
  cover: { height: 28, borderRadius: 4, marginHorizontal: -6, marginTop: -6 },
  logo: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.card,
    borderWidth: 2,
    marginTop: -13,
    marginLeft: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowText: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  rowPrice: { width: 18, height: 8, borderRadius: 4 },
  search: { height: 10, borderRadius: 5, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', gap: 3 },
  chip: { width: 18, height: 6, borderRadius: 3, backgroundColor: colors.borderStrong },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  cell: {
    width: '48%',
    height: 22,
    borderRadius: 4,
    backgroundColor: colors.card,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    padding: 2,
  },
  plus: { width: 7, height: 7, borderRadius: 4 },
  basket: { height: 10, borderRadius: 5, marginTop: 'auto' },
  photoBanner: { height: 34, borderRadius: 4, marginHorizontal: -6, marginTop: -6 },
  dots: { flexDirection: 'row', gap: 4 },
  dotTile: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.borderStrong, borderWidth: 1.5, borderColor: 'transparent' },
  photoRow: { width: 16, height: 16, borderRadius: 3, backgroundColor: '#B8C7D9' },
});
