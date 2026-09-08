/**
 * Which small world sits on a service's tile, and how its faces are lit.
 *
 * A glyph names a service. A diorama shows it: a stack of folded clothes, an
 * iron resting on its board, a suit under a cover, a bed made up. The scene is
 * chosen from the service's own name first — that is the only thing telling one
 * bedding service from another — and from its category when the owner typed a
 * name nobody could read.
 *
 * The lighting is derived rather than authored so a new category tone needs no
 * new palette: one light source, up and to the left, gives a top face, a lit
 * left face and a shaded right face, and every box in every scene obeys it.
 */
import type { ServiceCategory } from './service-catalog';

export const SCENE_KEYS = [
  'stack',
  'iron',
  'suit',
  'bed',
  'machine',
  'basket',
  'shoes',
  'curtain',
] as const;

export type SceneKey = (typeof SCENE_KEYS)[number];

interface SceneRule {
  /** Matched against the lowercased service name. */
  keywords: readonly string[];
  scene: SceneKey;
}

/**
 * Order carries the meaning, exactly as in `service-icon.ts`: "Wash, Dry &
 * Fold" holds all three words and "Dry cleaning" holds "dry", so the most
 * specific reading has to be asked first.
 */
const RULES: readonly SceneRule[] = [
  { keywords: ['dry clean', 'dryclean', 'barong', 'suit', 'gown', 'formal', 'coat'], scene: 'suit' },
  { keywords: ['iron', 'press', 'plantsa'], scene: 'iron' },
  {
    keywords: ['comforter', 'blanket', 'duvet', 'bed sheet', 'bedsheet', 'bedding', 'pillow', 'kumot'],
    scene: 'bed',
  },
  { keywords: ['curtain', 'drape'], scene: 'curtain' },
  { keywords: ['shoe', 'sneaker', 'sapatos'], scene: 'shoes' },
  { keywords: ['bag', 'luggage', 'backpack'], scene: 'basket' },
  { keywords: ['towel', 'fold', 'labada', 'garment', 'clothes'], scene: 'stack' },
  { keywords: ['self', 'coin', 'load'], scene: 'machine' },
  { keywords: ['wash', 'laba'], scene: 'machine' },
];

const CATEGORY_SCENES: Record<ServiceCategory, SceneKey> = {
  wash_fold: 'stack',
  ironing: 'iron',
  dry_cleaning: 'suit',
  special_items: 'bed',
  self_service: 'machine',
  other: 'basket',
};

export function sceneFor(name: string, category: ServiceCategory): SceneKey {
  const haystack = name.toLowerCase();
  for (const rule of RULES) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.scene;
  }
  return CATEGORY_SCENES[category] ?? CATEGORY_SCENES.other;
}

/**
 * Where the object stands. On a coloured tile it is painted near-white and
 * the tile carries the hue; on a white card that reads as a hole, so the
 * object has to carry the hue itself.
 */
export type SceneSurface = 'tile' | 'white';

export interface SceneFaces {
  /** The tile behind the scene, or `transparent` on a white card. */
  skyTop: string;
  skyFoot: string;
  /** The three faces of every solid in the scene, lit from the upper left. */
  top: string;
  left: string;
  right: string;
  /** The pool a solid casts onto the floor. */
  shadow: string;
  /** A hairline along the tile's top edge, where the light lands. */
  rim: string;
}

const FALLBACK: readonly [number, number, number] = [0x6b, 0x7c, 0x93];

/** A hex colour as channels, or a neutral slate for anything unreadable. */
function channels(hex: string): readonly [number, number, number] {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return FALLBACK;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
}

function hex(rgb: readonly [number, number, number]): string {
  return `#${rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0')).join('')}`;
}

/** Mixes toward white above 0 and toward black below it. */
function shift(rgb: readonly [number, number, number], amount: number): string {
  const target = amount >= 0 ? 255 : 0;
  const weight = Math.abs(amount);
  return hex([
    rgb[0] + (target - rgb[0]) * weight,
    rgb[1] + (target - rgb[1]) * weight,
    rgb[2] + (target - rgb[2]) * weight,
  ]);
}

/**
 * One light source for the whole set. The white faces of the reference
 * drawings are the tile colour lifted most of the way to white rather than
 * pure white: a diorama in one hue reads as a made object, and pure white on
 * every face would flatten it back into a sticker.
 */
export function sceneFaces(brand: string, surface: SceneSurface = 'tile'): SceneFaces {
  const rgb = channels(brand);

  if (surface === 'white') {
    return {
      skyTop: 'transparent',
      skyFoot: 'transparent',
      top: shift(rgb, 0.3),
      left: shift(rgb, 0.02),
      right: shift(rgb, -0.26),
      // Neutral, not tinted: a coloured pool under an object standing on white
      // reads as spilled paint rather than as shadow.
      shadow: '#8A93A0',
      rim: shift(rgb, 0.45),
    };
  }

  return {
    skyTop: shift(rgb, 0.1),
    skyFoot: shift(rgb, -0.22),
    top: shift(rgb, 0.95),
    left: shift(rgb, 0.62),
    right: shift(rgb, 0.3),
    shadow: shift(rgb, -0.4),
    rim: shift(rgb, 0.55),
  };
}

/**
 * The colours an object is actually made of.
 *
 * Every scene used to be painted from its category's tone, so a stack of
 * laundry, a washing machine and a pair of shoes were all the same blue with
 * the same three shades. That reads as a diagram of a thing rather than as
 * the thing. A washing machine is white steel with a dark glass door; a
 * hiking shoe is navy and orange; folded laundry is a pile of different
 * colours, which is the whole reason it looks like laundry.
 *
 * Five roles per object, ordered by luminance so form reads without any
 * per-drawing guesswork: `light` catches the lamp, `base` is the body,
 * `shade` turns away, `deep` is the darkest crease, and `accent` is the one
 * colour the object is remembered by.
 */
export interface ScenePalette {
  light: string;
  base: string;
  shade: string;
  deep: string;
  /** The colour the object is remembered by — kept vivid on purpose. */
  accent: string;
}

const PALETTES: Record<SceneKey, ScenePalette> = {
  // Folded laundry: warm neutrals for the linen, with the coloured garments
  // in the pile carrying the vibrancy.
  stack: { light: '#FBFAF7', base: '#DCE3EC', shade: '#9FB0C4', deep: '#5B6B80', accent: '#2E86DE' },
  // A modern iron: white and steel, with the plastic in a vivid green.
  iron: { light: '#FFFFFF', base: '#D7DEE7', shade: '#94A2B4', deep: '#42505F', accent: '#7ED321' },
  // A garment cover: charcoal with a cool sheen, and a warm zip.
  suit: { light: '#8A94A3', base: '#59636F', shade: '#39424D', deep: '#1E252D', accent: '#E8A33D' },
  // Bedding: cream and sand, the warmest object in the set.
  bed: { light: '#FDF8EF', base: '#EAD9BE', shade: '#C4A87F', deep: '#7A6647', accent: '#C97B4A' },
  // A front-loader: white steel, a dark door, and the water behind the glass.
  machine: { light: '#FFFFFF', base: '#E2E7ED', shade: '#A3AEBC', deep: '#3D4753', accent: '#28A9E0' },
  // A woven basket in tan, with the wash inside it bright.
  basket: { light: '#F3DFC0', base: '#D9B383', shade: '#A9834F', deep: '#6B5030', accent: '#E2574C' },
  // A trainer: pale mesh over a navy body, with an orange flash.
  shoes: { light: '#F2F5F8', base: '#8FA3BA', shade: '#4C6280', deep: '#22303F', accent: '#F5821F' },
  // Curtains: a soft warm fabric, the folds carrying the light.
  curtain: { light: '#FBF2E4', base: '#E4CDAA', shade: '#B79A72', deep: '#6F5C41', accent: '#4EA391' },
};

export function scenePalette(scene: SceneKey): ScenePalette {
  return PALETTES[scene] ?? PALETTES.basket;
}
