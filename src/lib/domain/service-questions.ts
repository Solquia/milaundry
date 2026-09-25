/**
 * What a booking asks, by the kind of service being booked.
 *
 * The booking used to ask every service the questions a wash needs, so a
 * customer booking a shirt pressed was asked which detergent to use, and one
 * booking dry cleaning — where there is no water and no soap — was offered a
 * fabcon. Each question here belongs to a service because the counter would
 * actually act on the answer for that service; anything else is left unasked.
 *
 * The shop's own `supported_preferences` still narrows this further: a
 * question only appears if the service needs it *and* the shop honours it.
 */
import type { PreferenceKey } from './laundry-preferences';
import type { PricingUnit } from './pricing';
import type { ServiceCategory } from './service-catalog';
import type { AddonKind } from './shop-addons';

export interface ServiceQuestions {
  /** The heading over the questions. */
  title: string;
  preferences: readonly PreferenceKey[];
  /** Which of the shop's add-on shelves make sense for this service. */
  addonKinds: readonly AddonKind[];
  /** Comforters and curtains alongside: only when the load is washed. */
  offersHeavyItems: boolean;
  /** What "delicate items" means at this counter. */
  delicatesNote: string;
  /** The example in the empty notes field. */
  instructionsExample: string;
  /** The line under the estimate: what makes the final price. */
  finalPriceNote: string;
}

const ALL_ADDONS: readonly AddonKind[] = ['detergent', 'fabcon', 'extra'];
const EXTRAS_ONLY: readonly AddonKind[] = ['extra'];

type CategoryQuestions = Omit<ServiceQuestions, 'finalPriceNote'>;

const BY_CATEGORY: Record<ServiceCategory, CategoryQuestions> = {
  wash_fold: {
    title: 'How should we wash it?',
    preferences: ['detergent', 'softener', 'separate_whites', 'delicates', 'air_dry', 'instructions'],
    addonKinds: ALL_ADDONS,
    offersHeavyItems: true,
    delicatesNote: 'Gentle cycle',
    instructionsExample: 'Cold wash for the dark jeans',
  },
  // Pressing only: no water touches it, so no soap, no fabcon, no drying.
  ironing: {
    title: 'How should we press it?',
    preferences: ['delicates', 'instructions'],
    addonKinds: EXTRAS_ONLY,
    offersHeavyItems: false,
    delicatesNote: 'Low heat',
    instructionsExample: 'Crease the slacks, hang the barong',
  },
  // Solvent, not water: care notes are all the counter can use.
  dry_cleaning: {
    title: 'Anything we should know?',
    preferences: ['delicates', 'instructions'],
    addonKinds: EXTRAS_ONLY,
    offersHeavyItems: false,
    delicatesNote: 'Handle with care',
    instructionsExample: 'Wine stain on the left sleeve',
  },
  // Comforters and curtains are washed, but one at a time: no whites to sort.
  special_items: {
    title: 'How should we wash it?',
    preferences: ['detergent', 'softener', 'air_dry', 'instructions'],
    addonKinds: ALL_ADDONS,
    offersHeavyItems: true,
    delicatesNote: 'Gentle cycle',
    instructionsExample: 'Wash the comforter on its own',
  },
  // The customer runs the machine. The shop can sell them soap; it does not wash.
  self_service: {
    title: 'Need soap or anything else?',
    preferences: [],
    addonKinds: ALL_ADDONS,
    offersHeavyItems: false,
    delicatesNote: 'Gentle cycle',
    instructionsExample: '',
  },
  other: {
    title: 'Anything we should know?',
    preferences: ['instructions'],
    addonKinds: EXTRAS_ONLY,
    offersHeavyItems: false,
    delicatesNote: 'Handle with care',
    instructionsExample: 'Anything the shop should know',
  },
};

const FINAL_PRICE_NOTES: Record<PricingUnit, string> = {
  per_kg: 'Final price confirmed after the shop weighs your laundry.',
  per_item: 'Final price confirmed after the shop counts your pieces.',
  flat: 'Set price for this service, plus any add-ons.',
};

export function questionsFor(category: ServiceCategory, unit: PricingUnit): ServiceQuestions {
  const questions = BY_CATEGORY[category] ?? BY_CATEGORY.other;
  return { ...questions, finalPriceNote: FINAL_PRICE_NOTES[unit] ?? FINAL_PRICE_NOTES.flat };
}
