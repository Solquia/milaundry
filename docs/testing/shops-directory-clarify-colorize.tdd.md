# Shops directory — clarify + colorize — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Target:** `src/app/(customer)/shops.tsx` (the Shops tab — the directory of
merchant shops), plus `src/lib/domain/shop-directory.ts`.

## Request

> "clarify + colorize the merhcant shops please"

Read as the shops **directory** — the list of merchant shops in the customer's
Shops tab — matching the previous turn, where "the merchant store" meant the
customer's view of one shop. No merchant-dashboard file was touched.

## Clarify

### The heading made a claim the app cannot support — fixed

"**Laundry shops near you**" implied proximity. `getVisibleShops`
(`api.ts:59-65`) is:

```ts
supabase.from('shops').select('*').order('name', { ascending: true })
```

No latitude, no longitude, no distance, no geo permission anywhere in the app.
The list is alphabetical. A customer in Cebu was told a Manila shop was near
them. Now: "**More laundry shops**", with one line of helper text that explains
what connecting buys — "Connect to a shop to see its prices and book a wash."

Renamed "My laundry shops" → "**Your laundry shops**" to match the second person
already used everywhere else ("You're connected to…", "Your laundry here").

### The empty state pointed at nothing

One sentence covered both empty cases: "You haven't connected to a laundry shop
yet. Pick one below or scan its QR code." When the directory itself was empty,
"pick one below" sent a new customer to study blank space.

`emptyDirectoryMessage({ mine, discoverable })` now separates first use from an
empty directory, and names the QR route in both — it is the way in that does not
depend on the shop being listed at all.

### Errors were raw backend strings

Both the directory load error and the join error printed `err.message` —
Postgres constraint names and PostgREST JSON. `friendlyDirectoryError(action,
raw)` follows the established per-surface mapper convention
(`booking-error.ts`, `merchant-error.ts`, `auth-error.ts`, `admin-error.ts`):
connection failures become "No internet connection…", technical detail becomes a
fallback naming what did not happen, and a sentence the shop itself wrote
("This shop is not accepting new customers.") passes through untouched.

`load` and `connect` keep **separate** fallbacks on purpose — one "something
went wrong" for both leaves a customer unable to tell a shop list that never
arrived from a shop that refused them.

The join error also **moved to where it happened**: it now renders inside the
card whose button failed, keyed on `joinMutation.variables`, instead of at the
top of a screen the customer has already scrolled past.

### Redundant control removed

Connected shops carried a filled "View shop" button *and* a pressable row that
went to the same route. The button is gone; the row still opens the shop. Each
card now has at most one control, and per-shop `accessibilityLabel`s name the
shop ("Connect to Sparkle clean") rather than "this shop".

## Colorize

The screen was near-monochrome, and the blue was spent backwards: the **filled
blue button sat on shops you had already joined**, while "Connect to this shop"
— the one conversion action on the screen — was a neutral `outline`. Colour was
on the redundant control and withheld from the decisive one.

Deleting "View shop" freed the blue for the action that earns it. The strategy
is three roles, one each, in Operate mode where rarity gives an accent force:

| Role | Colour | Where |
|---|---|---|
| **yours** | the shop's `ACCENTS` tone | avatar surface + ink, and a 1px accent hairline on the card |
| **you can act here** | `colors.action` | the filled Connect button, once per discoverable card |
| **not yet** | `colors.sunken` / `colors.subtle` | plain storefront glyph on unconnected shops |

The accent hairline reuses the incumbent vocabulary — `WelcomeCard` on the shop
page already borders itself in `accent.ink`. It is 1px, never a slab, so the
craft floor's ban on colored borders above 1px holds. `ui-kit`'s `Card` cannot
take a border colour, so `ShopCard` composes the same recipe locally rather than
widening a shared primitive for one screen.

No new colour, token, or primitive was introduced. Hardcoded values were
replaced with tokens (`type.section`, `type.label`, `space.*`,
`elevation.rest`).

## Tests

**RED first.** Nine new cases appended to
`src/lib/domain/__tests__/shop-directory.test.ts` and run before either function
existed:

```
Tests: 9 failed, 6 passed, 15 total
```

**GREEN after:** `Tests: 15 passed, 15 total`.

Coverage: empty message suppressed once a shop is joined; points "below" only
when something is below; always offers the QR route; passes through a shop's own
sentence; maps connection failures; strips Postgres detail; keeps `load` and
`connect` distinguishable; falls back on a blank message.

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/shop-directory.test.ts` (pre-impl) | 9 failed, 6 passed (RED) |
| same, post-impl | 15/15 passed (GREEN) |
| `npx jest` | 47 suites, 423/423 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <both changed files>` | clean |
| impeccable design detector | no findings |

Contrast: `colors.action` + white label 5.9:1; `colors.text` on `colors.card`
≥12:1; `Subtle` (`colors.subtle`) 5.5:1; every `ACCENTS` ink ≥5:1 on its own
surface. The accent hairline carries no text, and "yours vs not yours" is also
encoded by initials-vs-glyph and by the presence of the Connect button, so no
information is colour-only.

## Preserved

All queries and query keys, `splitShopsByRegistration` and its six existing
tests, the `joinShop` mutation and its post-join redirect, both routes, the
`assignAccents` distinctness rule, and the shop-name/address content.
