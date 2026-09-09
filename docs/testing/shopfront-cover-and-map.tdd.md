# Shopfront cover photo, store map, and the logo that never arrived — TDD evidence

## Source plan

`~/.claude/plans/cosmic-twirling-rose.md` (session 2026-09-06). Journeys were
derived from the owner's request: the blue block at the top of the shopfront
should be a photo of the actual laundry with the name on a tag at the bottom;
customers should see where the shop is on an interactive Google Map; both
must be editable by the merchant; and a logo changed in merchant settings
never showed up on the customer side.

## User journeys

1. As a customer, I want to see a photo of the physical laundry at the top of
   its shopfront, so that I recognise the place I am booking with.
2. As a customer, I want an interactive map with the shop's pin and one tap to
   directions, so that I can get there without retyping the address.
3. As a shop owner, I want to upload the photo and place the pin myself, so
   that my shopfront is right without asking an admin.
4. As a shop owner, when I change my logo, I want customers to see the new one.

## Task report

### Task 1 — The logo bug was never a cache bug (root cause)

Every customer surface drew initials and threw `logo_url` away:

- `src/app/(customer)/shop/[id].tsx` — `ShopfrontHero` had no `logoUrl` prop;
  the mark rendered `<Text>{initials}</Text>` unconditionally.
- `src/app/(customer)/shops.tsx:178-184` — initials or a storefront glyph.
- `src/app/(customer)/orders.tsx:534` — `{shop.initials}`; the tile type
  `ConnectedShopTile` had no logo field at all.

The data was already there: `getShop`, `getRegisteredShops` and
`getVisibleShops` all `select('*')`. Storage paths were unique per upload
(`<shop>/<ts>.<ext>`), so neither expo-image nor the CDN could have served a
stale picture. RLS had been fixed in `0014` and failed loudly anyway.

A second, smaller fault: `branding-card.tsx:77` (and `payment-rails-card.tsx:59`)
invalidated `['active-shop']`, a query key no query in the app registers. The
real keys are `['merchant-shops']`, `['shop', id]`, `['registered-shops']`,
`['visible-shops']`. Even after the render fix, an already-mounted customer
screen would have kept the old row until `staleTime` (30 s) lapsed.

**Fix.** `src/components/shop-logo.tsx` is the one image-or-initials decision,
used by the directory, the home tab and the merchant preview; the hero draws
the logo image directly in its 64px mark. `src/lib/query-keys.ts` →
`invalidateShopSurfaces(queryClient, shopId, updatedRow)` replaces the dead
key in both cards and seeds `['shop', id]` from the RPC's returned row so a
superadmin in view-as mode refreshes too.

**RED** — `connected-shops.test.ts` full-shape `toEqual` without `logo_url`
plus two new logo cases; **GREEN** after `logo_url` joined `ConnectedShopTile`.

### Task 2 — Pin rules (`src/lib/domain/shop-location.ts`)

19 tests, written first: pins outside the world, `NaN`/`Infinity`/strings,
null island `(0, 0)` refused (it is what an unset field produces, never a
laundry), half a pin is no pin, 6-decimal rounding is idempotent, exact
Google Maps URLs (`/maps/dir/?api=1&destination=lat,lng`,
`/maps/search/?api=1&query=<encoded>`), and the `mapMode` truth table:

| pin | address | platform | key | mode |
|---|---|---|---|---|
| yes | – | ios | – | `map` |
| yes | – | android | real | `map` |
| yes | – | android | none / `''` / `<ANDROID_MAPS_KEY>` | `address-only` |
| yes | – | web | real | `address-only` |
| no | yes | any | – | `address-only` |
| no | no | any | – | `hidden` |

The placeholder case matters: `app.json` ships with `<ANDROID_MAPS_KEY>` until
the real key is pasted in, and a placeholder renders a blank grey map.

### Task 3 — Cover rules (`src/lib/domain/shop-cover.ts`)

`heroBackdrop` (pending local pick outranks the saved URL; `''`/whitespace/null
→ the coloured field), `shopLogoUri` (`''` → null, so every surface makes the
same decision), `coverTooLarge` (6 MB cap; unknown size passes because the
picker does not always report `fileSize`). 11 tests.

### Task 4 — Data

`supabase/migrations/0018_shop_cover_and_location.sql`, applied via MCP:
`cover_url text not null default ''`, `latitude`/`longitude double precision`
with both-or-neither and range constraints; `set_shop_branding` **replaced**
(not overloaded — PostgREST cannot pick between two signatures) with a
`p_cover_url` that follows the logo's "null keeps" rule; new
`set_shop_location` where both-null **clears** the pin. Verified with
`pg_proc`: exactly one `set_shop_branding(uuid, smallint, text, text, text)`.
Cover uploads go to `shop-logos/<shop_id>/cover-<ts>.<ext>`; the `0014` policy
checks only the folder, so no policy change.

### Task 5 — Merchant side

- `branding-card.tsx`: "Change shop photo" (16:9 crop, quality 0.7, size
  guard), preview is now the same composition the customer sees (photo, mark,
  name pill at the foot), and the invalidation fix above.
- `shop-location-card.tsx` + `location-picker.tsx`: tap the map to place the
  pin (`onMapClick` → `roundPin`), "Use my current location" via
  `expo-location` (`requestForegroundPermissionsAsync` →
  `getCurrentPositionAsync({ accuracy: High })`; denied → the `locate-me`
  sentence plus an "Open Settings" link), "Remove pin", save via
  `set_shop_location`. The camera follows the pin only on a `focusKey` bump so
  a careful second tap lands where the merchant aimed.
- `merchant-error.ts`: `save-cover`, `save-location`, `locate-me` — the last
  deliberately not "try again in a moment", because denied permission is not
  a server fault. The card passes `''` so the fallback wins over the OS's
  own wording; the exhaustive-actions test now covers 12 actions.

### Task 6 — Customer side

- `src/components/shopfront-hero.tsx` (extracted from `[id].tsx`, which drops
  from 1118 to ~770 lines): photo backdrop through the same entrance cue, a
  two-part navy scrim (light at the top for the chevron and clock, deep at the
  foot for the caption), `WashLine` only on the field, min height 300 + inset,
  everything that says who this is anchored bottom-left with the name on a
  pill. Same layout for the blue fallback, so there is one composition.
- `src/components/shop-map-card.tsx` under a "Where to Find Us" title, above
  "What Customers Say": `GoogleMaps.View` / `AppleMaps.View` by platform,
  marker on the pin, `Open in Google Maps` → `Linking.openURL(directionsUrl)`,
  address-only fallback with `searchUrl` when there is no pin or no key.

### Task 7 — Config

`expo-maps ~57.0.2`, `expo-location ~57.0.16`; `app.json` plugins for both
and `android.config.googleMaps.apiKey = "<ANDROID_MAPS_KEY>"`.
`npx expo config --type introspect` confirms `ACCESS_FINE_LOCATION` /
`ACCESS_COARSE_LOCATION` coexist with `BLUETOOTH_SCAN
usesPermissionFlags="neverForLocation"` (the BLE plugin only flags its own
permission; it does not strip location), and `com.google.android.geo.API_KEY`
carries the placeholder.

## Validation commands

```
npx jest shop-location shop-cover connected-shops merchant-error   # 54 passed
npx jest                                                            # 85 suites, 972 tests
npx tsc --noEmit                                                    # clean
npx expo lint                                                       # clean
```

## Not verified from this session — please confirm on device

- Merchant → Settings → *Change shop photo* + *Change logo* → *Save branding*
  → open the shop as a customer: photo behind the name pill, real logo in the
  mark; logo also on the Shops tab and the home tiles.
- Merchant → *Your location* → tap the map / *Use my current location* →
  *Save location* → customer shopfront shows the map card with the pin;
  pinch and drag work inside the scroll view (if the scroll view steals the
  drag, set `scrollGesturesEnabled: false` on the card's `uiSettings` and rely
  on *Open in Google Maps*).
- Android map needs the real key: Google Cloud → Maps SDK for Android → key
  restricted to `com.milaundry.app` + the SHA-1 from `eas credentials -p android`.
  Until then the card shows the address-only fallback by design.
- Deny location permission → the `locate-me` sentence and *Open Settings*.
- The BLE printer still pairs after the permission additions.