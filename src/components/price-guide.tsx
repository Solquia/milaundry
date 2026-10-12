/**
 * The shop's own menu, for a shop that has a price guide (`priceGuideFor`).
 *
 * Three packages, then everything else. The packages sit side by side as
 * tabs in the colours of the shop's poster; the open one asks the questions
 * inside it — regular clothes or beddings, which soap and fabcon — shows the
 * weight table that sets its price, and books it. Below come the other
 * services, each with its basic and deep grade as two buttons, then drying,
 * then the add-on shelf.
 *
 * Every price is read from the shop's services (`guideMenu`), so what the
 * owner changes in the service editor is what this shows and what the
 * booking charges. The soap photos and the colours are the only fixed parts.
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
  guideMenu,
  priceGuideFor,
  weightLabel,
  isFromPrice,
  type GuidePackageLook,
  type GuideProduct,
  type GuideService,
  type GuideTone,
  type MenuGroup,
  type MenuPackage,
  type MenuVariant,
  type VariantKind,
  type PriceGuide,
} from '@/lib/domain/price-guide';
import { ADDON_KIND_SHORT, groupAddons, type ShopAddon } from '@/lib/domain/shop-addons';
import type { WeightBand } from '@/lib/domain/weight-prices';

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
/** A load runs this far over its limit for an excess fee before the shop splits it. */
const SPLIT_AT = 1.25;


/** An icon for a cleaning service by what it cleans; a bag where nothing matches. */
function serviceIcon(name: string): keyof typeof Ionicons.glyphMap {
  if (/shoe|sneaker|sapatos/i.test(name)) return 'footsteps';
  if (/cap|hat/i.test(name)) return 'baseball';
  if (/helmet/i.test(name)) return 'bicycle';
  if (/sofa|carpet|couch|rug/i.test(name)) return 'home';
  return 'bag-handle';
}

function money(amount: number): string {
  return formatMoneyCompact(amount);
}

function ProductTile({ name, source, price }: { name: string; source: ImageSource | null; price?: string }) {
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

interface PackageView<S extends GuideService> {
  look: GuidePackageLook;
  menu: MenuPackage<S>;
}

function PackageTabs<S extends GuideService>({
  packages,
  picked,
  onPick,
}: {
  packages: PackageView<S>[];
  picked: number;
  onPick: (index: number) => void;
}) {
  return (
    <View style={styles.tabs} accessibilityRole="tablist">
      {packages.map(({ look, menu }, index) => {
        const tone = TONES[look.tone];
        const isPicked = index === picked;
        const ink = isPicked ? colors.onAccent : tone.ink;
        const price = menu.variants[0]?.service.price ?? 0;
        return (
          <Pressable
            key={look.number}
            accessibilityRole="tab"
            accessibilityState={{ selected: isPicked }}
            accessibilityLabel={`Package ${look.number}, from ${money(price)} per load`}
            onPress={() => onPick(index)}
            style={({ pressed }) => [
              styles.tab,
              { backgroundColor: isPicked ? tone.band : tone.surface },
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.tabLabel, { color: ink }]}>{`Package ${look.number}`}</Text>
            <Text style={[styles.tabPrice, { color: ink }]}>{money(price)}</Text>
            <Text style={[styles.tabUnit, { color: ink }]}>per load</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function LoadChoice<S extends GuideService>({
  variants,
  value,
  onChange,
  tone,
}: {
  variants: MenuVariant<S>[];
  value: VariantKind;
  onChange: (kind: VariantKind) => void;
  tone: (typeof TONES)[GuideTone];
}) {
  const options = variants.map((variant) => ({
    key: variant.kind,
    title: variant.title,
    meta: `${money(variant.service.price)} · up to ${variant.perLoadKg} kg a load`,
  }));
  return (
    <View style={styles.strip}>
      <Text style={styles.stripTitle}>What are we washing?</Text>
      <View style={styles.choices} accessibilityRole="radiogroup">
        {options.map((option) => {
          const isOn = option.key === value;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="radio"
              accessibilityState={{ selected: isOn }}
              onPress={() => onChange(option.key)}
              style={({ pressed }) => [
                styles.choice,
                isOn && { borderColor: tone.band, backgroundColor: tone.surface },
                pressed && styles.pressed,
              ]}
            >
              <Ionicons
                name={isOn ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={isOn ? tone.band : colors.borderStrong}
              />
              <View style={styles.grow}>
                <Text style={[styles.choiceTitle, isOn && { color: tone.ink }]}>{option.title}</Text>
                <Text style={styles.choiceMeta}>{option.meta}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/**
 * How many machines a band fills. The shop runs one load a little over its
 * limit for an excess fee (8 kg loads up to 9.5 kg), and splits only past a
 * quarter over (10 kg for an 8 kg load, 5 kg for a 4 kg one).
 */
function loadsFor(band: WeightBand, perLoadKg: number): number {
  if (band.from < perLoadKg * SPLIT_AT) return 1;
  return Math.max(2, Math.ceil(band.to / perLoadKg));
}

function WeightTable({
  weights,
  perLoadKg,
  tone,
}: {
  weights: WeightBand[];
  perLoadKg: number;
  tone: (typeof TONES)[GuideTone];
}) {
  if (weights.length === 0) return null;
  return (
    <View style={styles.strip}>
      <Text style={styles.stripTitle}>Price by weight</Text>
      <View style={[styles.table, { borderColor: tone.surface }]}>
        {weights.map((band, index) => {
          const label = weightLabel(band);
          const loads = loadsFor(band, perLoadKg);
          const isSplit = loads > 1;
          return (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}${isSplit ? `, ${loads} loads` : ''}, ${money(band.price)}`}
              style={[styles.tableRow, index > 0 && styles.ruled, isSplit && { backgroundColor: tone.surface }]}
            >
              <Text style={styles.tableWeight}>{label}</Text>
              {isSplit ? (
                <View style={[styles.loads, { borderColor: tone.ink }]}>
                  <Text style={[styles.loadsText, { color: tone.ink }]}>{`${loads} loads`}</Text>
                </View>
              ) : null}
              <Text style={styles.tablePrice}>{money(band.price)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function BookButton({
  label,
  fill,
  onPress,
}: {
  label: string;
  fill: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !onPress }}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.book,
        { backgroundColor: onPress ? fill : colors.borderStrong },
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.bookText}>{label}</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.onAccent} />
    </Pressable>
  );
}

function PackagePanel<S extends GuideService>({
  view,
  load,
  onLoad,
  onBook,
}: {
  view: PackageView<S>;
  load: VariantKind;
  onLoad: (load: VariantKind) => void;
  onBook?: (serviceId: string) => void;
}) {
  const { look, menu } = view;
  const tone = TONES[look.tone];
  const variant = menu.variants.find((entry) => entry.kind === load) ?? menu.variants[0];
  const chosen = variant?.service;
  return (
    <View style={[styles.panel, { borderColor: tone.band }]}>
      <View style={[styles.panelBand, { backgroundColor: tone.band }]}>
        <View style={styles.grow}>
          <Text style={styles.panelEyebrow}>{`PACKAGE ${look.number}`}</Text>
          <Text style={styles.panelTitle}>Wash · Dry · Fold</Text>
        </View>
        {chosen ? (
          <View style={styles.panelPriceWrap}>
            <Text style={styles.panelPrice}>{money(chosen.price)}</Text>
            <Text style={styles.panelUnit}>{`per load · up to ${variant.perLoadKg} kg`}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.panelBody}>
        {menu.variants.length > 1 ? (
          <LoadChoice variants={menu.variants} value={variant.kind} onChange={onLoad} tone={tone} />
        ) : null}
        <ProductStrip title={look.detergentTitle} products={look.detergents} />
        <ProductStrip title="Choose your fabric conditioner" products={look.fabcons} />
        {variant ? <WeightTable weights={variant.weights} perLoadKg={variant.perLoadKg} tone={tone} /> : null}
        {chosen ? (
          <BookButton
            label={`Book Package ${look.number} · ${variant.title}`}
            fill={tone.band}
            onPress={onBook ? () => onBook(chosen.id) : undefined}
          />
        ) : null}
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

function SectionHead({ eyebrow, title, caption }: { eyebrow: string; title: string; caption: string }) {
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <Text style={styles.tagline}>{caption}</Text>
    </View>
  );
}

function OtherRow<S extends GuideService>({
  group,
  isFirst,
  onBook,
  icon,
}: {
  group: MenuGroup<S>;
  isFirst: boolean;
  onBook?: (serviceId: string) => void;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  // One line for the item, but only when every option says the same thing;
  // a range that differs by option is shown on its own price instead.
  const notes = new Set(group.options.map((option) => option.service.description?.trim() ?? ''));
  const blurb = notes.size === 1 ? [...notes][0] : '';
  const [only] = group.options;
  // One price and no grade to choose: the row itself books it, the price at its end.
  if (group.options.length === 1 && !only.label) {
    const from = isFromPrice(only.service.description) ? '+' : '';
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Book ${only.service.name}, ${money(only.service.price)}`}
        disabled={!onBook}
        onPress={onBook ? () => onBook(only.service.id) : undefined}
        style={({ pressed }) => [styles.otherRow, styles.otherHead, !isFirst && styles.ruled, pressed && styles.pressed]}
      >
        <View style={styles.otherBadge}>
          <Ionicons name={icon ?? serviceIcon(group.name)} size={20} color={colors.actionInk} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.otherName}>{group.name}</Text>
          {blurb ? (
            <Text style={styles.caption} numberOfLines={2}>
              {blurb}
            </Text>
          ) : null}
        </View>
        <View style={styles.pricePill}>
          <Text style={styles.pricePillText}>{`${money(only.service.price)}${from}`}</Text>
        </View>
      </Pressable>
    );
  }
  return (
    <View style={[styles.otherRow, !isFirst && styles.ruled]}>
      <View style={styles.otherHead}>
        <View style={styles.otherBadge}>
          <Ionicons name={icon ?? serviceIcon(group.name)} size={20} color={colors.actionInk} />
        </View>
        <View style={styles.grow}>
          <Text style={styles.otherName}>{group.name}</Text>
          {blurb ? (
            <Text style={styles.caption} numberOfLines={2}>
              {blurb}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.tiers}>
        {group.options.map((option) => (
          <Pressable
            key={option.service.id}
            accessibilityRole="button"
            accessibilityLabel={`Book ${option.service.name}, ${money(option.service.price)}`}
            disabled={!onBook}
            onPress={onBook ? () => onBook(option.service.id) : undefined}
            style={({ pressed }) => [styles.tier, pressed && styles.pressed]}
          >
            <Text style={styles.tierName}>{option.label || 'Cleaning'}</Text>
            <Text style={styles.tierPrice}>
              {`${money(option.service.price)}${isFromPrice(option.service.description) ? '+' : ''}`}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function OthersCard<S extends GuideService>({
  groups,
  onBook,
}: {
  groups: MenuGroup<S>[];
  onBook?: (serviceId: string) => void;
}) {
  if (groups.length === 0) return null;
  return (
    <View style={[styles.card, styles.cardFlush]}>
      <View>
        <Image
          source={PHOTOS.sneakers}
          style={styles.banner}
          contentFit="cover"
          accessibilityLabel="Muddy sneakers beside the same pair cleaned white"
        />
        <View style={styles.bannerTag}>
          <Text style={styles.bannerTitle}>Restore your style</Text>
          <Text style={styles.bannerSub}>Tap a price to book it · Drop off today!</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        {groups.map((group, index) => (
          <OtherRow key={group.name} group={group} isFirst={index === 0} onBook={onBook} />
        ))}
      </View>
    </View>
  );
}

function DryCleaningCard<S extends GuideService>({
  sections,
  onBook,
}: {
  sections: { heading: string; groups: MenuGroup<S>[] }[];
  onBook?: (serviceId: string) => void;
}) {
  if (sections.length === 0) return null;
  return (
    <View style={styles.card}>
      {sections.map((section, index) => (
        <View key={section.heading} style={[styles.cleanSection, index > 0 && styles.ruled]}>
          <Text style={styles.cleanHeading} accessibilityRole="header">
            {section.heading.toUpperCase()}
          </Text>
          {section.groups.map((group, at) => (
            <OtherRow key={group.name} group={group} isFirst={at === 0} onBook={onBook} icon="shirt-outline" />
          ))}
        </View>
      ))}
    </View>
  );
}

function DryingCard<S extends GuideService>({
  rows,
  onBook,
}: {
  rows: S[];
  onBook?: (serviceId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <View style={styles.card}>
      <View style={styles.limits}>
        {['Max 8 kg regular clothes', 'Max 4 kg beddings & towels', 'Comforters & duvets per piece'].map(
          (limit) => (
            <View key={limit} style={styles.limit}>
              <Text style={styles.limitText}>{limit}</Text>
            </View>
          )
        )}
      </View>
      {rows.map((row, index) => (
        <Pressable
          key={row.id}
          accessibilityRole="button"
          accessibilityLabel={`Book ${row.name}, ${money(row.price)}`}
          disabled={!onBook}
          onPress={onBook ? () => onBook(row.id) : undefined}
          style={({ pressed }) => [styles.dryRow, index > 0 && styles.ruled, pressed && styles.pressed]}
        >
          <View style={[styles.grow, styles.dryWords]}>
            <View style={styles.dryName}>
              <Text style={styles.dryNameText}>{row.name.toUpperCase()}</Text>
            </View>
            {row.description ? <Text style={styles.caption}>{row.description}</Text> : null}
          </View>
          <View style={styles.priceTag}>
            <Text style={styles.priceTagText}>{money(row.price)}</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function AddonsCard({ addons }: { addons: readonly ShopAddon[] }) {
  const groups = groupAddons(addons);
  if (groups.length === 0) return null;
  return (
    <View style={styles.card}>
      <Text style={styles.caption}>Added to any package at booking, charged once.</Text>
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

/** Whether this shop's page is drawn as a price guide instead of the plain service list. */
export function hasPriceGuide(shopId: string | null | undefined): boolean {
  return priceGuideFor(shopId) !== null;
}

/**
 * The shop's menu as a price guide, or nothing for a shop without one.
 * `onBook` is absent while the customer cannot book yet; the prices still show.
 */
export function ShopPriceGuide<S extends GuideService>({
  shopId,
  services,
  onBook,
}: {
  shopId: string | null | undefined;
  services: readonly S[];
  onBook?: (service: S) => void;
}) {
  const guide = priceGuideFor(shopId);
  const [picked, setPicked] = useState(0);
  const [load, setLoad] = useState<VariantKind>('clothes');
  // Shares the booking page's key, so a customer who goes on to book reads the cache.
  const shelf = useQuery({
    queryKey: ['shop-addon-shelf', shopId],
    queryFn: () => getShopAddonShelf(shopId as string),
    enabled: Boolean(guide && shopId),
    retry: false,
  });

  if (!guide) return null;
  const menu = guideMenu(services);
  const packages = guide.packages.flatMap((look) => {
    const entry = menu.packages.find((pack) => pack.number === look.number);
    return entry && entry.variants.length > 0 ? [{ look, menu: entry }] : [];
  });
  const view = packages[picked] ?? packages[0];
  const book = onBook
    ? (serviceId: string) => {
        const service = services.find((row) => row.id === serviceId);
        if (service) onBook(service);
      }
    : undefined;

  return (
    <View style={styles.guide}>
      {view ? (
        <>
          <SectionHead eyebrow="PACKAGES" title={guide.title} caption={guide.tagline} />
          <PackageTabs packages={packages} picked={picked} onPick={setPicked} />
          <PackagePanel view={view} load={load} onLoad={setLoad} onBook={book} />
          <LoadRules rules={guide.loadRules} />
        </>
      ) : null}
      {menu.others.length > 0 ? (
        <>
          <SectionHead
            eyebrow="MORE SERVICES"
            title="Shoes, caps, toys & more"
            caption="Basic or deep clean — tap a price to book it."
          />
          <OthersCard groups={menu.others} onBook={book} />
        </>
      ) : null}
      {menu.dryCleaning.length > 0 ? (
        <>
          <SectionHead
            eyebrow="DRY CLEANING"
            title="Dry cleaning"
            caption="Gowns, wedding dresses, jackets and togas — tap a size to book."
          />
          <DryCleaningCard sections={menu.dryCleaning} onBook={book} />
        </>
      ) : null}
      {menu.drying.length > 0 ? (
        <>
          <SectionHead
            eyebrow="DRYING"
            title="Drying services"
            caption="Already washed? Bring it in just to dry."
          />
          <DryingCard rows={menu.drying} onBook={book} />
        </>
      ) : null}
      {groupAddons(shelf.data?.addons ?? []).length > 0 ? (
        <>
          <SectionHead eyebrow="ADD-ONS" title="Extras" caption="Pick these while you book." />
          <AddonsCard addons={shelf.data?.addons ?? []} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  guide: { gap: space.cosy, marginTop: space.cosy },
  grow: { flex: 1, minWidth: 0 },
  sectionHead: { gap: 2, marginTop: space.cosy },
  eyebrow: { ...type.caption, fontFamily: fontFor(700), color: colors.actionInk, letterSpacing: 1.2 },
  sectionTitle: { ...type.title, color: colors.text },
  tagline: { ...type.caption, color: colors.subtle },
  caption: { ...type.caption, color: colors.subtle },
  pressed: { opacity: 0.75 },
  ruled: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },

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

  choices: { gap: space.snug },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.snug,
    padding: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  choiceTitle: { ...type.label, color: colors.text },
  choiceMeta: { ...type.caption, color: colors.subtle },

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

  book: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.snug,
    minHeight: 50,
    borderRadius: RADII.pill,
  },
  bookText: { ...type.label, fontSize: 16, color: colors.onAccent },

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
  cardBody: { paddingHorizontal: space.room, paddingBottom: space.snug },

  banner: { width: '100%', aspectRatio: 640 / 300 },
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

  otherRow: { gap: space.snug, paddingVertical: space.cosy },
  otherHead: { flexDirection: 'row', alignItems: 'center', gap: space.cosy },
  otherBadge: {
    width: 40,
    height: 40,
    borderRadius: RADII.chip,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.actionSurface,
  },
  otherName: { ...type.body, fontFamily: fontFor(700), color: colors.text },
  // Wraps three to a row, so six sizes or seven trains still read as one list.
  tiers: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug },
  tier: {
    flexBasis: '30%',
    flexGrow: 1,
    padding: space.cosy,
    borderRadius: RADII.control,
    borderWidth: 1,
    borderColor: colors.actionMuted,
    backgroundColor: colors.actionSurface,
    gap: 2,
  },
  tierName: { ...type.caption, color: colors.actionInk },
  tierPrice: { ...type.value, color: colors.text, fontVariant: ['tabular-nums'] },

  pricePill: {
    paddingHorizontal: space.cosy,
    paddingVertical: space.tight,
    borderRadius: RADII.pill,
    backgroundColor: colors.actionSurface,
  },
  pricePillText: { ...type.label, fontSize: 16, color: colors.text, fontVariant: ['tabular-nums'] },
  cleanSection: { paddingTop: space.cosy },
  cleanHeading: { ...type.caption, fontFamily: fontFor(700), color: colors.actionInk, letterSpacing: 1 },

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
  priceTag: {
    paddingHorizontal: space.cosy,
    paddingVertical: space.tight,
    borderRadius: RADII.chip,
    backgroundColor: SUN.tag,
    transform: [{ rotate: '-4deg' }],
  },
  priceTagText: { ...type.label, color: colors.onAccent, fontVariant: ['tabular-nums'] },
});
