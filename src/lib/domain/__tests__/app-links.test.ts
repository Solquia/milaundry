/// <reference types="node" />
/**
 * The OS opens the app for a printed link only if the native config and the
 * files on the web host both claim the same paths. These tests keep the three
 * from drifting: the links we print, app.json, and public/.well-known.
 */
import * as fs from 'fs';
import * as path from 'path';

import { DEFAULT_WEB_HOST, WEB_LINK_PATHS, claimUrl, joinUrl } from '../web-links';

const ROOT = path.resolve(__dirname, '../../../..');
const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')).expo;
const wellKnown = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(ROOT, 'public', '.well-known', name), 'utf8'));

const SHOP_ID = '2f6f2f9e-6f0a-4a8e-9a3b-1c2d3e4f5a6b';
const ORDER_ID = 'a1b2c3d4-e5f6-4a8e-9a3b-0f1e2d3c4b5a';
const FINGERPRINT_RE = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

describe('the paths the app owns on the web host', () => {
  it('are exactly the paths the printed codes use', () => {
    const printed = [joinUrl(SHOP_ID, 't'), claimUrl(ORDER_ID, 't')];
    for (const p of WEB_LINK_PATHS) {
      expect(printed.some((url) => url.startsWith(`https://${DEFAULT_WEB_HOST}/${p}/`))).toBe(true);
    }
    expect(WEB_LINK_PATHS).toHaveLength(printed.length);
  });
});

describe('Android App Links', () => {
  const filters: any[] = appJson.android?.intentFilters ?? [];
  const verified = filters.filter((f) => f.autoVerify === true && f.action === 'VIEW');
  const data = verified.flatMap((f) => f.data ?? []);

  it.each([...WEB_LINK_PATHS])('claims https://<host>/%s/ with autoVerify', (segment) => {
    expect(data).toContainEqual({ scheme: 'https', host: DEFAULT_WEB_HOST, pathPrefix: `/${segment}/` });
  });

  it('leaves the storefront and tracking pages to the browser', () => {
    for (const d of data) {
      expect(d.pathPrefix).toMatch(/^\/(join|claim)\//);
    }
  });

  it('is browsable so a tapped link, not only a scan, opens the app', () => {
    for (const f of verified) expect(f.category).toEqual(expect.arrayContaining(['BROWSABLE', 'DEFAULT']));
  });

  it('publishes an assetlinks.json that names this package and real fingerprints', () => {
    const statements = wellKnown('assetlinks.json');
    expect(statements).toHaveLength(1);
    const [statement] = statements;
    expect(statement.relation).toEqual(['delegate_permission/common.handle_all_urls']);
    expect(statement.target.namespace).toBe('android_app');
    expect(statement.target.package_name).toBe(appJson.android.package);
    expect(statement.target.sha256_cert_fingerprints.length).toBeGreaterThan(0);
    for (const fp of statement.target.sha256_cert_fingerprints) expect(fp).toMatch(FINGERPRINT_RE);
  });
});

describe('iOS Universal Links', () => {
  it('associates the web host with the app', () => {
    expect(appJson.ios?.associatedDomains).toContain(`applinks:${DEFAULT_WEB_HOST}`);
  });

  it('publishes an apple-app-site-association for this bundle and only the owned paths', () => {
    const aasa = wellKnown('apple-app-site-association');
    const [detail] = aasa.applinks.details;
    for (const appId of detail.appIDs) {
      expect(appId).toMatch(new RegExp(`^[A-Z0-9]{10}\.${appJson.ios.bundleIdentifier.replace(/\./g, '\.')}$`));
    }
    const claimed = detail.components.map((c: { '/': string }) => c['/']);
    expect(claimed.sort()).toEqual([...WEB_LINK_PATHS].map((p) => `/${p}/*`).sort());
  });
});
