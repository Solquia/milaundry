import React from 'react';
import renderer, { act, type ReactTestInstance } from 'react-test-renderer';

import { SchedulePlanner, type Schedule, type StopName } from '../schedule-planner';
import { DEFAULT_SHOP_HOURS, type ShopHours } from '@/lib/domain/rider-calendar';

// The icon font loads asynchronously; the words and the taps are what is under test.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

/** Friday 25 Sep 2026, 2 PM in Manila. */
const NOW = new Date('2026-09-25T06:00:00Z');
const SUNDAYS_OFF: ShopHours = { ...DEFAULT_SHOP_HOURS, closedWeekdays: [0] };
const SCHEDULE: Schedule = {
  pickup: { day: '2026-09-25', hour: 16 },
  deliver: { day: '2026-09-26', hour: 16 },
};

function render(
  value: Schedule,
  openStop: StopName | null,
  onChange: (next: Schedule) => void = () => undefined
) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <SchedulePlanner
        value={value}
        onChange={onChange}
        openStop={openStop}
        onOpenStop={() => undefined}
        hours={SUNDAYS_OFF}
        now={NOW}
      />
    );
  });
  return tree;
}

function allText(tree: renderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out.join(' ');
}

function byLabel(tree: renderer.ReactTestRenderer, label: RegExp): ReactTestInstance {
  const hits = tree.root.findAll(
    (node) =>
      typeof node.props.accessibilityLabel === 'string' &&
      label.test(node.props.accessibilityLabel) &&
      typeof node.props.onPress === 'function'
  );
  return hits[0];
}

describe('SchedulePlanner', () => {
  it('reads as a journey: who comes, when, how long it stays, when it is back', () => {
    const text = allText(render(SCHEDULE, null));
    expect(text).toContain('Today, 25 Sep');
    expect(text).toContain('4–6 PM');
    expect(text).toContain('Tomorrow, 26 Sep');
    expect(text).toContain('about 1 day later');
  });

  it('shows a closed day as closed before anyone taps it', () => {
    const tree = render(SCHEDULE, 'pickup');
    const sunday = byLabel(tree, /^Pickup, Sun 27, Closed$/);
    expect(sunday.props.disabled).toBe(true);
  });

  it('moves the pickup to a tapped day and carries the return with it', () => {
    const onChange = jest.fn();
    const tree = render(SCHEDULE, 'pickup', onChange);
    act(() => byLabel(tree, /^Pickup, Mon 28/).props.onPress());
    expect(onChange).toHaveBeenCalledWith({
      pickup: { day: '2026-09-28', hour: 16 },
      // The return had been Saturday, before the new pickup: it moves past it.
      deliver: { day: '2026-09-29', hour: 16 },
    });
  });

  it('tags the soonest return inside the return picker', () => {
    const later = { ...SCHEDULE, deliver: { day: '2026-09-26', hour: 12 } };
    const tree = render(later, 'deliver');
    expect(byLabel(tree, /^Return 8–10 AM, soonest$/)).toBeDefined();
  });

  it('says what is wrong under the stop it belongs to, without waiting for Continue', () => {
    const passed = { ...SCHEDULE, pickup: { day: '2026-09-25', hour: 12 } };
    expect(allText(render(passed, null))).toMatch(/pickup time has passed/i);
  });
});
