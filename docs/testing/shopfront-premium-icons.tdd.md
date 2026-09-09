# Shopfront price list — icons and the premium pass — TDD evidence

**Date:** 2026-08-26
**Branch:** main
**Targets:** `src/app/(customer)/shop/[id].tsx`, `src/lib/domain/service-icon.ts`

## Request

> "Polish I still dont like it can we do Icons or at least find a different
> style because it still feels not premium"

## Why the icons failed the first time

Icons came off the rows two passes ago for a good reason: the row drew
`categoryIcon(service.category)`, so a shop with three bedding services printed
the **same bed glyph three times**. The icon described the bucket, not the
service, so it carried no information and read as decoration.

That is a defect in *where the glyph came from*, not in having glyphs. A
service's name is the only thing that distinguishes it from its neighbours, so
the name is now what gets read.

New `serviceIcon(name, category)` matches keywords against the lowercased name
and falls back to the category when nothing matches — owners type their own
service names, and an unrecognised one still needs a glyph.

Ordering carries the real work, because the obvious names collide:

| Name | Contains | Resolves to | Why |
|---|---|---|---|
| `Dry cleaning — Gown` | "dry" | sparkles | checked before any dryer rule; a sun on a gown would be plainly wrong |
| `Wash, Dry & Iron` | wash, dry, iron | flame | a service that presses is a pressing service, even if it washes first |
| `Wash, Dry & Fold` | wash, dry, fold | shirt | what the customer hands over is a bag of clothes |
| `Self-service wash` | wash | water | the machine it actually uses |
| `Self-service dry` | dry | sunny | ditto |
| `Curtains` | curtain | layers | no longer a bed |

Tagalog keywords (`labada`, `laba`, `kumot`, `plantsa`, `tuyo`) are included,
since owners name services in the language they speak at the counter.

## What else was not premium

Icons alone would not have fixed it. Four other things read as component
library rather than as product:

**The grey category bar.** A filled `colors.sunken` band across the sheet is a
spreadsheet header. It is now unfilled — tracked caps in the shop's own accent
ink, with a hairline above each subsequent section. It also lost its glyph: the
rows below carry icons now, so a category glyph would be the third thing saying
"bedding" within one inch.

**Full-bleed dividers.** The rule ran the entire width, cutting under the
icons. It now lives on the row's *content* rather than the row, so it starts at
the text edge. An inset rule is the cheapest thing on the screen and the detail
that most reads as built rather than assembled.

**Circular tiles would have been wrong.** The service tile is a 38pt squircle
(radius 12), not a circle. Circles are avatars — they say "a person or a brand".
A rounded square says "a thing you can buy". The tile takes the shop's
`accent.surface` when connected, so every row belongs to *this* laundry.

**Sheet radius 18 → 22.** On a tall sheet, the larger radius is the difference
between a container and a considered object.

## Tests

**RED first.** Eight cases written before the module existed:

```
Test Suites: 1 failed — Cannot find module '../service-icon'
```

**GREEN after:** `8 passed` — the three bedding services diverge, self-service
reads its machine, fold outranks the wash beside it, pressing outranks the wash
beside it, dry cleaning stays away from the dryer, case and stray punctuation
are ignored, unknown names fall back to the category, and no input ever yields
an empty glyph.

One test was **wrong and was corrected, not the code**: it asserted that
"Bayad sa labada" would fall through to the category, but `labada` is a keyword
deliberately shipped, so matching it is right. The example was changed to a
genuinely unrecognised name ("Rush handling fee").

## Verification

| Check | Result |
|---|---|
| `npx jest src/lib/domain/__tests__/service-icon.test.ts` (pre-impl) | suite failed, module not found (RED) |
| same, post-impl | 8/8 passed (GREEN) |
| `npx jest` | 50 suites, 482/482 passed |
| `npx tsc --noEmit` | clean |
| `npx eslint <changed files>` | clean |

Contrast: `accent.ink` on `accent.surface` ≥5:1 for both the tile glyph and the
band label (every `ACCENTS` pair is checked against its own surface); price ink
on white ≥12:1; unit and minimum unchanged. Icons never carry meaning alone —
every row states its service in words beside the glyph.

## Preserved

Every price, name, unit, and minimum; grouping and canonical order; the connect
gate and the unconnected treatment (tiles fall back to `colors.sunken` /
`colors.subtle`); all queries and routes; and the spoken `accessibilityLabel`,
which still reads the full `formatPriceLine` sentence.

## Note on row height

The tile adds ~14pt per row against the previous pass (≈44 → ≈58), still well
under the ≈68–78 of the version first flagged as too tall. If scroll matters
more than icons on a long menu, the tile is a one-line removal — but the icons
are what make the column scannable without reading every name, which is the
thing that was missing.
