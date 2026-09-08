/**
 * The object on a service card, drawn to look like a thing rather than a
 * diagram of one.
 *
 * The previous set was isometric boxes painted from the category's tone: one
 * hue, three flat faces, hard corners. It read as an instruction manual. These
 * are built the way an illustrator builds them instead — a silhouette in the
 * object's own colours, a vertical gradient standing in for the lamp above,
 * a lighter plane where the form turns up and a darker one where it turns
 * away, a highlight along the leading edge, and a soft pool underneath.
 *
 * Deliberately short of photographic. Every curve is a rounded path rather
 * than a traced outline, and the shading is two or three stops rather than a
 * continuous ramp, which keeps the object legible at 100px where a real
 * photograph would turn to mush.
 *
 * Colours come from `scenePalette`, so a stack of laundry is linen and cotton
 * while a washing machine is white steel with a dark glass door.
 */
import React from 'react';
import Svg, {
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  scenePalette,
  type ScenePalette,
  type SceneKey,
  type SceneSurface,
} from '@/lib/domain/service-scene';

interface Art {
  palette: ScenePalette;
  /** Unique per rendered scene: SVG ids share one namespace per document. */
  id: string;
}

/** A vertical two-stop gradient, the cheapest honest stand-in for a lamp above. */
function Lit({ id, from, to }: { id: string; from: string; to: string }) {
  return (
    <LinearGradient id={id} x1="0" y1="0" x2="0.25" y2="1">
      <Stop offset="0" stopColor={from} />
      <Stop offset="1" stopColor={to} />
    </LinearGradient>
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
  fill,
  edge,
  top,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  edge: string;
  top: string;
}) {
  const r = Math.min(5, h / 2);
  return (
    <G>
      {/* The body of the fold. */}
      <Path
        d={`M ${x + r} ${y} h ${w - r * 2} a ${r} ${r} 0 0 1 ${r} ${r} v ${h - r * 2} a ${r} ${r} 0 0 1 ${-r} ${r} h ${-(w - r * 2)} a ${r} ${r} 0 0 1 ${-r} ${-r} v ${-(h - r * 2)} a ${r} ${r} 0 0 1 ${r} ${-r} z`}
        fill={fill}
      />
      {/* The top plane, where the cloth turns up into the light. */}
      <Path
        d={`M ${x + r} ${y} h ${w - r * 2} a ${r} ${r} 0 0 1 ${r} ${r} v 1 H ${x} v -1 a ${r} ${r} 0 0 1 ${r} ${-r} z`}
        fill={top}
        opacity={0.9}
      />
      {/* The crease along the fore-edge — the mark that says "folded". */}
      <Path
        d={`M ${x + 3} ${y + h - r} h ${w - 6}`}
        stroke={edge}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.55}
      />
    </G>
  );
}

/** Wash & fold: a pile of laundry, each garment its own colour. */
function Stack({ palette, id }: Art) {
  const cloths = ['#2E86DE', '#E2574C', '#F2B233', '#3FBF9B', '#8E7CC3'];
  return (
    <G>
      {/* Linen at the bottom, colours above, so the pile has a base. */}
      <Fold x={26} y={78} w={68} h={13} fill={palette.base} edge={palette.deep} top={palette.light} />
      {cloths.map((colour, i) => {
        const inset = 3 + i * 2.5;
        return (
          <Fold
            key={colour}
            x={26 + inset}
            y={68 - i * 10}
            w={68 - inset * 2}
            h={11}
            fill={colour}
            edge="#0F1D2B"
            top={colour}
          />
        );
      })}
      {/* The topmost cloth catches the most light. */}
      <Path
        d={`M ${32} ${30} h 56 a 4 4 0 0 1 4 4 v 1 H 28 v -1 a 4 4 0 0 1 4 -4 z`}
        fill="#FFFFFF"
        opacity={0.35}
      />
    </G>
  );
}

/**
 * Wash & iron: an iron in strict profile, nose to the right.
 *
 * Two passes went wrong the same way and the cause was proportion, not
 * detail: a tall body under a high round handle is a kettle in any palette.
 * An iron is wide and low — roughly twice as wide as it is tall — and its
 * handle is a flat loop that hugs the body rather than arcing above it. The
 * plate is drawn clear of the laundry so the wedge is never interrupted.
 */
function Iron({ palette, id }: Art) {
  return (
    <G>
      {/* The laundry sits behind and below, clear of the plate. */}
      <Fold x={20} y={88} w={76} h={11} fill="#3FBF9B" edge="#0F1D2B" top="#3FBF9B" />
      <Fold x={26} y={79} w={64} h={10} fill="#E2574C" edge="#0F1D2B" top="#E2574C" />

      {/* The soleplate: long, flat, running to a point at the nose. */}
      <Path
        d="M 20 70 L 86 70 C 98 70 106 73 106 75.5 C 106 78 98 80 86 80 L 26 80 C 21 80 20 77 20 74 z"
        fill={palette.deep}
      />
      <Path
        d="M 20 70 L 86 70 C 97 70 104 72.5 105.5 74.5 C 99 72 91 71.5 82 71.5 L 20 71.5 z"
        fill={palette.shade}
      />

      {/* The body: low and wedge-shaped, tapering with the plate. */}
      <Path
        d="M 24 70 C 24 60 28 55 38 55 L 70 55 C 82 55 90 61 94 69 C 94.8 70 93 70 90 70 z"
        fill={`url(#${id}body)`}
      />
      {/* The vivid shell over the nose half. */}
      <Path
        d="M 60 55 L 70 55 C 82 55 90 61 94 69 C 94.8 70 93 70 90 70 L 72 70 C 71 63 67 58 60 55 z"
        fill={palette.accent}
      />
      {/* The handle: a flat loop hugging the body, not an arc above it. */}
      <Path
        d="M 32 56 C 32 46 42 43 56 43 C 70 43 78 46 80 55"
        stroke={palette.deep}
        strokeWidth={7.5}
        strokeLinecap="round"
        fill="none"
      />
      <Path
        d="M 34 54 C 35 48 44 45.5 55 45.5"
        stroke={palette.light}
        strokeWidth={2}
        strokeLinecap="round"
        opacity={0.5}
        fill="none"
      />
      {/* The temperature dial at the heel. */}
      <Ellipse cx={34} cy={64} rx={4} ry={4} fill={palette.deep} opacity={0.75} />

      {/* Steam off the nose. */}
      <Path
        d="M 102 64 c 6 -7 -3 -10 3 -17"
        stroke="#BFD8E8"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
        opacity={0.85}
      />
      <Path
        d="M 94 59 c 4 -5 -3 -8 1 -13"
        stroke="#BFD8E8"
        strokeWidth={2.4}
        strokeLinecap="round"
        fill="none"
        opacity={0.5}
      />
    </G>
  );
}

/**
 * Dry clean: a suit under a garment cover, on a hanger.
 *
 * The shoulders have to be *angular*. Rounded ones read as a bag however the
 * hem is shaped — that was the last two attempts. Straight diagonals from the
 * neck out to two shoulder points, then near-vertical sides to a wide hem, is
 * the coat-hanger silhouette nothing else shares.
 */
function Suit({ palette, id }: Art) {
  return (
    <G>
      {/* Hook and neck. */}
      <Path
        d="M 60 30 v -8 a 5.5 5.5 0 1 1 5.5 5.5"
        stroke={palette.shade}
        strokeWidth={2.8}
        strokeLinecap="round"
        fill="none"
      />
      {/* The cover: angular shoulders, then straight sides to a wide hem. */}
      <Path
        d="M 60 30 L 88 48 C 91 50 92 53 91.5 57 L 87 88 C 86.3 92 83 94 78 94 L 42 94 C 37 94 33.7 92 33 88 L 28.5 57 C 28 53 29 50 32 48 z"
        fill={`url(#${id}bag)`}
      />
      {/* The plane turning toward the lamp. */}
      <Path
        d="M 60 30 L 32 48 C 29 50 28 53 28.5 57 L 33 88 C 33.7 92 37 94 42 94 L 52 94 C 46 76 46 50 55 34 z"
        fill={palette.light}
        opacity={0.2}
      />
      {/* The hanger bar showing through the shoulder. */}
      <Path
        d="M 33 50 L 60 33 L 87 50"
        stroke={palette.deep}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.6}
        fill="none"
      />
      {/* The zip and its pull. */}
      <Path d="M 60 34 L 60 92" stroke={palette.deep} strokeWidth={2.2} opacity={0.9} />
      <Path d="M 60 34 L 60 92" stroke={palette.accent} strokeWidth={0.9} opacity={0.95} />
      <Ellipse cx={60} cy={68} rx={2.8} ry={3.6} fill={palette.accent} />
    </G>
  );
}

/**
 * Beddings: a folded duvet with a pillow on top.
 *
 * Folded fabric is read at its edge, not its face. The stack only stops
 * looking like pancakes once the layers show at the fold — so the left edge
 * carries three visible plies, and the pillow gets a corner rather than an
 * outline.
 */
function Bed({ palette, id }: Art) {
  return (
    <G>
      {/* The duvet: a deep slab, its fore-edge rolling over. */}
      <Path
        d="M 24 60 C 24 55 28 52 36 52 L 88 52 C 94 52 98 55 98 61 L 98 84 C 98 90 94 93 88 93 L 34 93 C 27 93 24 90 24 84 z"
        fill={`url(#${id}duvet)`}
      />
      {/* The plies at the fold: what makes it folded cloth and not a box. */}
      {[66, 74, 82].map((y) => (
        <Path
          key={y}
          d={`M 24 ${y} C 34 ${y - 3} 44 ${y - 3} 52 ${y - 1}`}
          stroke={palette.shade}
          strokeWidth={2.4}
          strokeLinecap="round"
          opacity={0.55}
          fill="none"
        />
      ))}
      {/* The lit roll along the top edge. */}
      <Path
        d="M 24 60 C 24 55 28 52 36 52 L 88 52 C 94 52 98 55 98 61 C 88 56 70 55 58 56 C 42 57 30 58 24 60 z"
        fill={palette.light}
      />
      {/* A woven band across the duvet, the warm note. */}
      <Path
        d="M 26 78 C 44 74 72 74 97 78"
        stroke={palette.accent}
        strokeWidth={3.4}
        strokeLinecap="round"
        opacity={0.8}
        fill="none"
      />
      {/* The pillow, with a corner turned so it has volume. */}
      <Path
        d="M 36 30 C 46 25 68 24 78 29 C 86 33 86 44 78 48 C 67 53 44 53 36 48 C 29 44 29 34 36 30 z"
        fill={`url(#${id}pillow)`}
      />
      <Path
        d="M 78 29 C 86 33 86 44 78 48 C 80 41 80 36 78 29 z"
        fill={palette.shade}
        opacity={0.45}
      />
      <Path
        d="M 39 32 C 48 28 66 27 75 30"
        stroke="#FFFFFF"
        strokeWidth={2.6}
        strokeLinecap="round"
        opacity={0.7}
        fill="none"
      />
    </G>
  );
}

/** Self-service: a front-loader mid-cycle, water behind the glass. */
function Machine({ palette, id }: Art) {
  return (
    <G>
      <Path
        d="M 30 24 C 30 19 33 17 38 17 L 82 17 C 87 17 90 19 90 24 L 90 92 C 90 97 87 99 82 99 L 38 99 C 33 99 30 97 30 92 z"
        fill={`url(#${id}shell)`}
      />
      {/* The lit left edge. */}
      <Path
        d="M 30 24 C 30 19 33 17 38 17 L 46 17 L 46 99 L 38 99 C 33 99 30 97 30 92 z"
        fill={palette.light}
        opacity={0.55}
      />
      {/* The control panel and its dial. */}
      <Path d="M 34 31 L 86 31" stroke={palette.shade} strokeWidth={1.4} opacity={0.7} />
      <Ellipse cx={79} cy={25} rx={4} ry={4} fill={palette.deep} />
      <Ellipse cx={79} cy={25} rx={1.6} ry={1.6} fill={palette.accent} />
      <Rect x={37} y={22} width={22} height={5} rx={2.5} fill={palette.shade} opacity={0.55} />
      {/* The door: a dark ring, then glass with the wash turning behind it. */}
      <Ellipse cx={60} cy={62} rx={26} ry={26} fill={palette.deep} />
      <Ellipse cx={60} cy={62} rx={22} ry={22} fill={palette.shade} opacity={0.5} />
      <Ellipse cx={60} cy={62} rx={19} ry={19} fill={`url(#${id}glass)`} />
      {/* Water and suds inside, tilted the way a drum throws them. */}
      <Path
        d="M 42 66 C 48 60 54 72 62 66 C 68 61 74 70 79 66 L 79 70 C 79 79 70 81 60 81 C 50 81 42 79 42 70 z"
        fill={palette.accent}
        opacity={0.75}
      />
      <Ellipse cx={52} cy={56} rx={4} ry={4} fill="#FFFFFF" opacity={0.75} />
      <Ellipse cx={66} cy={51} rx={2.6} ry={2.6} fill="#FFFFFF" opacity={0.55} />
      {/* The highlight sweeping across the glass. */}
      <Path
        d="M 46 52 C 52 45 68 44 74 49"
        stroke="#FFFFFF"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.5}
        fill="none"
      />
    </G>
  );
}

/** Other services: a woven basket with the wash spilling over the rim. */
function Basket({ palette, id }: Art) {
  return (
    <G>
      {/* The wash first: the rim is drawn over its back. */}
      <Ellipse cx={54} cy={47} rx={19} ry={13} fill="#EDF1F6" />
      <Ellipse cx={70} cy={43} rx={13} ry={10} fill={palette.accent} opacity={0.9} />
      <Ellipse cx={45} cy={42} rx={11} ry={8} fill="#2E86DE" opacity={0.85} />
      {/* The basket: a tapered vessel, wider at the rim. */}
      <Path
        d="M 30 54 L 90 54 L 83 90 C 82 95 78 97 72 97 L 48 97 C 42 97 38 95 37 90 z"
        fill={`url(#${id}weave)`}
      />
      {/* The weave, in the basket's own shade so it reads as material. */}
      {[0.2, 0.4, 0.6, 0.8].map((t) => (
        <Path
          key={t}
          d={`M ${30 + 60 * t} 54 L ${37 + 46 * t} 97`}
          stroke={palette.deep}
          strokeWidth={1.2}
          opacity={0.3}
        />
      ))}
      {[64, 74, 84].map((y) => (
        <Path
          key={y}
          d={`M ${31 + (y - 54) * 0.19} ${y} L ${89 - (y - 54) * 0.19} ${y}`}
          stroke={palette.deep}
          strokeWidth={1.2}
          opacity={0.22}
        />
      ))}
      {/* The rim lip: the thickness that makes it an open vessel. */}
      <Path
        d="M 28 54 L 92 54 C 94 54 94 50 92 50 L 28 50 C 26 50 26 54 28 54 z"
        fill={palette.light}
      />
    </G>
  );
}

/** Shoe cleaning: a trainer in three-quarter view. */
function Shoes({ palette, id }: Art) {
  return (
    <G>
      {/* The sole: a thick slab curving up at the toe. */}
      <Path
        d="M 18 78 C 18 72 24 70 32 70 L 88 70 C 96 70 100 74 100 79 C 100 85 95 88 86 88 L 30 88 C 22 88 18 84 18 78 z"
        fill={palette.light}
      />
      <Path
        d="M 18 80 C 22 86 26 88 34 88 L 86 88 C 95 88 100 85 100 80 C 98 84 92 85 84 85 L 32 85 C 24 85 20 83 18 80 z"
        fill={palette.shade}
        opacity={0.6}
      />
      {/* The upper: heel high, sweeping down to the toe. */}
      <Path
        d="M 22 70 C 22 56 26 46 36 43 C 46 40 52 48 60 53 C 70 59 84 58 92 63 C 97 66 98 69 98 71 L 30 71 C 25 71 22 71 22 70 z"
        fill={`url(#${id}upper)`}
      />
      {/* The toe cap, in the flash colour. */}
      <Path
        d="M 78 60 C 86 60 95 64 98 70 L 76 70 C 74 66 75 62 78 60 z"
        fill={palette.accent}
      />
      {/* The collar and the swoosh of the lacing. */}
      <Path
        d="M 24 62 C 26 52 30 46 37 44"
        stroke={palette.deep}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {[0, 1, 2].map((i) => (
        <Path
          key={i}
          d={`M ${42 + i * 9} ${52 + i * 3.5} L ${50 + i * 9} ${60 + i * 2.5}`}
          stroke={palette.light}
          strokeWidth={2.4}
          strokeLinecap="round"
        />
      ))}
      <Path
        d="M 40 66 C 52 60 66 62 76 68"
        stroke={palette.accent}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
    </G>
  );
}

/** Curtains: a hanging panel, the folds carrying the light. */
function Curtain({ palette, id }: Art) {
  const folds = [30, 42, 54, 66, 78];
  return (
    <G>
      {/* The rail and its finials. */}
      <Rect x={22} y={20} width={76} height={5} rx={2.5} fill={palette.shade} />
      <Ellipse cx={22} cy={22.5} rx={4} ry={4} fill={palette.deep} />
      <Ellipse cx={98} cy={22.5} rx={4} ry={4} fill={palette.deep} />
      {/* The panel, hem swinging out at the foot. */}
      <Path
        d="M 26 25 L 94 25 L 97 86 C 97 90 92 92 86 90 C 74 86 62 92 50 90 C 38 88 28 92 24 88 z"
        fill={`url(#${id}cloth)`}
      />
      {/* Folds: alternating light and shade, which is all a fold is. */}
      {folds.map((x, i) => (
        <Path
          key={x}
          d={`M ${x} 26 C ${x + (i % 2 ? 4 : -4)} 50, ${x - (i % 2 ? 4 : -4)} 68, ${x + (i % 2 ? 2 : -2)} 89`}
          stroke={i % 2 ? palette.light : palette.shade}
          strokeWidth={7}
          strokeLinecap="round"
          opacity={i % 2 ? 0.55 : 0.4}
          fill="none"
        />
      ))}
      {/* A tie-back band, the one saturated note. */}
      <Path
        d="M 24 74 C 44 79 76 79 96 74"
        stroke={palette.accent}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
        opacity={0.9}
      />
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
};

/** Where each object meets the page, and how wide its pool spreads. */
const GROUND: Record<SceneKey, { cy: number; rx: number }> = {
  stack: { cy: 93, rx: 38 },
  iron: { cy: 94, rx: 36 },
  suit: { cy: 92, rx: 27 },
  bed: { cy: 93, rx: 39 },
  machine: { cy: 101, rx: 32 },
  basket: { cy: 98, rx: 28 },
  shoes: { cy: 90, rx: 42 },
  curtain: { cy: 92, rx: 38 },
};

export function ServiceScene({
  scene,
  brand,
  surface = 'tile',
}: {
  scene: SceneKey;
  brand: string;
  /** A coloured tile, or floating on the white of the card. */
  surface?: SceneSurface;
}) {
  const key = SCENES[scene] ? scene : 'basket';
  const Drawing = SCENES[key];
  const palette = scenePalette(key);
  const ground = GROUND[key];
  const isOnWhite = surface === 'white';
  // SVG ids live in one document-wide namespace, so two cards sharing an id
  // would share a gradient — the bug that once turned a green tile blue.
  const id = `sc${key}${surface}`;

  return (
    <Svg width="100%" height="100%" viewBox="10 8 100 100">
      <Defs>
        <Lit id={`${id}body`} from={palette.light} to={palette.shade} />
        <Lit id={`${id}bag`} from={palette.base} to={palette.deep} />
        <Lit id={`${id}duvet`} from={palette.base} to={palette.shade} />
        <Lit id={`${id}pillow`} from={palette.light} to={palette.base} />
        <Lit id={`${id}shell`} from={palette.light} to={palette.base} />
        <Lit id={`${id}weave`} from={palette.base} to={palette.shade} />
        <Lit id={`${id}upper`} from={palette.base} to={palette.deep} />
        <Lit id={`${id}cloth`} from={palette.light} to={palette.base} />
        <RadialGradient id={`${id}glass`} cx="0.4" cy="0.35" r="0.75">
          <Stop offset="0" stopColor={palette.shade} />
          <Stop offset="1" stopColor={palette.deep} />
        </RadialGradient>
        <RadialGradient id={`${id}pool`} cx="0.5" cy="0.5" r="0.5">
          <Stop offset="0" stopColor="#5C6674" stopOpacity="0.34" />
          <Stop offset="1" stopColor="#5C6674" stopOpacity="0" />
        </RadialGradient>
        <LinearGradient id={`${id}tile`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={brand} stopOpacity="0.16" />
          <Stop offset="1" stopColor={brand} stopOpacity="0.06" />
        </LinearGradient>
      </Defs>

      {isOnWhite ? null : (
        <Rect x="10" y="8" width="100" height="100" fill={`url(#${id}tile)`} />
      )}

      {/* The pool the object throws, soft-edged so it reads as light and not
          as a second object sitting under the first. */}
      <Ellipse cx={60} cy={ground.cy} rx={ground.rx} ry={ground.rx * 0.2} fill={`url(#${id}pool)`} />

      <Drawing palette={palette} id={id} />
    </Svg>
  );
}