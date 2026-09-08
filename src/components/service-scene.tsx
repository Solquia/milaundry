/**
 * The small world on a service tile.
 *
 * Each service gets a diorama rather than a glyph: an object built out of
 * boxes, drawn in 3/4 view, lit from the upper left, standing on a floor with
 * its own shadow. Every solid is projected through the same `iso` transform
 * and painted from `sceneFaces`, so eight different objects share one light
 * source and one hue and the price list reads as one set rather than eight
 * clip-arts.
 *
 * Circles on a face are walked and projected rather than drawn with a
 * transform — a washer door has to sit *in* the box's face, and a projected
 * polygon is the only way that is true at every size.
 */
import React from 'react';
import Svg, { Defs, Ellipse, LinearGradient, Path, Polygon, Rect, Stop } from 'react-native-svg';

import { sceneFaces, type SceneKey } from '@/lib/domain/service-scene';

const SIZE = 120;
/** cos 30 and sin 30: the 2:1 isometric the whole set is drawn on. */
const KX = 0.866;
const KY = 0.5;
/** Where world origin lands on the tile. The floor sits low, the object above it. */
const CX = 60;
const CY = 66;

type Point = readonly [number, number];

function iso(x: number, y: number, z: number): Point {
  return [CX + (x - y) * KX, CY + (x + y) * KY - z];
}

function poly(points: readonly Point[]): string {
  return points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

interface Box {
  top: string;
  left: string;
  right: string;
}

/** A solid at (x, y, z) of width w, depth d and height h, as its three lit faces. */
function box(x: number, y: number, z: number, w: number, d: number, h: number): Box {
  return {
    top: poly([iso(x, y, z + h), iso(x + w, y, z + h), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]),
    left: poly([iso(x, y + d, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x, y + d, z + h)]),
    right: poly([iso(x + w, y, z), iso(x + w, y + d, z), iso(x + w, y + d, z + h), iso(x + w, y, z + h)]),
  };
}

/** A circle lying in the plane of a box's right face, projected into the view. */
function discOnRight(x: number, y: number, z: number, r: number, steps = 28): string {
  const points: Point[] = [];
  for (let i = 0; i < steps; i += 1) {
    const angle = (i / steps) * Math.PI * 2;
    points.push(iso(x, y + Math.cos(angle) * r, z + Math.sin(angle) * r));
  }
  return poly(points);
}

/** The pool a solid throws on the floor, drawn as a flat iso diamond. */
function floorPatch(x: number, y: number, w: number, d: number): string {
  return poly([iso(x, y, 0), iso(x + w, y, 0), iso(x + w, y + d, 0), iso(x, y + d, 0)]);
}

type Faces = ReturnType<typeof sceneFaces>;

/**
 * Three faces plus a hairline along every edge. Without the line, two pale
 * faces of neighbouring solids meet and read as one mass — a made bed becomes
 * a lump. The line is the deep tile colour, so it looks like shadow in the
 * seam rather than like ink.
 */
function Solid({ shape, faces, opacity = 1 }: { shape: Box; faces: Faces; opacity?: number }) {
  const edge = { stroke: faces.skyFoot, strokeWidth: 1, strokeLinejoin: 'round' as const, opacity: opacity * 0.55 };
  return (
    <>
      <Polygon points={shape.right} fill={faces.right} opacity={opacity} />
      <Polygon points={shape.left} fill={faces.left} opacity={opacity} />
      <Polygon points={shape.top} fill={faces.top} opacity={opacity} />
      <Polygon points={shape.right} fill="none" {...edge} />
      <Polygon points={shape.left} fill="none" {...edge} />
      <Polygon points={shape.top} fill="none" {...edge} />
    </>
  );
}

/** A stack of folded laundry: three slabs, each turned a little off the one below. */
function Stack({ faces }: { faces: Faces }) {
  return (
    <>
      <Solid shape={box(-16, -16, 0, 32, 32, 9)} faces={faces} />
      <Solid shape={box(-14, -13, 9, 28, 27, 8)} faces={faces} />
      <Solid shape={box(-12, -15, 17, 25, 29, 7)} faces={faces} />
      {/* The crease down the middle of the top fold. */}
      <Path
        d={`M ${iso(-12, -1, 24).join(' ')} L ${iso(13, -1, 24).join(' ')}`}
        stroke={faces.left}
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </>
  );
}

/**
 * An iron resting on its board, steam rising off the plate.
 *
 * The iron is the subject, so it is drawn large and the board is kept lean
 * underneath it. The sole plate juts past the body toward the light, which is
 * the shape that says "iron" before any of the detail is read.
 */
function Iron({ faces }: { faces: Faces }) {
  return (
    <>
      {/* Legs, then the board: far parts first. */}
      <Solid shape={box(-4, -18, 0, 4, 4, 14)} faces={faces} opacity={0.8} />
      <Solid shape={box(-4, 14, 0, 4, 4, 14)} faces={faces} opacity={0.8} />
      <Solid shape={box(-15, -21, 14, 24, 42, 3)} faces={faces} opacity={0.95} />
      {/* The sole plate, wider than the body and running to a point. */}
      <Polygon
        points={poly([iso(-11, -10, 17), iso(9, -10, 17), iso(18, 0, 17), iso(9, 10, 17), iso(-11, 10, 17)])}
        fill={faces.top}
      />
      <Polygon
        points={poly([iso(-11, 10, 17), iso(9, 10, 17), iso(18, 0, 17), iso(18, 0, 19), iso(9, 10, 19), iso(-11, 10, 19)])}
        fill={faces.left}
      />
      {/* The body sitting on the plate. */}
      <Solid shape={box(-10, -8, 19, 17, 16, 9)} faces={faces} />
      {/* The handle, arcing over the body. */}
      <Path
        d={`M ${iso(-9, 0, 28).join(' ')} C ${iso(-9, 0, 40).join(' ')} ${iso(6, 0, 40).join(' ')} ${iso(6, 0, 28).join(' ')}`}
        stroke={faces.top}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      {/* Steam off the nose. */}
      <Path
        d={`M ${iso(17, 2, 22).join(' ')} c 3 -6 -4 -8 -1 -14`}
        stroke={faces.top}
        strokeWidth={2.2}
        strokeLinecap="round"
        fill="none"
        opacity={0.75}
      />
      <Path
        d={`M ${iso(19, -7, 25).join(' ')} c 3 -5 -3 -7 0 -11`}
        stroke={faces.top}
        strokeWidth={2}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
      />
    </>
  );
}

/**
 * A suit under a garment cover, on a hanger.
 *
 * A plain box said "parcel". The cover now narrows at the shoulder and widens
 * to the hem, which is the one silhouette nobody mistakes for a package, and
 * the hanger reads above it.
 */
function Suit({ faces }: { faces: Faces }) {
  const edge = { stroke: faces.skyFoot, strokeWidth: 1, strokeLinejoin: 'round' as const, opacity: 0.5 };
  // Shoulder half-width at the top, hem half-width at the foot.
  const s0 = 7;
  const s1 = 13;
  const zTop = 34;
  const left = poly([iso(-s1, s1, 0), iso(s1, s1, 0), iso(s0, s0, zTop), iso(-s0, s0, zTop)]);
  const right = poly([iso(s1, -s1, 0), iso(s1, s1, 0), iso(s0, s0, zTop), iso(s0, -s0, zTop)]);
  const top = poly([iso(-s0, -s0, zTop), iso(s0, -s0, zTop), iso(s0, s0, zTop), iso(-s0, s0, zTop)]);
  return (
    <>
      <Polygon points={right} fill={faces.right} />
      <Polygon points={left} fill={faces.left} />
      <Polygon points={top} fill={faces.top} />
      <Polygon points={right} fill="none" {...edge} />
      <Polygon points={left} fill="none" {...edge} />
      <Polygon points={top} fill="none" {...edge} />
      {/* The hanger: a bar across the shoulder and a hook above it. */}
      <Solid shape={box(-9, -2, 34, 18, 4, 2)} faces={faces} />
      <Path
        d={`M ${iso(0, 0, 36).join(' ')} L ${iso(0, 0, 44).join(' ')} c 0 -4 6 -4 6 0`}
        stroke={faces.top}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
      {/* The zip, straight down the lit face. */}
      <Path
        d={`M ${iso(-s0 + 1, s0, zTop - 2).join(' ')} L ${iso(-s1 + 1, s1, 2).join(' ')}`}
        stroke={faces.top}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.85}
      />
    </>
  );
}

/**
 * A bed made up: headboard, mattress, two pillows, and a duvet turned back
 * over the foot.
 *
 * Order is the whole trick. In this projection a solid with a larger x + y
 * sits nearer the viewer, so the parts are painted far to near — headboard,
 * mattress, pillows, duvet. Painted the other way the headboard lands in
 * front of the pillows and the bed reads as an open crate.
 */
function Bed({ faces }: { faces: Faces }) {
  return (
    <>
      <Solid shape={box(-26, -14, 0, 4, 28, 26)} faces={faces} />
      <Solid shape={box(-22, -14, 0, 44, 28, 8)} faces={faces} opacity={0.92} />
      <Solid shape={box(-20, -12, 8, 13, 11, 6)} faces={faces} />
      <Solid shape={box(-20, 1, 8, 13, 11, 6)} faces={faces} />
      <Solid shape={box(-6, -15, 8, 28, 30, 7)} faces={faces} />
      {/* The sheet turned back over the top of the duvet. */}
      <Polygon
        points={poly([iso(-6, -15, 15), iso(-6, 15, 15), iso(1, 15, 15), iso(1, -15, 15)])}
        fill={faces.left}
        opacity={0.55}
      />
    </>
  );
}

/** A front-loader mid-cycle, its door a circle sunk into the face. */
function Machine({ faces }: { faces: Faces }) {
  return (
    <>
      <Solid shape={box(-14, -14, 0, 28, 28, 32)} faces={faces} />
      {/* The door, walked around the right face so it sits in the plane. */}
      <Polygon points={discOnRight(14.1, 0, 16, 9.5)} fill={faces.right} opacity={0.55} />
      <Polygon points={discOnRight(14.2, 0, 16, 6.5)} fill={faces.top} opacity={0.9} />
      {/* The control strip along the top of the face. */}
      <Polygon
        points={poly([iso(14.1, -10, 27), iso(14.1, 10, 27), iso(14.1, 10, 29.5), iso(14.1, -10, 29.5)])}
        fill={faces.top}
        opacity={0.75}
      />
      {/* Suds coming off the top. */}
      <Ellipse cx={iso(-6, -6, 40)[0]} cy={iso(-6, -6, 40)[1]} rx={4} ry={4} fill={faces.top} opacity={0.5} />
      <Ellipse cx={iso(-2, -12, 46)[0]} cy={iso(-2, -12, 46)[1]} rx={2.6} ry={2.6} fill={faces.top} opacity={0.35} />
    </>
  );
}

/**
 * A slatted basket with a load spilling over the rim.
 *
 * The rim lip is what makes it a basket rather than a bin: an open vessel has
 * a visible thickness at the top, and the slats give the sides a material.
 */
function Basket({ faces }: { faces: Faces }) {
  const edge = { stroke: faces.skyFoot, strokeWidth: 1, strokeLinejoin: 'round' as const, opacity: 0.5 };
  const b = 12;
  const r = 16;
  const h = 21;
  const left = poly([iso(-b, b, 0), iso(b, b, 0), iso(r, r, h), iso(-r, r, h)]);
  const right = poly([iso(b, -b, 0), iso(b, b, 0), iso(r, r, h), iso(r, -r, h)]);
  return (
    <>
      {/* The load first: it sits inside, so the rim is drawn over its back. */}
      <Ellipse cx={iso(-3, -3, h + 3)[0]} cy={iso(-3, -3, h + 3)[1]} rx={12} ry={7.5} fill={faces.top} />
      <Ellipse cx={iso(5, 5, h + 6)[0]} cy={iso(5, 5, h + 6)[1]} rx={8} ry={5} fill={faces.left} opacity={0.9} />
      <Polygon points={right} fill={faces.right} />
      <Polygon points={left} fill={faces.left} />
      {/* Slats: evenly spaced down each side, in the face's own shade. */}
      {[0.25, 0.5, 0.75].map((t) => (
        <Path
          key={`l${t}`}
          d={`M ${iso(-b + 2 * b * t, b, 0).join(' ')} L ${iso(-r + 2 * r * t, r, h).join(' ')}`}
          stroke={faces.skyFoot}
          strokeWidth={1}
          opacity={0.35}
        />
      ))}
      {[0.25, 0.5, 0.75].map((t) => (
        <Path
          key={`r${t}`}
          d={`M ${iso(b, -b + 2 * b * t, 0).join(' ')} L ${iso(r, -r + 2 * r * t, h).join(' ')}`}
          stroke={faces.skyFoot}
          strokeWidth={1}
          opacity={0.35}
        />
      ))}
      <Polygon points={right} fill="none" {...edge} />
      <Polygon points={left} fill="none" {...edge} />
      {/* The rim lip, the thickness that makes it an open vessel. */}
      <Polygon
        points={poly([iso(-r, -r, h), iso(r, -r, h), iso(r, r, h), iso(-r, r, h)])}
        fill="none"
        stroke={faces.top}
        strokeWidth={3}
        strokeLinejoin="round"
      />
    </>
  );
}

/**
 * A pair of shoes, side by side, toes toward the light.
 *
 * Drawn as three parts each — a sole slab, an upper at the heel, and a wedge
 * tapering to the toe — because a shoe read as a single box is just a box. The
 * far shoe is painted first so the near one overlaps it.
 */
function Shoes({ faces }: { faces: Faces }) {
  function shoe(y: number, key: string) {
    const w = 9;
    return (
      <React.Fragment key={key}>
        {/* Sole. */}
        <Solid shape={box(-14, y, 0, 26, w, 3)} faces={faces} />
        {/* Heel and upper. */}
        <Solid shape={box(-14, y, 3, 13, w, 9)} faces={faces} />
        {/* The toe, tapering from the upper down to the sole. */}
        <Polygon
          points={poly([iso(-1, y, 3), iso(-1, y, 10), iso(12, y, 3)])}
          fill={faces.right}
        />
        <Polygon
          points={poly([iso(-1, y + w, 3), iso(-1, y + w, 10), iso(12, y + w, 3)])}
          fill={faces.left}
        />
        <Polygon
          points={poly([iso(-1, y, 10), iso(-1, y + w, 10), iso(12, y + w, 3), iso(12, y, 3)])}
          fill={faces.top}
        />
        {/* The laces, across the top of the upper. */}
        {[0.3, 0.55, 0.8].map((t) => (
          <Path
            key={t}
            d={`M ${iso(-1 + 13 * t, y + 1, 10 - 7 * t).join(' ')} L ${iso(-1 + 13 * t, y + w - 1, 10 - 7 * t).join(' ')}`}
            stroke={faces.skyFoot}
            strokeWidth={1.1}
            opacity={0.4}
          />
        ))}
      </React.Fragment>
    );
  }
  return (
    <>
      {shoe(-13, 'far')}
      {shoe(3, 'near')}
    </>
  );
}

/**
 * Curtains on a rail, hanging in folds.
 *
 * The one scene with no boxes in it below the rail: cloth has no flat faces,
 * so each fold is a hanging curve, and they alternate which way they belly so
 * the panel reads as gathered rather than as a fence.
 */
function Curtain({ faces }: { faces: Faces }) {
  const folds = [-18, -12, -6, 0, 6, 12, 18];
  function fold(y: number, belly: number) {
    const head = iso(0, y, 38);
    const hem = iso(0, y, 3);
    return `M ${head.join(' ')} C ${head[0] - belly} ${head[1] + 13}, ${hem[0] + belly} ${hem[1] - 13}, ${hem.join(' ')}`;
  }
  return (
    <>
      {/* The rail, and the finial at the near end. */}
      <Solid shape={box(-3, -24, 38, 6, 48, 4)} faces={faces} />
      {folds.map((y, index) => (
        <Path
          key={y}
          d={fold(y, index % 2 === 0 ? 5.5 : -5.5)}
          stroke={index % 2 === 0 ? faces.top : faces.left}
          strokeWidth={6}
          strokeLinecap="round"
          fill="none"
          opacity={index % 2 === 0 ? 0.95 : 0.85}
        />
      ))}
      {/* The hem, tying the folds into one panel. */}
      <Path
        d={`M ${iso(0, -20, 3).join(' ')} L ${iso(0, 20, 3).join(' ')}`}
        stroke={faces.skyFoot}
        strokeWidth={1.6}
        strokeLinecap="round"
        opacity={0.4}
      />
    </>
  );
}

const SCENES: Record<SceneKey, (props: { faces: Faces }) => React.JSX.Element> = {
  stack: Stack,
  iron: Iron,
  suit: Suit,
  bed: Bed,
  machine: Machine,
  basket: Basket,
  shoes: Shoes,
  curtain: Curtain,
};

/** How much floor each scene throws a shadow across. */
const SHADOWS: Record<SceneKey, readonly [number, number, number, number]> = {
  stack: [-17, -17, 34, 34],
  iron: [-17, -23, 28, 46],
  suit: [-12, -12, 24, 24],
  bed: [-21, -15, 42, 30],
  machine: [-15, -15, 30, 30],
  basket: [-12, -14, 24, 28],
  shoes: [-15, -15, 22, 30],
  curtain: [-5, -23, 10, 46],
};

export function ServiceScene({ scene, brand }: { scene: SceneKey; brand: string }) {
  // SVG ids live in one document-wide namespace on web, so a shared `sky` id
  // made every tile after the first paint itself with the first tile's
  // gradient — the bedding tile came out blue. Keying the id to the colour
  // gives each tone its own gradient, and lets two tiles of one colour share.
  const skyId = `sky${brand.replace(/[^a-zA-Z0-9]/g, '')}`;
  const faces = sceneFaces(brand);
  const Drawing = SCENES[scene] ?? SCENES.basket;
  const [sx, sy, sw, sd] = SHADOWS[scene] ?? SHADOWS.basket;

  return (
    <Svg width="100%" height="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id={skyId} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={faces.skyTop} />
          <Stop offset="1" stopColor={faces.skyFoot} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width={SIZE} height={SIZE} fill={`url(#${skyId})`} />
      {/* The light lands on the top edge of the tile. */}
      <Rect x="0" y="0" width={SIZE} height="1.5" fill={faces.rim} opacity={0.5} />
      <Polygon points={floorPatch(sx, sy, sw, sd)} fill={faces.shadow} opacity={0.32} />
      <Drawing faces={faces} />
    </Svg>
  );
}