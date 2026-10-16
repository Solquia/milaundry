/**
 * Orders a customer has cleared off their home screen.
 *
 * Clearing is a tidy-up, not a delete: the order stays on the shop's books and
 * still opens from a link or a notification. Only a load that has nothing left
 * to happen to it can go — finished, cancelled, or sitting at the counter
 * (a shop that never marks a pickup would otherwise leave it "Ready" forever).
 */
import type { ConfirmPrompt } from './confirm-prompts';
import type { OrderStatus } from './order-status';

const CLEARABLE: readonly OrderStatus[] = ['ready', 'completed', 'cancelled'];

/** Caps what one phone remembers, so the list cannot grow without end. */
export const MAX_HIDDEN_ORDERS = 500;

export function canHideOrder(status: OrderStatus): boolean {
  return CLEARABLE.includes(status);
}

/** Whatever was stored, read back as a list of ids — or nothing. */
export function parseHiddenOrderIds(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string' && id.length > 0);
  } catch {
    return [];
  }
}

/** Adds ids, newest last, without repeats, keeping only the newest `MAX_HIDDEN_ORDERS`. */
export function withHidden(current: readonly string[], ids: readonly string[]): string[] {
  const added = [...new Set(ids)].filter((id) => !current.includes(id));
  const next = [...current, ...added];
  return next.slice(Math.max(0, next.length - MAX_HIDDEN_ORDERS));
}

export function withoutHidden(current: readonly string[], ids: readonly string[]): string[] {
  return current.filter((id) => !ids.includes(id));
}

export function hideOrderPrompt(count: number): ConfirmPrompt {
  const isOne = count === 1;
  return {
    title: isOne ? 'Remove from home?' : `Remove ${count} orders from home?`,
    message: isOne
      ? 'It stops showing on your home screen. The shop keeps its record, and you can still open it from a notification.'
      : 'They stop showing on your home screen. The shop keeps its records.',
    confirmLabel: 'Remove',
    dismissLabel: 'Keep',
  };
}
