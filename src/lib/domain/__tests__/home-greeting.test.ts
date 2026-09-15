import { greetingName, homeGreeting, storefrontGreeting } from '../home-greeting';

describe('greetingName', () => {
  test('uses the first name only: a greeting says what a person is called', () => {
    expect(greetingName('Maria Santos')).toBe('Maria');
  });

  test('keeps a one-word name whole', () => {
    expect(greetingName('Maria')).toBe('Maria');
  });

  test('trims the padding a sign-up form leaves behind', () => {
    expect(greetingName('  Ana   Reyes  ')).toBe('Ana');
  });

  test('is empty when there is no name to use', () => {
    expect(greetingName(null)).toBe('');
    expect(greetingName(undefined)).toBe('');
    expect(greetingName('   ')).toBe('');
  });

  test('refuses a name too long to set on one line, rather than truncating mid-word', () => {
    // 20 characters is the most the headline holds at its largest size; past
    // that the greeting drops to "Hi there," instead of shipping an ellipsis.
    expect(greetingName('Bartholomewsimpsonian')).toBe('');
  });
});

describe('homeGreeting', () => {
  test('greets the customer by name and says what the screen is', () => {
    expect(homeGreeting('Maria Santos')).toEqual({
      hello: 'Hi Maria,',
      name: 'Maria',
      line: "here's your laundry.",
      lead: "here's",
      rest: 'your laundry.',
    });
  });

  test('greets a nameless session without pretending to know them', () => {
    expect(homeGreeting(null)).toEqual({
      hello: 'Hi there,',
      name: 'there',
      line: "here's your laundry.",
      lead: "here's",
      rest: 'your laundry.',
    });
  });
});

describe('storefrontGreeting', () => {
  test('speaks for the shop, not for the app', () => {
    expect(storefrontGreeting('Maria Santos')).toEqual({
      hello: 'Hi Maria,',
      name: 'Maria',
      line: "here's what we wash.",
      lead: "here's",
      rest: 'what we wash.',
    });
  });

  test('greets a visitor who has never signed in', () => {
    expect(storefrontGreeting(null)).toEqual({
      hello: 'Hi there,',
      name: 'there',
      line: "here's what we wash.",
      lead: "here's",
      rest: 'what we wash.',
    });
  });
});

describe('the emphasis split', () => {
  test('rejoins into exactly the line it was split from', () => {
    for (const greeting of [homeGreeting('Maria Santos'), storefrontGreeting(null)]) {
      expect(greeting.lead + ' ' + greeting.rest).toBe(greeting.line);
    }
  });

  test('names the reader so the headline can weight it on its own', () => {
    expect(homeGreeting('Maria Santos').name).toBe('Maria');
    expect(homeGreeting('  ').name).toBe('there');
  });
});
