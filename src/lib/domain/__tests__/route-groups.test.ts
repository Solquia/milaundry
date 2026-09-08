/// <reference types="node" />
import * as fs from 'fs';
import * as path from 'path';

import { GROUP_SCREENS, groupForRole, routeForRole } from '../route-groups';

const APP_DIR = path.resolve(__dirname, '../../../app');

describe('groupForRole', () => {
  it('maps every role to the group that owns its screens', () => {
    expect(groupForRole('customer')).toBe('(customer)');
    expect(groupForRole('merchant')).toBe('(merchant)');
    expect(groupForRole('superadmin')).toBe('(admin)');
    expect(groupForRole(null)).toBe('(customer)');
  });
});

describe('routeForRole', () => {
  it('keeps the same screen when the role has one under that name', () => {
    // A customer who refreshes /shops on the web was matched to (admin)/shops.
    expect(routeForRole('customer', 'shops')).toBe('/(customer)/shops');
    expect(routeForRole('customer', 'settings')).toBe('/(customer)/settings');
    expect(routeForRole('merchant', 'orders')).toBe('/(merchant)/orders');
    expect(routeForRole('superadmin', 'settings')).toBe('/(admin)/settings');
  });

  it('falls back to the home screen when the role has no such screen', () => {
    expect(routeForRole('merchant', 'shops')).toBe('/(merchant)/orders');
    expect(routeForRole('customer', 'pos')).toBe('/(customer)/orders');
    expect(routeForRole('superadmin', 'scan')).toBe('/(admin)');
  });

  it('never answers with a bare path that could resolve into the wrong group', () => {
    for (const role of ['customer', 'merchant', 'superadmin'] as const) {
      for (const screen of ['shops', 'orders', 'settings', 'index', 'nope']) {
        expect(routeForRole(role, screen)).toMatch(/^\/\((customer|merchant|admin)\)/);
      }
    }
  });
});

describe('GROUP_SCREENS', () => {
  it.each(Object.keys(GROUP_SCREENS))('lists exactly the top-level screens in src/app/%s', (group) => {
    const files = fs
      .readdirSync(path.join(APP_DIR, group))
      .filter((f) => f.endsWith('.tsx') && !f.startsWith('_'))
      .map((f) => f.replace(/\.tsx$/, ''))
      .sort();
    expect([...GROUP_SCREENS[group as keyof typeof GROUP_SCREENS]].sort()).toEqual(files);
  });
});
