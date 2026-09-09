/**
 * When something happens, said the way somebody would say it out loud.
 *
 * The order screen used to print `new Date(iso).toLocaleString()`, so a pickup
 * arrived as **8/29/2026, 12:00:00 PM**. Three things are wrong with that, and
 * all three are the customer's problem rather than the machine's:
 *
 * - the seconds are noise — no laundry was ever collected at 12:00:07;
 * - the year is noise — a laundry order is always in this one;
 * - "8/29" is a date the reader has to convert into "the day after tomorrow"
 *   before it means anything, which is the only thing they wanted to know.
 *
 * So the near days are named. "Tomorrow, 12:00 PM" needs no arithmetic, and a
 * date that is genuinely far off still gets its weekday, because "Tue 1 Sep"
 * answers "will I be at work?" and a bare 9/1 does not.
 *
 * The month and day names are spelled here rather than left to the device
 * locale so the string is the same on every phone and can actually be pinned by
 * a test. Everything the app writes is English; a half-translated date row
 * would be worse than a consistent one.
 */

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MS_PER_DAY = 86_400_000;

/** Midnight local, so "tomorrow" is a calendar fact and not 24 hours away. */
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/** `9:05 AM`. Padded, because 9:5 reads as a typo and 09:05 reads as a log. */
function clock(date: Date): string {
  const hours = date.getHours();
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour}:${String(date.getMinutes()).padStart(2, '0')} ${suffix}`;
}

/**
 * A timestamp as a person would say it, relative to `now`.
 *
 * Returns an empty string for anything unparseable so the screen can drop the
 * row entirely. `toLocaleString` renders the literal text "Invalid Date" into
 * the interface, which tells the customer nothing and looks like a crash.
 */
export function formatWhen(
  iso: string | null | undefined,
  now: Date = new Date()
): string {
  if (!iso) return '';

  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';

  const time = clock(when);
  // Rounded: a daylight-saving boundary makes the gap 23 or 25 hours, and
  // truncating there would call tomorrow "today".
  const days = Math.round((startOfDay(when) - startOfDay(now)) / MS_PER_DAY);

  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Tomorrow, ${time}`;
  if (days === -1) return `Yesterday, ${time}`;

  const day = when.getDate();
  const month = MONTHS[when.getMonth()];

  if (when.getFullYear() === now.getFullYear()) {
    return `${WEEKDAYS[when.getDay()]} ${day} ${month}, ${time}`;
  }
  return `${day} ${month} ${when.getFullYear()}, ${time}`;
}
