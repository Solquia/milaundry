/**
 * The top of a shop's web page: the shop, in its own colour.
 *
 * The app's shopfront hero is built around a connect gesture and entrance
 * animation that only make sense inside the app. This is the still version:
 * the storefront photo when the shop has one, its brand colour when it has
 * not, the logo, the name, and the two facts a customer weighs before reading
 * a price list — what other people thought and what the cheapest way in costs.
 */
import { Image } from 'expo-image';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, Rect, Stop, LinearGradient as SvgLinearGradient } from 'react-native-svg';

import { ShopLogo } from '@/components/shop-logo';
import { space, type } from '@/components/ui-kit';
import { formatMoneyCompact } from '@/lib/domain/money';
import { heroBackdrop, shopLogoUri } from '@/lib/domain/shop-cover';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import type { StorefrontShop } from '@/lib/types';

/** The app's deep navy: the photo darkens into brand, not into black. */
const SCRIM = '#04203F';
const HERO_HEIGHT = 300;
const LOGO_SIZE = 72;

interface StorefrontHeroProps {
  shop: StorefrontShop;
  theme: StorefrontTheme;
  reputationLabel: string | null;
  cheapest: number | null;
  serviceCount: number;
}

export function StorefrontHero({
  shop,
  theme,
  reputationLabel,
  cheapest,
  serviceCount,
}: StorefrontHeroProps) {
  const backdrop = heroBackdrop(shop);
  const chips = [
    reputationLabel,
    cheapest !== null ? `from ${formatMoneyCompact(cheapest)}` : null,
    serviceCount > 0 ? `${serviceCount} ${serviceCount === 1 ? 'service' : 'services'}` : null,
  ].filter((chip): chip is string => chip !== null);

  return (
    <View style={[styles.hero, { backgroundColor: theme.brand }]}>
      {backdrop.kind === 'photo' ? (
        <>
          <Image
            source={{ uri: backdrop.uri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessibilityLabel={`${shop.name} storefront`}
          />
          <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
            <Defs>
              <SvgLinearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.25" stopColor={SCRIM} stopOpacity="0" />
                <Stop offset="1" stopColor={SCRIM} stopOpacity="0.85" />
              </SvgLinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#scrim)" />
          </Svg>
        </>
      ) : null}

      <View style={styles.foot}>
        <View style={styles.logoRing}>
          <ShopLogo
            name={shop.name}
            logoUrl={shopLogoUri(shop)}
            size={LOGO_SIZE}
            accent={{ surface: theme.brandSoft, ink: theme.brandInk }}
          />
        </View>
        <Text style={styles.name} accessibilityRole="header">
          {shop.name}
        </Text>
        {shop.tagline ? <Text style={styles.tagline}>{shop.tagline}</Text> : null}
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map((chip) => (
              <Text key={chip} style={styles.chip}>
                {chip}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: HERO_HEIGHT, justifyContent: 'flex-end', overflow: 'hidden' },
  foot: { padding: space.section, gap: space.snug },
  logoRing: {
    alignSelf: 'flex-start',
    borderRadius: LOGO_SIZE / 2 + 3,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    marginBottom: space.tight,
  },
  name: { ...type.hero, color: '#FFFFFF' },
  tagline: { ...type.body, color: 'rgba(255,255,255,0.88)' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.snug, marginTop: space.tight },
  chip: {
    ...type.label,
    color: '#FFFFFF',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: space.cosy,
    paddingVertical: space.tight,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
