// The only place the ImageKit private key exists.
//
// ImageKit replaced Supabase Storage as the app's image store. Its private key
// can do anything to the media library, so it never leaves this function; the
// app bundle carries no ImageKit credential at all.
//
// Two things happen here, and both are gated on the same question the old
// storage policies asked:
//
//   - `upload-token` mints a v2 upload JWT. v2 signs the *whole* payload, so
//     the folder and file name this function chooses are part of the token and
//     ImageKit itself rejects an upload that moves them. That is what stops one
//     shop's owner from writing over another shop's logo — the hole v1 would
//     have left open, since a v1 signature covers only a token and an expiry.
//   - `view-url` signs a short-lived URL for a private order photo. A load of
//     laundry and a receipt carrying a customer's name are not public objects.
//
// Authorization runs as the caller, against the same rows the storage policies
// used to consult: `can_manage_shop(shop_id)` (an owner, or a superadmin —
// staff cannot rebrand the shop, migration 0021) for a shop's branding, and a
// plain read of the order for its photos, which RLS already limits to that
// order's customer, the shop's members, and a superadmin.
//
// Deploy:  supabase functions deploy imagekit-media
//          (JWT verification stays ON — every caller here is signed in.)
// Secrets: supabase secrets set IMAGEKIT_PRIVATE_KEY=... IMAGEKIT_PUBLIC_KEY=... \
//            IMAGEKIT_URL_ENDPOINT=https://ik.imagekit.io/<imagekit_id>

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

/** Long enough to pick a photo and push it up a shop's wifi, short enough to matter. */
const UPLOAD_TOKEN_TTL_SECONDS = 600;

/** Mirrors PRIVATE_IMAGE_TTL_SECONDS in src/lib/domain/imagekit.ts. */
const VIEW_URL_TTL_SECONDS = 60 * 60;

/**
 * What a camera or a picker on a phone actually produces. The extension only
 * ever reaches a file name, never a path, but an unbounded string here would
 * still let a caller shape the key ImageKit stores.
 */
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'heic'];

const SHOP_KINDS = ['logo', 'cover'];
const ORDER_KINDS = ['weigh', 'proof'];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── crypto ───────────────────────────────────────────────────────────────
async function hmac(hash: 'SHA-1' | 'SHA-256', key: string, data: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(key),
    { name: 'HMAC', hash },
    false,
    ['sign']
  );
  return crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(data));
}

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function base64url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * An ImageKit v2 upload token: an HS256 JWT whose payload *is* the upload
 * parameters, and whose `kid` is the account's public key.
 */
async function uploadToken(
  payload: Record<string, string>,
  privateKey: string,
  publicKey: string
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: publicKey }));
  const body = base64url(
    JSON.stringify({ ...payload, iat: issuedAt, exp: issuedAt + UPLOAD_TOKEN_TTL_SECONDS })
  );
  const signature = base64url(await hmac('SHA-256', privateKey, `${header}.${body}`));
  return `${header}.${body}.${signature}`;
}

/**
 * A signed delivery URL. ImageKit signs the URL with the endpoint stripped off
 * and the expiry appended; `ik-t` is added afterwards, so it is not itself part
 * of what was signed.
 */
async function signedUrl(
  filePath: string,
  urlEndpoint: string,
  privateKey: string
): Promise<string> {
  const endpoint = urlEndpoint.replace(/\/$/, '');
  const url = `${endpoint}${filePath.startsWith('/') ? '' : '/'}${filePath}`;
  const expiry = Math.floor(Date.now() / 1000) + VIEW_URL_TTL_SECONDS;
  const signature = hex(await hmac('SHA-1', privateKey, `${url.replace(`${endpoint}/`, '')}${expiry}`));
  return `${url}?ik-t=${expiry}&ik-s=${signature}`;
}

// ── request shapes ───────────────────────────────────────────────────────
interface Body {
  action?: string;
  purpose?: string;
  shop_id?: string;
  order_id?: string;
  kind?: string;
  extension?: string;
  file_path?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The order an ImageKit photo path belongs to — and null unless the path is one
 * this function itself could have minted.
 *
 * `view-url` signs whatever it is handed, so without this shape check a caller
 * who can read one order could ask for a signature over any file in the
 * library. Mirrors orderIdOfImagePath in src/lib/domain/imagekit.ts.
 */
function orderIdOfPhotoPath(filePath: string): string | null {
  const match = /^\/orders\/([^/]+)\/[a-z]+-\d+\.[a-z0-9]+$/.exec(filePath);
  return match && UUID_RE.test(match[1]) ? match[1] : null;
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
  const privateKey = Deno.env.get('IMAGEKIT_PRIVATE_KEY');
  const publicKey = Deno.env.get('IMAGEKIT_PUBLIC_KEY');
  const urlEndpoint = Deno.env.get('IMAGEKIT_URL_ENDPOINT');
  if (!supabaseUrl || !anonKey || !privateKey || !publicKey || !urlEndpoint) {
    console.error('imagekit-media: missing environment');
    return json({ error: 'Function is not configured' }, 500);
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Request body must be JSON' }, 400);
  }

  // Acts as the caller, so RLS and can_operate_shop() answer for them.
  const asCaller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (body.action === 'view-url') {
    // The path names its own order, so nothing else needs to be sent — and the
    // order it names is the one authorized below.
    const filePath = String(body.file_path ?? '');
    const orderId = orderIdOfPhotoPath(filePath);
    if (!orderId) {
      return json({ error: 'Unknown image' }, 400);
    }
    if (!(await mayReadOrder(asCaller, orderId))) {
      return json({ error: 'not allowed' }, 403);
    }
    return json({ url: await signedUrl(filePath, urlEndpoint, privateKey) });
  }

  if (body.action !== 'upload-token') {
    return json({ error: 'Unknown action' }, 400);
  }

  const extension = String(body.extension ?? '').toLowerCase();
  const kind = String(body.kind ?? '');
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return json({ error: 'Unsupported image type' }, 400);
  }

  let folder: string;
  let isPrivateFile: boolean;

  if (body.purpose === 'shop') {
    const shopId = String(body.shop_id ?? '');
    if (!UUID_RE.test(shopId) || !SHOP_KINDS.includes(kind)) {
      return json({ error: 'Unknown image' }, 400);
    }
    const { data: allowed, error } = await asCaller.rpc('can_manage_shop', {
      p_shop_id: shopId,
    });
    if (error) return json({ error: error.message }, 401);
    if (allowed !== true) return json({ error: 'not allowed' }, 403);
    folder = `/shops/${shopId}`;
    isPrivateFile = false;
  } else if (body.purpose === 'order') {
    const orderId = String(body.order_id ?? '');
    if (!UUID_RE.test(orderId) || !ORDER_KINDS.includes(kind)) {
      return json({ error: 'Unknown image' }, 400);
    }
    if (!(await mayReadOrder(asCaller, orderId))) {
      return json({ error: 'not allowed' }, 403);
    }
    folder = `/orders/${orderId}`;
    isPrivateFile = true;
  } else {
    return json({ error: 'Unknown purpose' }, 400);
  }

  // Every value stringified: ImageKit compares the multipart fields against
  // the JWT payload verbatim, and a number there would never match the text
  // the client sends.
  const uploadPayload: Record<string, string> = {
    fileName: `${kind}-${Date.now()}.${extension}`,
    folder,
    useUniqueFileName: 'false',
    overwriteFile: 'true',
    isPrivateFile: String(isPrivateFile),
  };

  return json({
    upload_payload: uploadPayload,
    token: await uploadToken(uploadPayload, privateKey, publicKey),
  });
});

/**
 * Whether the caller may see this order at all. `orders` RLS already answers
 * exactly the question the old `order-photos` policies asked — the order's
 * customer, the shop's members, or a superadmin — so a read that returns a row
 * is the authorization.
 */
async function mayReadOrder(
  client: ReturnType<typeof createClient>,
  orderId: string
): Promise<boolean> {
  const { data, error } = await client
    .from('orders')
    .select('id')
    .eq('id', orderId)
    .maybeSingle();
  return !error && Boolean(data);
}
