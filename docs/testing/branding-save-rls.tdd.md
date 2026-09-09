# Saving a shopfront — TDD evidence

## Source plan

No `*.plan.md`. Journeys were derived during this TDD run from a merchant bug
report: the Settings → shopfront card showed **"The price was not saved. Try
again in a moment."** after picking a new logo and pressing *Save branding*.

## User journeys

1. As a shop owner, I want to upload a logo for my shopfront, so that customers
   browsing the app recognise my shop.
2. As a shop owner, when a save fails, I want to be told *what* failed in my own
   words, so that I know which part of the screen to try again.

## Task report

### Task 1 — Logo upload was denied for every shop member (root cause)

`uploadBrandLogo` (`src/lib/api.ts:465`) writes `shop-logos/<shop_id>/<ts>.<ext>`.
The RLS policy gating that write, added in
`supabase/migrations/0012_shop_branding_self_serve.sql:71-84`, was written as:

```sql
exists (
  select 1 from public.shops s
  where s.id::text = (storage.foldername(name))[1]
    and public.can_operate_shop(s.id)
)
```

Unqualified `name` inside the subquery binds to `shops.name`, not
`storage.objects.name`. Postgres resolved it that way and stored it that way —
the deployed definition read `storage.foldername(s.name)`.

`storage.foldername('Sparkle clean')` is `{}`, so `[1]` is `null`,
`s.id::text = null` is `null`, and the `exists` is **false for every row**. No
shop member could ever upload a logo. Superadmins were unaffected — they pass
through the separate `"superadmin manages shop logos"` policy — which is why the
bug survived review.

Because `branding-card.tsx` uploads *before* calling `set_shop_branding`, a
pending logo also blocked the colour and tagline from saving. Saving colour or
tagline with no logo picked always worked, which made the bug look intermittent.

The same shape appears in the `order-photos` policies in `0011`; those are
correct only by luck, because `orders` has no `name` column. `0014` qualifies the
column explicitly so a future column cannot silently break it.

**Validation command** (RED, before the fix):

```sql
select (storage.foldername(t.name))[1] as buggy_first_segment,
       exists (select 1 from public.shops s
               where s.id::text = (storage.foldername(t.name))[1]) as buggy_predicate,
       exists (select 1 from public.shops s
               where s.id::text = (storage.foldername(t.id::text || '/1730000000.jpg'))[1]) as fixed_predicate
from (select id, name from public.shops order by created_at limit 3) t;
```

```
shop_name      | buggy_first_segment | buggy_predicate | fixed_predicate
Sparkle Wash   | null                | false           | true
Sparkle clean  | null                | false           | true
```

**Validation command** (GREEN, after `0014`):

```sql
select policyname, pg_get_expr(polwithcheck, polrelid) from pg_policies ... ;
-- => ((bucket_id = 'shop-logos') AND (EXISTS (SELECT 1 FROM shops s
--     WHERE (((s.id)::text = (storage.foldername(objects.name))[1])
--            AND can_operate_shop(s.id)))))

-- predicate now resolves for a real object key:
shop_id                              | path_resolves_to_a_shop
b02c393b-dd55-4884-a0c4-af16f24a5ef1 | true
3e322460-95c8-4c89-a571-8e91bbbc481e | true
```

**Guaranteed:** an object keyed `<shop_id>/<file>` in `shop-logos` matches the
ownership predicate exactly when `can_operate_shop(<shop_id>)` holds. Flat legacy
keys still cannot be written by a merchant, which was `0012`'s stated intent.

### Task 2 — A branding failure reported itself as a price failure

`branding-card.tsx:81` called `friendlyMerchantError('save-price', …)`. There was
no `'save-branding'` action, so a rejected logo upload — whose raw message
`new row violates row-level security policy` matches `TECHNICAL_RE` and is
therefore replaced by a fallback — printed *"The price was not saved."* on a
screen with no prices on it.

**Validation command:** `npx jest merchant-error`

RED (test written first, implementation absent):

```
● friendlyMerchantError › tells a branding failure apart from a price failure
    Expected: "Your shopfront was not saved. Try again in a moment."
    Received: undefined
● friendlyMerchantError › covers every action with its own sentence
    TypeError: Cannot read properties of undefined (reading 'endsWith')
Tests: 2 failed, 4 passed, 6 total
```

GREEN (after adding `'save-branding'` to `MerchantAction` and `FALLBACKS`, and
switching the branding card to it):

```
√ tells a branding failure apart from a price failure (1 ms)
√ covers every action with its own sentence (1 ms)
Tests: 6 passed, 6 total
```

**Guaranteed:** every `MerchantAction` maps to a distinct sentence ending in a
full stop, and a branding failure never borrows the price wording.

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
|---|--------------------|----------------------|-----------|--------|----------|
| 1 | A branding failure produces its own sentence, never the price one | `src/lib/domain/__tests__/merchant-error.test.ts:tells a branding failure apart from a price failure` | unit | PASS | `npx jest merchant-error` |
| 2 | Every merchant action has a unique fallback sentence ending in a full stop | `src/lib/domain/__tests__/merchant-error.test.ts:covers every action with its own sentence` | unit | PASS | `npx jest merchant-error` |
| 3 | RLS wording is never shown to a shop owner | `src/lib/domain/__tests__/merchant-error.test.ts:never shows database wording to a shop owner` | unit | PASS | `npx jest merchant-error` |
| 4 | `shop-logos/<shop_id>/…` matches the ownership predicate for an operator of that shop | live SQL predicate evaluation against `pg_policies` + `storage.foldername` | integration (manual SQL) | PASS | see Task 1 GREEN block |
| 5 | No regression across the existing suite | `npx jest` | unit | PASS | 65 suites, 694 tests passed |
| 6 | Types still resolve with the widened union | `npx tsc --noEmit` | typecheck | PASS | exit 0, no output |

## Coverage and known gaps

- `npx jest` — **65 suites, 694 tests, all passing.** `npm run test:coverage` was
  not run; the repo defines no coverage threshold and this change adds one string
  constant plus one union member, both covered by tests 1–3.
- **Gap — the RLS fix has no automated test.** Guarantee #4 was verified by
  evaluating the policy predicate directly against the live database, before and
  after. The repo has no pgTAP or Supabase integration-test harness, so there is
  nothing to hang a regression test on. Worth adding; a single pgTAP file
  asserting the predicate for an operator and a non-operator would have caught
  this at `0012`.
- **Gap — not verified end-to-end on a device.** The predicate is proven correct
  and the policy is deployed, but an actual logo upload through the app has not
  been run. Please confirm on device.
- **Related bug found, not fixed (out of scope):** `order-photos` policies in
  `0011` use the same unqualified `name`. They are correct today only because
  `orders` has no `name` column. Adding one would break photo upload the same way.

## Merge evidence

- RED: policy predicate `false` for all shops; `jest merchant-error` 2 failed / 4 passed.
- GREEN: policy predicate `true` for a real object key; `jest merchant-error` 6 passed;
  full suite 694 passed; `tsc --noEmit` clean.
- Refactor: none — the fix was two constants and one corrected column reference.

## Checkpoint commits

**Not created.** The working tree carried substantial unrelated modifications on
`main` before this task, so staged checkpoint commits would have been ambiguous
about what each stage proved. The RED/GREEN evidence above is the substitute
record. Files changed by this task:

- `supabase/migrations/0014_fix_logo_policy_name_binding.sql` (new)
- `src/lib/domain/merchant-error.ts`
- `src/lib/domain/__tests__/merchant-error.test.ts`
- `src/components/branding-card.tsx`
