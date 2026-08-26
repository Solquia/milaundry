import { DEFAULT_SETTINGS } from '../app-settings';
import {
  actionableCount,
  badgeLabel,
  bellLabel,
  buildNotifications,
  enabledNotifications,
  type NotifiableOrder,
} from '../notifications';

const base: NotifiableOrder = {
  id: 'order-1',
  shopName: 'Sparkle Wash',
  status: 'washing',
  order_type: 'online',
  fulfillment: 'pickup',
  payment_status: 'unpaid',
  estimated_total: 300,
  final_total: null,
  updated_at: '2026-08-26T10:00:00.000Z',
};

const order = (patch: Partial<NotifiableOrder> = {}): NotifiableOrder => ({
  ...base,
  ...patch,
});

describe('buildNotifications', () => {
  it('says nothing when the customer has no orders', () => {
    expect(buildNotifications([])).toEqual([]);
  });

  it('names the cycle stage the laundry is actually in', () => {
    const [notification] = buildNotifications([order({ status: 'drying' })]);

    expect(notification.kind).toBe('stage');
    expect(notification.title).toBe('Drying');
    expect(notification.body).toContain('Sparkle Wash');
  });

  it('says the shop has the laundry before the wash starts', () => {
    const [notification] = buildNotifications([order({ status: 'received' })]);

    expect(notification.title).toBe('In the shop');
    expect(notification.needsAction).toBe(false);
  });

  it('carries the order it belongs to, so tapping it can open that order', () => {
    const [notification] = buildNotifications([order({ id: 'order-42' })]);

    expect(notification.orderId).toBe('order-42');
  });

  it('gives every notification an id unique across the feed', () => {
    const feed = buildNotifications([
      order({ id: 'a', final_total: 340 }),
      order({ id: 'b' }),
    ]);
    const ids = feed.map((notification) => notification.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it('announces the actual price once the shop has weighed the laundry', () => {
    const feed = buildNotifications([order({ final_total: 340 })]);
    const priced = feed.find((notification) => notification.kind === 'price_ready');

    expect(priced).toBeDefined();
    expect(priced!.body).toContain('₱340.00');
    expect(priced!.needsAction).toBe(true);
  });

  it('reports the stage and the price separately for one weighed load', () => {
    // Both matter and neither replaces the other: where the clothes are, and
    // what is now owed for them.
    const kinds = buildNotifications([order({ final_total: 340 })]).map((n) => n.kind);

    expect(kinds).toContain('stage');
    expect(kinds).toContain('price_ready');
  });

  it('stops asking for payment once the order is paid', () => {
    const feed = buildNotifications([
      order({ final_total: 340, payment_status: 'paid' }),
    ]);

    expect(feed.some((notification) => notification.kind === 'price_ready')).toBe(false);
  });

  it('never asks an online-only question of a walk-in order', () => {
    const feed = buildNotifications([
      order({ order_type: 'walk_in', final_total: 340 }),
    ]);

    expect(feed.some((notification) => notification.kind === 'price_ready')).toBe(false);
  });

  it('tells a booked customer the shop still has to weigh the load', () => {
    const [notification] = buildNotifications([order({ status: 'pending' })]);

    expect(notification.kind).toBe('booked');
    expect(notification.needsAction).toBe(false);
  });

  it('calls a ready load ready, because someone has to go and get it', () => {
    const [notification] = buildNotifications([order({ status: 'ready' })]);

    expect(notification.title).toBe('Ready for pickup');
    expect(notification.needsAction).toBe(true);
  });

  it('says delivery, not pickup, when the shop is bringing it over', () => {
    const [notification] = buildNotifications([
      order({ status: 'ready', fulfillment: 'delivery' }),
    ]);

    expect(notification.title).toBe('Out for delivery');
  });

  it('keeps a finished order in the feed as a quiet receipt', () => {
    const [notification] = buildNotifications([order({ status: 'completed' })]);

    expect(notification.kind).toBe('completed');
    expect(notification.needsAction).toBe(false);
  });

  it('does not chase payment on a cancelled order', () => {
    const feed = buildNotifications([order({ status: 'cancelled', final_total: 340 })]);

    expect(feed.every((notification) => !notification.needsAction)).toBe(true);
  });

  it('puts what needs the customer above what is only news', () => {
    // The older ready load still outranks the newer washing one: the feed is
    // sorted by what is owed of the customer, then by recency.
    const feed = buildNotifications([
      order({ id: 'new', status: 'washing', updated_at: '2026-08-26T12:00:00.000Z' }),
      order({ id: 'old', status: 'ready', updated_at: '2026-08-26T09:00:00.000Z' }),
    ]);

    expect(feed[0].orderId).toBe('old');
    expect(feed[0].needsAction).toBe(true);
  });

  it('shows the most recent news first among equals', () => {
    const feed = buildNotifications([
      order({ id: 'older', status: 'washing', updated_at: '2026-08-26T09:00:00.000Z' }),
      order({ id: 'newer', status: 'drying', updated_at: '2026-08-26T12:00:00.000Z' }),
    ]);

    expect(feed.map((notification) => notification.orderId)).toEqual(['newer', 'older']);
  });

  it('carries a tone and an icon so the row can be read before it is read', () => {
    const [notification] = buildNotifications([order({ status: 'ready' })]);

    expect(notification.icon).toBeTruthy();
    expect(notification.tone).toBe('action');
  });
});

describe('actionableCount', () => {
  it('counts nothing on an empty feed', () => {
    expect(actionableCount([])).toBe(0);
  });

  it('counts only what the customer has to do something about', () => {
    const feed = buildNotifications([
      order({ id: 'a', status: 'ready' }),
      order({ id: 'b', status: 'washing' }),
      order({ id: 'c', status: 'folded', final_total: 250 }),
    ]);

    expect(actionableCount(feed)).toBe(2);
  });
});

describe('badgeLabel', () => {
  it('shows no badge when there is nothing to answer for', () => {
    expect(badgeLabel(0)).toBe('');
  });

  it('shows the count while it still fits in a dot', () => {
    expect(badgeLabel(1)).toBe('1');
    expect(badgeLabel(9)).toBe('9');
  });

  it('caps rather than letting the dot grow into a pill', () => {
    expect(badgeLabel(10)).toBe('9+');
    expect(badgeLabel(147)).toBe('9+');
  });

  it('treats a nonsense count as nothing rather than rendering NaN', () => {
    expect(badgeLabel(-3)).toBe('');
  });
});

describe('bellLabel', () => {
  it('tells a screen reader the bell is worth pressing', () => {
    expect(bellLabel(2)).toBe('Notifications, 2 need your attention');
  });

  it('uses the singular for one', () => {
    expect(bellLabel(1)).toBe('Notifications, 1 needs your attention');
  });

  it('still names the control when nothing is waiting', () => {
    expect(bellLabel(0)).toBe('Notifications');
  });
});

describe('enabledNotifications', () => {
  const feed = () =>
    buildNotifications([
      order({ id: 'washing', status: 'washing' }),
      order({ id: 'ready', status: 'ready' }),
      order({ id: 'priced', status: 'received', final_total: 340 }),
      order({ id: 'done', status: 'completed' }),
      order({ id: 'void', status: 'cancelled' }),
    ]);

  const kindsOf = (settings: typeof DEFAULT_SETTINGS) =>
    enabledNotifications(feed(), settings).map((notification) => notification.kind);

  it('hides nothing while both notification settings are on', () => {
    expect(enabledNotifications(feed(), DEFAULT_SETTINGS)).toEqual(feed());
  });

  it('drops progress news once order updates are turned off', () => {
    const kinds = kindsOf({ ...DEFAULT_SETTINGS, orderUpdates: false });

    expect(kinds).not.toContain('stage');
    expect(kinds).not.toContain('booked');
  });

  it('drops finished and cancelled orders once that setting is off', () => {
    const kinds = kindsOf({ ...DEFAULT_SETTINGS, finishedOrders: false });

    expect(kinds).not.toContain('completed');
    expect(kinds).not.toContain('cancelled');
  });

  it('still shows what the customer must act on, whatever they muted', () => {
    // Muting updates is a request for less noise, not a request to be kept
    // from a price waiting to be settled or laundry waiting to be collected.
    const kinds = kindsOf({
      ...DEFAULT_SETTINGS,
      orderUpdates: false,
      finishedOrders: false,
    });

    expect(kinds).toEqual(expect.arrayContaining(['price_ready', 'ready']));
    expect(
      enabledNotifications(feed(), {
        ...DEFAULT_SETTINGS,
        orderUpdates: false,
        finishedOrders: false,
      }).every((notification) => notification.needsAction)
    ).toBe(true);
  });

  it('keeps the badge and the feed agreeing when updates are muted', () => {
    const muted = { ...DEFAULT_SETTINGS, orderUpdates: false };

    expect(actionableCount(enabledNotifications(feed(), muted))).toBe(
      actionableCount(feed())
    );
  });

  it('keeps the order the feed was already sorted into', () => {
    const kept = enabledNotifications(feed(), {
      ...DEFAULT_SETTINGS,
      finishedOrders: false,
    });

    expect(kept.map((n) => n.id)).toEqual(
      feed()
        .filter((n) => n.kind !== 'completed' && n.kind !== 'cancelled')
        .map((n) => n.id)
    );
  });

  it('leaves the feed it was given untouched', () => {
    const original = feed();
    const copy = [...original];

    enabledNotifications(original, { ...DEFAULT_SETTINGS, orderUpdates: false });

    expect(original).toEqual(copy);
  });
});
