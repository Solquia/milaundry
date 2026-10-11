/**
 * The shop's own price guide, for a shop that has one (`priceGuideFor`).
 *
 * It reads top to bottom the way a customer decides: which package, what it
 * comes with, what my load weighs, then what else I can add or bring. The
 * three packages sit side by side as tabs wearing the colours of the shop's
 * own poster — blue, green, orange — so the board on the wall and the page on
 * the phone are recognisably the same list. The open package shows the soaps
 * and fabcons to choose from as photos, then its weight table, where a
 * two-load row is tinted so the jump in price explains itself.
 *
 * Add-ons are read live from the shop's shelf, so a price the owner changes in
 * the app is the price shown here; everything else is the printed board.
 */
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Image, type ImageSource } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { CROWN, RADII, colors, fontFor, space, type } from './ui-kit';
import { getShopAddonShelf } from '@/lib/api';
import { formatMoneyCompact } from '@/lib/domain/money';
import {
  priceGuideFor,
  weightLabel,
  type GuideOption,
  type GuidePackage,
  type GuideProduct,
  type GuideTone,
  type PriceGuide,
  type RestoreItem,
} from '@/lib/domain/price-guide';
import { ADDON_KIND_SHORT, groupAddons, type ShopAddon } from '@/lib/domain/shop-addons';

const PHOTOS: Record<string, ImageSource> = {
  'membership-value': require('../../assets/images/price-guides/bubblygav/membership-value.jpg'),
  champion: require('../../assets/images/price-guides/bubblygav/champion.jpg'),
  surf: require('../../assets/images/price-guides/bubblygav/surf.jpg'),
  'calla-pink': require('../../assets/images/price-guides/bubblygav/calla-pink.jpg'),
  'calla-blue': require('../../assets/images/price-guides/bubblygav/calla-blue.jpg'),
  ariel: require('../../assets/images/price-guides/bubblygav/ariel.jpg'),
  'del-gentle': require('../../assets/images/price-guides/bubblygav/del-gentle.jpg'),
  'del-lavender': require('../../assets/images/price-guides/bubblygav/del-lavender.jpg'),
  'champion-antibac': require('../../assets/images/price-guides/bubblygav/champion-antibac.jpg'),
  'personal-collection': require('../../assets/images/price-guides/bubblygav/personal-collection.jpg'),
  tide: require('../../assets/images/price-guides/bubblygav/tide.jpg'),
  'arm-hammer': require('../../assets/images/price-guides/bubblygav/arm-hammer.jpg'),
  persil: require('../../assets/images/price-guides/bubblygav/persil.jpg'),
  gain: require('../../assets/images/price-guides/bubblygav/gain.jpg'),
  'pc-eternity': require('../../assets/images/price-guides/bubblygav/pc-eternity.jpg'),
  'pc-all-time-fresh': require('../../assets/images/price-guides/bubblygav/pc-all-time-fresh.jpg'),
  'pc-pink': require('../../assets/images/price-guides/bubblygav/pc-pink.jpg'),
  downy: require('../../assets/images/price-guides/bubblygav/downy.jpg'),
  sneakers: require('../../assets/images/price-guides/bubblygav/sneakers.jpg'),
};

/** The poster's colours. Every `band` carries white text at 4.5:1 or better. */
const TONES: Record<GuideTone, { band: string; surface: string; ink: string }> = {
  blue: { band: '#1370CE', surface: '#E8F1FC', ink: '#1263AF' },
  green: { band: '#15803D', surface: '#DEF3E7', ink: '#0B6238' },
  orange: { band: '#C2410C', surface: '#FDEBDD', ink: '#9A3412' },
};

const SUN = { surface: '#FFF4CC', ink: '#8A5606', tag: '#1D4E89' };
const TILE_WIDTH = 84;

function money(amount: number): string {
  return formatMoneyCompact(amount);
}

function ProductTile({
  name,
  source,
  price,
}: {
  name: string;
  source: ImageSource | null;
  price?: string;
}) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={price ? `${name}, ${price}` : name}>
      {source ? (
        <Image source={source} style={styles.tilePhoto} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.tilePhoto, styles.tileBlank]}>
          <Ionicons name="water-outline" size={26} color={colors.subtle} />
        </View>
      )}
      <Text style={styles.tileName} numberOfLines={2}>
        {name}
      </Text>
      {price ? <Text style={styles.tilePrice}>{price}</Text> : null}
    </View>
  );
}

function ProductStrip({ title, products }: { title: string; products: GuideProduct[] }) {
  return (
    <View style={styles.strip}>
      <Text style={styles.stripTitle}>{title}</Text>
      <View style={styles.tiles}>
        {products.map((product) => (
          <ProductTile key={product.photo} name={product.name} source={PHOTOS[product.photo] ?? null} />
        ))}
      </View>
    </View>
  );
}

function PackageTabs({
  packages,
  picked,
  onPick,
}: {
  packages: GuidePackage[];
  picked: number;
  onPick: (index: number) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {packages.map((pack, index) => {
        const tone = TONES[pack.tone];
        const isPicked = index === picked;
        const ink = isPicked ? colors.onAccent : tone.ink;
        return (
          <Pressable
            key={pack.label}
            accessibilityRole="tab"
            accessibilityState={{ selected: isPicked }}
            accessibilityLabel={`${pack.label}, ${money(pack.price)} per load`}
            onPress={() => onPick(index)}
            style={({ pressed }) => [
              styles.tab,
              { backgroundColor: isPicked ? tone.band : tone.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabLabel, { color: ink }]}>{pack.label}</Text>
            <Text style={[styles.tabPrice, { color: ink }]}>{money(pack.price)}</Text>
            <Text style={[styles.tabUnit, { color: ink }]}>per load</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function WeightTable({ pack }: { pack: GuidePackage }) {
  const tone = TONES[pack.tone];
  return (
    <View style={styles.strip}>
      <Text style={styles.stripTitle}>Price by weight</Text>
      <View style={[styles.table, { borderColor: tone.surface }]}>
        {pack.weights.map((row, index) => {
          const label = weightLabel(row);
          const loads = row.loads === 2 ? '2 loads' : '1 load';
          return (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}, ${loads}, ${money(row.price)}`}
              style={[
                styles.tableRow,
                index > 0 && styles.tableRuled,
                row.loads === 2 && { backgroundColor: tone.surface },
              ]}
            >
              <Text style={styles.tableWeight}>{label}</Text>
              {/* Only the split is worth a mark: every other row is one load. */}
              {row.loads === 2 ? (
                <View style={[styles.loads, { borderColor: tone.ink }]}>
                  <Text style={[styles.loadsText, { color: tone.ink }]}>{loads}</Text>
                </View>
              ) : null}
              <Text style={styles.tablePrice}>{money(row.price)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function PackagePanel({ pack }: { pack: GuidePackage }) {
  const tone = TONES[pack.tone];
  return (
    <View style={[styles.panel, { borderColor: tone.band }]}>
      <View style={[styles.panelBand, { backgroundColor: tone.band }]}>
        <View style={styles.grow}>
          <Text style={styles.panelEyebrow}>{pack.label.toUpperCase()}</Text>
          <Text style={styles.panelTitle}>Wash · Dry · Fold</Text>
        </View>
        <View style={styles.panelPriceWrap}>
          <Text style={styles.panelPrice}>{money(pack.price)}</Text>
          <Text style={styles.panelUnit}>per load · up to 8 kg</Text>
        </View>
      </View>
      <View style={styles.panelBody}>
        <ProductStrip title={pack.detergentTitle} products={pack.detergents} />
        <ProductStrip title="Choose your fabric conditioner" products={pack.fabcons} />
        <WeightTable pack={pack} />
      </View>
    </View>
  );
}

function LoadRules({ rules }: { rules: PriceGuide['loadRules'] }) {
  return (
    <View style={styles.rules}>
      {rules.map((rule) => (
        <View key={rule.text} style={styles.ruleRow}>
          <Ionicons
            name={`${rule.icon}-outline` as keyof typeof Ionicons.glyphMap}
            size={18}
            color={colors.actionInk}
          />
          <Text style={styles.ruleText}>{rule.text}</Text>
        </View>
      ))}
    </View>
  );
}

function CardHead({
  icon,
  tint,
  title,
  caption,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  tint: { surface: string; ink: string };
  title: string;
  caption: string;
}) {
  return (
    <View style={styles.cardHead}>
      <View style={[styles.badge, { backgroundColor: tint.surface }]}>
        <Ionicons name={icon} size={20} color={tint.ink} />
      </View>
      <View style={styles.grow}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
        <Text style={styles.cardCaption}>{caption}</Text>
      </View>
    </View>
  );
}

function AddonsCard({ addons }: { addons: readonly ShopAddon[] }) {
  const groups = groupAddons(addons);
  if (groups.length === 0) return null;
  return (
    <View style={styles.card}>
      <CardHead
        icon="add-circle-outline"
        tint={TONES.blue}
        title="Add-ons"
        caption="Extras on top of any package, charged once per booking."
      />
      {groups.map((group) => (
        <View key={group.kind} style={styles.strip}>
          <Text style={styles.stripTitle}>{ADDON_KIND_SHORT[group.kind]}</Text>
          <View style={styles.tiles}>
            {group.addons.map((addon) => (
              <ProductTile
                key={addon.id}
                name={addon.name}
                source={addon.image_url ? { uri: addon.image_url } : null}
                price={addon.price > 0 ? `+${money(addon.price)}` : 'Free'}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function DryingRow({ option, isFirst }: { option: GuideOption; isFirst: boolean }) {
  return (
    <View
      style={[styles.dryRow, !isFirst && styles.tableRuled]}
      accessible
      accessibilityLabel={`${option.name}, ${money(option.price)}. ${option.points.join('. ')}`}
    >
      <View style={[styles.grow, styles.dryWords]}>
        <View style={styles.dryName}>
          <Text style={styles.dryNameText}>{option.name.toUpperCase()}</Text>
        </View>
        {option.points.map((point) => (
          <Text key={point} style={styles.point}>
            {`•  ${point}`}
          </Text>
        ))}
      </View>
      <View style={styles.priceTag}>
        <Text style={styles.priceTagText}>{money(option.price)}</Text>
      </View>
    </View>
  );
}

function DryingCard({ drying }: { drying: PriceGuide['drying'] }) {
  return (
    <View style={styles.card}>
      <CardHead
        icon="sunny"
        tint={SUN}
        title="Drying packages"
        caption="Already washed? Bring it in just to dry."
      />
      <View style={styles.limits}>
        {drying.limits.map((limit) => (
          <View key={limit} style={styles.limit}>
            <Text style={styles.limitText}>{limit}</Text>
          </View>
        ))}
      </View>
      {drying.options.map((option, index) => (
        <DryingRow key={option.name} option={option} isFirst={index === 0} />
      ))}
    </View>
  );
}

function RestoreRow({ item }: { item: RestoreItem }) {
  return (
    <View style={styles.restoreRow}>
      <View style={styles.restoreHead}>
        <Ionicons name={item.icon} size={18} color={colors.actionInk} />
        <Text style={styles.restoreName}>{item.name}</Text>
      </View>
      <Text style={styles.cardCaption}>{item.blurb}</Text>
      <View style={styles.tiers}>
        {item.tiers.map((tier) => (
          <View
            key={tier.name}
            style={styles.tier}
            accessible
            accessibilityLabel={`${item.name}, ${tier.name}, ${money(tier.price)}`}
          >
            <Text style={styles.tierName}>{tier.name}</Text>
            <Text style={styles.tierPrice}>{money(tier.price)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function RestoreCard({ restore }: { restore: PriceGuide['restore'] }) {
  return (
    <View style={[styles.card, styles.cardFlush]}>
      <View>
        <Image
          source={PHOTOS[restore.photo]}
          style={styles.banner}
          contentFit="cover"
          accessibilityLabel="Muddy sneakers beside the same pair cleaned white"
        />
        <View style={styles.bannerTag}>
          <Text style={styles.bannerTitle}>Restore your style</Text>
          <Text style={styles.bannerSub}>Sneaker and cap care · Drop off today!</Text>
        </View>
      </View>
      <View style={styles.restoreBody}>
        {restore.items.map((item) => (
          <RestoreRow key={item.name} item={item} />
        ))}
      </View>
    </View>
  );
}

/** Draws the shop's price guide, or nothing for a shop without one. */
export function ShopPriceGuide({ shopId }: { shopId: string | null | undefined }) {
  const guide = priceGuideFor(shopId);
  const [picked, setPicked] = useState(0);
  // Shares the booking page's key, so a customer who goes on to book reads the cache.
  const shelf = useQuery({
    queryKey: ['shop-addon-shelf', shopId],
    queryFn: () => getShopAddonShelf(shopId as string),
    enabled: Boolean(guide && shopId),
    retry: false,
  });

  if (!guide) return null;
  const pack = guide.packages[picked] ?? guide.packages[0];

  return (
    <View style={styles.guide}>
      <View style={styles.heading}>
        <Text style={styles.eyebrow}>PRICE LIST</Text>
        <Text style={styles.title} accessibilityRole="header">
          {guide.title}
        </Text>
        <Text style={styles.tagline}>{guide.tagline}</Text>
      </View>
      <PackageTabs packages={guide.packages} picked={picked} onPick={setPicked} />
      <PackagePanel pack={pack} />
      <LoadRules rules={guide.loadRules} />
      <AddonsCard addons={shelf.data?.addons ?? []} />
      <DryingCard drying={guide.drying} />
      <RestoreCard restore={guide.restore} />
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { gap: space.cosy, marginTop: space.section },
  grow: { flex: 1, minWidth: 0 },
  heading: { gap: 2 },
  eyebrow: { ...type.caption, fontFamily: fontFor(700), color: colors.actionInk, letterSpacing: 1.2 },
  title: { ...type.title, color: colors.text },
  tagline: { ...type.caption, color: colors.subtle },
  pressed: { opacity: 0.75 },

  tabs: { flexDirection: 'row', gap: space.snug },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.cosy,
    paddingHorizontal: space.tight,
    borderRadius: RADII.control,
    minHeight: 76,
  },
  tabLabel: { ...type.caption, fontFamily: fontFor(700) },
  tabPrice: { ...type.value, fontVariant: ['tabular-nums'] },
  tabUnit: { ...type.caption, fontSize: 11, lineHeight: 14 },

  panel: { ...CROWN, borderWidth: 2, backgroundColor: colors.card, overflow: 'hidden' },
  panelBand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingHorizontal: space.room,
    paddingVertical: space.cosy,
  },
  panelEyebrow: { ...type.caption, fontFamily: fontFor(700), color: colors.onAccent, letterSpacing: 1 },
  panelTitle: { ...type.section, color: colors.onAccent },
  panelPriceWrap: { alignItems: 'flex-end' },
  panelPrice: { ...type.title, color: colors.onAccent, fontVariant: ['tabular-nums'] },
  panelUnit: { ...type.caption, fontSize: 11, lineHeight: 14, color: colors.onAccent },
  panelBody: { padding: space.room, gap: space.section },

  strip: { gap: space.snug },
  stripTitle: { ...type.label, color: colors.text },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  tile: { width: TILE_WIDTH, gap: 2 },
  tilePhoto: {
    width: TILE_WIDTH,
    height: TILE_WIDTH * 1.25,
    borderRadius: RADII.chip,
    backgroundColor: colors.sunken,
  },
  tileBlank: { alignItems: 'center', justifyContent: 'center' },
  tileName: { ...type.caption, fontSize: 12, lineHeight: 15, color: colors.text, textAlign: 'center' },
  tilePrice: {
    ...type.caption,
    fontSize: 12,
    fontFamily: fontFor(700),
    color: colors.moneyIn,
    textAlign: 'center',
  },

  table: { borderWidth: 1, borderRadius: RADII.chip, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    paddingHorizontal: space.cosy,
    minHeight: 44,
  },
  tableRuled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  tableWeight: { ...type.body, flex: 1, color: colors.text },
  loads: { borderWidth: 1, borderRadius: RADII.pill, paddingHorizontal: space.snug, paddingVertical: 1 },
  loadsText: { ...type.caption, fontSize: 11, lineHeight: 14, fontFamily: fontFor(600) },
  tablePrice: {
    ...type.body,
    minWidth: 64,
    textAlign: 'right',
    fontFamily: fontFor(700),
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },

  rules: {
    gap: space.snug,
    padding: space.room,
    borderRadius: RADII.card,
    backgroundColor: colors.actionSurface,
  },
  ruleRow: { flexDirection: 'row', gap: space.snug, alignItems: 'flex-start' },
  ruleText: { ...type.caption, flex: 1, color: colors.text },

  card: {
    ...CROWN,
    gap: space.cosy,
    padding: space.room,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  cardFlush: { padding: 0, gap: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  badge: { width: 40, height: 40, borderRadius: RADII.chip, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { ...type.body, fontFamily: fontFor(700), color: colors.text },
  cardCaption: { ...type.caption, color: colors.subtle },

  limits: { flexDirection: 'row', flexWrap: 'wrap', gap: space.tight },
  limit: {
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    backgroundColor: colors.sunken,
  },
  limitText: { ...type.caption, fontSize: 12, color: colors.subtle },
  dryRow: { flexDirection: 'row', gap: space.cosy, paddingTop: space.cosy, alignItems: 'flex-start' },
  dryWords: { gap: 2 },
  dryName: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.snug,
    paddingVertical: 2,
    borderRadius: RADII.hair,
    marginBottom: 2,
    backgroundColor: SUN.surface,
  },
  dryNameText: { ...type.caption, fontFamily: fontFor(700), letterSpacing: 0.6, color: SUN.ink },
  point: { ...type.caption, color: colors.subtle },
  priceTag: {
    paddingHorizontal: space.cosy,
    paddingVertical: space.tight,
    borderRadius: RADII.chip,
    backgroundColor: SUN.tag,
    transform: [{ rotate: '-4deg' }],
  },
  priceTagText: { ...type.label, color: colors.onAccent, fontVariant: ['tabular-nums'] },

  banner: { width: '100%', aspectRatio: 640 / 374 },
  bannerTag: {
    position: 'absolute',
    left: space.cosy,
    bottom: space.cosy,
    paddingHorizontal: space.cosy,
    paddingVertical: space.snug,
    borderRadius: RADII.chip,
    backgroundColor: 'rgba(13, 45, 92, 0.88)',
  },
  bannerTitle: { ...type.label, color: colors.onAccent },
  bannerSub: { ...type.caption, fontSize: 12, color: colors.onAccent },
  restoreBody: { padding: space.room, gap: space.section },
  restoreRow: { gap: space.snug },
  restoreHead: { flexDirection: 'row', alignItems: 'center', gap: space.snug },
  restoreName: { ...type.body, fontFamily: fontFor(700), color: colors.text },
  tiers: { flexDirection: 'row', gap: space.snug },
  tier: {
    flex: 1,
    padding: space.cosy,
    borderRadius: RADII.control,
    backgroundColor: colors.actionSurface,
    gap: 2,
  },
  tierName: { ...type.caption, color: colors.actionInk },
  tierPrice: { ...type.value, color: colors.text, fontVariant: ['tabular-nums'] },
});
