import { DOCKET_LENGTH, docketNumber, stampLabel } from '../docket';

describe('stampLabel', () => {
  // The rule worth pinning: a stamp is an authority's mark, and nobody has
  // stood behind an estimate yet. An unmarked ticket is what "we have not
  // weighed this" looks like.
  it('leaves an estimate unstamped', () => {
    expect(stampLabel('estimated')).toBeNull();
  });

  it('marks a weighed load as owing', () => {
    expect(stampLabel('weighed')).toBe('TO PAY');
  });

  it('marks a settled bill paid', () => {
    expect(stampLabel('settled')).toBe('PAID');
  });
});

describe('docketNumber', () => {
  it('takes the tail of the order id, in the case a receipt is printed in', () => {
    expect(docketNumber('9f8c1a2b-3d4e-5f60-a1b2-c3d4e5f6a7b8')).toBe('F6A7B8');
  });

  // The tail, not the head: consecutive uuids from the same generator can share
  // a prefix, and two orders on one counter must never show the same docket.
  it('reads from the end so near-identical ids stay distinguishable', () => {
    const a = docketNumber('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaa000001');
    const b = docketNumber('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaa000002');

    expect(a).not.toBe(b);
  });

  it('drops the dashes rather than printing them in the number', () => {
    expect(docketNumber('1234-5678')).toBe('345678');
    expect(docketNumber('abc-def')).not.toContain('-');
  });

  it('is always the same length when the id is long enough', () => {
    expect(docketNumber('9f8c1a2b-3d4e-5f60-a1b2-c3d4e5f6a7b8')).toHaveLength(
      DOCKET_LENGTH
    );
  });

  // A short id is not a reason to show nothing: whatever is there still tells
  // the counter which order is being asked about.
  it('shows a short id in full rather than padding it', () => {
    expect(docketNumber('a1b2')).toBe('A1B2');
  });

  it('has nothing to show for a missing id', () => {
    expect(docketNumber('')).toBe('');
    expect(docketNumber('   ')).toBe('');
    expect(docketNumber(null)).toBe('');
    expect(docketNumber(undefined)).toBe('');
    // An id made only of separators leaves no characters to print.
    expect(docketNumber('----')).toBe('');
  });
});
