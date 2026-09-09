# TDD evidence — images move to ImageKit

**Source plan:** none. Derived during this run from the request: *"use imagekit
for storing images, use this as the main for storage"*, with the account's
public key, private key and URL endpoint supplied.

## What was there before

| Image | Where it lived | How it was guarded |
|---|---|---|
| Shop logo, shop cover | `shop-logos` bucket, public | `storage.objects` policy on the `<shop_id>` folder (0012, 0014) |
| Weigh photo, payment receipt | `order-photos` bucket, private | four `storage.objects` policies on the `<order_id>` folder (0011) |

Both upload paths read the file natively and guarded the byte count
(`domain/photo-upload.ts`), after a photo once uploaded as fourteen bytes.

## The decision that shaped the work

ImageKit's **v1** upload signature covers only a token and an expiry — nothing
about *where* the file goes. Handing a signed-in merchant v1 credentials would
have let them upload over another shop's logo, which the Supabase policies had
prevented. The **v2** upload API signs the entire payload as a JWT, so the
folder and file name the server picks are inside the token and ImageKit itself
refuses an upload that moves them. v2 is what the Edge Function issues, and
`IMAGEKIT_UPLOAD_URL` is asserted in a test that says why.

## Task report

### Task 1 — `domain/imagekit.ts`, TDD-first

**RED.** `npx jest imagekit` →
`Cannot find module '../imagekit' from imagekit.test.ts:1:1`,
`Test Suites: 1 failed`, `Tests: 0 total`.

**GREEN.** Same command after implementing → `Tests: 16 passed`.

The module holds no credential and decides nothing about authorization. It is
the wire shape between the app and the function, which is worth testing because
an upload field that disagrees with the token by one character fails the whole
upload: `uploadFormFields` is asserted to echo *every* signed parameter and
drop none, and `uploadTokenRequest` is asserted **not** to contain a `folder` —
a client that could name its own folder is the hole v2 exists to close.

`isImagekitFilePath` is the compatibility seam. Supabase keys were
`<order_id>/<file>`; ImageKit reports `/orders/<order_id>/<file>`. That one
leading slash is the whole discriminator, so it has its own tests — orders
photographed last week must still show their evidence, and they do, through the
unchanged Storage path in `orderPhotoUrl`.

### Task 2 — the function that holds the key

`supabase/functions/imagekit-media` mints upload tokens and signs view URLs. It
asks the same questions the storage policies asked, as the caller:
`can_operate_shop(shop_id)` for branding, and a plain read of the order for its
photos — `orders` RLS already limits that to the order's customer, the shop's
members, and a superadmin.

`view-url` reads the order out of the path rather than trusting a separate
field, and refuses any path it could not have minted itself. Without that shape
check, someone who can read one order could have asked for a signature over any
file in the library.

### Task 3 — verified against the live account

Deno's `crypto.subtle` HMAC and the JWT assembly were reproduced in Node against
the real ImageKit account before deploying anything, uploading a 1×1 PNG to a
`/_selftest` folder and deleting it again:

```
UPLOAD  200 {"filePath":"/_selftest/selftest-1788836972726.png", ...}
PLAIN   403      ← a private file refuses its own plain CDN URL
SIGNED  200 image/png
CLEANUP 204
```

That is the whole contract: v2 token accepted, private file genuinely private,
`ik-t`/`ik-s` signature accepted, and nothing left behind in the library.

### Task 4 — dead weight removed

`photoObjectPath` named order-photo objects client-side. ImageKit names them in
the function now, so it and its tests are gone rather than left to rot.

## Result

`npx jest` → `Test Suites: 92 passed`, `Tests: 1042 passed`.
`npx tsc --noEmit` → clean.
`npx expo lint` → one pre-existing error in `(merchant)/_layout.tsx`, untouched
by this work.

## Not done here

The function still has to be deployed and its three secrets set; both need
Supabase credentials this run did not have. `docs/SETUP.md` carries the two
commands. Until then, uploading an image reports that it could not be uploaded,
and nothing else changes.
