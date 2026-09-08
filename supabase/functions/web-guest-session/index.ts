// Turns a name and a mobile number, typed on a shop's web page, into a signed-in
// customer.
//
// Supabase phone sign-in needs a paid SMS provider, which this project avoids,
// so accounts run on a synthetic email derived from the number (see
// src/lib/domain/phone-email.ts). A guest has no password, and must not be
// asked to invent one to book a wash. So:
//
//   - A number with no account gets one, with a random password the guest never
//     sees, and the browser receives a one-time sign-in token to exchange for a
//     session. The tracking page later offers "set a password" for the app.
//   - A number that already has an account gets { exists: true } and nothing
//     else. The page then asks for that account's password. This is the line
//     that stops anyone from booking as you by typing your number.
//
// Rate limited per IP and per number through note_guest_attempt (migration
// 0020), so the function can neither mass-create accounts nor be used to find
// out which numbers have one at any useful speed.
//
// Deploy:  supabase functions deploy web-guest-session --no-verify-jwt
// Secrets: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected by the
//          platform. AUTH_EMAIL_DOMAIN must match EXPO_PUBLIC_AUTH_EMAIL_DOMAIN
//          in the app if either is overridden.

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Which web origins may call this from a browser. Unset means any, for local
// previews and the first deploy; set it to the storefront host(s) once known:
//   supabase secrets set ALLOWED_ORIGINS=https://milaundry.app,https://wash.example.ph
const ALLOWED_ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get('origin') ?? '';
  const allowed =
    ALLOWED_ORIGINS.length === 0 ? '*' : ALLOWED_ORIGINS.includes(origin) ? origin : 'null';
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

// Mirrors src/lib/domain/{phone-email,guest-identity}.ts. Duplicated on
// purpose: this runs on Deno and must not trust the client.
const E164_RE = /^\+[1-9]\d{7,14}$/;
const MIN_NAME_LENGTH = 2;
const AUTH_EMAIL_DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'example.com';

/**
 * A few per minute per number, a few more per address (a family on one wifi),
 * and a ceiling for the whole function. The address can be spoofed by anyone
 * who writes their own X-Forwarded-For, so the global ceiling is the one that
 * actually bounds mass account creation and number enumeration.
 */
const PHONE_LIMIT = 5;
const IP_LIMIT = 20;
const GLOBAL_LIMIT = 120;
const WINDOW_SECONDS = 60;

interface GuestSessionBody {
  phone?: unknown;
  full_name?: unknown;
}

function json(request: Request, body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json' },
  });
}

function validate(body: GuestSessionBody): { phone: string; fullName: string } | string {
  const phone = String(body.phone ?? '').trim();
  const fullName = String(body.full_name ?? '').trim();
  if (!E164_RE.test(phone)) return 'phone must be an E.164 mobile number';
  if (fullName.length < MIN_NAME_LENGTH) return 'full_name is required';
  return { phone, fullName };
}

/**
 * The address the platform's own proxy saw. Proxies append to
 * X-Forwarded-For, so the last entry is theirs and the first is whatever the
 * caller typed; a proxy-set header wins when present.
 */
function clientAddress(request: Request): string {
  const proxied = request.headers.get('cf-connecting-ip');
  if (proxied) return proxied;
  const hops = (request.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter(Boolean);
  return hops[hops.length - 1] ?? 'unknown';
}

/** A password nobody knows. The guest signs in by token; the app by choice. */
function randomPassword(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(request) });
  }
  if (request.method !== 'POST') {
    return json(request, { error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('web-guest-session: missing Supabase environment');
    return json(request, { error: 'Function is not configured' }, 500);
  }

  let body: GuestSessionBody;
  try {
    body = await request.json();
  } catch {
    return json(request, { error: 'Request body must be JSON' }, 400);
  }

  const valid = validate(body);
  if (typeof valid === 'string') {
    return json(request, { error: valid }, 400);
  }

  const asService = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Both counters are charged before anything is looked up, so a refused
  // request costs the caller exactly as much as an answered one.
  const counters = await Promise.all(
    [
      [`ip:${clientAddress(request)}`, IP_LIMIT],
      [`phone:${valid.phone}`, PHONE_LIMIT],
      ['global', GLOBAL_LIMIT],
    ].map(([key, limit]) =>
      asService.rpc('note_guest_attempt', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: WINDOW_SECONDS,
      })
    )
  );
  const counterError = counters.find((result) => result.error)?.error;
  if (counterError) {
    console.error('web-guest-session: rate limit check failed', counterError);
    return json(request, { error: 'Could not check this request' }, 500);
  }
  if (counters.some((result) => result.data === false)) {
    return json(request, { error: 'Too many attempts. Wait a minute and try again.' }, 429);
  }

  const email = `${valid.phone.slice(1)}@${AUTH_EMAIL_DOMAIN}`;

  const { data: created, error: createError } = await asService.auth.admin.createUser({
    email,
    password: randomPassword(),
    email_confirm: true,
    user_metadata: { full_name: valid.fullName, phone: valid.phone },
  });

  if (createError) {
    // The one expected failure: the number already belongs to someone. Say so
    // and nothing more; the page asks for their password next.
    // Matched on the code alone: a message that merely contains "already"
    // (a trigger failure, say) must not turn into a password prompt for an
    // account that does not exist.
    if (createError.code === 'email_exists') {
      return json(request, { exists: true }, 200);
    }
    console.error('web-guest-session: createUser failed', createError);
    return json(request, { error: 'Could not create the account' }, 400);
  }
  if (!created?.user) {
    return json(request, { error: 'Could not create the account' }, 400);
  }

  const { data: link, error: linkError } = await asService.auth.admin.generateLink({
    type: 'magiclink',
    email,
  });
  if (linkError || !link?.properties?.hashed_token) {
    // The account exists but cannot be entered. Remove it so the next attempt
    // starts clean rather than landing on "exists" with no password to give.
    await asService.auth.admin.deleteUser(created.user.id);
    console.error('web-guest-session: generateLink failed', linkError);
    return json(request, { error: 'Could not start the session' }, 500);
  }

  return json(request, { token_hash: link.properties.hashed_token }, 200);
});
