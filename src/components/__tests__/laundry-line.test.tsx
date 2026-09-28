import React from 'react';
import renderer, { act } from 'react-test-renderer';

import { LaundryLine } from '../laundry-line';
import { ACCENTS } from '@/components/ui-kit';
import type { LineOrder } from '@/lib/domain/laundry-line';

// The icon font loads asynchronously; the words and their order are what is under test.
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

/** Friday 25 Sep 2026, 2 PM in Manila. */
const NOW = new Date('2026-09-25T06:00:00Z');

function order(overrides: Partial<LineOrder>): LineOrder {
  return {
    id: 'o',
    status: 'washing',
    fulfillment: 'delivery',
    pickup_at: null,
    deliver_by: '2026-09-26T10:00:00Z',
    estimated_total: 196.61,
    final_total: null,
    payment_status: 'unpaid',
    created_at: '2026-09-22T00:00:00Z',
    order_items: [{ service_name: 'Wash and fold', unit: 'per_kg', quantity: 8.5 }],
    ...overrides,
  };
}

function textOf(tree: renderer.ReactTestRenderer): string {
  const out: string[] = [];
  const walk = (node: unknown) => {
    if (typeof node === 'string') out.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === 'object' && 'children' in node) {
      walk((node as { children: unknown }).children);
    }
  };
  walk(tree.toJSON());
  return out.join('');
}

function render(orders: LineOrder[], onOpen = jest.fn()) {
  let tree!: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(
      <LaundryLine
        orders={orders}
        now={NOW}
        shopFor={() => ({ name: 'Sparkle clean', logoUrl: null, accent: ACCENTS[0] })}
        onOpen={onOpen}
      />
    );
  });
  return tree;
}

describe('LaundryLine', () => {
  it('says a load in two short lines: where it is, then how much and when', () => {
    const text = textOf(render([order({ id: 'a' })]));
    expect(text).toContain('Washing');
    expect(text).toContain('8.5 kg · Back tomorrow 6 PM');
    expect(text).toContain('~₱197');
    expect(text).not.toMatch(/2026|NO\.|Step \d of \d|Wash and fold/);
  });

  it('leads with the ready load, and offers to pay only what is owed', () => {
    const text = textOf(
      render([
        order({ id: 'washing' }),
        order({ id: 'ready', status: 'ready', final_total: 616, deliver_by: '2026-09-25T10:00:00Z' }),
      ])
    );
    expect(text.indexOf('Ready')).toBeLessThan(text.indexOf('Washing'));
    expect(text).toContain('Arrives today 6 PM');
    expect(text).toContain('Pay ₱616');
  });

  it('says nothing about money already paid', () => {
    const paid = order({ status: 'ready', final_total: 616, payment_status: 'paid' });
    expect(textOf(render([paid]))).not.toContain('₱616');
  });

  it('opens the load that was tapped', () => {
    const onOpen = jest.fn();
    const tree = render([order({ id: 'tap-me' })], onOpen);
    const row = tree.root.find(
      (node) => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function'
    );
    act(() => row.props.onPress());
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'tap-me' }));
  });
});
