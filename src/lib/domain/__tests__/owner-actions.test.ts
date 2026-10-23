import { ownerActions, type ActionInput } from '../owner-actions';

function input(overrides: Partial<ActionInput> = {}): ActionInput {
  return {
    sold: 1000,
    moneyIn: 1000,
    supplies: 80,
    taken: 8,
    collectable: { amount: 0, count: 0 },
    restock: [],
    topSupply: null,
    expenses: { total: 0, top: null },
    salesDelta: 0,
    compareLabel: 'yesterday by 2:15 PM',
    missingCosts: 0,
    ...overrides,
  };
}

const keys = (actions: ReturnType<typeof ownerActions>) => actions.map((action) => action.key);

describe('ownerActions', () => {
  it('puts money waiting at the counter first', () => {
    const actions = ownerActions(input({ collectable: { amount: 1040, count: 4 } }));

    expect(actions[0]).toMatchObject({ key: 'collect', tone: 'urgent', target: 'collect' });
    expect(actions[0].title).toBe('Collect ₱1,040.00 from 4 customers');
  });

  it('asks for a restock, out before low', () => {
    const actions = ownerActions(
      input({
        restock: [
          { name: 'Surf', left: 0 },
          { name: 'Downy', left: 3 },
        ],
      })
    );

    expect(actions.slice(0, 2).map((action) => action.title)).toEqual([
      'Restock Surf: it is out',
      'Buy more Downy: 3 left',
    ]);
  });

  it('warns when supplies eat too much of sales, naming the biggest', () => {
    const actions = ownerActions(
      input({ supplies: 200, topSupply: { name: 'Zonrox Bleach', cost: 120 } })
    );
    const supplies = actions.find((action) => action.key === 'supplies');

    expect(supplies).toMatchObject({ tone: 'warn', target: 'prices' });
    expect(supplies?.detail).toContain('Zonrox Bleach');
  });

  it('warns when spending passes money in', () => {
    const actions = ownerActions(
      input({ moneyIn: 500, expenses: { total: 800, top: { label: 'Rent', amount: 600 } } })
    );

    expect(actions[0]).toMatchObject({ key: 'expenses', tone: 'urgent', target: 'expenses' });
    expect(actions[0].detail).toContain('Rent');
  });

  it('points at missing costs so profit can be trusted', () => {
    expect(keys(ownerActions(input({ missingCosts: 2 })))).toContain('costs');
  });

  it('says so when there is nothing to do, and keeps the list short', () => {
    expect(ownerActions(input())).toEqual([
      expect.objectContaining({ key: 'clear', tone: 'good' }),
    ]);

    const busy = ownerActions(
      input({
        collectable: { amount: 100, count: 1 },
        restock: [
          { name: 'A', left: 0 },
          { name: 'B', left: 0 },
          { name: 'C', left: 1 },
        ],
        supplies: 300,
        missingCosts: 3,
        salesDelta: -200,
      })
    );
    expect(busy).toHaveLength(5);
  });
});
