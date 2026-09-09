import { homeSubline, leadingIndex, type HeadlineOrder } from '../home-headline';

const washing: HeadlineOrder = {
  status: 'washing',
  statusLabel: 'Washing',
  shopName: 'Sparkle Wash',
};

const folded: HeadlineOrder = {
  status: 'folded',
  statusLabel: 'Folded',
  shopName: 'Sparkle clean',
};

const ready: HeadlineOrder = {
  status: 'ready',
  statusLabel: 'Ready for pickup',
  shopName: 'Sparkle Wash',
};

describe('leadingIndex', () => {
  it('reports nothing to lead with on an empty wash', () => {
    expect(leadingIndex([])).toBe(-1);
  });

  it('picks the ready load wherever it sits', () => {
    expect(leadingIndex([washing, folded, ready])).toBe(2);
  });

  it('picks the furthest-along load when none is ready', () => {
    expect(leadingIndex([washing, folded])).toBe(1);
  });

  it('picks the first of several ready loads', () => {
    expect(leadingIndex([washing, ready, ready])).toBe(1);
  });
});

describe('homeSubline', () => {
  it('invites a first booking when nothing is in the wash', () => {
    expect(homeSubline([])).toBe(
      "Book a pickup and we'll collect it from your door."
    );
  });

  it('reads as a sentence, since no heading sits above it', () => {
    expect(homeSubline([washing])).toBe('Washing at Sparkle Wash');
  });

  it('leads with the load that is ready, wherever it sits in the list', () => {
    // A ready load means someone is waiting; it outranks anything mid-cycle
    // even when the API returns it last.
    expect(homeSubline([washing, folded, ready])).toBe(
      'Ready for pickup at Sparkle Wash · +2 more'
    );
  });

  it('counts the rest rather than listing them', () => {
    expect(homeSubline([washing, folded])).toBe('Folded at Sparkle clean · +1 more');
  });

  it('counts multiple ready loads instead of naming one shop', () => {
    expect(homeSubline([ready, { ...ready, shopName: 'Sparkle clean' }])).toBe(
      '2 loads ready for pickup'
    );
  });

  it('speaks for the load leadingIndex picked', () => {
    // The shop page's Track card routes by leadingIndex; the home line names a
    // load. They must not disagree.
    const active = [washing, folded, ready];
    expect(homeSubline(active)).toContain(active[leadingIndex(active)].statusLabel);
  });
});
