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

export interface SceneFaces {
  /** The tile behind the scene: lighter at the top, deeper at the foot. */
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
export function sceneFaces(brand: string): SceneFaces {
  const rgb = channels(brand);
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
