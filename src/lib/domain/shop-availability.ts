/**
 * Whether a shop is open, and whether it is taking orders — the sign on the
 * door, in data.
 *
 * Three things decide it, in order of force:
 *
 *  1. **A pause** — the owner or the counter flipped the sign to CLOSED: a
 *     lunch break, a power cut, a flooded street. Nothing goes in online until
 *     the time they chose, or until they flip it back.
 *  2. **A closure** — a day the owner blocked out ahead: a fiesta, Christmas,
 *     a week's renovation. No online orders that day either.
 *  3. **Weekly hours** — the times painted on the door. Outside them the shop
 *     is closed but still takes orders to book ahead, the way a customer can
 *     still slip a note under the door: the rider comes when it opens.
 *
 * A shop that never set hours reads as open all day, as every shop did before
 * this existed.
 *
 * Everything runs on the shop's wall clock — Manila, +8 all year, the same
 * fixed offset `rider-calendar.ts` uses — and takes `now` as an argument.
 * The server keeps the same rules for pauses and closures (migration 0035),
 * so a stale screen cannot place an order the shop has refused.
 */

/** Manila is +8 all year: the Philippines keeps no summer time. */
export const SHOP_UTC_OFFSET_MINUTES = 8 * 60;
const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const DAY_MINUTES = 24 * 60;
/** The last hour before closing earns a warning, so nobody books a 6:55 drop-off blind. */
const CLOSING_SOON_MINUTES = 60;
/** How far ahead to look for the next opening before giving up on naming it. */
const LOOKAHEAD_DAYS = 21;
/** Opening and closing times move in half hours: no laundry opens at 8:07. */
const TIME_STEP_MINUTES = 30;
export const CLOSURE_NOTE_MAX = 40;
export const PAUSE_NOTE_MAX = 60;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

/** One day's opening, in minutes after the shop's midnight; `closes` may be 1440. */
export interface DayHours {
  readonly opens: number;
  readonly closes: number;
}

/** Seven entries, Sunday first; null is a day the shop does not open. */
export type WeekHours = readonly (DayHours | null)[];

/** Days blocked out ahead, as shop-wall dates `YYYY-MM-DD`, both ends included. */
export interface Closure {
  readonly from: string;
  readonly to: string;
  readonly note: string;
}

export interface Availability {
  /** Null until the owner sets hours: open all day. */
  readonly hours: WeekHours | null;
  /** The sign is flipped to CLOSED until this instant; null or past when it is not. */
  readonly pausedUntil: Date | null;
  readonly pauseNote: string;
  readonly closures: readonly Closure[];
}

export type ShopState = 'open' | 'closing-soon' | 'closed' | 'paused' | 'holiday';

export interface ShopStatus {
  readonly state: ShopState;
  /** False only when online orders are refused: paused, or a closure today. */
  readonly isTakingOrders: boolean;
  /** "Open", "Closing soon", "Closed", "Closed for now", "Closed today". */
  readonly label: string;
  /** "until 7:00 PM", "opens tomorrow 8:00 AM", "back 3:00 PM"; null when nothing to add. */
  readonly detail: string | null;
}

/** 8 AM to 7 PM: where a new week of hours starts before the owner edits it. */
export const DEFAULT_DAY: DayHours = { opens: 8 * 60, closes: 19 * 60 };

/**
 * "Until I reopen": far enough off to never arrive, and still a date both
 * Postgres and JavaScript read without complaint.
 */
export const UNTIL_REOPENED = new Date('9999-12-31T00:00:00Z');

// ── the shop's wall clock ────────────────────────────────────────────────────

/** The instant, moved onto the shop's wall clock and read in UTC. */
function wall(instant: Date): Date {
  return new Date(instant.getTime() + SHOP_UTC_OFFSET_MINUTES * MINUTE_MS);
}

/** Today's date on the shop's wall, `YYYY-MM-DD`. */
export function shopToday(now: Date): string {
  return wall(now).toISOString().slice(0, 10);
}

function minuteOfDay(instant: Date): number {
  const w = wall(instant);
  return w.getUTCHours() * 60 + w.getUTCMinutes();
}

function addDays(day: string, days: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

function daysBetween(fromDay: string, toDay: string): number {
  return Math.round((Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / DAY_MS);
}

/** The instant a shop-wall day reaches the given minute. */
function instantAt(day: string, minutes: number): Date {
  return new Date(Date.parse(`${day}T00:00:00Z`) + (minutes - SHOP_UTC_OFFSET_MINUTES) * MINUTE_MS);
}

/** Minutes after midnight as a wall-clock time: 1140 → "7:00 PM". */
export function formatClock(minutes: number): string {
  const inDay = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  const hours24 = Math.floor(inDay / 60);
  const mins = inDay % 60;
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${hours24 < 12 ? 'AM' : 'PM'}`;
}

/** A shop-wall date as "Oct 5". */
export function formatShopDate(day: string): string {
  const [, month, date] = day.split('-').map(Number);
  return `${MONTHS_SHORT[month - 1]} ${date}`;
}

/** "3:00 PM", "tomorrow 8:00 AM", "Mon 8:00 AM", "Oct 5" — as near as it is. */
function describeWhen(target: Date, now: Date, hasTime: boolean): string {
  const targetDay = shopToday(target);
  const ahead = daysBetween(shopToday(now), targetDay);
  const time = formatClock(minuteOfDay(target));
  if (ahead > 6) return formatShopDate(targetDay);
  const day =
    ahead <= 0 ? (hasTime ? '' : 'today') : ahead === 1 ? 'tomorrow' : WEEKDAYS_SHORT[weekdayOf(targetDay)];
  if (!hasTime) return day;
  return day ? `${day} ${time}` : time;
}

// ── reading the rules ────────────────────────────────────────────────────────

function closureOn(day: string, closures: readonly Closure[]): Closure | null {
  return closures.find((c) => c.from <= day && day <= c.to) ?? null;
}

function isUntilReopened(until: Date): boolean {
  return until.getTime() >= UNTIL_REOPENED.getTime() - DAY_MS;
}

function isPaused(availability: Availability, now: Date): boolean {
  return !!availability.pausedUntil && availability.pausedUntil.getTime() > now.getTime();
}

/**
 * The next time the doors open, starting `fromDays` days after today. Days in
 * a closure are skipped; with no hours set, a day opens at its first minute
 * and has no time worth naming.
 */
function nextOpening(
  availability: Availability,
  now: Date,
  fromDays = 0
): { at: Date; hasTime: boolean } | null {
  const today = shopToday(now);
  const nowMinute = minuteOfDay(now);
  for (let offset = fromDays; offset <= LOOKAHEAD_DAYS; offset += 1) {
    const day = addDays(today, offset);
    if (closureOn(day, availability.closures)) continue;
    if (!availability.hours) {
      return { at: offset === 0 ? now : instantAt(day, 0), hasTime: false };
    }
    const hours = availability.hours[weekdayOf(day)];
    if (!hours) continue;
    if (offset === 0 && hours.opens <= nowMinute) continue;
    return { at: instantAt(day, hours.opens), hasTime: true };
  }
  return null;
}

function joinDetail(parts: readonly (string | null | undefined)[]): string | null {
  const kept = parts.filter((p): p is string => !!p && p.trim().length > 0);
  return kept.length > 0 ? kept.join(' · ') : null;
}

/** What the sign on the door says right now. */
export function shopStatus(availability: Availability, now: Date): ShopStatus {
  const note = availability.pauseNote.trim();

  if (isPaused(availability, now) && availability.pausedUntil) {
    const until = availability.pausedUntil;
    const back = isUntilReopened(until) ? null : `back ${describeWhen(until, now, true)}`;
    return {
      state: 'paused',
      isTakingOrders: false,
      label: 'Closed for now',
      detail: joinDetail([note, back]),
    };
  }

  const today = shopToday(now);
  const closure = closureOn(today, availability.closures);
  if (closure) {
    const next = nextOpening(availability, now);
    const back = next ? `back ${describeWhen(next.at, now, next.hasTime)}` : null;
    return {
      state: 'holiday',
      isTakingOrders: false,
      label: 'Closed today',
      detail: joinDetail([closure.note, back]),
    };
  }

  if (!availability.hours) {
    return { state: 'open', isTakingOrders: true, label: 'Open', detail: null };
  }

  const hours = availability.hours[weekdayOf(today)];
  const nowMinute = minuteOfDay(now);
  if (hours && hours.opens <= nowMinute && nowMinute < hours.closes) {
    const isClosingSoon = hours.closes - nowMinute <= CLOSING_SOON_MINUTES;
    return {
      state: isClosingSoon ? 'closing-soon' : 'open',
      isTakingOrders: true,
      label: isClosingSoon ? 'Closing soon' : 'Open',
      detail: `until ${formatClock(hours.closes)}`,
    };
  }

  const next = nextOpening(availability, now);
  return {
    state: 'closed',
    isTakingOrders: true,
    label: 'Closed',
    detail: next ? `opens ${describeWhen(next.at, now, next.hasTime)}` : null,
  };
}

// ── the row, as stored ───────────────────────────────────────────────────────

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isShopDate(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function readDay(value: unknown): DayHours | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object') return undefined;
  const { opens, closes } = value as { opens?: unknown; closes?: unknown };
  if (!Number.isInteger(opens) || !Number.isInteger(closes)) return undefined;
  const o = opens as number;
  const c = closes as number;
  if (o < 0 || c > DAY_MINUTES || o >= c) return undefined;
  return { opens: o, closes: c };
}

function readHours(value: unknown): WeekHours | null {
  if (!Array.isArray(value) || value.length !== 7) return null;
  const days = value.map(readDay);
  return days.some((d) => d === undefined) ? null : (days as (DayHours | null)[]);
}

function readClosures(value: unknown): Closure[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { from, to, note } = item as { from?: unknown; to?: unknown; note?: unknown };
    if (!isShopDate(from) || !isShopDate(to) || to < from) return [];
    return [{ from, to, note: typeof note === 'string' ? note : '' }];
  });
}

function readInstant(value: unknown): Date | null {
  if (typeof value !== 'string') return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * The shop row's availability columns (migration 0035), read defensively: a
 * row from before the columns existed, or with a hand-edited value that does
 * not parse, reads as open rather than as a shop nobody can book.
 */
export function readAvailability(row: {
  hours?: unknown;
  paused_until?: unknown;
  pause_note?: unknown;
  closures?: unknown;
}): Availability {
  return {
    hours: readHours(row.hours),
    pausedUntil: readInstant(row.paused_until),
    pauseNote: typeof row.pause_note === 'string' ? row.pause_note : '',
    closures: readClosures(row.closures),
  };
}

// ── flipping the sign ────────────────────────────────────────────────────────

export interface PauseChoice {
  readonly key: '30m' | '1h' | 'today' | 'reopen';
  readonly label: string;
  /** "back 2:30 PM"; null for "until I reopen". */
  readonly hint: string | null;
  readonly until: Date;
}

/** The ways to flip the sign to CLOSED, shortest first. */
export function pauseChoices(availability: Availability, now: Date): PauseChoice[] {
  const inHalfHour = new Date(now.getTime() + 30 * MINUTE_MS);
  const inHour = new Date(now.getTime() + 60 * MINUTE_MS);
  const midnight = instantAt(addDays(shopToday(now), 1), 0);
  const tomorrow = availability.hours ? nextOpening(availability, now, 1) : null;
  const restOfDay = tomorrow?.at ?? midnight;
  const back = (at: Date) => `back ${describeWhen(at, now, true)}`;

  return [
    { key: '30m', label: '30 minutes', hint: back(inHalfHour), until: inHalfHour },
    { key: '1h', label: '1 hour', hint: back(inHour), until: inHour },
    {
      key: 'today',
      label: 'Rest of today',
      hint: tomorrow ? back(tomorrow.at) : 'back tomorrow',
      until: restOfDay,
    },
    { key: 'reopen', label: 'Until I reopen', hint: null, until: UNTIL_REOPENED },
  ];
}

// ── editing the hours ────────────────────────────────────────────────────────

/** The owner's week, or 8 to 7 every day to start editing from. */
export function weekOrDefault(hours: WeekHours | null): WeekHours {
  return hours ?? Array.from({ length: 7 }, () => DEFAULT_DAY);
}

/** A new week with one day changed. */
export function setDayHours(week: WeekHours, weekday: number, day: DayHours | null): WeekHours {
  return week.map((existing, index) => (index === weekday ? day : existing));
}

/** A time moved by half-hour steps, kept inside the day. */
export function stepTime(minutes: number, steps: number): number {
  return Math.min(DAY_MINUTES, Math.max(0, minutes + steps * TIME_STEP_MINUTES));
}

/** "8:00 AM – 7:00 PM", or "Closed". */
export function describeDay(day: DayHours | null): string {
  return day ? `${formatClock(day.opens)} – ${formatClock(day.closes)}` : 'Closed';
}

// ── closures ─────────────────────────────────────────────────────────────────

/** Why a closure cannot be saved, or null when it can. */
export function validateClosure(draft: Closure, now: Date): string | null {
  if (!isShopDate(draft.from) || !isShopDate(draft.to)) return 'Pick both dates.';
  if (draft.to < draft.from) return "The end date can't be before the start.";
  if (draft.to < shopToday(now)) return 'That date is in the past.';
  if (draft.note.trim().length > CLOSURE_NOTE_MAX) {
    return `Keep the note short — ${CLOSURE_NOTE_MAX} characters at most.`;
  }
  return null;
}

/** Closures still to come or under way, soonest first. */
export function upcomingClosures(closures: readonly Closure[], now: Date): Closure[] {
  const today = shopToday(now);
  return closures.filter((c) => c.to >= today).sort((a, b) => a.from.localeCompare(b.from));
}

/** "Dec 24 – 26", "Dec 31 – Jan 2", or "Nov 1". */
export function describeClosureDates(closure: Closure): string {
  if (closure.from === closure.to) return formatShopDate(closure.from);
  const start = formatShopDate(closure.from);
  const end = formatShopDate(closure.to);
  const isSameMonth = closure.from.slice(0, 7) === closure.to.slice(0, 7);
  return `${start} – ${isSameMonth ? end.split(' ')[1] : end}`;
}

/** A shop-wall date some days from today, for a date stepper. */
export function shopDayFrom(now: Date, days: number): string {
  return addDays(shopToday(now), days);
}

/** A shop-wall date moved by whole days. */
export function shiftShopDay(day: string, days: number): string {
  return addDays(day, days);
}
