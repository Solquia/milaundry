/**
 * The porthole: a service behind a washer door.
 *
 * The shelf card and the till tile used to stand each service in a white well —
 * a clean frame, but one any app could have drawn around any product. A
 * laundry's services are the things that go through its machines, so they sit
 * behind a machine's door here: a chrome rim, a dark gasket, a pane of glass
 * with a little water in it and the object inside.
 *
 * The water is what makes it a machine rather than a circle with a drawing in
 * it, and it is the door's one working part. Its level comes from
 * `domain/porthole.ts`: at rest it sits low, in the category's colour; on the
 * till it rises as the counter loads the ticket and takes the shop's colour,
 * and each tap sets the load tumbling once. The customer's card uses `lift`
 * instead — under a finger the object tips and a few bubbles rise.
 *
 * A photograph of the shop's own work still wins the glass whenever there is
 * one; the drawing is what a service wears until then.
 */
import React from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { sceneFor } from '@/lib/domain/service-scene';
import { showcaseTone } from '@/lib/domain/service-showcase';
import { useReducedMotion } from '@/lib/use-reduced-motion';

import { ServiceScene } from './service-scene';
import type { WelledService } from './service-well';
import { colors, fontFor } from './ui-kit';

/** The rim, as a share of the door: thick enough to read as metal at 64pt. */
const RIM_SHARE = 0.1;
/** The object's margin inside the glass, so it floats rather than touches. */
const ART_INSET_SHARE = 0.12;
/** How far the load tips when the door is tapped. */
const TUMBLE_DEG = 14;
/** One pass of the water's surface across the glass. */
const SLOSH_MS = 2600;

/** The door's metal and rubber. Cool greys, so any category's water sits in it. */
const METAL = { light: '#FFFFFF', mid: '#E3E9F0', dark: '#BAC6D4', edge: '#C9D3DF' };
const GASKET = '#8C9AAD';

/** A sine strip two panes wide, so sliding it one pane loops without a seam. */
function wavePath(width: number, height: number): string {
  const quarter = width / 4;
  const crest = height * 0.15;
  const rest = height * 0.55;
  return (
    `M0 ${rest} Q${quarter} ${crest} ${quarter * 2} ${rest} ` +
    `T${quarter * 4} ${rest} T${quarter * 6} ${rest} T${quarter * 8} ${rest} ` +
    `V${height} H0 Z`
  );
}

/** The glint on the glass: an arc along the upper left, where the light is. */
function glintPath(size: number): string {
  const r = size * 0.36;
  const c = size / 2;
  const from = (205 * Math.PI) / 180;
  const to = (250 * Math.PI) / 180;
  const x1 = c + r * Math.cos(from);
  const y1 = c + r * Math.sin(from);
  const x2 = c + r * Math.cos(to);
  const y2 = c + r * Math.sin(to);
  return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`;
}

/** Where the bubbles start, across the glass, and how far each one climbs. */
const BUBBLES = [
  { x: 0.28, size: 0.07, climb: 0.26 },
  { x: 0.62, size: 0.05, climb: 0.34 },
  { x: 0.74, size: 0.085, climb: 0.2 },
] as const;

export function ServicePorthole({
  service,
  size,
  level,
  waterTint,
  lift,
  tumbleKey,
  isSloshing = false,
  readout,
}: {
  service: WelledService;
  /** The door's outer diameter. */
  size: number;
  /** 0–1: how high the water stands. `portholeLevel` decides it. */
  level: number;
  /** The water's colour — the category's at rest, the shop's once loaded. */
  waterTint: string;
  /** 0–1 press engagement from the card: the load tips, bubbles rise. */
  lift?: Animated.Value;
  /** Changes when something is loaded; each change tumbles the load once. */
  tumbleKey?: string | number;
  /** The surface rolls across the glass while the door is loaded. */
  isSloshing?: boolean;
  /** What the door's display says — the count on the ticket. */
  readout?: string | null;
}) {
  const isReduced = useReducedMotion();
  const [isPhotoBroken, setIsPhotoBroken] = React.useState(false);
  const rawId = React.useId();
  const id = `ph${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;

  const rim = Math.round(size * RIM_SHARE);
  const glass = size - rim * 2;
  const waveHeight = Math.max(6, Math.round(glass * 0.09));
  const tone = showcaseTone(service.category);
  const photo = (service.image_url ?? '').trim();
  const hasPhoto = photo.length > 0 && !isPhotoBroken;

  // The water's top edge, as a distance down the glass.
  const surfaceY = glass * (1 - level) - waveHeight / 2;
  const [waterY] = React.useState(() => new Animated.Value(surfaceY));
  const [wave] = React.useState(() => new Animated.Value(0));
  const [tumble] = React.useState(() => new Animated.Value(0));
  const [pop] = React.useState(() => new Animated.Value(1));
  const lastTumble = React.useRef(tumbleKey);
  const lastReadout = React.useRef(readout);

  React.useEffect(() => {
    if (isReduced) {
      waterY.setValue(surfaceY);
      return;
    }
    // Underdamped, so a rising load bobs once before it settles.
    const run = Animated.spring(waterY, {
      toValue: surfaceY,
      damping: 9,
      stiffness: 120,
      mass: 0.8,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [surfaceY, isReduced, waterY]);

  React.useEffect(() => {
    if (!isSloshing || isReduced) {
      wave.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: SLOSH_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [isSloshing, isReduced, wave]);

  React.useEffect(() => {
    if (lastTumble.current === tumbleKey) return;
    lastTumble.current = tumbleKey;
    if (isReduced) return;
    tumble.setValue(1);
    Animated.spring(tumble, {
      toValue: 0,
      damping: 5,
      stiffness: 180,
      mass: 0.7,
      useNativeDriver: true,
    }).start();
  }, [tumbleKey, isReduced, tumble]);

  React.useEffect(() => {
    if (lastReadout.current === readout) return;
    lastReadout.current = readout;
    if (isReduced || !readout) return;
    pop.setValue(0.7);
    Animated.spring(pop, {
      toValue: 1,
      damping: 8,
      stiffness: 260,
      useNativeDriver: true,
    }).start();
  }, [readout, isReduced, pop]);

  const artTransform = [
    { rotate: tumble.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${-TUMBLE_DEG}deg`] }) },
    ...(lift
      ? [
          { rotate: lift.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-7deg'] }) },
          { scale: lift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
        ]
      : []),
  ];

  return (
    <View style={{ width: size, height: size }}>
      {/* The hinge, on the left, where a front-loader's door hangs. */}
      <View
        style={[
          styles.hinge,
          { top: size * 0.33, height: size * 0.34, width: Math.max(5, rim * 0.7) },
        ]}
      />

      {/* The rim and the gasket, drawn: a flat grey ring reads as a button. */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`${id}rim`} x1="0.15" y1="0" x2="0.85" y2="1">
            <Stop offset="0" stopColor={METAL.light} />
            <Stop offset="0.55" stopColor={METAL.mid} />
            <Stop offset="1" stopColor={METAL.dark} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - 0.75}
          fill={`url(#${id}rim)`}
          stroke={METAL.edge}
          strokeWidth={1}
        />
        <Circle cx={size / 2} cy={size / 2} r={glass / 2 + 1.75} fill={GASKET} />
      </Svg>

      <View
        style={[
          styles.glass,
          {
            left: rim,
            top: rim,
            width: glass,
            height: glass,
            borderRadius: glass / 2,
            backgroundColor: tone.field,
          },
        ]}
      >
        {hasPhoto ? (
          <Image
            source={{ uri: photo }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            onError={() => setIsPhotoBroken(true)}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <>
            {/* The water, behind the load: it sits in the drum, the load
                tumbles in front of it. */}
            <Animated.View
              style={[
                styles.water,
                { width: glass * 2, height: glass + waveHeight, transform: [{ translateY: waterY }] },
              ]}
            >
              <Animated.View
                style={{
                  transform: [
                    { translateX: wave.interpolate({ inputRange: [0, 1], outputRange: [0, -glass] }) },
                  ],
                }}
              >
                <Svg width={glass * 2} height={waveHeight}>
                  <Path d={wavePath(glass * 2, waveHeight)} fill={waterTint} />
                </Svg>
              </Animated.View>
              <View style={[styles.waterBody, { backgroundColor: waterTint }]} />
            </Animated.View>

            {lift
              ? BUBBLES.map((bubble, index) => (
                  <Animated.View
                    key={index}
                    style={[
                      styles.bubble,
                      {
                        left: glass * bubble.x,
                        top: glass * (1 - level) - glass * bubble.size,
                        width: glass * bubble.size,
                        height: glass * bubble.size,
                        borderRadius: glass,
                        borderColor: waterTint,
                        opacity: lift.interpolate({ inputRange: [0, 1], outputRange: [0, 0.9] }),
                        transform: [
                          {
                            translateY: lift.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, -glass * bubble.climb],
                            }),
                          },
                        ],
                      },
                    ]}
                  />
                ))
              : null}

            <Animated.View
              style={[
                styles.art,
                { margin: glass * ART_INSET_SHARE, transform: artTransform },
              ]}
            >
              <ServiceScene
                scene={sceneFor(service.name, service.category)}
                brand={tone.bg}
                surface="white"
              />
            </Animated.View>
          </>
        )}

        {/* The glint, over everything behind the glass, photograph included. */}
        <Svg width={glass} height={glass} style={StyleSheet.absoluteFill} pointerEvents="none">
          <Path
            d={glintPath(glass)}
            stroke="#FFFFFF"
            strokeOpacity={0.85}
            strokeWidth={Math.max(2.5, glass * 0.055)}
            strokeLinecap="round"
            fill="none"
          />
        </Svg>
      </View>

      {readout ? (
        <Animated.View style={[styles.readout, { transform: [{ scale: pop }] }]}>
          <Text style={styles.readoutText} numberOfLines={1}>
            {readout}
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hinge: {
    position: 'absolute',
    left: -3,
    borderRadius: 3,
    backgroundColor: METAL.dark,
  },
  glass: { position: 'absolute', overflow: 'hidden' },
  water: { position: 'absolute', left: 0, top: 0, opacity: 0.42 },
  waterBody: { flex: 1 },
  bubble: {
    position: 'absolute',
    borderWidth: 1.5,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  art: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, pointerEvents: 'none' },
  /**
   * The door's display: dark glass, white figures. It overlaps the rim's foot
   * the way a machine's readout sits on its panel, so it reads as part of the
   * machine rather than as a badge stuck on the picture.
   */
  readout: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    minWidth: 30,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.text,
    borderWidth: 2,
    borderColor: colors.card,
  },
  readoutText: {
    fontFamily: fontFor(800),
    fontSize: 12,
    lineHeight: 15,
    color: colors.onAccent,
    fontVariant: ['tabular-nums'],
  },
});
