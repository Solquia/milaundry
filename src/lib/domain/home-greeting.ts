/**
 * The line a home page opens with.
 *
 * Both homes used to lead with the product's own name — a wordmark on the app
 * home, and nothing at all for the person reading it. A customer opening a
 * laundry app knows which app they opened; what they do not know is whether
 * anything is waiting for them. Greeting them by name costs the same line and
 * spends it on them instead of on us.
 *
 * Two lines, not one sentence: the greeting is set large across two rows, and
 * the break has to fall in the same place every time rather than wherever the
 * width happens to put it.
 */

/** The most a first name can be and still fit the headline at full size. */
const NAME_CEILING = 20;

export interface Greeting {
  /** "Hi Maria," — the half that belongs to the reader. */
  hello: string;
  /** The reader's own name, so the headline can set it apart from the rest. */
  name: string;
  /** "here's your laundry." — the half that belongs to the page. */
  line: string;
  /**
   * The same line split where the emphasis falls: the connector takes the
   * accent, the rest takes the weight. Split here rather than in the view so
   * the copy stays in one place and the app and the shop's web page cannot
   * drift into breaking it differently.
   */
  lead: string;
  rest: string;
}

/**
 * The name to say, or an empty string when there is none worth saying.
 *
 * First name only: a full legal name in a greeting reads as a form letter. A
 * name longer than the headline holds is dropped rather than cut — "Hi there,"
 * is friendlier than half a name with an ellipsis on it.
 */
export function greetingName(fullName: string | null | undefined): string {
  const first = (fullName ?? '').trim().split(/\s+/)[0] ?? '';
  if (first.length === 0 || first.length > NAME_CEILING) return '';
  return first;
}

function hello(fullName: string | null | undefined): string {
  const name = greetingName(fullName);
  return name ? `Hi ${name},` : 'Hi there,';
}

/** The customer's own home: their laundry, wherever they left it. */
export function homeGreeting(fullName: string | null | undefined): Greeting {
  return {
    hello: hello(fullName),
    name: greetingName(fullName) || 'there',
    line: "here's your laundry.",
    lead: "here's",
    rest: 'your laundry.',
  };
}

/**
 * A shop's public page. The second line is the shop talking — the page belongs
 * to the laundry, and "we" is the laundry, not the app.
 */
export function storefrontGreeting(fullName: string | null | undefined): Greeting {
  return {
    hello: hello(fullName),
    name: greetingName(fullName) || 'there',
    line: "here's what we wash.",
    lead: "here's",
    rest: 'what we wash.',
  };
}
