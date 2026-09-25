/**
 * What the shop's web page hands the shared booking flow.
 *
 * The web page reads the shop through `get_storefront`, which answers signed
 * out and so carries only the public half of each service. The booking flow
 * the app uses takes full service rows; these fill in the rest, so the web
 * page books through the very same flow instead of a copy of it.
 */
import type { ServiceRow, StorefrontService } from '@/lib/types';

/** The storefront's price list as bookable rows. Every row it returns is active. */
export function storefrontServiceRows(
  shopId: string,
  services: readonly StorefrontService[]
): ServiceRow[] {
  return services.map((service) => ({
    ...service,
    shop_id: shopId,
    is_active: true,
    created_at: '',
  }));
}

/** The service a price card was tapped on, from the page link; null when none was. */
export function pickedServiceId(param: string | string[] | undefined): string | null {
  const value = Array.isArray(param) ? param[0] : param;
  return value ? value : null;
}
