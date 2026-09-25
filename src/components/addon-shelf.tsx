/**
 * The shop's add-ons, shelved like a store: a photo, a name, a price, a "+".
 *
 * Each kind is a section of a product grid — the whole shelf on the page at
 * once, three to a phone row — rather than a rail that swiped sideways and
 * kept most of the soaps off screen. Tapping a card puts it on the load; the
 * round button in the photo's corner turns to a tick so the state never has
 * to be inferred from a border alone.
 *
 * The photo is the shop's own, of the product on its own shelf. Until the
 * owner takes one, the card shows a drawn pack in the name's colour.
 */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View, type DimensionValue } from 'react-native';

import {
  ADDON_KIND_TITLES,
  addonKindNote,
  addonPriceLabel,
  allowsMultiple,
  groupAddons,
  type AddonGroupRules,
  type AddonKind,
  type AddonPicks,
  type ShopAddon,
} from '@/lib/domain/shop-addons';

import { ProductCard, ProductGrid, QuantityStepper } from './product-grid';
import { SoapArt, soapColor, type SoapShape } from './soap-art';
import { colors, space, type } from './ui-kit';

/** The drawn pack when the picture has no fixed height to size it from. */
const FILL_ART_SIZE = 56;

const SHAPE_FOR: Record<AddonKind, SoapShape> = {
  detergent: 'powder',
  fabcon: 'bottle',
  extra: 'bar',
};

/**
 * The product's picture: the shop's photo, or the drawn pack. Fixed sizes for
 * the owner's thumbnails; `'100%'` to fill a card's square photo well.
 */
export function AddonPicture({
  addon,
  width = '100%',
  height = '100%',
}: {
  addon: Pick<ShopAddon, 'kind' | 'name' | 'image_url'>;
  width?: DimensionValue;
  height?: DimensionValue;
}) {
  const color = soapColor(addon.name);
  if (addon.image_url) {
    return (
      <Image
        source={{ uri: addon.image_url }}
        style={{ width, height }}
        contentFit="cover"
        transition={160}
        accessibilityIgnoresInvertColors
      />
    );
  }
  const artSize = typeof height === 'number' ? Math.round(height * 0.62) : FILL_ART_SIZE;
  return (
    <View style={[styles.drawn, { width, height, backgroundColor: `${color}1A` }]}>
      <SoapArt shape={SHAPE_FOR[addon.kind]} color={color} size={artSize} />
    </View>
  );
}

export function AddonShelf({
  addons,
  picks,
  rules,
  onToggle,
  onQuantity,
}: {
  addons: readonly ShopAddon[];
  /** How many of each id are on the load. */
  picks: AddonPicks;
  /** The shop's pick-one or pick-several setting per kind. */
  rules: AddonGroupRules;
  onToggle: (addon: ShopAddon) => void;
  onQuantity: (addon: ShopAddon, quantity: number) => void;
}) {
  return (
    <View style={styles.shelf}>
      {groupAddons(addons).map((group) => {
        const isMultiple = allowsMultiple(group.kind, rules);
        return (
          <View key={group.kind} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{ADDON_KIND_TITLES[group.kind]}</Text>
              <Text style={styles.groupCount}>
                {group.addons.length} {group.addons.length === 1 ? 'item' : 'items'}
              </Text>
            </View>
            <Text style={styles.groupNote}>{addonKindNote(group.kind, isMultiple)}</Text>
            <ProductGrid
              items={group.addons}
              keyOf={(addon) => addon.id}
              accessibilityRole={isMultiple ? 'list' : 'radiogroup'}
              accessibilityLabel={ADDON_KIND_TITLES[group.kind]}
              renderItem={(addon) => {
                const quantity = picks[addon.id] ?? 0;
                return (
                  <ProductCard
                    picture={<AddonPicture addon={addon} />}
                    name={addon.name}
                    note={addon.max_quantity > 1 ? addon.note || `Up to ${addon.max_quantity}` : addon.note}
                    price={addon.price > 0 ? `${addonPriceLabel(addon.price)}${addon.max_quantity > 1 ? ' each' : ''}` : 'Free'}
                    role={isMultiple ? 'checkbox' : 'radio'}
                    isOn={quantity > 0}
                    onPress={() => onToggle(addon)}
                  >
                    {quantity > 0 && addon.max_quantity > 1 ? (
                      <QuantityStepper
                        name={addon.name}
                        value={quantity}
                        max={addon.max_quantity}
                        onChange={(next) => onQuantity(addon, next)}
                      />
                    ) : null}
                  </ProductCard>
                );
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shelf: { gap: space.section },
  group: { gap: space.snug },
  groupHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  groupTitle: { ...type.label, fontSize: 15, color: colors.text },
  groupCount: { ...type.caption, color: colors.subtle },
  groupNote: { ...type.caption, color: colors.subtle, marginTop: -space.tight },
  drawn: { alignItems: 'center', justifyContent: 'center' },
});
