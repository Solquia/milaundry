import type { OrderStatus } from './order-status';

export interface WashCycleStage {
  status: OrderStatus;
  /** What the customer sees on the tracker. */
  label: string;
  /** Ionicons glyph for the stage dot. */
  icon: string;
}

/**
 * The laundry's journey as the customer experiences it. `pending` sits before
 * the cycle (booked, not yet handed over) and `completed` sits after it, so
 * neither is a stage of its own.
 */
export const WASH_CYCLE_STAGES: readonly WashCycleStage[] = [
  { status: 'received', label: 'Received', icon: 'basket-outline' },
  { status: 'washing', label: 'Washing', icon: 'water-outline' },
  { status: 'drying', label: 'Drying', icon: 'sunny-outline' },
  { status: 'folded', label: 'Folded', icon: 'layers-outline' },
  { status: 'ready', label: 'Ready', icon: 'checkmark-done-outline' },
];

export type StepState = 'done' | 'current' | 'upcoming';

export interface WashCycleStep extends WashCycleStage {
  state: StepState;
}

export interface WashCycleProgress {
  steps: WashCycleStep[];
  /** How far through the cycle, 0–100. */
  percent: number;
  isCancelled: boolean;
}

/** Tracker state for one order: which stage it's at and how far along. */
export function washCycleProgress(status: OrderStatus): WashCycleProgress {
  const isCancelled = status === 'cancelled';
  const isFinished = status === 'completed';
  const currentIndex = WASH_CYCLE_STAGES.findIndex((stage) => stage.status === status);

  const steps = WASH_CYCLE_STAGES.map((stage, index) => ({
    ...stage,
    state: stepState(index, currentIndex, isFinished, isCancelled),
  }));

  let percent = 0;
  if (isFinished) {
    percent = 100;
  } else if (!isCancelled && currentIndex >= 0) {
    percent = Math.round(((currentIndex + 1) / WASH_CYCLE_STAGES.length) * 100);
  }

  return { steps, percent, isCancelled };
}

export interface CycleStanding {
  /** 1-based position in the cycle; 0 before it starts or once it is void. */
  position: number;
  total: number;
  /** `Step 3 of 5`, or the phase in words when there is no step to count. */
  caption: string;
  /** A machine is actually turning right now, as opposed to laundry sitting. */
  isRunning: boolean;
}

/**
 * The cycle as a position rather than a percentage.
 *
 * A percentage is an abstraction of something the customer can already count:
 * there are five stages, and their laundry is at one of them. "Step 3 of 5"
 * says how much is left in the same terms the tracker's dots are drawn in,
 * which an unlabelled 60% arc does not.
 */
export function cycleStanding(status: OrderStatus): CycleStanding {
  const total = WASH_CYCLE_STAGES.length;
  const index = WASH_CYCLE_STAGES.findIndex((stage) => stage.status === status);

  if (status === 'cancelled') {
    return { position: 0, total, caption: 'Cancelled', isRunning: false };
  }
  if (status === 'completed') {
    return { position: total, total, caption: 'All done', isRunning: false };
  }
  if (index === -1) {
    // Booked, not yet handed over: the cycle has not begun, so nothing counts.
    return { position: 0, total, caption: 'Not started yet', isRunning: false };
  }

  const position = index + 1;
  return {
    position,
    total,
    caption: `Step ${position} of ${total}`,
    isRunning: status === 'washing' || status === 'drying',
  };
}

function stepState(
  index: number,
  currentIndex: number,
  isFinished: boolean,
  isCancelled: boolean
): StepState {
  if (isCancelled) return 'upcoming';
  if (isFinished) return 'done';
  if (currentIndex === -1) return 'upcoming'; // still pending pickup/drop-off
  if (index < currentIndex) return 'done';
  if (index === currentIndex) return 'current';
  return 'upcoming';
}
