/**
 * Cut-outs made for one shop's own services, where the stock set has only
 * one picture for the kind of work: Bubbly Gav's three bedding packages, each
 * folded in its package's poster colour.
 *
 * They stand on the same canvas and baseline as `SERVICE_CUTOUTS`, so they
 * sit in any well that shows a cut-out. A photo the owner uploads for the
 * service still wins; this is only what shows until they do.
 */
import type { ImageSource } from 'expo-image';

import { BUBBLY_GAV_SHOP_ID } from '@/lib/domain/price-guide';

const BEDDING_BY_PACKAGE: Record<number, ImageSource> = {
  1: require('../../assets/images/price-guides/bubblygav/bedding-blue.png'),
  2: require('../../assets/images/price-guides/bubblygav/bedding-green.png'),
  3: require('../../assets/images/price-guides/bubblygav/bedding-orange.png'),
};

const PACKAGE_BEDDING = /^package\s*(\d+)\b.*(bed|towel|linen)/i;

/** The shop's own cut-out for this service, or null to use the stock set. */
export function guideServicePhoto(service: { shop_id?: string; name: string }): ImageSource | null {
  if (service.shop_id !== BUBBLY_GAV_SHOP_ID) return null;
  const packageNumber = Number(PACKAGE_BEDDING.exec(service.name)?.[1]);
  return BEDDING_BY_PACKAGE[packageNumber] ?? null;
}
