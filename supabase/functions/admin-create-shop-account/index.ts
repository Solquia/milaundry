// Creates a login account for a laundry shop and attaches it to that shop.
//
// Creating an auth user needs the service_role key, which can never ship in
// the Expo bundle — so it happens here. The caller's own JWT is checked first,
// and the user is only created once that check passes, so a rejected request
// can never leave an orphaned auth user behind.
//
// Two callers are allowed: a superadmin, who may attach either role to any
// shop, and a shop owner, who may attach staff to their own shop and nothing
// else.
//
// Accounts sign in with either a branded username (auto-generated with the
// shop, e.g. sparklewash) or an E.164 mobile number; at least one is required.
//
// Deploy:  supabase functions deploy admin-create-shop-account
// Secrets: SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are
//          injected by the platform. AUTH_EMAIL_DOMAIN is optional and must
//          match EXPO_PUBLIC_AUTH_EMAIL_DOMAIN in the app.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Mirrors src/lib/domain/{phone-email,login-id,credentials}.ts.
// Duplicated deliberately: this runs on Deno and must not trust the client.
const E164_RE = /^\+[1-9]\d{7,14}$/;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHOP_ROLES = ['owner', 'staff'];
const MIN_PASSWORD_LENGTH = 8;
const AUTH_EMAIL_DOMAIN = Deno.env.get('AUTH_EMAIL_DOMAIN') ?? 'example.com';

interface CreateShopAccountBody {
  shop_id?: unknown;
  full_name?: unknown;
  phone?: unknown;
  username?: unknown;
  password?: unknown;
  role?: unknown;
}

interface ValidBody {
  shopId: string;
  fullName: string;
  phone: string;
  username: string;
  password: string;
  role: string;
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function validate(body: CreateShopAccountBody): ValidBody | string {
  const shopId = String(body.shop_id ?? '');
  const fullName = String(body.full_name ?? '').trim();
  const phone = String(body.phone ?? '').trim();
  const username = String(body.username ?? '').trim().toLowerCase();
  const password = String(body.password ?? '');
  const role = String(body.role ?? '');

  if (!UUID_RE.test(shopId)) return 'shop_id must be a shop UUID';
  if (fullName.length < 2) return 'full_name is required';
  if (!phone && !username) return 'a username or phone is required';
  if (phone && !E164_RE.test(phone)) return 'phone must be an E.164 mobile number';
  if (username && (!USERNAME_RE.test(username) || !/[a-z]/.test(username))) {
    return 'username must be 3-30 characters (letters, numbers, . _ -) with at least one letter';
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (!SHOP_ROLES.includes(role)) return 'role must be owner or staff';

  return { shopId, fullName, phone, username, password, role };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return json({ error: 'not authenticated' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('admin-create-shop-account: missing Supabase environment');
    return json({ error: 'Function is not configured' }, 500);
  }

  let body: CreateShopAccountBody;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON' }, 400);
  }

  const valid = validate(body);
  if (typeof valid === 'string') {
    return json({ error: valid }, 400);
  }

  // Acts as the calling user, so RLS and my_role() apply to them.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Authorize BEFORE creating anything.
  const { data: callerRole, error: roleError } = await asCaller.rpc('my_role');
  if (roleError) {
    return json({ error: roleError.message }, 401);
  }

  const isSuperadmin = callerRole === 'superadmin';

  // A shop owner may cut a key for their own counter, and only ever a staff
  // key. Another owner, or any other shop, stays superadmin work. The role is
  // tested here and hardcoded again inside owner_attach_shop_staff, so neither
  // layer is load-bearing on its own.
  let isShopOwner = false;
  if (!isSuperadmin && valid.role === 'staff') {
    const { data: canManage } = await asCaller.rpc('can_manage_shop', {
      p_shop_id: valid.shopId,
    });
    isShopOwner = canManage === true;
  }

  if (!isSuperadmin && !isShopOwner) {
    return json({ error: 'not allowed' }, 403);
  }

  const asService = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Usernames are the branded identity; phones remain supported for staff
  // added by mobile number. The synthetic email mirrors src/lib/domain.
  const localPart = valid.username || valid.phone.slice(1);
  const { data: created, error: createError } = await asService.auth.admin.createUser({
    email: `${localPart}@${AUTH_EMAIL_DOMAIN}`,
    password: valid.password,
    email_confirm: true,
    user_metadata: {
      full_name: valid.fullName,
      phone: valid.phone,
      username: valid.username,
    },
  });

  if (createError || !created?.user) {
    return json({ error: createError?.message ?? 'Could not create the account' }, 400);
  }

  // Attaching runs as the caller, so the database re-checks who is asking
  // rather than trusting this function. The owner path takes no role argument
  // at all — that is the guarantee, not a check.
  const { error: attachError } = isSuperadmin
    ? await asCaller.rpc('admin_attach_shop_account', {
        p_shop_id: valid.shopId,
        p_profile_id: created.user.id,
        p_role: valid.role,
      })
    : await asCaller.rpc('owner_attach_shop_staff', {
        p_shop_id: valid.shopId,
        p_profile_id: created.user.id,
      });

  if (attachError) {
    // Roll back so a failed attach does not strand a login with no shop.
    await asService.auth.admin.deleteUser(created.user.id);
    return json({ error: attachError.message }, 400);
  }

  return json(
    {
      profile_id: created.user.id,
      full_name: valid.fullName,
      phone: valid.phone,
      username: valid.username,
      role: valid.role,
    },
    200
  );
});
