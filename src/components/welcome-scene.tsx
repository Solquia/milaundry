/**
 * The drawn things on the front door's hero.
 *
 * Four pieces. Two are drawn once and never move — the field and the laundry
 * standing in it — and two give the water the only movement on the screen:
 * bubbles rising behind the words, and a seam that sways along the waterline.
 * Both of those take the reduced-motion answer the device gives and hold a still
 * frame when it says so.
 *
 * 1. `HeroField` is the field and its bottom edge: one deep-blue gradient and
 *    one large curve, in a single Svg. There was a drifting three-layer wave
 *    here and it was wrong twice over — it moved on a screen whose whole job
 *    is to be got past quickly, and the layered crests read as grey slabs
 *    rather than as water. One curve says the same thing and says it at a
 *    glance.
 * 2. `WelcomeScene` is the laundry, drawn the way `service-scene.tsx` draws —
 *    a silhouette in the object's own colours, a lighter plane where the form
 *    turns up, a darker one where it turns away, a highlight along the leading
 *    edge. It borrows those exact palettes, so the machine on this screen is
 *    the same white steel as the machine on a service card.
 *
 * **Both Svgs are sized in real pixels, never percentages.** `react-native-svg`
 * paints a fixed viewport for a percentage-sized Svg, so a field asked to be
 * `height="100%"` stops short of its container and the screen's own dark
 * background shows through below it — which is exactly what happened here, as
 * a navy band under the scene. `splash.tsx` carries the same warning. The
 * caller measures the hero and passes the numbers.
 */
import React from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { scenePalette } from '@/lib/domain/service-scene';

/** The field the hero is painted in — the splash's water, deep to shallow. */
export const FIELD = ['#04203F', '#0B4A8C', '#1B76CE'] as const;
/** The one bright tone in that water. */
export const FOAM = '#7FF3D6';
/** Ink that survives the field: a full-strength white and a receded blue-white. */
export const ON_FIELD = '#FFFFFF';
export const ON_FIELD_SOFT = '#B9D7F5';

/**
 * How much higher the curve sits at the edges than at its lowest point.
 *
 * Large on purpose. A 12pt curve is a rounded corner somebody forgot to
 * finish; at 52 it is unmistakably a drawn edge, and the sheet below reads as
 * a card the blue is tucked behind.
 */
export const CURVE_RISE = 52;

/**
 * The field and its edge, in one drawn object.
 *
 * The curve is a single quadratic: the sheet's colour hangs from `h - rise` at
 * both sides down to `h` at the centre, so the blue bulges gently past it.
 * One control point, one path — nothing to keep in sync and nothing to animate.
 */
export function HeroField({
  width,
  height,
  sheet,
}: {
  width: number;
  height: number;
  /** The colour the sheet below is painted in. The curve matches it exactly. */
  sheet: string;
}) {
  if (width <= 0 || height <= 0) return null;

  const top = height - CURVE_RISE;
  // A quadratic's midpoint is (P0 + 2C + P2) / 4, so a control point this far
  // below lands the curve's lowest point exactly on the hero's bottom edge.
  const control = height + CURVE_RISE;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <SvgLinearGradient id="field" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={FIELD[0]} />
          <Stop offset="0.55" stopColor={FIELD[1]} />
          <Stop offset="1" stopColor={FIELD[2]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill="url(#field)" />
      <Path
        d={`M 0 ${top} Q ${width / 2} ${control} ${width} ${top} L ${width} ${height} L 0 ${height} Z`}
        fill={sheet}
      />
    </Svg>
  );
}

/** The scene's drawing box. Everything below is in these coordinates. */
const ART_W = 260;
const ART_H = 150;

/**
 * The laundry, on the water.
 *
 * A front-loader mid-cycle with a basket beside it and a folded stack in
 * front — the three objects the product is actually about, arranged so the
 * machine's porthole is the one bright circle and everything else steps down
 * from it. Each object is lit from above: `light` catches the lamp, `base` is
 * the body, `shade` turns away, and a hairline of `light` runs along the
 * leading edge.
 */
export function WelcomeScene({ width }: { width: number }) {
  const machine = scenePalette('machine');
  const basket = scenePalette('basket');
  const stack = scenePalette('stack');
  const height = Math.round((width / ART_W) * ART_H);

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${ART_W} ${ART_H}`}>
      <Defs>
        {/* The lamp above, standing in for a light source in one gradient. */}
        <SvgLinearGradient id="steel" x1="0" y1="0" x2="0.2" y2="1">
          <Stop offset="0" stopColor={machine.light} />
          <Stop offset="1" stopColor={machine.base} />
        </SvgLinearGradient>
        <SvgLinearGradient id="glass" x1="0.2" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={machine.accent} />
          <Stop offset="1" stopColor="#0E5FA8" />
        </SvgLinearGradient>
        <SvgLinearGradient id="weave" x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={basket.light} />
          <Stop offset="1" stopColor={basket.base} />
        </SvgLinearGradient>
      </Defs>

      {/* The pool every object stands in. Blue, not grey: on water a neutral
          shadow reads as a smudge on the glass. */}
      <Ellipse cx={130} cy={137} rx={104} ry={9} fill="#04203F" opacity={0.35} />

      {/* ── The basket, behind and to the right ─────────────────────────── */}
      <Path
        d="M 168 66 L 232 66 L 224 122 Q 223 128 217 128 L 183 128 Q 177 128 176 122 Z"
        fill="url(#weave)"
      />
      {/* The side that turns away from the lamp. */}
      <Path d="M 208 66 L 232 66 L 224 122 Q 223 128 217 128 L 205 128 Z" fill={basket.shade} />
      {/* The wash in it — the one place in the scene with loose colour. */}
      <Path d="M 173 66 Q 186 50 200 58 Q 214 48 227 66 Z" fill={basket.accent} />
      <Path d="M 186 62 Q 196 52 206 60 Q 214 54 221 66 L 190 66 Z" fill={stack.light} />
      {/* The rim, and the weave read as three ruled lines rather than drawn. */}
      <Rect x={166} y={62} width={68} height={8} rx={4} fill={basket.light} />
      <Path
        d="M 174 86 L 226 86 M 172 100 L 224 100 M 170 114 L 222 114"
        stroke={basket.shade}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.75}
      />

      {/* ── The machine, the object the eye lands on ────────────────────── */}
      <Rect x={26} y={34} width={104} height={94} rx={14} fill="url(#steel)" />
      {/* The plane that turns away, on the right where the lamp is not. */}
      <Path
        d="M 112 34 L 116 34 Q 130 34 130 48 L 130 114 Q 130 128 116 128 L 112 128 Z"
        fill={machine.shade}
        opacity={0.55}
      />
      {/* The console: a lit strip and one control, at the size a control is. */}
      <Rect x={38} y={44} width={58} height={7} rx={3.5} fill={machine.shade} opacity={0.5} />
      <Circle cx={108} cy={47.5} r={5} fill={machine.deep} />
      <Circle cx={108} cy={47.5} r={2} fill={machine.accent} />

      {/* The door: a steel ring, dark glass, water behind it, and one
          specular highlight where the glass turns to the lamp. */}
      <Circle cx={78} cy={92} r={31} fill={machine.light} />
      <Circle cx={78} cy={92} r={26} fill={machine.deep} />
      <Circle cx={78} cy={92} r={22} fill="url(#glass)" />
      <Path
        d="M 56 92 Q 67 84 78 92 Q 89 100 100 92 L 100 100 Q 89 108 78 100 Q 67 92 56 100 Z"
        fill={FOAM}
        opacity={0.65}
      />
      <Circle cx={68} cy={80} r={4} fill={ON_FIELD} opacity={0.5} />
      <Circle cx={88} cy={102} r={3} fill={ON_FIELD} opacity={0.3} />
      {/* The specular: an arc, not a dot — glass this size catches a sweep. */}
      <Path
        d="M 62 76 Q 70 68 82 68"
        stroke={ON_FIELD}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.55}
      />
      {/* The highlight along the leading edge, which is what makes the body
          read as steel rather than as a filled rectangle. */}
      <Path
        d="M 26 48 Q 26 34 40 34 L 60 34"
        stroke={machine.light}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />

      {/* ── The folded stack, in front of both ──────────────────────────── */}
      <Fold x={96} y={108} w={62} h={11} palette={stack} accent={stack.accent} />
      <Fold x={100} y={118} w={54} h={11} palette={stack} accent="#E2574C" />
    </Svg>
  );
}

/**
 * One folded garment: a soft slab with a rounded fore-edge, the top face
 * catching the light and the front turning away from it.
 */
function Fold({
  x,
  y,
  w,
  h,
  palette,
  accent,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  palette: ReturnType<typeof scenePalette>;
  accent: string;
}) {
  return (
    <>
      <Rect x={x} y={y} width={w} height={h} rx={h / 2} fill={palette.base} />
      <Rect x={x} y={y} width={w} height={h * 0.5} rx={h * 0.25} fill={palette.light} />
      {/* The one coloured garment in the pile: a band at the fore-edge, which
          is the only part of a folded shirt whose colour you actually see. */}
      <Rect x={x + w - 16} y={y + 2} width={12} height={h - 4} rx={3} fill={accent} opacity={0.9} />
    </>
  );
}

/**
 * The water's own movement: bubbles rising through the field.
 *
 * The drifting three-layer wave this module used to carry was removed for good
 * reasons — it moved the whole edge of a screen whose job is to be got past,
 * and layered crests read as grey slabs rather than as water. Bubbles are the
 * other way round: nothing structural moves, a few small things drift upward
 * behind the words, and the field reads as liquid rather than as a gradient.
 *
 * Deterministic by construction. The positions are a fixed table rather than
 * `Math.random()`, so the screen composes the same way every launch and a
 * re-render never re-scatters them mid-rise.
 *
 * `isStill` is the device's reduced-motion answer, arriving from the screen
 * that already asked for it. Still means still — the bubbles hold a mid-rise
 * frame, which is the handsome one, rather than the frame the loop starts on.
 */
const BUBBLES = [
  { x: 0.08, r: 7, delay: 0, seconds: 9 },
  { x: 0.21, r: 4, delay: 2600, seconds: 7.5 },
  { x: 0.36, r: 10, delay: 1200, seconds: 11 },
  { x: 0.52, r: 5, delay: 4200, seconds: 8 },
  { x: 0.68, r: 8, delay: 800, seconds: 10.5 },
  { x: 0.79, r: 3.5, delay: 3200, seconds: 7 },
  { x: 0.91, r: 6, delay: 1900, seconds: 9.5 },
] as const;

export function Bubbles({
  width,
  height,
  isStill,
}: {
  width: number;
  height: number;
  isStill: boolean;
}) {
  if (width <= 0 || height <= 0) return null;

  return (
    // Decoration, and nothing a finger or a screen reader should ever reach:
    // every one of these is a circle that says nothing the words do not.
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={StyleSheet.absoluteFill}
    >
      {BUBBLES.map((bubble) => (
        <Bubble
          key={`${bubble.x}-${bubble.r}`}
          bubble={bubble}
          width={width}
          height={height}
          isStill={isStill}
        />
      ))}
    </View>
  );
}

function Bubble({
  bubble,
  width,
  height,
  isStill,
}: {
  bubble: (typeof BUBBLES)[number];
  width: number;
  height: number;
  isStill: boolean;
}) {
  const [rise] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (isStill) {
      rise.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(bubble.delay),
        Animated.timing(rise, {
          toValue: 1,
          duration: bubble.seconds * 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        // Straight back to the floor with the bubble already invisible, so the
        // reset is never seen as a bubble falling.
        Animated.timing(rise, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [rise, bubble.delay, bubble.seconds, isStill]);

  const size = bubble.r * 2;

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: Math.round(width * bubble.x) - bubble.r,
        // Starts just under the hero's foot and rises out through the top.
        top: height - size,
        width: size,
        height: size,
        borderRadius: bubble.r,
        borderWidth: 1,
        // Foam, held well back. At full strength the ring drew a hard circle
        // over whatever line of the greeting it happened to pass, which is a
        // bubble competing with the words instead of sitting behind them.
        borderColor: 'rgba(127, 243, 214, 0.5)',
        backgroundColor: 'rgba(127, 243, 214, 0.1)',
        opacity: rise.interpolate({
          // In quickly, out slowly: a bubble that fades as it goes reads as one
          // rising *through* the water rather than sliding across a picture.
          inputRange: [0, 0.12, 0.75, 1],
          outputRange: [0, 0.34, 0.2, 0],
        }),
        transform: [
          {
            translateY: rise.interpolate({
              inputRange: [0, 1],
              outputRange: [0, -(height - size)],
            }),
          },
          // A lazy sideways sway: still water does not run a bubble up a plumb
          // line, and two bubbles on identical paths read as a screensaver.
          {
            translateX: rise.interpolate({
              inputRange: [0, 0.35, 0.7, 1],
              outputRange: [0, bubble.r * 1.6, -bubble.r * 1.2, 0],
            }),
          },
        ],
      }}
    />
  );
}

/**
 * The seam between the water and the sheet below it.
 *
 * `HeroField` draws this curve as part of its own field; this is the same edge
 * on its own, for a hero that paints its field itself. It sits on the foot of
 * the hero in the sheet's colour, so the white below simply continues out of
 * the blue, and carries one hairline of foam along the waterline — the detail
 * that makes it read as a surface rather than as a cut.
 *
 * When motion is allowed the crest slides a few points sideways on a very slow
 * loop. Nothing reflows: the path is drawn wider than the screen and moved by
 * transform alone, so the edge never leaves a gap at either side.
 */
const HEM_OVERHANG = 24;
const HEM_SWAY_MS = 9000;

export function WaveHem({
  width,
  sheet,
  isStill,
}: {
  width: number;
  /** The colour the sheet below is painted in. The curve matches it exactly. */
  sheet: string;
  isStill: boolean;
}) {
  const [sway] = React.useState(() => new Animated.Value(0));

  React.useEffect(() => {
    if (isStill) {
      sway.setValue(0.5);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sway, {
          toValue: 1,
          duration: HEM_SWAY_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(sway, {
          toValue: 0,
          duration: HEM_SWAY_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [sway, isStill]);

  if (width <= 0) return null;

  // Drawn past both edges, so a crest that has slid sideways still reaches the
  // corners of the screen it is sealing.
  const paintWidth = width + HEM_OVERHANG * 2;
  const control = CURVE_RISE * 2;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        position: 'absolute',
        left: -HEM_OVERHANG,
        right: -HEM_OVERHANG,
        bottom: 0,
        height: CURVE_RISE,
        transform: [
          {
            translateX: sway.interpolate({
              inputRange: [0, 1],
              outputRange: [-HEM_OVERHANG / 2, HEM_OVERHANG / 2],
            }),
          },
        ],
      }}
    >
      <Svg width={paintWidth} height={CURVE_RISE}>
        <Path
          d={`M 0 0 Q ${paintWidth / 2} ${control} ${paintWidth} 0 L ${paintWidth} ${CURVE_RISE} L 0 ${CURVE_RISE} Z`}
          fill={sheet}
        />
        {/* The waterline itself: foam where the two meet, held back so it is a
            highlight on an edge rather than a second line under it. */}
        <Path
          d={`M 0 0 Q ${paintWidth / 2} ${control} ${paintWidth} 0`}
          stroke={FOAM}
          strokeWidth={2}
          strokeOpacity={0.45}
          fill="none"
        />
      </Svg>
    </Animated.View>
  );
}

/**
 * The four marks on the front door's tiles.
 *
 * They were Ionicons — one hairline weight, one flat colour, four glyphs that
 * could have come off any screen in any app. Everything else drawn here is an
 * *object*: a body in its own colour, a plane where the form turns toward the
 * light, a darker one where it turns away, a highlight along the leading edge.
 * Four glyphs sitting under a drawn laundry looked like what they were, which
 * is a placeholder.
 *
 * So they are drawn the way the machine is, on the same three-tone recipe, from
 * each tile's own ink. One 44×44 box, one object each, and nothing finer than
 * 1.5 units — under a thumb at 32 points a hairline is a smudge.
 */

/** Mixes a `#RRGGBB` toward white. The plane that turns into the light. */
function toward(hex: string, white: number): string {
  const n = parseInt(hex.slice(1), 16);
  const mix = (channel: number) => Math.round(channel + (255 - channel) * white);
  const r = mix((n >> 16) & 255);
  const g = mix((n >> 8) & 255);
  const b = mix(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** And toward black, for the plane that turns away from it. */
function away(hex: string, black: number): string {
  const n = parseInt(hex.slice(1), 16);
  const dim = (channel: number) => Math.round(channel * (1 - black));
  const r = dim((n >> 16) & 255);
  const g = dim((n >> 8) & 255);
  const b = dim(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export type WayMarkKind = 'scan' | 'key' | 'person' | 'shop';

const MARK_BOX = 44;

export function WayMark({
  kind,
  ink,
  size,
}: {
  kind: WayMarkKind;
  /** The tile's own colour. Every plane of the object is mixed from it. */
  ink: string;
  size: number;
}) {
  const light = toward(ink, 0.42);
  const shade = away(ink, 0.24);
  const glint = toward(ink, 0.78);

  return (
    // The tile that holds this already carries the spoken label, so the mark
    // is hidden from assistive tech by the wrapper rather than by props on the
    // <Svg> — react-native-svg forwards unknown props straight to the DOM node
    // on web, and the browser logs every one it does not know.
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
    <Svg width={size} height={size} viewBox={`0 0 ${MARK_BOX} ${MARK_BOX}`}>
      {kind === 'scan' ? <ScanMark ink={ink} light={light} shade={shade} glint={glint} /> : null}
      {kind === 'key' ? <KeyMark ink={ink} light={light} shade={shade} glint={glint} /> : null}
      {kind === 'person' ? (
        <PersonMark ink={ink} light={light} shade={shade} glint={glint} />
      ) : null}
      {kind === 'shop' ? <ShopMark ink={ink} light={light} shade={shade} glint={glint} /> : null}
    </Svg>
    </View>
  );
}

interface MarkProps {
  ink: string;
  light: string;
  shade: string;
  glint: string;
}

/**
 * A code, as the camera meets it: three finder squares and a block of modules,
 * with the lower-left corner in shade so the code reads as printed on a face
 * turned slightly away rather than as a flat pattern.
 */
function ScanMark({ ink, light, shade, glint }: MarkProps) {
  return (
    <>
      <Rect x={5} y={5} width={16} height={16} rx={4} fill={light} />
      <Rect x={9} y={9} width={8} height={8} rx={2} fill={ink} />
      <Rect x={23} y={5} width={16} height={16} rx={4} fill={ink} />
      <Rect x={27} y={9} width={8} height={8} rx={2} fill={glint} />
      <Rect x={5} y={23} width={16} height={16} rx={4} fill={shade} />
      <Rect x={9} y={27} width={8} height={8} rx={2} fill={glint} />
      {/* The data side: four modules, weighted so the block has a corner. */}
      <Rect x={23} y={23} width={7} height={7} rx={2} fill={ink} />
      <Rect x={32} y={23} width={7} height={7} rx={2} fill={light} />
      <Rect x={23} y={32} width={7} height={7} rx={2} fill={light} />
      <Rect x={32} y={32} width={7} height={7} rx={2} fill={shade} />
    </>
  );
}

/** A key on its side: a ringed bow, a shaft with a lit top edge, two teeth. */
function KeyMark({ ink, light, shade, glint }: MarkProps) {
  return (
    <>
      <Rect x={20} y={18} width={20} height={8} rx={4} fill={ink} />
      {/* The shaft's lit top: a key is a cylinder, and this is the only line
          that says so. */}
      <Rect x={22} y={19} width={16} height={2.5} rx={1.25} fill={glint} opacity={0.75} />
      <Rect x={30} y={26} width={3.5} height={7} rx={1.5} fill={shade} />
      <Rect x={36} y={26} width={3.5} height={5} rx={1.5} fill={shade} />
      <Circle cx={15} cy={22} r={11} fill={ink} />
      <Path d="M 15 11 A 11 11 0 0 1 26 22 L 15 22 Z" fill={light} />
      <Circle cx={15} cy={22} r={4.5} fill={glint} />
      <Circle cx={15} cy={22} r={4.5} fill="none" stroke={shade} strokeWidth={1.5} />
    </>
  );
}

/** A person, lit from above, with the badge that makes them a new one. */
function PersonMark({ ink, light, shade, glint }: MarkProps) {
  return (
    <>
      <Path d="M 7 37 C 7 28 13 24 19 24 C 25 24 31 28 31 37 Z" fill={ink} />
      {/* Where the shoulder turns up into the light. */}
      <Path d="M 7 37 C 7 29 12 25 17 24.2 C 13 27 11 31 10.5 37 Z" fill={light} />
      <Circle cx={19} cy={14} r={8} fill={ink} />
      <Path d="M 19 6 A 8 8 0 0 1 27 14 L 19 14 Z" fill={light} />
      <Circle cx={16.5} cy={11.5} r={2} fill={glint} opacity={0.65} />
      {/* The badge sits over the shoulder, so the plus reads as attached to
          the person rather than floating beside them. Light disc, dark plus:
          a dark disc on a dark shoulder was one silhouette with a bite in it. */}
      <Circle cx={34} cy={30} r={10} fill={glint} />
      <Circle cx={34} cy={30} r={10} fill="none" stroke={ink} strokeWidth={1.5} />
      <Rect x={32.5} y={25} width={3} height={10} rx={1.5} fill={ink} />
      <Rect x={29} y={28.5} width={10} height={3} rx={1.5} fill={ink} />
    </>
  );
}

/**
 * A shopfront, drawn for the size it is actually seen at.
 *
 * The first cut had a four-scallop awning over a two-tone face and a shaded
 * door; at 34 points that was six shapes inside 44 units and it silted up into
 * a brown block. An awning is the one form that says "shop" on its own, so it
 * takes the top third at full width, and everything under it is two planes and
 * a doorway.
 */
function ShopMark({ ink, light, shade, glint }: MarkProps) {
  return (
    <>
      {/* The building, pale so the awning over it has something to sit on. */}
      <Rect x={10} y={23} width={24} height={16} rx={2} fill={glint} />
      <Rect x={26} y={23} width={8} height={16} rx={2} fill={light} />
      {/* The doorway, standing open on the dark inside. */}
      <Rect x={15} y={28} width={11} height={11} rx={1.5} fill={ink} />
      <Rect x={15} y={28} width={3.5} height={11} rx={1.5} fill={shade} />
      {/* The awning. It overhangs the shop on both sides and takes a third of
          the box — at this size the cloth *is* the word "shop", and scallops
          cut any shallower than this close up into a lid. */}
      <Path
        d="M 5 23 L 9 11 L 35 11 L 39 23 C 33.3 23 33.3 17 27.7 17 C 22 17 22 23 16.3 23 C 10.7 23 10.7 17 5 17 Z"
        fill={ink}
      />
      {/* The band along its ridge, where the cloth catches the light. */}
      <Path d="M 9 11 L 35 11 L 36.4 15 L 7.6 15 Z" fill={glint} />
    </>
  );
}
