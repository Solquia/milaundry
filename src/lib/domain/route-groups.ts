/**
 * Which route group a role lives in, and where to send someone who landed in
 * the wrong one.
 *
 * Three groups share screen names: `shops` is a customer tab and an admin
 * tab, `orders` is a customer tab and a merchant tab, `settings` is in all
 * three. In the app every link carries its group, so nothing is ambiguous.
 * On the web the address bar drops the group, and a refresh on `/shops`
 * matches the first group alphabetically — the admin one, for a customer.
 * That layout used to answer with a redirect to `/`, which resolved back
 * into the same group, and the page looped until React gave up.
 *
 * The answer is never a bare path: a wrong-role visitor is sent to the same
 * screen inside their own group when it has one, otherwise to their home.
 */
import { type Role, homeRouteForRole } from './splash-gate';

export type RouteGroup = '(customer)' | '(merchant)' | '(admin)';

/** The top-level screens in each group. A test holds this to `src/app`. */
export const GROUP_SCREENS: Readonly<Record<RouteGroup, readonly string[]>> = Object.freeze({
  '(customer)': ['new-order', 'notifications', 'orders', 'scan', 'settings', 'shops'],
  '(merchant)': ['analytics', 'customers', 'orders', 'pos', 'services', 'settings'],
  '(admin)': ['index', 'new-shop', 'settings', 'shops'],
});

export function groupForRole(role: Role | null | undefined): RouteGroup {
  if (role === 'merchant') return '(merchant)';
  if (role === 'superadmin') return '(admin)';
  return '(customer)';
}

/** The same screen in the role's own group, or the role's home. */
export function routeForRole(role: Role | null | undefined, screen: string | undefined): string {
  const group = groupForRole(role);
  if (screen && screen !== 'index' && GROUP_SCREENS[group].includes(screen)) {
    return `/${group}/${screen}`;
  }
  return homeRouteForRole(role);
}
