/**
 * Which accent each thing wears.
 *
 * A customer's connected shops are the only list on the home screen where
 * colour carries identity rather than state: a shop that is always teal is
 * findable at a glance, the way a contact avatar is.
 *
 * Two rules are in tension. A shop's tone should be *stable* — surviving a
 * re-sort, a reload, a reinstall — which argues for hashing its id. But two
 * shops on screen together must never share a tone, and with a six-colour
 * palette any pair collides one time in six no matter how good the hash is;
 * that is the pigeonhole principle, not a weak function. ("sparkle-wash" and
 * "sparkle-clean" genuinely collided.)
 *
 * So: hash for the preference, then resolve collisions across the list.
 * Stable in the common case, distinct always.
 */

/** djb2, then murmur3's finaliser so one changed character moves all 32 bits. */
function hash32(seed: string): number {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    // >>> 0 keeps the running value an unsigned 32-bit int, so a long name
    // cannot tip it negative and produce a negative index.
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) >>> 0;
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b) >>> 0;
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35) >>> 0;
  hash ^= hash >>> 16;
  return hash >>> 0;
}

/** The accent a seed prefers, before any collision is resolved. */
export function accentIndex(seed: string, count: number): number {
  if (!Number.isInteger(count) || count < 1) return 0;
  return hash32(seed) % count;
}

/**
 * One accent per seed, in list order. Each keeps its preferred tone unless an
 * earlier item already took it, in which case it walks to the next free one.
 * Once the palette is exhausted the preference stands — beyond `count` items
 * repeats are unavoidable, and a stable colour beats an arbitrary one.
 */
export function assignAccents(seeds: readonly string[], count: number): number[] {
  if (!Number.isInteger(count) || count < 1) return seeds.map(() => 0);

  const taken = new Set<number>();
  return seeds.map((seed) => {
    const preferred = accentIndex(seed, count);
    if (taken.size >= count) return preferred;

    let chosen = preferred;
    while (taken.has(chosen)) chosen = (chosen + 1) % count;
    taken.add(chosen);
    return chosen;
  });
}
