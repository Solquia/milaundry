/**
 * The object on a service card, drawn to look like the cut-out product
 * photographs on a laundry's price board.
 *
 * The subjects are the board's own: a tall pile of folded shirts with a few
 * flowers on top, an iron standing on its heel on the pressed stack, a black
 * garment bag on its hanger, a patterned throw folded in front of a pillow,
 * a hiking trainer, an armchair for sofa and mattress work. Each is lit the
 * way a studio lights a product (`photo-kit`) — its own colours ramped from a
 * lit crown into a deep core, a warm lamp side and a cool far side, a hard
 * highlight on the leading edge, contact shadow under every layer.
 *
 * Every object sits whole inside the square and touches its foot, so the
 * card can let it run off the corner the way the board's photographs do,
 * and a door or a well can still show it entire.
 */
import React from 'react';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

import {
  mixTone,
  scenePalette,
  type SceneKey,
  type ScenePalette,
  type SceneSurface,
} from '@/lib/domain/service-scene';
import { COLORWAYS, type Colorway, type ColorwayKey } from '@/lib/domain/service-look';

import { CHROME, CLOTH, Fold, GLOSS, RampGradient, SharedLight, type Weave } from './photo-kit';

interface Art {
  palette: ScenePalette;
  /** Unique per scene, colorway and surface: SVG ids share one namespace per document. */
  id: string;
  /** A sibling's dyes, or null for the house colours the drawing was made in. */
  wear: Colorway | null;
}

/** A pile re-dyed in a colorway, keeping every garment where it lies and how it is woven. */
function dyed(pile: readonly Layer[], wear: Colorway | null): readonly Layer[] {
  if (!wear) return pile;
  return pile.map((layer, i) => ({ ...layer, colour: wear.dyes[i % wear.dyes.length] }));
}

/** A garment in a pile: its dye, where it sits, and what it is woven as. */
interface Layer {
  colour: string;
  x: number;
  y: number;
  w: number;
  weave: Weave;
}

/** Paints a pile bottom-up, each garment its own gradient. */
function Pile({ id, layers, h }: { id: string; layers: readonly Layer[]; h: number }) {
  return (
    <G>
      <Defs>
        {layers.map((layer, i) => (
          <RampGradient key={i} id={`${id}-l${i}`} colour={layer.colour} ramp={CLOTH} />
        ))}
      </Defs>
      {layers.map((layer, i) => (
        <Fold
          key={i}
          id={id}
          x={layer.x}
          y={layer.y}
          w={layer.w}
          h={h}
          fill={`url(#${id}-l${i})`}
          weave={layer.weave}
          hasSeam={i > 0}
        />
      ))}
    </G>
  );
}

/** Folded shirts and knits, bottom to top, in the muted-bright dyes of real washing. */
const SHIRT_PILE: readonly Layer[] = [
  { colour: '#E07A3A', x: 8, y: 93, w: 86, weave: 'plain' },
  { colour: '#C94B4B', x: 10, y: 87, w: 84, weave: 'rib' },
  { colour: '#4F86D8', x: 7, y: 81, w: 88, weave: 'stitch' },
  { colour: '#27A3A0', x: 11, y: 75, w: 82, weave: 'plain' },
  { colour: '#2B3F66', x: 9, y: 69, w: 85, weave: 'stripe' },
  { colour: '#3E7CC9', x: 8, y: 63, w: 86, weave: 'rib' },
  { colour: '#2E8C9A', x: 12, y: 57, w: 80, weave: 'plain' },
  { colour: '#9AA3A8', x: 9, y: 51, w: 84, weave: 'stripe' },
  { colour: '#8A6A55', x: 10, y: 45, w: 83, weave: 'plain' },
];

/** A white carnation: a ruffled head and the shadow of its petals. */
function Carnation({ id, x, y, r }: { id: string; x: number; y: number; r: number }) {
  return (
    <G>
      <Circle cx={x} cy={y} r={r} fill={`url(#${id}-petal)`} />
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const px = x + Math.cos(rad) * r * 0.55;
        const py = y + Math.sin(rad) * r * 0.55;
        return (
          <Path
            key={deg}
            d={`M ${px - r * 0.3} ${py} Q ${px} ${py + r * 0.28} ${px + r * 0.3} ${py}`}
            stroke="#8E97A3"
            strokeOpacity={0.45}
            strokeWidth={0.6}
            fill="none"
          />
        );
      })}
    </G>
  );
}

/** Wash & fold: a tall pile of folded shirts with a few carnations laid on top. */
function Stack({ id, wear }: Art) {
  const pile = dyed(SHIRT_PILE, wear);
  const brown = pile[pile.length - 1].colour;
  return (
    <G>
      <Defs>
        <LinearGradient id={`${id}-lid`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={mixTone(brown, 0.42)} />
          <Stop offset="1" stopColor={mixTone(brown, 0.12)} />
        </LinearGradient>
        <RadialGradient id={`${id}-petal`} cx="0.4" cy="0.35" r="0.7">
          <Stop offset="0" stopColor="#FFFFFF" />
          <Stop offset="0.7" stopColor="#F1F3F6" />
          <Stop offset="1" stopColor="#C7CDD5" />
        </RadialGradient>
        <RampGradient id={`${id}-leaf`} colour="#4E9A48" ramp={GLOSS} />
      </Defs>

      <Pile id={id} layers={pile} h={6.2} />
      {/* The top shirt's face, catching the lamp. */}
      <Path d="M 15 39.8 Q 51 38.4 87 39.8 C 92 40.4 94 42.8 92.4 45.4 L 11.6 45.4 C 10 42.8 11.4 40.4 15 39.8 Z" fill={`url(#${id}-lid)`} />
      <Path d="M 24 42.6 C 34 41.4 42 43.6 52 42.2" stroke="#FFFFFF" strokeOpacity={0.4} strokeWidth={1} strokeLinecap="round" fill="none" />
      <Fold id={id} x={10} y={45} w={83} h={6.2} fill={`url(#${id}-l${pile.length - 1})`} hasSeam={false} />

      {/* Flowers laid across the top right corner. */}
      <Ellipse cx={70} cy={40} rx={9} ry={2.4} fill="#0B1422" opacity={0.18} />
      <Path d="M 62 38 C 68 30 76 30 80 34 C 74 34 68 36 62 38 Z" fill={`url(#${id}-leaf)`} />
      <Path d="M 86 37 C 90 30 96 30 97 33 C 94 34 90 36 86 37 Z" fill={`url(#${id}-leaf)`} />
      <Carnation id={id} x={72} y={31} r={6} />
      <Carnation id={id} x={84} y={29} r={5.4} />
      <Carnation id={id} x={79} y={36.5} r={4.6} />
    </G>
  );
}

/** Pressed clothes under the iron, bottom to top. */
const PRESSED_PILE: readonly Layer[] = [
  { colour: '#C9383A', x: 12, y: 95, w: 82, weave: 'plain' },
  { colour: '#1FA6A0', x: 10, y: 90.4, w: 86, weave: 'plain' },
  { colour: '#F2B233', x: 14, y: 85.8, w: 80, weave: 'plain' },
  { colour: '#2F6ED6', x: 11, y: 81.2, w: 84, weave: 'plain' },
  { colour: '#D8403A', x: 15, y: 76.6, w: 78, weave: 'plain' },
  { colour: '#2E9E4F', x: 13, y: 72, w: 80, weave: 'plain' },
];

/**
 * Wash & iron: an iron stood up on its heel on the pressed stack, the
 * soleplate to the left and the nose up, as the board shows it.
 *
 * Drawn in profile (nose right, plate down) and turned: the profile's
 * proportions are what keep it an iron and not a kettle.
 */
function Iron({ palette, id, wear }: Art) {
  const body = 'M 24 70 C 24 60 28 55 38 55 L 70 55 C 82 55 90 61 94 69 C 94.8 70 93 70 90 70 z';
  const shell = 'M 60 55 L 70 55 C 82 55 90 61 94 69 C 94.8 70 93 70 90 70 L 72 70 C 71 63 67 58 60 55 z';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-plate`} colour="#B8C2CE" ramp={CHROME} />
        <RampGradient id={`${id}-body`} colour="#D5DCE3" ramp={GLOSS} />
        <RampGradient id={`${id}-shell`} colour={wear?.accent ?? palette.accent} ramp={GLOSS} />
        <RampGradient id={`${id}-grip`} colour="#59636F" ramp={GLOSS} />
      </Defs>

      <Pile id={id} layers={dyed(PRESSED_PILE, wear)} h={5} />
      <Ellipse cx={50} cy={72.4} rx={14} ry={2} fill="#0B1422" opacity={0.3} />

      {/* Stood on its heel: new x = tx − 0.8y, new y = ty − 0.8x, tipped a little. */}
      <G transform="rotate(7 50 44) matrix(0 -0.8 -0.8 0 101 90)">
        <Path d="M 20 70 L 86 70 C 98 70 106 73 106 75.5 C 106 78 98 80 86 80 L 26 80 C 21 80 20 77 20 74 z" fill={`url(#${id}-plate)`} />
        <Path d={body} fill={`url(#${id}-body)`} />
        <Path d={shell} fill={`url(#${id}-shell)`} />
        <Path d={body} fill={`url(#${id}-side)`} />
        <Path d="M 34 57 L 70 57 C 79 57 86 61 90 66" stroke="#FFFFFF" strokeOpacity={0.7} strokeWidth={1.4} strokeLinecap="round" fill="none" />
        <Path d="M 32 56 C 32 46 42 43 56 43 C 70 43 78 46 80 55" stroke={`url(#${id}-grip)`} strokeWidth={7.5} strokeLinecap="round" fill="none" />
        <Path d="M 34.5 53 C 35.5 47.5 44 45 55 45" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.6} strokeLinecap="round" fill="none" />
        <Circle cx={36} cy={64} r={3.4} fill={`url(#${id}-grip)`} />
        <Path d="M 30 67 C 30 62 32.5 59.5 37 59.5 L 50 59.5" stroke="#7FD3F5" strokeOpacity={0.6} strokeWidth={2} fill="none" />
      </G>
    </G>
  );
}

/** Dry clean: a black garment bag on its hanger, the nylon catching light in its folds. */
function Suit({ id, wear }: Art) {
  const bag =
    'M 60 13 L 84 25 C 88 27 90 30 90 34 L 92 95 C 92 98 90.5 100 88 100 H 32 C 29.5 100 28 98 28 95 L 30 34 C 30 30 32 27 36 25 Z';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-nylon`} colour={wear?.cloth ?? '#2E323A'} ramp={CLOTH} />
        <RampGradient id={`${id}-hook`} colour="#B8C2CE" ramp={CHROME} isAcross />
      </Defs>
      <Path d="M 60 14 V 7 A 4 4 0 1 1 64 11" stroke={`url(#${id}-hook)`} strokeWidth={2.2} strokeLinecap="round" fill="none" />
      <Path d={bag} fill={`url(#${id}-nylon)`} />
      {/* Folds in the nylon: a lit crest beside a dark trough, over and over. */}
      {[
        'M 38 34 C 42 52 38 72 42 96',
        'M 50 30 C 52 46 48 62 52 80',
        'M 72 30 C 76 50 72 70 78 96',
        'M 84 34 C 86 54 84 74 88 96',
      ].map((d, i) => (
        <G key={d}>
          <Path d={d} stroke="#FFFFFF" strokeOpacity={i % 2 ? 0.1 : 0.2} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path d={d} stroke="#000000" strokeOpacity={0.35} strokeWidth={1.4} strokeLinecap="round" fill="none" transform="translate(2.4 0)" />
        </G>
      ))}
      {/* The shoulders, pulled taut over the hanger. */}
      <Path d="M 36 26 L 60 14.5 L 84 26" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* The zip, running down off-centre, and its pull. */}
      <Path d="M 58 18 C 57 46 60 70 56 98" stroke="#15171B" strokeWidth={2} fill="none" />
      <Path d="M 58 18 C 57 46 60 70 56 98" stroke="#AEB6BF" strokeWidth={0.8} strokeDasharray={[0.8, 1]} fill="none" />
      <Rect x={56} y={40} width={4} height={7} rx={1.4} fill={`url(#${id}-hook)`} />
      <Path d={bag} fill={`url(#${id}-side)`} />
    </G>
  );
}

/** Beddings: a patterned throw folded in front of a matching pillow. */
function Bed({ id, wear }: Art) {
  const pillow = 'M 42 30 C 58 24 84 24 94 30 C 99 34 99 52 94 58 C 82 64 56 64 44 58 C 38 54 37 36 42 30 Z';
  const throwCloth = 'M 6 64 C 6 57 11 54 18 54 H 88 C 95 54 98 58 98 64 V 92 C 98 97 95 100 90 100 H 14 C 9 100 6 97 6 92 Z';
  const drape = 'M 6 64 C 20 60 40 62 60 66 C 72 68 86 66 98 62 V 71 C 84 77 60 75 40 73 C 24 71 12 73 6 77 Z';
  const lattice = '#F6EFE5';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-pillow`} colour={wear ? mixTone(wear.cloth, 0.3) : '#D8CBBB'} ramp={CLOTH} />
        <RampGradient id={`${id}-throw`} colour={wear?.cloth ?? '#C4B39E'} ramp={CLOTH} />
        <RampGradient id={`${id}-drape`} colour={wear ? mixTone(wear.cloth, 0.12) : '#CDBDA9'} ramp={CLOTH} />
      </Defs>

      <Path d={pillow} fill={`url(#${id}-pillow)`} />
      {[46, 60, 74].map((x) => (
        <G key={x}>
          <Path d={`M ${x} 30 L ${x + 14} 58`} stroke={lattice} strokeOpacity={0.6} strokeWidth={0.9} />
          <Path d={`M ${x + 14} 30 L ${x} 58`} stroke={lattice} strokeOpacity={0.6} strokeWidth={0.9} />
        </G>
      ))}
      <Path d={pillow} fill={`url(#${id}-side)`} />
      <Path d="M 46 31 C 60 27 80 27 90 30" stroke={`url(#${id}-spec)`} strokeWidth={1.4} strokeLinecap="round" fill="none" />

      <Rect x={8} y={52} width={88} height={5} rx={2.5} fill={`url(#${id}-seam)`} />
      <Path d={throwCloth} fill={`url(#${id}-throw)`} />
      {[10, 28, 46, 64].map((x) => (
        <G key={x}>
          <Path d={`M ${x} 56 L ${x + 18} 98`} stroke={lattice} strokeOpacity={0.55} strokeWidth={0.9} />
          <Path d={`M ${x + 18} 56 L ${x} 98`} stroke={lattice} strokeOpacity={0.55} strokeWidth={0.9} />
        </G>
      ))}
      {/* The plies at the fold on the left edge. */}
      {[80, 86, 92].map((y) => (
        <Path key={y} d={`M 6.5 ${y} C 12 ${y - 2} 18 ${y - 2} 24 ${y - 1}`} stroke="#6E5E4B" strokeOpacity={0.35} strokeWidth={1} strokeLinecap="round" fill="none" />
      ))}
      <Path d={throwCloth} fill={`url(#${id}-side)`} />
      {/* A second ply draped over the front. */}
      <Path d="M 6 76 C 12 72 24 70 40 72 C 60 74 84 76 98 70 V 74 C 84 80 60 78 40 76 C 24 74 12 76 6 80 Z" fill={`url(#${id}-seam)`} />
      <Path d={drape} fill={`url(#${id}-drape)`} />
      <Path d="M 10 64 C 24 61 42 63 60 66.6" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.2} strokeLinecap="round" fill="none" />
    </G>
  );
}

/** Shoe cleaning: a grey hiking trainer, toe to the left, with orange accents. */
function Shoes({ palette, id, wear }: Art) {
  const upper = 'M 8 74 C 6 66 12 60 22 58 C 34 55 44 50 52 40 C 56 34 62 30 70 30 L 86 30 C 92 30 96 36 96 44 V 74 Z';
  const orange = wear?.accent ?? palette.accent;
  const overlay = '#2B2F35';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-mesh`} colour={wear ? mixTone(wear.cloth, -0.05) : '#7C858F'} ramp={CLOTH} />
        <RampGradient id={`${id}-over`} colour={overlay} ramp={GLOSS} />
        <RampGradient id={`${id}-mid`} colour="#C3C9D0" ramp={CLOTH} />
        <RampGradient id={`${id}-lug`} colour="#26292E" ramp={GLOSS} />
        <RampGradient id={`${id}-flash`} colour={orange} ramp={GLOSS} />
      </Defs>

      {/* The lugged outsole, then the midsole. */}
      <Path d="M 6 84 C 5 90 9 94 16 94 H 90 C 95 94 98 91 98 86 V 82 H 6 Z" fill={`url(#${id}-lug)`} />
      {Array.from({ length: 11 }, (_, i) => (
        <Rect key={i} x={12 + i * 7.6} y={92.5} width={4.6} height={3.4} rx={0.8} fill="#15171A" />
      ))}
      <Path d="M 5 80 C 5 74 10 72 18 72 H 92 C 96 72 98 76 98 80 V 86 H 6 Z" fill={`url(#${id}-mid)`} />
      <Path d="M 22 80 H 76" stroke={orange} strokeWidth={1.6} strokeLinecap="round" />

      {/* The mesh upper, its weave as a fine dot. */}
      <Path d={upper} fill={`url(#${id}-mesh)`} />
      {[42, 48, 54, 60, 66].map((y) => (
        <Path key={y} d={`M ${y < 50 ? 50 : 26} ${y} H 84`} stroke="#FFFFFF" strokeOpacity={0.14} strokeWidth={1.1} strokeDasharray={[0.4, 1.6]} strokeLinecap="round" />
      ))}
      {/* Black overlays: the toe guard, a swoop through the midfoot, the heel counter. */}
      <Path d="M 8 74 C 6 66 12 60 22 58 C 27 61 29 67 27 74 Z" fill={`url(#${id}-over)`} />
      <Path d="M 30 74 C 40 62 56 60 70 46 C 73 53 73 64 67 74 Z" fill={`url(#${id}-over)`} />
      <Path d="M 84 30 C 92 30 96 36 96 44 V 74 H 80 C 84 60 85 44 84 30 Z" fill={`url(#${id}-over)`} />
      {/* The laces and eyelets, and the orange at the tongue and heel. */}
      {[0, 1, 2, 3].map((i) => (
        <G key={i}>
          <Path d={`M ${52 + i * 5} ${44 - i * 3} L ${58 + i * 5} ${48 - i * 3}`} stroke={orange} strokeWidth={1.8} strokeLinecap="round" />
          <Circle cx={58 + i * 5} cy={48 - i * 3} r={1} fill="#D9DDE2" />
        </G>
      ))}
      <Path d="M 68 30 C 70 24 78 22 82 26 L 82 30 Z" fill={`url(#${id}-flash)`} />
      <Path d="M 90 27 L 97 30 L 95 39 L 89 35 Z" fill={`url(#${id}-flash)`} />
      <Path d={upper} fill={`url(#${id}-side)`} />
      <Path d="M 14 62 C 24 58 36 55 46 48" stroke={`url(#${id}-spec)`} strokeWidth={1.4} strokeLinecap="round" fill="none" />
      <Path d="M 8 73.4 H 96" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={0.8} />
    </G>
  );
}

/** Sofa & mattress: an upholstered armchair in camel fabric, on turned wooden legs. */
function Sofa({ palette, id, wear }: Art) {
  const fabric = wear?.cloth ?? palette.base;
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-back`} colour={fabric} ramp={CLOTH} />
        <RampGradient id={`${id}-seat`} colour={mixTone(fabric, 0.1)} ramp={CLOTH} />
        <RampGradient id={`${id}-far`} colour={mixTone(fabric, -0.18)} ramp={CLOTH} />
        <RampGradient id={`${id}-skirt`} colour={mixTone(fabric, -0.1)} ramp={CLOTH} />
        <RampGradient id={`${id}-wood`} colour="#8A5A34" ramp={GLOSS} />
      </Defs>

      {/* Legs first: the chair stands on them. */}
      {[
        'M 12 90 L 13.4 100 H 17 L 18.4 90 Z',
        'M 28 88 L 29 98 H 32 L 33 88 Z',
        'M 84 86 L 85 95 H 88 L 89 86 Z',
      ].map((d) => (
        <Path key={d} d={d} fill={`url(#${id}-wood)`} />
      ))}
      {/* The back, the far arm, the seat cushion, the skirt, then the near arm. */}
      <Path d="M 26 20 C 26 12 32 8 42 8 H 78 C 88 8 94 12 94 20 V 60 H 26 Z" fill={`url(#${id}-back)`} />
      <Path d="M 32 14 C 44 11 66 11 82 13" stroke={`url(#${id}-spec)`} strokeWidth={1.6} strokeLinecap="round" fill="none" />
      <Path d="M 60 12 C 58 28 60 44 58 58" stroke="#3E2A16" strokeOpacity={0.14} strokeWidth={1.4} fill="none" />
      <Path d="M 80 36 C 80 30 84 28 88 28 C 93 28 96 32 96 38 V 84 H 80 Z" fill={`url(#${id}-far)`} />
      <Rect x={22} y={56} width={70} height={5} rx={2.5} fill={`url(#${id}-seam)`} />
      <Path d="M 24 58 C 24 54 28 52 34 52 H 86 C 90 52 92 55 92 58 V 70 H 24 Z" fill={`url(#${id}-seat)`} />
      <Path d="M 30 54.6 H 86" stroke="#FFFFFF" strokeOpacity={0.45} strokeWidth={1.2} strokeLinecap="round" />
      <Path d="M 24 68 H 92 V 84 C 92 86.5 90.5 88 88 88 H 26 C 24.5 88 24 86.5 24 84 Z" fill={`url(#${id}-skirt)`} />
      <Path d="M 24 69.4 H 92" stroke="#3E2A16" strokeOpacity={0.25} strokeWidth={1} />
      <Path d="M 6 44 C 6 36 12 32 20 32 C 28 32 34 38 34 46 V 86 C 34 90 31 92 27 92 H 13 C 9 92 6 90 6 86 Z" fill={`url(#${id}-back)`} />
      <Path d="M 6 44 C 6 36 12 32 20 32 C 28 32 34 38 34 46 V 86 C 34 90 31 92 27 92 H 13 C 9 92 6 90 6 86 Z" fill={`url(#${id}-side)`} />
      <Path d="M 10 40 C 12 36 16 34.4 21 34.4" stroke={`url(#${id}-spec)`} strokeWidth={1.8} strokeLinecap="round" fill="none" />
      {/* The piping along the arm's face. */}
      <Path d="M 9 46 C 10 40 14 37 20 37 C 26 37 30 41 31 46 V 88" stroke="#3E2A16" strokeOpacity={0.22} strokeWidth={1} fill="none" />
    </G>
  );
}

/** A machine's dyes: the wash seen tumbling through the door. */
const WASH_DYES = { coral: '#F2554E', sun: '#FFC233', teal: '#14BE9C' } as const;

/** Self-service: a glossy front-loader mid-cycle, the wash turning behind the glass. */
function Machine({ palette, id, wear }: Art) {
  const [coral, sun, teal] = wear ? wear.dyes : [WASH_DYES.coral, WASH_DYES.sun, WASH_DYES.teal];
  const shell = 'M 20 16 C 20 11 23 9 28 9 L 72 9 C 77 9 80 11 80 16 L 80 94 C 80 98 77 100 72 100 L 28 100 C 23 100 20 98 20 94 z';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-shell`} colour="#EEF2F6" ramp={GLOSS} />
        <RampGradient id={`${id}-ring`} colour="#B8C2CE" ramp={CHROME} />
        <RadialGradient id={`${id}-drum`} cx="0.42" cy="0.36" r="0.7">
          <Stop offset="0" stopColor="#5C7187" />
          <Stop offset="1" stopColor="#152131" />
        </RadialGradient>
        <RampGradient id={`${id}-water`} colour={palette.accent} ramp={GLOSS} />
      </Defs>

      <Path d={shell} fill={`url(#${id}-shell)`} />
      <Path d={shell} fill={`url(#${id}-side)`} />
      <Path d="M 23 24 L 77 24" stroke="#0B1422" strokeOpacity={0.14} strokeWidth={1.2} />
      <Rect x={27} y={13} width={20} height={6.5} rx={1.6} fill="#10202E" />
      <Rect x={29} y={15} width={9} height={2.4} rx={0.8} fill="#3FD2FF" opacity={0.9} />
      <Circle cx={69} cy={16.5} r={4.4} fill={`url(#${id}-ring)`} />
      <Circle cx={69} cy={16.5} r={2.2} fill="#2C3845" />

      <Circle cx={50} cy={60} r={26} fill={`url(#${id}-ring)`} />
      <Circle cx={50} cy={60} r={21.6} fill="#1D2733" />
      <Circle cx={50} cy={60} r={19.4} fill={`url(#${id}-drum)`} />
      <Ellipse cx={41} cy={55} rx={8} ry={5.5} fill={coral} transform="rotate(-24 41 55)" />
      <Ellipse cx={56} cy={52} rx={7} ry={4.6} fill={sun} transform="rotate(18 56 52)" />
      <Ellipse cx={52} cy={63} rx={9} ry={4.6} fill={teal} transform="rotate(-8 52 63)" />
      <Path d="M 31 65 C 37 59 43 70 51 64 C 57 59 63 68 69 64 L 69 68 C 69 77 60 79 50 79 C 40 79 31 77 31 68 z" fill={`url(#${id}-water)`} opacity={0.82} />
      <Path d="M 35 51 C 40 43.5 56 42 63.5 47" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      <Path d="M 28 10.6 L 72 10.6" stroke={`url(#${id}-spec)`} strokeWidth={1.2} strokeLinecap="round" />
    </G>
  );
}

/** Other services: a wicker basket with the wash heaped over the rim. */
function Basket({ palette, id, wear }: Art) {
  const vessel = 'M 16 56 L 84 56 L 76 96 C 75 99 72 100 68 100 L 32 100 C 28 100 25 99 24 96 z';
  const wicker = '#D69C55';
  return (
    <G>
      <Defs>
        <RampGradient id={`${id}-wicker`} colour={wicker} ramp={CLOTH} />
        <RampGradient id={`${id}-rim`} colour={mixTone(wicker, -0.08)} ramp={GLOSS} />
        <RampGradient id={`${id}-towel`} colour="#F1F4F8" ramp={CLOTH} />
        <RampGradient id={`${id}-shirt`} colour={wear?.dyes[0] ?? palette.accent} ramp={CLOTH} />
        <RampGradient id={`${id}-denim`} colour={wear?.dyes[1] ?? '#2F6ED6'} ramp={CLOTH} />
      </Defs>

      <Path d="M 20 56 C 19 44 29 36 40 38 C 47 30 61 31 66 38 C 77 36 84 45 81 56 Z" fill={`url(#${id}-towel)`} />
      <Path d="M 46 56 C 45 45 53 37 63 39 C 73 40 79 48 77 56 Z" fill={`url(#${id}-shirt)`} />
      <Path d="M 22 56 C 21 47 28 41 36 42 C 44 43 48 50 45 56 Z" fill={`url(#${id}-denim)`} />
      <Path d={vessel} fill={`url(#${id}-wicker)`} />
      {[63, 70, 77, 84, 91].map((y) => {
        const inset = (y - 56) * 0.2;
        return (
          <G key={y}>
            <Path d={`M ${17 + inset} ${y} L ${83 - inset} ${y}`} stroke="#0B1422" strokeOpacity={0.24} strokeWidth={1} />
            <Path d={`M ${17.5 + inset} ${y - 2.6} L ${82.5 - inset} ${y - 2.6}`} stroke="#FFFFFF" strokeOpacity={0.28} strokeWidth={1.8} />
          </G>
        );
      })}
      <Path d={vessel} fill={`url(#${id}-side)`} />
      <Rect x={12} y={52} width={76} height={6.5} rx={3.2} fill={`url(#${id}-rim)`} />
      <Path d="M 15 53.6 L 85 53.6" stroke={`url(#${id}-spec)`} strokeWidth={1.2} strokeLinecap="round" />
    </G>
  );
}

/** Curtains: a velvet panel on a brass rail, the folds carrying the light. */
function Curtain({ palette, id, wear }: Art) {
  const panel = 'M 16 16 L 84 16 L 88 90 C 88 95 83 97 76 95 C 64 91 52 97 40 95 C 28 93 18 97 13 93 z';
  const velvet = wear?.cloth ?? palette.accent;
  const folds = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1];
  return (
    <G>
      <Defs>
        <LinearGradient id={`${id}-folds`} x1="0" y1="0" x2="1" y2="0">
          {folds.map((offset, i) => (
            <Stop key={offset} offset={String(offset)} stopColor={mixTone(velvet, i % 2 ? -0.34 : 0.26)} />
          ))}
        </LinearGradient>
        <LinearGradient id={`${id}-drop`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#0B1422" stopOpacity="0.35" />
          <Stop offset="0.18" stopColor="#0B1422" stopOpacity="0" />
          <Stop offset="0.8" stopColor="#0B1422" stopOpacity="0" />
          <Stop offset="1" stopColor="#0B1422" stopOpacity="0.28" />
        </LinearGradient>
        <RampGradient id={`${id}-brass`} colour="#D9A53B" ramp={CHROME} />
      </Defs>

      <Path d={panel} fill={`url(#${id}-folds)`} />
      <Path d={panel} fill={`url(#${id}-drop)`} />
      <Path d="M 14 72 C 34 77 66 77 86 72" stroke="#E8B64A" strokeWidth={3.4} strokeLinecap="round" fill="none" />
      <Circle cx={50} cy={75.6} r={3} fill="#E8B64A" />
      <Rect x={10} y={11} width={80} height={5} rx={2.5} fill={`url(#${id}-brass)`} />
      <Circle cx={9} cy={13.5} r={4.2} fill={`url(#${id}-brass)`} />
      <Circle cx={91} cy={13.5} r={4.2} fill={`url(#${id}-brass)`} />
    </G>
  );
}

const SCENES: Record<SceneKey, (art: Art) => React.JSX.Element> = {
  stack: Stack,
  iron: Iron,
  suit: Suit,
  bed: Bed,
  machine: Machine,
  basket: Basket,
  shoes: Shoes,
  curtain: Curtain,
  sofa: Sofa,
};

export function ServiceScene({
  scene,
  brand,
  surface = 'tile',
  colorway = 'mixed',
}: {
  scene: SceneKey;
  /** The category's colour: it tints the tile behind the object. */
  brand: string;
  /** A coloured tile, or standing on the white of the card. */
  surface?: SceneSurface;
  /** The dyes that tell this service from a sibling on the same drawing. */
  colorway?: ColorwayKey;
}) {
  const key = SCENES[scene] ? scene : 'basket';
  const Drawing = SCENES[key];
  // SVG ids live in one document-wide namespace, so two cards sharing an id
  // would share a gradient — the bug that once turned a green tile blue.
  const wear = colorway !== 'mixed' && COLORWAYS[colorway] ? COLORWAYS[colorway] : null;
  const id = `sc${key}${wear ? colorway : ''}${surface}`;

  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <SharedLight id={id} />
      </Defs>
      {surface === 'white' ? null : <Rect x={0} y={0} width={100} height={100} fill={mixTone(brand, 0.86)} />}
      <Drawing palette={scenePalette(key)} id={id} wear={wear} />
    </Svg>
  );
}
