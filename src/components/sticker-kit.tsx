/**
 * The app's illustration style, in one place.
 *
 * Every drawing in the app — the tracker's drum, the services behind their
 * washer doors — is a sticker: flat colour, one shade and one highlight per
 * shape, an ink outline in the darkest tone of its own colour, and the odd
 * sparkle. A painted, semi-realistic set was tried on the service doors and
 * stood apart from everything around it; one kit keeps the two families from
 * drifting again.
 */
import React from 'react';
import { G, Path, Rect } from 'react-native-svg';

import { mixTone } from '@/lib/domain/service-scene';

/** The laundry's own colours: the warm notes against any brand or stage tone. */
export const DYE = {
  sun: '#FFC233',
  coral: '#FF6B5B',
  mint: '#2FD3A6',
  sky: '#5AB2FF',
  violet: '#8C6BF0',
  paper: '#FFF8EC',
  steel: '#C9D3DF',
  wicker: '#E0A45C',
} as const;

export interface Tones {
  /** The colour, as given. */
  base: string;
  /** The outline and the darkest shade. */
  ink: string;
  shade: string;
  light: string;
  wash: string;
}

export function tonesFor(color: string): Tones {
  return {
    base: color,
    ink: mixTone(color, -0.55),
    shade: mixTone(color, -0.22),
    light: mixTone(color, 0.5),
    wash: mixTone(color, 0.82),
  };
}

/** The ink line every shape is drawn with. */
export const LINE = { strokeWidth: 2.2, strokeLinejoin: 'round', strokeLinecap: 'round' } as const;

/** A four-point sparkle: the one mark that says "fresh". */
export function Sparkle({ x, y, r, fill }: { x: number; y: number; r: number; fill: string }) {
  const k = r * 0.28;
  return (
    <Path
      d={`M ${x} ${y - r} Q ${x + k} ${y - k} ${x + r} ${y} Q ${x + k} ${y + k} ${x} ${y + r} Q ${x - k} ${y + k} ${x - r} ${y} Q ${x - k} ${y - k} ${x} ${y - r} Z`}
      fill={fill}
    />
  );
}

/** One flat folded garment: body, a shaded fore-edge, a highlight on top. */
export function Folded({
  x,
  y,
  w,
  h,
  fill,
  ink,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  ink: string;
}) {
  return (
    <G>
      <Rect x={x} y={y} width={w} height={h} rx={h * 0.45} fill={fill} stroke={ink} {...LINE} />
      <Path
        d={`M ${x + 3} ${y + h - 2.4} H ${x + w - 3}`}
        stroke={mixTone(fill, -0.25)}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d={`M ${x + 5} ${y + 2.6} H ${x + w * 0.45}`}
        stroke="#FFFFFF"
        strokeOpacity={0.7}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </G>
  );
}

/** A stroke drawn twice — ink under, colour over — for handles, rails and frames. */
export function InkedStroke({ d, color, ink, width }: { d: string; color: string; ink: string; width: number }) {
  return (
    <G>
      <Path d={d} stroke={ink} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <Path d={d} stroke={color} strokeWidth={width - 2.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </G>
  );
}
