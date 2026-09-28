/**
 * The shading kit behind the service objects' product-photo look.
 *
 * A laundry's price board shows its services as cut-out photographs: a pile of
 * folded shirts, an iron standing on the pressed stack, a garment bag, a
 * trainer. A vector copy only reads as a photograph if it lights every
 * material the way a studio does, so every drawing makes the same moves: the
 * colour ramps from a lit crown through its own hue into a deep core, the
 * side facing the lamp is warmer than the side turned away, a hard highlight
 * rides the leading edge, and wherever one thing rests on another a seam of
 * contact shadow sits under it.
 *
 * Every ramp is built from one colour with `mixTone`, so a material is chosen
 * once and shades itself.
 */
import React from 'react';
import { G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { mixTone } from '@/lib/domain/service-scene';

/** Stops as [offset, lift]: lift > 0 toward white, < 0 toward black. */
export type Ramp = readonly (readonly [number, number])[];

/** Soft goods: a lit crown, the true hue across the middle, a deep fold under. */
export const CLOTH: Ramp = [
  [0, 0.32],
  [0.16, 0.12],
  [0.5, 0],
  [0.84, -0.2],
  [1, -0.42],
];

/** Lacquer and plastic: a hotter highlight, then a quick fall into the body. */
export const GLOSS: Ramp = [
  [0, 0.72],
  [0.18, 0.3],
  [0.42, 0],
  [0.86, -0.22],
  [1, -0.4],
];

/** Polished steel: bands of sky and floor, which is all chrome ever shows. */
export const CHROME: Ramp = [
  [0, 0.92],
  [0.28, 0.4],
  [0.46, -0.3],
  [0.56, -0.05],
  [0.76, 0.6],
  [1, -0.25],
];

/** A gradient built from one colour and a ramp, vertical unless told across. */
export function RampGradient({
  id,
  colour,
  ramp,
  isAcross = false,
}: {
  id: string;
  colour: string;
  ramp: Ramp;
  isAcross?: boolean;
}) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2={isAcross ? '1' : '0.12'} y2={isAcross ? '0.08' : '1'}>
      {ramp.map(([offset, lift]) => (
        <Stop key={offset} offset={String(offset)} stopColor={mixTone(colour, lift)} />
      ))}
    </LinearGradient>
  );
}

/**
 * The overlays every solid shares, defined once per drawing: the lamp's side
 * and the far side, the edge highlight, and the seam where one thing sits on
 * another.
 */
export function SharedLight({ id }: { id: string }) {
  return (
    <>
      <LinearGradient id={`${id}-side`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.3" />
        <Stop offset="0.3" stopColor="#FFFFFF" stopOpacity="0" />
        <Stop offset="0.62" stopColor="#000000" stopOpacity="0" />
        <Stop offset="1" stopColor="#0B1422" stopOpacity="0.3" />
      </LinearGradient>
      <LinearGradient id={`${id}-spec`} x1="0" y1="0" x2="1" y2="0">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0" />
        <Stop offset="0.22" stopColor="#FFFFFF" stopOpacity="0.85" />
        <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.4" />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </LinearGradient>
      <LinearGradient id={`${id}-seam`} x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#0B1422" stopOpacity="0.45" />
        <Stop offset="1" stopColor="#0B1422" stopOpacity="0" />
      </LinearGradient>
    </>
  );
}

/**
 * A folded garment seen from the front: a soft slab whose fore-edge rolls
 * outward at both ends, because cloth folded over itself is round there.
 */
export function pillowPath(x: number, y: number, w: number, h: number, bulge = 1.6): string {
  const r = Math.min(h / 2, 5);
  return (
    `M ${x + r} ${y} Q ${x + w / 2} ${y + bulge * 0.5} ${x + w - r} ${y} ` +
    `C ${x + w + bulge} ${y} ${x + w + bulge} ${y + h} ${x + w - r} ${y + h} ` +
    `Q ${x + w / 2} ${y + h + bulge} ${x + r} ${y + h} ` +
    `C ${x - bulge} ${y + h} ${x - bulge} ${y} ${x + r} ${y} Z`
  );
}

export type Weave = 'plain' | 'rib' | 'stripe' | 'stitch';

/** What the cloth is made of, at the scale a thumb would see it. */
function WeaveMarks({ x, y, w, h, weave }: { x: number; y: number; w: number; h: number; weave: Weave }) {
  const r = Math.min(h / 2, 5);
  if (weave === 'rib') {
    const count = Math.floor((w - r * 2) / 2.2);
    return (
      <G>
        {Array.from({ length: count }, (_, i) => (
          <Path
            key={i}
            d={`M ${x + r + 1.1 + i * 2.2} ${y + 1.4} V ${y + h - 1.2}`}
            stroke="#0B1422"
            strokeOpacity={0.13}
            strokeWidth={0.8}
          />
        ))}
      </G>
    );
  }
  if (weave === 'stripe') {
    return (
      <Path
        d={`M ${x + r} ${y + h * 0.5} H ${x + w - r}`}
        stroke="#FFFFFF"
        strokeOpacity={0.7}
        strokeWidth={Math.max(0.8, h * 0.18)}
      />
    );
  }
  if (weave === 'stitch') {
    return (
      <Path
        d={`M ${x + r} ${y + h - 1.8} H ${x + w - r}`}
        stroke="#F4B04A"
        strokeWidth={0.6}
        strokeDasharray={[1.4, 1]}
      />
    );
  }
  return null;
}

/**
 * One garment in a pile. It throws its seam onto whatever is under it first,
 * then paints its body, its weave, the lamp's side and the edge highlight.
 */
export function Fold({
  id,
  x,
  y,
  w,
  h,
  fill,
  weave = 'plain',
  hasSeam = true,
}: {
  /** The drawing's id, for the shared light overlays. */
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  weave?: Weave;
  /** Off for the bottom of a pile. */
  hasSeam?: boolean;
}) {
  const r = Math.min(h / 2, 5);
  const body = pillowPath(x, y, w, h);
  return (
    <G>
      {hasSeam ? (
        <Rect x={x + 1.5} y={y + h - 1} width={w - 3} height={3.4} rx={1.7} fill={`url(#${id}-seam)`} />
      ) : null}
      <Path d={body} fill={fill} />
      <WeaveMarks x={x} y={y} w={w} h={h} weave={weave} />
      <Path d={body} fill={`url(#${id}-side)`} />
      <Path
        d={`M ${x + r + 1} ${y + 1.2} Q ${x + w / 2} ${y + 1.9} ${x + w - r - 1} ${y + 1.2}`}
        stroke={`url(#${id}-spec)`}
        strokeWidth={1}
        strokeLinecap="round"
        fill="none"
      />
    </G>
  );
}
