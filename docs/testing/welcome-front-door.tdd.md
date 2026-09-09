# The front door — scan first, then sign in or create — TDD evidence

**Date:** 2026-09-06
**Branch:** main
**Targets:** `src/lib/domain/welcome-flow.ts`, `src/lib/domain/splash-gate.ts`,
`src/lib/pending-scan-store.ts`, `src/lib/use-finish-scan.ts`,
`src/app/(auth)/welcome.tsx`, `src/app/(auth)/scan-laundry.tsx`,
`src/app/(auth)/sign-in.tsx`, `src/app/(auth)/sign-up.tsx`,
`src/components/handoff-note.tsx`, `supabase/migrations/0016_peek_scan.sql`

## Request

> "Initially if they are not logged in yet, we want to first make it easier for
> them to get started. We want first to allow them to scan the laundry or if
> they have account sign in or scan the laundry and create account. We want the
> flow to be really good. I want you to design that screen pretty good. Make it
> very creative and intuitive for customers and owners to easily login or add a
> laundry and get started."

## The thesis

Before this, the splash handed over to a sign-in form, and the only way to scan
a laundry was from a tab that needs an account. A customer standing at a counter
with the code in front of them had to invent an account first and find the
scanner second.

Now the splash hands over to a **welcome**, and the scan is the one big control
on it. Sign in and create account are not the gate in front of the scan; they
are the two ways to *finish* it.

```
splash ──► welcome ──┬─► scan ──► "Sparkle Wash is ready for you"
                     │             ├─► create account ─┐
                     │             └─► sign in ────────┤
                     ├─► sign in ─────────────────────┤──► connected, on the shopfront
                     ├─► create account ──────────────┘    (with the first-laundry welcome)
                     └─► shop sign in (owners) ──► owner dashboard
```

A scan made before there is an account is held in memory (`pending-scan-store`)
and finished by `useFinishScan` the moment the session exists. The customer
never sees a second step and never has to find the code twice.

## The screens

**Welcome.** Opens on the same water the splash closed on: the hero gradient,
two crests drifting behind the wordmark on the splash's seamless one-width loop.
The sheet rises to meet it. The scan tile is the only blue surface on the screen
— blue means "you can act here", and this is the act — with a drawn viewfinder
whose line reads once every few seconds. Sign in and create account are a pair
of white tiles beneath. Owners get one quiet line at the foot: they are one
visitor in a hundred and know who they are.

**Scan.** Full-bleed camera under a scrim, the frame left clear, a sweep across
it while the camera is looking. When a code is recognised the camera *stops*
(`active={false}`) and the laundry answers by name on a card in its own accent —
the mark landing with the shopfront's overshoot, so the card is a preview of
where they are about to be. Two ways in on the card. A bad read shows one of
three sentences, none of which blames the customer, and resumes after 1.5 s.

**Sign in.** One form, two voices. From the front door it asks a customer for
their mobile number; from "Run a laundry?" it asks an owner for their shop
username, with an eyebrow, a `default` keyboard, only username chips, and a
note explaining that MiLaundry sets each laundry up and hands the owner the
login. The single box still accepts either — the parser does not care — but
nobody is asked for a thing they do not have.

**Handoff note.** When a scan brought them here, the laundry rides on top of
both forms: its mark in its colour, and one line saying what happens the moment
they are in. A promise, not a step.

## The server window

Shops are readable only by authenticated users, so a guest could not learn a
laundry's name from its code. `peek_scan(p_type, p_id, p_token)` is the one
token-gated window: display fields only, and only for a code that would work
once they are in (an active shop's own token, or the claim token of an order
nobody has claimed). A wrong token returns nothing — the same answer an unknown
id gives — so the function cannot confirm that an id exists.

Verified against the live project as `anon`:

| probe | rows |
|---|---|
| right token | 1 |
| wrong token | 0 |
| direct `select` from shops | 0 |

## What was worth testing

`welcome-flow.ts` holds the words and the routes, apart from the pixels, because
they are the design decisions that would drift.

**The real defect this prevents is a false milestone.** `afterAuthRoute` carries
the pre-join count to the shopfront so it can stage "Sparkle Wash is your first
laundry" — and drops the param entirely on a count that cannot be trusted
(`NaN`, negative, fractional) rather than risk saying it on a fifth. Same rule
as `connection-welcome.ts`, pinned at the other end of the handoff.

Also pinned:

- `parseSignInMode` takes the first value when Expo Router repeats a key, and
  treats anything but `owner` as a customer;
- the owner form shows only username chips; the customer form keeps every chip,
  so a merchant who came in the front door still finds theirs;
- `fallbackRouteAfterFailedScan` still opens the shopfront for a refused shop
  scan (the connect control lives there) and goes home for an unclaimable order;
- `openRoute` sends a signed-out open to `/welcome`, never to a form.

```
PASS src/lib/domain/__tests__/welcome-flow.test.ts
PASS src/lib/domain/__tests__/splash-gate.test.ts
Test Suites: 78 passed, 78 total
Tests:       871 passed, 871 total
```

`tsc --noEmit` and `expo lint` are clean.

## Left as is, on purpose

- **Owner self-serve is not built.** Shops are created by the superadmin, who
  generates the branded username and temporary password (`SETUP.md`). The
  owner path here is the sign-in plus a note saying so; letting an owner create
  a shop from the welcome is a product decision with its own migration, RLS
  and username work.
- `(customer)/scan.tsx`, the signed-in scanner on the tab bar, is untouched.
- A scan does not survive a relaunch. Its token is a live key to a laundry's
  customer list, and a code scanned last week must not quietly connect an
  account created today.
