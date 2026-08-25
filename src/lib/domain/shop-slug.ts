export const MAX_SLUG_LENGTH = 40;

/**
 * URL-ish identity for a shop, shown as /sparkle-wash in the console and used
 * to brand the auto-generated login. Mirrored by the slug backfill in
 * supabase/migrations/0008_shop_branding.sql.
 */
export function slugifyShopName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');
}

/** First free slug among `taken`, suffixing -2, -3, … like file managers do. */
export function uniqueSlug(base: string, taken: string[]): string {
  const existing = new Set(taken);
  if (!existing.has(base)) return base;
  for (let suffix = 2; ; suffix += 1) {
    const candidate = `${base}-${suffix}`;
    if (!existing.has(candidate)) return candidate;
  }
}
