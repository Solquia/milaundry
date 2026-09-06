/**
 * What to say when the customer has no shops of their own yet.
 *
 * The Shops tab shows only the laundries a customer has connected to. Other
 * shops are not listed — a customer meets a laundry by standing in it — so the
 * one way forward is the code at the counter, and the sentence says exactly
 * that rather than pointing at a list that is not there.
 */
export function emptyDirectoryMessage(mineCount: number): string | null {
  if (mineCount > 0) return null;
  return "You haven't connected to a laundry shop yet. Scan the shop's QR code at the counter to connect.";
}

/** What the customer was doing when the directory failed them. */
export type DirectoryAction = 'load' | 'connect';

const DIRECTORY_FALLBACKS: Record<DirectoryAction, string> = {
  load: 'The shop list did not load. Try again in a moment.',
  connect: "We couldn't connect you to this shop. Try again in a moment.",
};

const DIRECTORY_OFFLINE = 'No internet connection. Check your signal and try again.';

const CONNECTION_RE = /network|fetch|timeout|offline|connection|econnrefused/i;

/** Postgres, PostgREST, and HTTP detail that means nothing to a customer. */
const TECHNICAL_RE =
  /[{}[\]]|\bPGRST\w*|\b[45]\d{2}\b|violates|constraint|\brelation\b|\bcolumn\b|null value|duplicate key|\bsyntax\b|\bundefined\b|\bnull\b/i;

/**
 * Turns a backend failure into something the customer can act on. A message
 * that already reads like a sentence — a shop's own "not accepting new
 * customers" — is passed through untouched.
 *
 * The two actions keep separate fallbacks on purpose: "something went wrong" on
 * both leaves a customer unable to tell a shop list that never arrived from a
 * shop that would not take them.
 *
 * Sibling mappers: `booking-error.ts` (booking), `merchant-error.ts` (owner),
 * `auth-error.ts` (sign-in), `admin-error.ts` (superadmin). Each surface keeps
 * its own wording deliberately, so one screen's copy cannot drift another's.
 */
export function friendlyDirectoryError(
  action: DirectoryAction,
  rawMessage: string
): string {
  const message = rawMessage.trim();
  if (!message) return DIRECTORY_FALLBACKS[action];
  if (CONNECTION_RE.test(message)) return DIRECTORY_OFFLINE;
  if (TECHNICAL_RE.test(message)) return DIRECTORY_FALLBACKS[action];
  return message;
}
