import { loginIdToAuthEmail, parseLoginId } from '../login-id';

describe('parseLoginId', () => {
  it('treats digit-only input as a mobile number', () => {
    expect(parseLoginId('0917 123 4567')).toEqual({
      kind: 'phone',
      phone: '+639171234567',
    });
    expect(parseLoginId('+63 917 123 4567')).toEqual({
      kind: 'phone',
      phone: '+639171234567',
    });
  });

  it('treats input with letters as a shop username', () => {
    expect(parseLoginId('SparkleWash')).toEqual({
      kind: 'username',
      username: 'sparklewash',
    });
    expect(parseLoginId('  sparkle-wash ')).toEqual({
      kind: 'username',
      username: 'sparkle-wash',
    });
  });

  it('rejects incomplete phone numbers', () => {
    expect(parseLoginId('0917 123')).toBeNull();
  });

  it('rejects usernames that are too short or malformed', () => {
    expect(parseLoginId('ab')).toBeNull();
    expect(parseLoginId('has spaces inside')).toBeNull();
    expect(parseLoginId('')).toBeNull();
  });
});

describe('loginIdToAuthEmail', () => {
  it('maps phones through the synthetic phone email', () => {
    expect(loginIdToAuthEmail({ kind: 'phone', phone: '+639171234567' })).toBe(
      '639171234567@example.com'
    );
  });

  it('maps usernames onto the same auth domain', () => {
    expect(
      loginIdToAuthEmail({ kind: 'username', username: 'sparklewash' })
    ).toBe('sparklewash@example.com');
  });
});
