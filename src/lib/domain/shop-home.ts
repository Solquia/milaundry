import type { ServiceCategory } from './service-catalog';

/**
 * Ionicons glyph shown on each tile of the customer shop home services grid.
 * Unknown categories (added server-side later) fall back to the `other` icon
 * so the grid never renders a missing glyph.
 */
export const CATEGORY_ICONS: Record<ServiceCategory, string> = {
  wash_fold: 'shirt-outline',
  ironing: 'flame-outline',
  dry_cleaning: 'sparkles-outline',
  special_items: 'bed-outline',
  self_service: 'time-outline',
  other: 'ellipsis-horizontal-outline',
};

export function categoryIcon(category: string): string {
  return CATEGORY_ICONS[category as ServiceCategory] ?? CATEGORY_ICONS.other;
}
