import { credentialsHandoff } from '../credentials-handoff';

describe('credentialsHandoff', () => {
  it('summarises the login details to hand to the shop', () => {
    const handoff = credentialsHandoff({
      fullName: '  Maria Santos ',
      phone: '+639171234567',
      password: 'temp-pass-123',
    });

    expect(handoff.title).toBe('Account created for Maria Santos');
    expect(handoff.lines).toEqual([
      'Mobile number: +63 917 123 4567',
      'Temporary password: temp-pass-123',
    ]);
    expect(handoff.note).toBe(
      'Send these to them privately — they can sign in right away and should change the password after.'
    );
  });

  it('falls back to the raw phone when it is not a PH number', () => {
    const handoff = credentialsHandoff({
      fullName: 'Ana',
      phone: '+15551234567',
      password: 'temp-pass-123',
    });

    expect(handoff.lines[0]).toBe('Mobile number: +15551234567');
  });
});
