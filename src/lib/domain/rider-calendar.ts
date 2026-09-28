/**
 * When a rider comes, and when the laundry comes back — on the shop's clock.
 *
 * The schedule used to be kept as "days from today" and read on whatever clock
 * the customer's device ran. Both were wrong in ways nobody would notice until
 * it cost a pickup: a booking that sat open past midnight was placed a day
 * later than the one on screen, and a cousin booking from Dubai for a shop in
 * Cuyapo was offered hours four hours out of true. A slot is now a calendar day
 * *in the shop's own time* and the hour a window opens, and everything here is
 * computed from an instant and the shop's offset — never from the device.
 *
 * The rest follows from what a laundry actually is:
 *
 *   - A rider arrives inside a window, not on the stroke of an hour. The
 *     customer is told "2–4 PM", so nobody waits at the gate from 2:00 sharp.
 *   - The laundry has to be washed. A return is never offered before the
 *     pickup window has closed and the shop has had `processingHours`.
 *   - A shop has days it is shut, and that is shown, not discovered at the end.
 *
 * `now` is always passed in, so every rule can be tested at 9 PM on a Friday.
 */

/** A calendar day in the shop's own time, as `YYYY-MM-DD`. */
export type DayKey = string;

export interface Slot {
  day: DayKey;
  /** The hour the window opens, 24-hour, on the shop's clock. */
  hour: number;
}

/** How one shop runs its riders. Every shop gets the default until it says otherwise. */
export interface ShopHours {
  /** The shop's distance from UTC. Manila is +8 all year: the Philippines keeps no summer time. */
  utcOffsetMinutes: number;
  /** When each rider window opens. */
  windowStarts: readonly number[];
  /** How long a window stays open. */
  windowHours: number;
  /** Days with no riders at all, 0 = Sunday. */
  closedWeekdays: readonly number[];
  /** How far ahead of a window a booking has to land for a rider to make it. */
  leadMinutes: number;
  /** The least time between the pickup window closing and the laundry leaving again. */
  processingHours: number;
  /** How far ahead a pickup may be booked. */
  pickupDays: number;
  /** How long after the pickup day the return may be set. */
  returnDays: number;
}

export const DEFAULT_SHOP_HOURS: ShopHours = {
  utcOffsetMinutes: 8 * 60,
  windowStarts: [8, 10, 12, 14, 16, 18],
  windowHours: 2,
  closedWeekdays: [],
  leadMinutes: 60,
  processingHours: 4,
  pickupDays: 14,
  returnDays: 7,
};

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const WEEKDAYS_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

// ---------------------------------------------------------------------------
// Days, as plain calendar arithmetic. Done in UTC so no device clock, and no
// summer-time jump anywhere in the world, can move a day by an hour.
// ---------------------------------------------------------------------------

function parts(day: DayKey): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m, d];
}

function utcMidnight(day: DayKey): number {
  const [y, m, d] = parts(day);
  return Date.UTC(y, m - 1, d);
}

function keyOf(utcMs: number): DayKey {
  const date = new Date(utcMs);
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${date.getUTCFullYear()}-${m}-${d}`;
}

export function addDays(day: DayKey, count: number): DayKey {
  return keyOf(utcMidnight(day) + count * DAY_MS);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / DAY_MS);
}

export function weekdayOf(day: DayKey): number {
  return new Date(utcMidnight(day)).getUTCDay();
}

/** The instant, moved onto the shop's wall clock and read in UTC. */
function shopWall(instant: Date, hours: ShopHours): Date {
  return new Date(instant.getTime() + hours.utcOffsetMinutes * MINUTE_MS);
}

/** Today, on the shop's calendar. */
export function shopToday(now: Date, hours: ShopHours): DayKey {
  return keyOf(shopWall(now, hours).getTime());
}

/** The exact instant a window opens. What the order is placed with. */
export function slotInstant(slot: Slot, hours: ShopHours): Date {
  return new Date(utcMidnight(slot.day) + slot.hour * HOUR_MS - hours.utcOffsetMinutes * MINUTE_MS);
}

/** An instant read back as the shop's day and hour — last order's pickup, say. */
export function shopSlotOf(instant: Date, hours: ShopHours): Slot {
  const wall = shopWall(instant, hours);
  return { day: keyOf(wall.getTime()), hour: wall.getUTCHours() };
}

// ---------------------------------------------------------------------------
// Words.
// ---------------------------------------------------------------------------

function meridiem(hour: number): 'AM' | 'PM' {
  return hour % 24 >= 12 ? 'PM' : 'AM';
}

function clockHour(hour: number): number {
  const h = hour % 12;
  return h === 0 ? 12 : h;
}

/** `5 PM`, or `4:30 PM` when the minutes matter. */
export function timeText(hour: number, minute = 0): string {
  const mins = minute ? `:${String(minute).padStart(2, '0')}` : '';
  return `${clockHour(hour)}${mins} ${meridiem(hour)}`;
}

export function windowEnd(start: number, hours: ShopHours): number {
  return start + hours.windowHours;
}

/** `2–4 PM`; `10 AM–12 PM` where the window crosses noon. */
export function windowLabel(start: number, hours: ShopHours): string {
  const end = windowEnd(start, hours);
  if (meridiem(start) === meridiem(end)) {
    return `${clockHour(start)}–${clockHour(end)} ${meridiem(end)}`;
  }
  return `${timeText(start)}–${timeText(end)}`;
}

export type DayPart = 'morning' | 'afternoon' | 'evening';

export function windowPart(start: number): DayPart {
  if (start < 12) return 'morning';
  if (start < 16) return 'afternoon';
  return 'evening';
}

/** `Today`, `Tomorrow`, then the weekday — what a person would say. */
export function dayName(day: DayKey, today: DayKey): string {
  const offset = daysBetween(today, day);
  if (offset === 0) return 'Today';
  if (offset === 1) return 'Tomorrow';
  return WEEKDAYS[weekdayOf(day)];
}

/** `Today, 25 Sep` — the day, with its date, for a headline. */
export function dayTitle(day: DayKey, today: DayKey): string {
  const [, m, d] = parts(day);
  return `${dayName(day, today)}, ${d} ${MONTHS[m - 1]}`;
}

/** The whole choice in one line: `Tomorrow · 2–4 PM`, `Mon 28 Sep · 8–10 AM`. */
export function slotSummary(slot: Slot, today: DayKey, hours: ShopHours): string {
  const offset = daysBetween(today, slot.day);
  const [, m, d] = parts(slot.day);
  const when = offset === 0 || offset === 1
    ? dayName(slot.day, today)
    : `${WEEKDAYS[weekdayOf(slot.day)]} ${d} ${MONTHS[m - 1]}`;
  return `${when} · ${windowLabel(slot.hour, hours)}`;
}

/** `About 6 hours`, `About 2 days` — how long the shop keeps it. */
export function turnaroundText(pickup: Slot, back: Slot): string {
  const total = daysBetween(pickup.day, back.day) * 24 + (back.hour - pickup.hour);
  if (total < 20) {
    const h = Math.max(1, total);
    return `About ${h} hour${h === 1 ? '' : 's'}`;
  }
  const days = Math.max(1, Math.round(total / 24));
  return `About ${days} day${days === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Which windows are on offer, and why the others are not.
// ---------------------------------------------------------------------------

/** Why a window cannot be picked: gone, shop shut, still in the wash, or out of range. */
export type ShutReason = 'passed' | 'closed' | 'washing' | 'outside';

export interface WindowState {
  hour: number;
  label: string;
  isOpen: boolean;
  reason: ShutReason | null;
}

function allShut(hours: ShopHours, reason: ShutReason): WindowState[] {
  return hours.windowStarts.map((hour) => ({
    hour,
    label: windowLabel(hour, hours),
    isOpen: false,
    reason,
  }));
}

function earliestBookable(now: Date, hours: ShopHours): number {
  return now.getTime() + hours.leadMinutes * MINUTE_MS;
}

export function pickupWindows(day: DayKey, now: Date, hours: ShopHours): WindowState[] {
  const offset = daysBetween(shopToday(now, hours), day);
  if (offset < 0 || offset > hours.pickupDays) return allShut(hours, 'outside');
  if (hours.closedWeekdays.includes(weekdayOf(day))) return allShut(hours, 'closed');
  const earliest = earliestBookable(now, hours);
  return hours.windowStarts.map((hour) => {
    const isOpen = slotInstant({ day, hour }, hours).getTime() >= earliest;
    return { hour, label: windowLabel(hour, hours), isOpen, reason: isOpen ? null : 'passed' };
  });
}

/** The first instant the laundry is washed and could leave the shop again. */
export function earliestReturn(pickup: Slot, hours: ShopHours): Date {
  const closes = slotInstant({ day: pickup.day, hour: windowEnd(pickup.hour, hours) }, hours);
  return new Date(closes.getTime() + hours.processingHours * HOUR_MS);
}

export function returnWindows(
  day: DayKey,
  pickup: Slot,
  now: Date,
  hours: ShopHours
): WindowState[] {
  const offset = daysBetween(pickup.day, day);
  if (offset < 0) return allShut(hours, 'washing');
  if (offset > hours.returnDays) return allShut(hours, 'outside');
  if (hours.closedWeekdays.includes(weekdayOf(day))) return allShut(hours, 'closed');
  const washed = earliestReturn(pickup, hours).getTime();
  const earliest = earliestBookable(now, hours);
  return hours.windowStarts.map((hour) => {
    const at = slotInstant({ day, hour }, hours).getTime();
    const reason: ShutReason | null = at < washed ? 'washing' : at < earliest ? 'passed' : null;
    return { hour, label: windowLabel(hour, hours), isOpen: reason === null, reason };
  });
}

function openHours(windows: readonly WindowState[]): number[] {
  return windows.filter((w) => w.isOpen).map((w) => w.hour);
}

// ---------------------------------------------------------------------------
// The week strip.
// ---------------------------------------------------------------------------

export const STRIP_LENGTH = 7;

export type DayStatus = 'open' | 'closed' | 'done' | 'washing' | 'outside';

export interface StripDay {
  day: DayKey;
  /** `Today`, else the weekday. The strip is seven narrow columns; "Tomorrow" does not fit. */
  lead: string;
  dayOfMonth: number;
  /** On the first card and wherever the month turns over; null elsewhere. */
  month: string | null;
  isToday: boolean;
  openCount: number;
  status: DayStatus;
}

function statusOf(windows: readonly WindowState[]): DayStatus {
  if (windows.some((w) => w.isOpen)) return 'open';
  if (windows.every((w) => w.reason === 'closed')) return 'closed';
  if (windows.some((w) => w.reason === 'washing')) return 'washing';
  if (windows.some((w) => w.reason === 'passed')) return 'done';
  return 'outside';
}

/** Seven days from `start`, each with what it has left. */
export function stripDays(
  start: DayKey,
  today: DayKey,
  windowsFor: (day: DayKey) => readonly WindowState[]
): StripDay[] {
  let lastMonth: number | null = null;
  return Array.from({ length: STRIP_LENGTH }, (_, index) => {
    const day = addDays(start, index);
    const [, m, d] = parts(day);
    const windows = windowsFor(day);
    const month = m === lastMonth ? null : MONTHS[m - 1];
    lastMonth = m;
    return {
      day,
      lead: day === today ? 'Today' : WEEKDAYS[weekdayOf(day)],
      dayOfMonth: d,
      month,
      isToday: day === today,
      openCount: openHours(windows).length,
      status: statusOf(windows),
    };
  });
}

/** `25 Sep – 1 Oct`: the span a strip page covers. */
export function stripRange(start: DayKey): string {
  const end = addDays(start, STRIP_LENGTH - 1);
  const [, sm, sd] = parts(start);
  const [, em, ed] = parts(end);
  return sm === em
    ? `${sd}–${ed} ${MONTHS[em - 1]}`
    : `${sd} ${MONTHS[sm - 1]} – ${ed} ${MONTHS[em - 1]}`;
}

// ---------------------------------------------------------------------------
// Choosing, keeping and checking a schedule.
// ---------------------------------------------------------------------------

function firstPickup(now: Date, hours: ShopHours, preferred?: number): Slot | null {
  const today = shopToday(now, hours);
  for (let offset = 0; offset <= hours.pickupDays; offset += 1) {
    const day = addDays(today, offset);
    const open = openHours(pickupWindows(day, now, hours));
    const hour = preferred === undefined ? open[0] : open.find((h) => h === preferred);
    if (hour !== undefined) return { day, hour };
  }
  return null;
}

/**
 * The return kept after the pickup it depends on.
 *
 * A return that still works is left exactly where it was put. One the pickup
 * has overtaken moves to the day after, at the hour the customer chose. One
 * on the right day but now too soon slides to the first window after the
 * wash — the smallest move that makes it true again.
 */
export function reconcileReturn(pickup: Slot, back: Slot, now: Date, hours: ShopHours): Slot {
  const stillOpen = openHours(returnWindows(back.day, pickup, now, hours));
  if (stillOpen.includes(back.hour)) return back;

  const from = daysBetween(pickup.day, back.day) < 0 ? addDays(pickup.day, 1) : back.day;
  const last = addDays(pickup.day, hours.returnDays);
  for (let day = from; daysBetween(day, last) >= 0; day = addDays(day, 1)) {
    const open = openHours(returnWindows(day, pickup, now, hours));
    const hour =
      day === from
        ? open.find((h) => h >= back.hour) ?? (from === back.day ? undefined : open[0])
        : open.includes(back.hour) ? back.hour : open[0];
    if (hour !== undefined) return { day, hour };
  }
  return back;
}

/**
 * A schedule that works the moment the screen opens: the soonest pickup — at
 * last time's hour when a rider can still make it — and back a day later.
 */
export function suggestSchedule(
  now: Date,
  hours: ShopHours,
  preferredHour?: number
): { pickup: Slot; deliver: Slot } | null {
  const wants = preferredHour !== undefined && hours.windowStarts.includes(preferredHour);
  const pickup = (wants ? firstPickup(now, hours, preferredHour) : null) ?? firstPickup(now, hours);
  if (!pickup) return null;
  const deliver = reconcileReturn(pickup, { day: addDays(pickup.day, 1), hour: pickup.hour }, now, hours);
  return { pickup, deliver };
}

export type SlotProblems = Partial<Record<'pickupAt' | 'deliverBy', string>>;

function shutSentence(reason: ShutReason | null, day: DayKey): string {
  switch (reason) {
    case 'passed':
      return 'That time has passed — choose a later one.';
    case 'closed':
      return `The shop is closed on ${WEEKDAYS_LONG[weekdayOf(day)]}s — choose another day.`;
    default:
      return 'Choose one of the times shown.';
  }
}

function pickupProblem(pickup: Slot, now: Date, hours: ShopHours): string | undefined {
  const window = pickupWindows(pickup.day, now, hours).find((w) => w.hour === pickup.hour);
  if (window?.isOpen) return undefined;
  if (window?.reason === 'passed') return 'That pickup time has passed — choose a later one.';
  if (window?.reason === 'outside') {
    return `Pickups can be booked up to ${hours.pickupDays} days ahead.`;
  }
  return shutSentence(window?.reason ?? null, pickup.day);
}

function returnProblem(pickup: Slot, back: Slot, now: Date, hours: ShopHours): string | undefined {
  const window = returnWindows(back.day, pickup, now, hours).find((w) => w.hour === back.hour);
  if (window?.isOpen) return undefined;
  if (window?.reason === 'washing') {
    const ready = shopSlotOf(earliestReturn(pickup, hours), hours);
    const when = ready.day === back.day ? '' : `${WEEKDAYS[weekdayOf(ready.day)]} `;
    return `We need until ${when}${timeText(ready.hour)} to wash it — choose a later time.`;
  }
  if (window?.reason === 'outside') {
    return `We bring it back within ${hours.returnDays} days of pickup — choose an earlier day.`;
  }
  return shutSentence(window?.reason ?? null, back.day);
}

/** What is wrong with the pair, per leg, in words a customer can act on. Empty when nothing is. */
export function slotProblems(pickup: Slot, back: Slot, now: Date, hours: ShopHours): SlotProblems {
  const problems: SlotProblems = {};
  const pickupAt = pickupProblem(pickup, now, hours);
  const deliverBy = returnProblem(pickup, back, now, hours);
  if (pickupAt) problems.pickupAt = pickupAt;
  if (deliverBy) problems.deliverBy = deliverBy;
  return problems;
}

/**
 * The last minute to book today's last pickup — `5 PM` — or null once today
 * is done. Said up front, so nobody finds out at 5:10 that today was possible.
 */
export function bookingCutoff(now: Date, hours: ShopHours): string | null {
  const today = shopToday(now, hours);
  const open = openHours(pickupWindows(today, now, hours));
  if (open.length === 0) return null;
  const last = open[open.length - 1];
  const cutoff = shopWall(
    new Date(slotInstant({ day: today, hour: last }, hours).getTime() - hours.leadMinutes * MINUTE_MS),
    hours
  );
  return timeText(cutoff.getUTCHours(), cutoff.getUTCMinutes());
}
