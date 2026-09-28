/**
 * The head of the booking screen: the service you tapped, big.
 *
 * It used to be the shelf card, opened — a white well with the drawing in it,
 * a chip repeating the name, and the name again underneath. Correct, and a
 * third of the first screen spent restating what the customer had just
 * pressed, with the one control that mattered pushed under the footer.
 *
 * Now it is a band of the service's own colour with the thing itself — the
 * folded pile, the iron, the garment bag — standing in the corner and running
 * off it, the same object the shelf card showed. It hops each time the
 * weight on the scale below changes, and the weight reads back in the corner,
 * so the first thing the customer touches visibly does something up here.
 */
import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import { formatPriceLine, formatQuantity } from '@/lib/domain/price-label';
import { CATEGORY_LABELS } from '@/lib/domain/service-catalog';
import { serviceLook } from '@/lib/domain/service-look';
import { sceneFor } from '@/lib/domain/service-scene';
import { showcaseTitle, showcaseTone } from '@/lib/domain/service-showcase';
import type { ServiceRow } from '@/lib/types';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { ServiceScene } from './service-scene';
import { RADII, colors, fontFor, space, type } from './ui-kit';

const HERO_MIN_HEIGHT = 156;
/** The object's side, as a share of the band's height: big enough to run off the corner. */
const ART_SHARE = 1.22;
/** How far it runs off the right and the foot, as a share of its own side. */
const ART_BLEED = 0.1;
/** The object never takes more than this share of the band's width from the words. */
const ART_MAX_WIDTH = 0.46;
/** The navy the brand's deep end sinks toward. */
const DEEP = '#0B1B2B';

/** Soap bubbles drifting behind the text, as shares of the band. */
const FOAM = [
  { x: 0.08, y: 0.18, r: 0.05 },
  { x: 0.46, y: 0.12, r: 0.028 },
  { x: 0.55, y: 0.78, r: 0.04 },
  { x: 0.9, y: 0.12, r: 0.03 },
  { x: 0.3, y: 0.9, r: 0.022 },
] as const;

/** `hex` pulled `amount` of the way toward `toward`. Both are #RRGGBB. */
function mix(hex: string, toward: string, amount: number): string {
  const channel = (value: string, at: number) => parseInt(value.slice(at, at + 2), 16);
  const blend = (at: number) =>
    Math.round(channel(hex, at) + (channel(toward, at) - channel(hex, at)) * amount)
      .toString(16)
      .padStart(2, '0');
  return `#${blend(1)}${blend(3)}${blend(5)}`;
}

/** Letters only, lowercased, "&" read as "and": "Wash & Fold" = "Wash And Fold". */
function sameWords(a: string, b: string): boolean {
  const norm = (text: string) => text.toLowerCase().replace(/&/g, 'and').replace(/[^\p{L}]/gu, '');
  return norm(a) === norm(b);
}

export function BookingHero({ service, quantity }: { service: ServiceRow; quantity: number }) {
  const isReduced = useReducedMotion();
  const [land] = useState(() => new Animated.Value(0));
  const [size, setSize] = useState({ width: 360, height: HERO_MIN_HEIGHT });

  useEffect(() => {
    if (isReduced) {
      land.setValue(1);
      return;
    }
    land.setValue(0);
    Animated.spring(land, {
      toValue: 1,
      damping: 13,
      stiffness: 140,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [isReduced, land]);

  // Each change on the scale sets the load hopping once, as the door's tumble did.
  const [hop] = useState(() => new Animated.Value(0));
  const lastQuantity = React.useRef(quantity);
  useEffect(() => {
    if (lastQuantity.current === quantity) return;
    lastQuantity.current = quantity;
    if (isReduced) return;
    hop.setValue(1);
    Animated.spring(hop, { toValue: 0, damping: 6, stiffness: 200, mass: 0.7, useNativeDriver: true }).start();
  }, [quantity, isReduced, hop]);

  const artSize = Math.min(size.height * ART_SHARE, size.width * ART_MAX_WIDTH);
  const tone = showcaseTone(service.category);
  const title = showcaseTitle(service.name);
  const category = CATEGORY_LABELS[service.category];
  const [rate, ...terms] = formatPriceLine(service).split(' · ');
  const readout = quantity > 0 ? formatQuantity(service.unit, quantity) : null;
  const top = mix(tone.bg, '#FFFFFF', 0.08);
  const bottom = mix(tone.bg, DEEP, 0.38);

  return (
    <View
      style={styles.hero}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setSize({ width, height });
      }}
    >
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="heroWash" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={top} />
            <Stop offset="1" stopColor={bottom} />
          </LinearGradient>
          <RadialGradient id="heroGlow" cx="0.82" cy="0.45" r="0.42">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.32} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size.width} height={size.height} fill="url(#heroWash)" />
        <Rect width={size.width} height={size.height} fill="url(#heroGlow)" />
        {FOAM.map((bubble, index) => (
          <Circle
            key={index}
            cx={size.width * bubble.x}
            cy={size.height * bubble.y}
            r={size.width * bubble.r}
            fill="#FFFFFF"
            fillOpacity={0.08}
            stroke="#FFFFFF"
            strokeOpacity={0.28}
            strokeWidth={1.25}
          />
        ))}
        {/* The suds line along the foot. */}
        <Path
          d={`M0 ${size.height - 22} C ${size.width * 0.2} ${size.height - 40}, ${
            size.width * 0.38
          } ${size.height - 4}, ${size.width * 0.6} ${size.height - 20} S ${
            size.width * 0.92
          } ${size.height - 34}, ${size.width} ${size.height - 18} V ${size.height} H 0 Z`}
          fill="#FFFFFF"
          fillOpacity={0.1}
        />
      </Svg>

      <View style={[styles.copy, { marginRight: artSize * (1 - ART_BLEED) - space.cosy }]}>
        {!sameWords(category, title) && (
          <View style={styles.eyebrow}>
            <Text style={styles.eyebrowText}>{category}</Text>
          </View>
        )}
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        <Text style={styles.rate}>{rate}</Text>
        {terms.length > 0 && (
          <View style={styles.terms}>
            {terms.map((term) => (
              <View key={term} style={styles.term}>
                <Text style={styles.termText}>{term}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* The thing itself, big in the corner and running off it, as on the
          shelf card the customer just tapped. */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.art,
          {
            width: artSize,
            height: artSize,
            right: -artSize * ART_BLEED,
            bottom: -artSize * ART_BLEED,
            opacity: land,
            transform: [
              { translateY: land.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              { translateY: hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] }) },
              { rotate: hop.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-4deg'] }) },
            ],
          },
        ]}
      >
        <ServiceScene
          scene={sceneFor(service.name, service.category)}
          colorway={serviceLook(service.name, service.category).colorway}
          brand={tone.bg}
          surface="white"
        />
      </Animated.View>

      {readout ? (
        <View style={styles.readout}>
          <Text style={styles.readoutText} numberOfLines={1}>
            {readout}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: HERO_MIN_HEIGHT,
    borderRadius: RADII.sheet,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.cosy,
    paddingVertical: space.room,
    paddingLeft: space.room,
    paddingRight: space.cosy,
    backgroundColor: colors.action,
  },
  copy: { flex: 1, gap: space.tight },
  eyebrow: {
    alignSelf: 'flex-start',
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  eyebrowText: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    fontFamily: fontFor(700),
    color: colors.onAccent,
    textTransform: 'uppercase',
  },
  title: { ...type.title, color: colors.onAccent },
  rate: { ...type.body, fontFamily: fontFor(700), color: colors.onAccent, opacity: 0.92 },
  terms: { flexDirection: 'row', flexWrap: 'wrap', gap: space.tight, marginTop: 2 },
  term: {
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
  },
  termText: { ...type.caption, fontFamily: fontFor(600), color: colors.onAccent },
  art: { position: 'absolute' },
  /** What is on the scale, in the corner above the object: dark glass, white figures. */
  readout: {
    position: 'absolute',
    top: space.cosy,
    right: space.cosy,
    paddingHorizontal: space.snug,
    paddingVertical: 3,
    borderRadius: RADII.pill,
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.85)',
  },
  readoutText: {
    ...type.caption,
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fontFor(800),
    color: colors.onAccent,
    fontVariant: ['tabular-nums'],
  },
});
