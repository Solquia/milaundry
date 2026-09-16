/**
 * The corner the shop stands on, drawn from map tiles.
 *
 * The app can ask the phone for a map. The shop's web page cannot — `expo-maps`
 * is a native module, and there is no Google key to embed one with — so the
 * page used to show the address as a line of text and a link out. A customer
 * deciding whether to walk there does not want a link; they want to see the
 * street. `domain/map-tiles` does the arithmetic, this draws it, and it draws
 * the same on either platform, so a build with no maps module gets a real map
 * instead of an apology.
 *
 * The tiles are washed toward the shop's own colour. A raster basemap is grey
 * and belongs to nobody; a map that carries the shop's accent reads as part of
 * the storefront rather than as a component dropped into it. The wash is light
 * enough that street names survive it — the map still has to be a map.
 */
import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Path,
  Rect,
  Stop,
  LinearGradient as SvgLinearGradient,
} from 'react-native-svg';

import { colors, space, type } from '@/components/ui-kit';
import { tileMosaic, tileUrl, type PlacedTile } from '@/lib/domain/map-tiles';
import { SHOP_MAP_ZOOM, type ShopPin } from '@/lib/domain/shop-location';
import type { StorefrontTheme } from '@/lib/domain/web-theme';
import { useReducedMotion } from '@/lib/use-reduced-motion';

interface ShopMapProps {
  pin: ShopPin;
  theme: StorefrontTheme;
  height: number;
  /** Read to anyone who cannot see the tiles. */
  label: string;
  zoom?: number;
}

/** How hard the shop's colour is pushed into the basemap. Past this, streets go. */
const BRAND_WASH = 0.13;
/** A second, paler wash that lifts the map so the first one reads as light. */
const LIFT = 0.07;
const TILE_PX = 256;

export function ShopMap({ pin, theme, height, label, zoom = SHOP_MAP_ZOOM }: ShopMapProps) {
  // The box is only known once it has been laid out, and every tile address
  // depends on it, so nothing is fetched until the width is real.
  const [width, setWidth] = useState(0);
  const mosaic = tileMosaic({ pin, zoom, width, height });

  return (
    <View
      style={[styles.frame, { height }]}
      onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))}
      accessibilityRole="image"
      accessibilityLabel={label}
    >
      <View style={[styles.tiles, TINT_FILTER]} {...TILE_MARK}>
        {mosaic.tiles.map((tile, index) => (
          <AssemblingTile key={tile.key} tile={tile} order={index} />
        ))}
      </View>

      {/* The shop's colour, laid over the streets rather than instead of them,
          and a shade at the very foot so the map credit has something to sit on. */}
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.brand, opacity: BRAND_WASH }]}
      />
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.brandSoft, opacity: LIFT }]}
      />
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
        <Defs>
          <SvgLinearGradient id="mapScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.62" stopColor="#04203F" stopOpacity="0" />
            <Stop offset="1" stopColor="#04203F" stopOpacity="0.3" />
          </SvgLinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#mapScrim)" />
      </Svg>

      {width > 0 ? (
        <>
          <ApproachArc to={mosaic.pin} width={width} height={height} colour={theme.brand} />
          <View
            pointerEvents="none"
            style={[styles.pinAt, { left: mosaic.pin.left, top: mosaic.pin.top }]}
          >
            <LivePin theme={theme} />
          </View>
        </>
      ) : null}

      <Text style={styles.credit}>{mosaic.attribution}</Text>
    </View>
  );
}


/** Each tile's turn, so the mosaic lays itself down instead of blinking on. */
const TILE_STEP_MS = 55;
const TILE_IN_MS = 420;

/**
 * One tile, arriving.
 *
 * Nine pictures resolving at once reads as a page that was slow. The same nine
 * laid down corner by corner reads as a map being drawn for you, and it costs
 * one transform per tile. The stagger is capped so a wide window never turns
 * the last tile into a wait.
 */
function AssemblingTile({ tile, order }: { tile: PlacedTile; order: number }) {
  const isReduced = useReducedMotion();
  const [enter] = useState(() => new Animated.Value(isReduced ? 1 : 0));

  useEffect(() => {
    if (isReduced) {
      enter.setValue(1);
      return;
    }
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: TILE_IN_MS,
      delay: Math.min(order * TILE_STEP_MS, 330),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, isReduced, order]);

  return (
    <Animated.View
      style={[
        styles.tile,
        { left: tile.left, top: tile.top },
        {
          opacity: enter,
          transform: [
            { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }) },
          ],
        },
      ]}
    >
      <Image
        source={{ uri: tileUrl(tile) }}
        style={styles.tileImage}
        contentFit="cover"
        cachePolicy="disk"
      />
    </Animated.View>
  );
}

const ARC_MS = 1150;
/** The length the dash pattern is measured against; longer than any real arc. */
const ARC_SPAN = 420;

/**
 * The way in, drawn.
 *
 * A dashed line curving to the pin is the oldest mark on any map — the one that
 * says "this is the place you are going to". It carries no origin dot and no
 * distance, because the app does not know where the reader is standing and a
 * route it invented would be a lie. It is the gesture, not a direction.
 */
function ApproachArc({
  to,
  width,
  height,
  colour,
}: {
  to: { left: number; top: number };
  width: number;
  height: number;
  colour: string;
}) {
  const isReduced = useReducedMotion();
  const [draw] = useState(() => new Animated.Value(0));
  const [drawn, setDrawn] = useState(ARC_SPAN);
  // Derived, never written from the effect: a device asking for less motion is
  // handed the finished line instead of being animated toward it.
  const dashed = isReduced ? 0 : drawn;

  useEffect(() => {
    if (isReduced) return;
    // The offset is read into state rather than bound through an animated SVG
    // component: wrapping a Path in `createAnimatedComponent` makes React Native
    // Web hand the DOM its own `collapsable` prop, which the browser rejects as
    // a non-boolean attribute. One path stepping a number is cheaper than the
    // warning is worth.
    const id = draw.addListener(({ value }) => setDrawn(ARC_SPAN * (1 - value)));
    const animation = Animated.timing(draw, {
      toValue: 1,
      duration: ARC_MS,
      delay: 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start(() => setDrawn(0));
    return () => {
      animation.stop();
      draw.removeListener(id);
    };
  }, [draw, isReduced]);

  // Comes in low from the left and rises into the pin's foot, held inside the
  // frame on a narrow card so the curve never clips against the edge.
  const start = { x: Math.max(14, to.left - Math.min(150, width * 0.42)), y: Math.min(height - 16, to.top + 76) };
  const control = { x: start.x + (to.left - start.x) * 0.25, y: start.y - 34 };
  const path = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${to.left} ${to.top + 2}`;

  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" pointerEvents="none">
      {/* Drawn twice: a soft white underlay so the dashes survive a dark roof
          or a park, and the shop's colour on top of it. */}
      <Path
        d={path}
        stroke="#FFFFFF"
        strokeWidth={6}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
        strokeDasharray="9 9"
        strokeDashoffset={dashed}
      />
      <Path
        d={path}
        stroke={colour}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        strokeDasharray="9 9"
        strokeDashoffset={dashed}
      />
    </Svg>
  );
}

const PIN_HEIGHT = 40;
const PIN_WIDTH = 32;
const RIPPLE = 92;
const WAVE_MS = 2600;

/**
 * The pin, with the shop breathing under it.
 *
 * One slow ring rather than a pulse on every element: on a still basemap the
 * single moving thing is where the eye lands, which is the whole job of a pin.
 * It starts and stays still when the device asks for less motion — the pin's
 * position, not its movement, is what carries the meaning.
 */
function LivePin({ theme }: { theme: StorefrontTheme }) {
  const isReduced = useReducedMotion();
  const [wave] = useState(() => new Animated.Value(0));
  const [drop] = useState(() => new Animated.Value(isReduced ? 1 : 0));

  useEffect(() => {
    if (isReduced) {
      wave.setValue(0);
      return;
    }
    // The pin falls onto the street first; the rings start only once it has
    // landed, so the two motions read as cause and effect rather than as two
    // things happening at a pin.
    const fall = Animated.timing(drop, {
      toValue: 1,
      duration: 620,
      easing: Easing.bezier(0.17, 0.89, 0.34, 1.3),
      useNativeDriver: true,
    });
    fall.start();

    const loop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: WAVE_MS,
        delay: 520,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [drop, isReduced, wave]);

  /** Two rings off one driver, the second half a cycle behind the first. */
  const ring = (offset: number) => ({
    opacity: wave.interpolate({
      inputRange: [0, offset, offset + 0.001, 1],
      outputRange: [0, 0, 0.5, 0],
      extrapolate: 'clamp' as const,
    }),
    transform: [
      {
        scale: wave.interpolate({
          inputRange: [0, offset, 1],
          outputRange: [0.2, 0.2, 1],
          extrapolate: 'clamp' as const,
        }),
      },
    ],
  });

  return (
    <>
      {isReduced ? null : (
        <>
          <Animated.View style={[styles.ripple, { borderColor: theme.brand }, ring(0)]} />
          <Animated.View style={[styles.ripple, { borderColor: theme.brand }, ring(0.5)]} />
        </>
      )}
      <Animated.View
        style={[
          styles.pinMark,
          isReduced
            ? null
            : {
                opacity: drop.interpolate({ inputRange: [0, 0.25, 1], outputRange: [0, 1, 1] }),
                transform: [
                  { translateY: drop.interpolate({ inputRange: [0, 1], outputRange: [-34, 0] }) },
                ],
              },
        ]}
      >
        <Svg width={PIN_WIDTH} height={PIN_HEIGHT} viewBox="0 0 32 40">
          {/* The shadow the pin casts on the street, so it stands on the map
              rather than floating over a picture of one. */}
          <Circle cx="16" cy="37" r="4.5" fill="#04203F" opacity="0.28" />
          <Path
            d="M16 1C9.4 1 4 6.3 4 12.9c0 8.5 10.3 19.2 11 19.9.3.3.7.3 1 0 .7-.7 11-11.4 11-19.9C27 6.3 22.6 1 16 1Z"
            fill={theme.brand}
            stroke="#FFFFFF"
            strokeWidth="2.5"
          />
          <Circle cx="16" cy="13" r="4.4" fill="#FFFFFF" />
        </Svg>
      </Animated.View>
    </>
  );
}

/**
 * A residential basemap at street zoom is mostly pale grey: correct, and with
 * no character at all. Pushing the saturation up first is what gives the wash
 * something to sit on — parks go green, roofs go warm, and the shop colour then
 * reads as a tint over a living street rather than as paint over a diagram.
 *
 * Native takes the structured `filter` below. The web drops `filter` from a
 * style object entirely, so the layer marks itself with `data-maptiles` and the
 * document sheet in `lib/web-document.ts` paints it. A platform that honours
 * neither shows the basemap unfiltered: a duller map, not a broken one.
 */
/** What the document sheet looks for. `dataSet` is a web-only View prop. */
const TILE_MARK = Platform.select({ web: { dataSet: { maptiles: true } }, default: {} }) as object;

const TINT_FILTER = {
  filter: [{ saturate: 1.45 }, { contrast: 1.08 }, { brightness: 1.03 }],
} as const;

const styles = StyleSheet.create({
  frame: { backgroundColor: colors.sunken, overflow: 'hidden' },
  tiles: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  tile: { position: 'absolute', width: TILE_PX, height: TILE_PX },
  tileImage: { width: TILE_PX, height: TILE_PX },
  /**
   * A zero-size anchor: the pin's point sits on the coordinate the way a pin
   * pushed into a paper map does, rather than the pin's box being centred on it.
   */
  pinAt: { position: 'absolute', width: 0, height: 0 },
  pinMark: { position: 'absolute', bottom: -4, left: -PIN_WIDTH / 2, width: PIN_WIDTH },
  ripple: {
    position: 'absolute',
    width: RIPPLE,
    height: RIPPLE,
    left: -RIPPLE / 2,
    top: -RIPPLE / 2,
    borderRadius: RIPPLE / 2,
    borderWidth: 2,
  },
  /**
   * The credit OpenStreetMap asks for, on its own shade. White type straight
   * onto a pale street is unreadable, and darkening the whole foot of the map
   * to carry six words would cost more of the picture than the words are worth.
   */
  credit: {
    ...type.caption,
    position: 'absolute',
    right: space.snug,
    bottom: space.snug,
    fontSize: 10,
    color: 'rgba(255,255,255,0.94)',
    backgroundColor: 'rgba(4,32,63,0.5)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
});
