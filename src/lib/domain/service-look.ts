/**
 * How one service's drawing is told apart from its neighbours'.
 *
 * `sceneFor` picks the object from the name and the category, which is right
 * for one service and wrong for a price list: a shop with "Wash & Fold —
 * Regular", "Wash & Fold — Office Clothes" and "Wash & Fold — Towels" got three
 * identical piles of shirts, and the one thing that set them apart — the words
 * at the end of the name — was the thing a customer reads last.
 *
 * So a service carries a look: the object, the dyes it is made in, and a care
 * tag. The dyes come from the name when it names a fabric ("Whites" is a pile
 * of whites, "Delicates" a pile of pastels); siblings that share an object and
 * name no fabric are handed the unused colorways in list order. The tag is the
 * words only that sibling has — sewn on like a garment's label — and it is
 * drawn only when there is a sibling to be told from.
 */
import type { PricingUnit } from './pricing';
import type { ServiceCategory } from './service-catalog';
import { sceneFor, type SceneKey } from './service-scene';
import { showcaseTitle } from './service-showcase';

export const COLORWAY_KEYS = [
  'mixed',
  'earth',
  'ocean',
  'berry',
  'brights',
  'denim',
  'whites',
  'darks',
  'delicates',
  'baby',
] as const;

export type ColorwayKey = (typeof COLORWAY_KEYS)[number];

export interface Colorway {
  /** Garments in a pile, bottom-up, cycled when a pile is taller than the list. */
  dyes: readonly string[];
  /** The fabric of a one-material object: a garment bag, a throw, a chair, a curtain. */
  cloth: string;
  /** The one colour the object is remembered by: an iron's shell, a trainer's flash. */
  accent: string;
}

/**
 * `mixed` is the house pile the drawings were made in; a drawing keeps its own
 * colours under it, and these are only what its care tag shows.
 */
export const COLORWAYS: Record<ColorwayKey, Colorway> = {
  mixed: { dyes: ['#E07A3A', '#4F86D8', '#27A3A0', '#2B3F66', '#C94B4B', '#8A6A55'], cloth: '#C4B39E', accent: '#2E86DE' },
  earth: { dyes: ['#B5653A', '#D9A441', '#6E8B3D', '#8C4A2F', '#C9B28A', '#5A4632'], cloth: '#B5653A', accent: '#6E8B3D' },
  ocean: { dyes: ['#2E8C9A', '#1F5F8B', '#7FC6C4', '#2B6CB0', '#A7D3E0', '#164E63'], cloth: '#2E8C9A', accent: '#2B6CB0' },
  berry: { dyes: ['#8E3B63', '#D96A9A', '#5B2A6E', '#E7A1B8', '#B4436C', '#3F1D4A'], cloth: '#8E3B63', accent: '#D96A9A' },
  brights: { dyes: ['#E2574C', '#FFC233', '#14BE9C', '#2F6ED6', '#F5821F', '#9B5DE5'], cloth: '#E2574C', accent: '#FFC233' },
  denim: { dyes: ['#3C5E8C', '#6F8FB8', '#23395B', '#8FA9C9', '#2F4A70', '#A9BCD4'], cloth: '#3C5E8C', accent: '#E0A340' },
  whites: { dyes: ['#F4F1EA', '#E6ECF2', '#FFFFFF', '#ECE4D6', '#DDE4EC', '#F7F5EF'], cloth: '#EDE8DF', accent: '#8FB3D9' },
  darks: { dyes: ['#2A2F38', '#1E2A44', '#4A1F24', '#23392C', '#3A3F47', '#15181D'], cloth: '#2A2F38', accent: '#C9A227' },
  delicates: { dyes: ['#E8C8D4', '#D5C6E8', '#F3E3C8', '#C8E0D8', '#F2D0C4', '#DCD3EE'], cloth: '#E8C8D4', accent: '#B58BC9' },
  baby: { dyes: ['#CFE3F2', '#F8E3A3', '#F4C6CF', '#CDEBD8', '#FFFFFF', '#E3D7F2'], cloth: '#CFE3F2', accent: '#F4B6C2' },
};

interface TraitRule {
  pattern: RegExp;
  colorway: ColorwayKey;
}

/** Order matters as in `service-scene.ts`: "dark colors" is darks, not brights. */
const TRAITS: readonly TraitRule[] = [
  { pattern: /\b(whites?|puti)\b/, colorway: 'whites' },
  { pattern: /\b(darks?|blacks?)\b/, colorway: 'darks' },
  { pattern: /\b(delicates?|silk|lingerie|underwear|lace|wool|hand ?wash)\b/, colorway: 'delicates' },
  { pattern: /\b(denim|jeans?|maong)\b/, colorway: 'denim' },
  { pattern: /\b(baby|babies|infants?|kids?|children)\b/, colorway: 'baby' },
  { pattern: /\b(colou?rs?|colou?red|de colou?r|towels?)\b/, colorway: 'brights' },
  { pattern: /\b(uniforms?|office|school)\b/, colorway: 'ocean' },
];

/** The colorway a name asks for by naming a fabric, or null when it names none. */
export function traitColorway(name: string): ColorwayKey | null {
  const haystack = name.toLowerCase();
  return TRAITS.find((rule) => rule.pattern.test(haystack))?.colorway ?? null;
}

export interface ServiceLook {
  scene: SceneKey;
  colorway: ColorwayKey;
  /** What sets this service apart from a sibling on the same drawing, or null. */
  tag: string | null;
}

/** One service on its own: no sibling to be told from, so no tag. */
export function serviceLook(name: string, category: ServiceCategory): ServiceLook {
  return { scene: sceneFor(name, category), colorway: traitColorway(name) ?? 'mixed', tag: null };
}

export interface LookableService {
  id: string;
  name: string;
  category: ServiceCategory;
  unit: PricingUnit;
}

/** Long enough for "Regular Clothes", short enough to leave the rate its room. */
const TAG_MAX = 18;
const FILLER = new Set(['a', 'an', 'and', 'the', 'of', 'for', 'with', 'per', 'to', 'in', 'on', '&']);
const UNIT_TAGS: Record<PricingUnit, string> = { per_kg: 'Per kg', per_item: 'Per piece', flat: 'Flat rate' };

function words(name: string): string[] {
  return showcaseTitle(name)
    .split(/[^\p{L}\p{N}&]+/u)
    .filter((word) => word.length > 0);
}

/** Whole words, up to the tag's width; a word that alone is too long is cut. */
function fitTag(parts: readonly string[]): string {
  let tag = '';
  for (const part of parts) {
    const next = tag ? `${tag} ${part}` : part;
    if (next.length > TAG_MAX) break;
    tag = next;
  }
  return tag || `${parts[0].slice(0, TAG_MAX - 1)}…`;
}

/** The words only this sibling has, then its unit when the names are the same. */
function tagFor(own: LookableService, siblings: readonly LookableService[]): string | null {
  const shared = siblings
    .filter((other) => other.id !== own.id)
    .map((other) => new Set(words(other.name).map((word) => word.toLowerCase())));
  const distinct = words(own.name).filter(
    (word) => !FILLER.has(word.toLowerCase()) && shared.some((set) => !set.has(word.toLowerCase()))
  );
  if (distinct.length > 0) return fitTag(distinct);
  const isUnitDistinct = siblings.some((other) => other.id !== own.id && other.unit !== own.unit);
  return isUnitDistinct ? UNIT_TAGS[own.unit] : null;
}

/** Hands a sibling group its colorways: named fabrics first, then the rest in order. */
function colorwaysFor(group: readonly LookableService[]): ColorwayKey[] {
  const taken = new Set<ColorwayKey>();
  const claimed = group.map((service) => {
    const trait = traitColorway(service.name);
    if (!trait || taken.has(trait)) return null;
    taken.add(trait);
    return trait;
  });
  let cursor = 0;
  return claimed.map((trait) => {
    if (trait) return trait;
    const free = COLORWAY_KEYS.filter((key) => !taken.has(key));
    // Past ten siblings every colorway is spoken for; cycle rather than fail.
    const pick = free[0] ?? COLORWAY_KEYS[cursor++ % COLORWAY_KEYS.length];
    taken.add(pick);
    return pick;
  });
}

/**
 * Every service's look, decided across the whole list so siblings differ.
 * Pass the full list, not a filtered one: a search should not re-dye a card.
 */
export function serviceLooks(services: readonly LookableService[]): Map<string, ServiceLook> {
  const byScene = new Map<SceneKey, LookableService[]>();
  for (const service of services) {
    const scene = sceneFor(service.name, service.category);
    byScene.set(scene, [...(byScene.get(scene) ?? []), service]);
  }

  const looks = new Map<string, ServiceLook>();
  for (const [scene, group] of byScene) {
    if (group.length === 1) {
      looks.set(group[0].id, serviceLook(group[0].name, group[0].category));
      continue;
    }
    const colorways = colorwaysFor(group);
    group.forEach((service, index) => {
      looks.set(service.id, { scene, colorway: colorways[index], tag: tagFor(service, group) });
    });
  }
  return looks;
}
