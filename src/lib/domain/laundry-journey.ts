/**
 * The whole road a load of laundry walks, for the screen a customer opens to
 * ask one question: where is it?
 *
 * `order-tracking` names the stops and `wash-cycle` counts the cycle; this puts
 * a time on each stop (from the shop's status history), says in plain words
 * what happens there, and names what comes next — everything the tracker card
 * needs, with no React in it.
 */
import type { OrderStatus } from './order-status';
import { trackingHeadline, trackingSteps, type TrackingState } from './order-tracking';
import type { Fulfillment } from './walk-in-order';
import { cycleStanding } from './wash-cycle';

export interface JourneyStop {
  status: OrderStatus;
  label: string;
  /** Ionicons glyph. */
  icon: string;
  state: TrackingState;
  /** When the order last arrived here, or null when it hasn't / isn't recorded. */
  reachedAt: string | null;
  /** What happens at this stop, in the customer's terms. */
  blurb: string;
}

export interface LaundryJourney {
  stops: JourneyStop[];
  /** Index of the live stop; -1 when finished or cancelled. */
  currentIndex: number;
  current: JourneyStop | null;
  headline: string;
  /** Label of the stop after the live one. */
  nextUp: string | null;
  /** When the order reached the state it is in now. */
  since: string | null;
  /** `Step 3 of 5`, or the phase in words. */
  standing: string;
  isFinished: boolean;
  isCancelled: boolean;
}

interface JourneyOrder {
  status: OrderStatus;
  fulfillment: Fulfillment;
  created_at: string;
}

interface JourneyHistoryEntry {
  to_status: OrderStatus;
  created_at: string;
}

function stopIcon(status: OrderStatus, isDelivery: boolean): string {
  switch (status) {
    case 'pending':
      return 'receipt-outline';
    case 'received':
      return 'basket-outline';
    case 'washing':
      return 'water-outline';
    case 'drying':
      return 'sunny-outline';
    case 'folded':
      return 'layers-outline';
    case 'ready':
      return isDelivery ? 'bicycle-outline' : 'bag-check-outline';
    case 'completed':
      return isDelivery ? 'home-outline' : 'happy-outline';
    default:
      return 'close-outline';
  }
}

function stopBlurb(status: OrderStatus, isDelivery: boolean): string {
  switch (status) {
    case 'pending':
      return isDelivery
        ? 'Your booking is in. The shop will come by to collect your laundry.'
        : 'Your booking is in. Drop your laundry off at the shop whenever you are ready.';
    case 'received':
      return 'The shop has your laundry and is sorting and weighing it.';
    case 'washing':
      return 'In the machine now, washed the way you asked.';
    case 'drying':
      return 'Out of the wash and tumbling dry.';
    case 'folded':
      return 'Dry, folded and being packed into your bag.';
    case 'ready':
      return isDelivery
        ? 'Packed and on its way back to you.'
        : 'Packed and waiting for you at the counter.';
    case 'completed':
      return isDelivery ? 'Delivered to your door. Enjoy!' : 'Back in your hands. Enjoy!';
    default:
      return 'This order was cancelled.';
  }
}

/** The latest time the order moved to `status`, if the shop's log has it. */
function lastReached(status: OrderStatus, history: readonly JourneyHistoryEntry[]): string | null {
  let latest: string | null = null;
  for (const entry of history) {
    if (entry.to_status === status) latest = entry.created_at;
  }
  return latest;
}

export function laundryJourney(
  order: JourneyOrder,
  history: readonly JourneyHistoryEntry[]
): LaundryJourney {
  const isDelivery = order.fulfillment === 'delivery';
  const isCancelled = order.status === 'cancelled';
  const isFinished = order.status === 'completed';

  const stops: JourneyStop[] = trackingSteps(order.status, order.fulfillment).map((step) => ({
    ...step,
    icon: stopIcon(step.status, isDelivery),
    // Booking is the one stop the order row itself dates.
    reachedAt: step.status === 'pending' ? order.created_at : lastReached(step.status, history),
    blurb: stopBlurb(step.status, isDelivery),
  }));

  const currentIndex = stops.findIndex((stop) => stop.state === 'current');
  const current = currentIndex >= 0 ? stops[currentIndex] : null;
  const next = currentIndex >= 0 ? stops[currentIndex + 1] : undefined;

  const since =
    order.status === 'pending'
      ? order.created_at
      : lastReached(order.status, history);

  return {
    stops,
    currentIndex,
    current,
    headline: trackingHeadline(order.status, order.fulfillment),
    nextUp: next?.label ?? null,
    since,
    standing: cycleStanding(order.status).caption,
    isFinished,
    isCancelled,
  };
}

const MINUTE_MS = 60_000;
const HOUR_MINUTES = 60;
const DAY_MINUTES = 24 * HOUR_MINUTES;

/**
 * How long the laundry has been where it is: "25 min", "2 h 5 min", "3 days".
 * Empty when the time is missing, unreadable, or ahead of the clock.
 */
export function elapsedLabel(fromIso: string | null, nowMs: number): string {
  if (!fromIso) return '';
  const from = new Date(fromIso).getTime();
  if (Number.isNaN(from) || from > nowMs) return '';

  const minutes = Math.floor((nowMs - from) / MINUTE_MS);
  if (minutes < 1) return 'just now';
  if (minutes < HOUR_MINUTES) return `${minutes} min`;
  if (minutes < DAY_MINUTES) {
    const hours = Math.floor(minutes / HOUR_MINUTES);
    const rest = minutes % HOUR_MINUTES;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }
  const days = Math.floor(minutes / DAY_MINUTES);
  return days === 1 ? '1 day' : `${days} days`;
}
