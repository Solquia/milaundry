import {
  MAX_BANNERS,
  basketBadge,
  cardTag,
  cheapestId,
  matchesQuery,
  ownImage,
  withServiceImages,
  serviceFrames,
  spotlightBanners,
  spotlightPicks,
  spotlightPrice,
  spotlightSections,
  type SpotlightService,
} from '../spotlight';

function service(overrides: Partial<SpotlightService> & { id: string }): SpotlightService {
  return {
    name: 'Wash & Fold',
    unit: 'per_kg',
    price: 35,
    category: 'wash_fold',
    min_quantity: 0,
    ...overrides,
  };
}

const MENU: SpotlightService[] = [
  service({ id: 'wf', name: 'Wash & Fold', price: 35 }),
  service({ id: 'wf-office', name: 'Wash & Fold Office Clothes', price: 45 }),
  service({ id: 'press', name: 'Ironing', unit: 'per_item', price: 20, category: 'ironing' }),
  service({ id: 'comforter', name: 'Comforter', unit: 'per_item', price: 180, category: 'special_items' }),
  service({ id: 'self', name: 'Self-Service Wash', unit: 'flat', price: 60, category: 'self_service' }),
];

const RATED = { average: 4.76, count: 12, label: '4.8 · 12 reviews' };

describe('spotlightBanners', () => {
  it('leads with the lowest price and links it to that service', () => {
    const [first] = spotlightBanners({ services: MENU, reputation: null });
    expect(first.kicker).toBe('Lowest price');
    expect(first.headline).toBe('Ironing');
    expect(first.detail).toBe('Only ₱20/piece at this shop');
    expect(first.photo).toBe('iron');
    expect(first.action).toEqual({ kind: 'service', serviceId: 'press' });
  });

  it('runs the rating only when customers have rated the shop', () => {
    const rated = spotlightBanners({ services: MENU, reputation: RATED });
    expect(rated[1].headline).toBe('Rated 4.8 out of 5');
    expect(rated[1].detail).toBe('From 12 reviews after real orders');
    const unrated = spotlightBanners({ services: MENU, reputation: null });
    expect(unrated.some((banner) => banner.key === 'rating')).toBe(false);
  });

  it('spotlights other categories and never repeats the lowest price one', () => {
    const banners = spotlightBanners({ services: MENU, reputation: null });
    const categories = banners.filter((banner) => banner.key.startsWith('category-'));
    expect(categories[0].headline).toBe('Wash & Fold');
    expect(categories[0].kicker).toBe('2 choices');
    expect(categories[0].detail).toBe('Starts from ₱35/kg');
    expect(categories.some((banner) => banner.key === 'category-ironing')).toBe(false);
  });

  it('caps the carousel and always ends on the whole menu', () => {
    const banners = spotlightBanners({ services: MENU, reputation: RATED });
    expect(banners).toHaveLength(MAX_BANNERS);
    expect(banners[banners.length - 1].key).toBe('all');
    expect(banners[banners.length - 1].headline).toBe('5 services, one checkout');
  });

  it('says the menu is coming when the shop has no prices', () => {
    const banners = spotlightBanners({ services: [], reputation: RATED });
    expect(banners.map((banner) => banner.key)).toEqual(['soon']);
  });

  it('skips a free service when choosing the lowest price', () => {
    const banners = spotlightBanners({
      services: [service({ id: 'free', price: 0 }), service({ id: 'paid', price: 50 })],
      reputation: null,
    });
    expect(banners[0].action).toEqual({ kind: 'service', serviceId: 'paid' });
  });
});

describe('spotlightPicks', () => {
  it('shows one of each category before a second of any', () => {
    expect(spotlightPicks(MENU).map((pick) => pick.id)).toEqual(['wf', 'press', 'comforter', 'self', 'wf-office']);
  });

  it('honours the limit', () => {
    expect(spotlightPicks(MENU, 2).map((pick) => pick.id)).toEqual(['wf', 'press']);
    expect(spotlightPicks(MENU, -1)).toEqual([]);
  });
});

describe('spotlightSections', () => {
  it('sections only the categories the shop sells, in menu order', () => {
    const sections = spotlightSections(MENU);
    expect(sections.map((section) => section.category)).toEqual([
      'wash_fold',
      'ironing',
      'special_items',
      'self_service',
    ]);
    expect(sections[0]).toMatchObject({ title: 'Wash & Fold', short: 'Wash & Fold', from: 'from ₱35/kg', photo: 'stack' });
    expect(sections[2]).toMatchObject({ short: 'Bedding', photo: 'bed' });
    expect(sections[0].services.map((item) => item.id)).toEqual(['wf', 'wf-office']);
  });
});

describe('serviceFrames', () => {
  it('gives siblings on one photo different crops', () => {
    const frames = serviceFrames(MENU);
    expect(frames.get('wf')?.photo).toBe('stack');
    expect(frames.get('wf-office')?.photo).toBe('stack');
    expect(frames.get('wf')?.focus).not.toEqual(frames.get('wf-office')?.focus);
    expect(frames.get('self')?.photo).toBe('machine');
  });
});

describe('spotlightPrice', () => {
  it('splits the figure from its unit', () => {
    expect(spotlightPrice(MENU[0])).toEqual({ figure: '₱35', unit: '/kg' });
    expect(spotlightPrice(MENU[4])).toEqual({ figure: '₱60', unit: '' });
  });
});

describe('basketBadge', () => {
  it('counts pieces and marks a load', () => {
    expect(basketBadge(0, false)).toBeNull();
    expect(basketBadge(2, false)).toBe('2 in basket');
    expect(basketBadge(1, true)).toBe('In basket');
  });
});

describe('cardTag', () => {
  it('marks the lowest price and otherwise says how it is charged', () => {
    const lowest = cheapestId(MENU);
    expect(lowest).toBe('press');
    expect(cardTag(MENU[2], lowest)).toBe('Lowest price');
    expect(cardTag(MENU[0], lowest)).toBe('Per kg');
    expect(cardTag(MENU[3], lowest)).toBe('Per piece');
    expect(cardTag(MENU[4], lowest)).toBe('Flat rate');
    expect(cardTag({ ...MENU[4], max_quantity: 8 }, lowest)).toBe('Per load');
  });
});

describe('matchesQuery', () => {
  it('needs every word, in the name or the description', () => {
    expect(matchesQuery(MENU[1], 'office fold')).toBe(true);
    expect(matchesQuery(MENU[1], 'office iron')).toBe(false);
    expect(matchesQuery({ ...MENU[3], description: 'Queen or king' }, 'king')).toBe(true);
    expect(matchesQuery(MENU[0], '   ')).toBe(true);
  });
});

describe('own service photos', () => {
  it('treats a blank url as the app cut-out', () => {
    expect(ownImage({ image_url: '' })).toBeNull();
    expect(ownImage({ image_url: '   ' })).toBeNull();
    expect(ownImage({})).toBeNull();
    expect(ownImage({ image_url: ' https://x/y.jpg ' })).toBe('https://x/y.jpg');
  });

  it('lets the shop photo win in the frame and keeps the cut-out as fallback', () => {
    const frames = serviceFrames([{ ...MENU[0], image_url: 'https://x/wf.jpg' }, MENU[2]]);
    expect(frames.get('wf')).toMatchObject({ photo: 'stack', imageUrl: 'https://x/wf.jpg' });
    expect(frames.get('press')).toMatchObject({ photo: 'iron', imageUrl: null });
  });

  it('lays fetched photos on and leaves the rest alone', () => {
    const merged = withServiceImages(MENU, { wf: 'https://x/wf.jpg' });
    expect(merged[0].image_url).toBe('https://x/wf.jpg');
    expect(merged[1].image_url).toBeUndefined();
    expect(withServiceImages(MENU, undefined)).toEqual(MENU);
  });
});
