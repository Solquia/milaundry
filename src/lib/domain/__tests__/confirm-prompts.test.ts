import {
  cancelOrderPrompt,
  markPaidPrompt,
  removeServicePrompt,
  signOutPrompt,
} from '../confirm-prompts';

describe('cancelOrderPrompt', () => {
  it('names the order and the amount being voided', () => {
    // Arrange / Act
    const prompt = cancelOrderPrompt('#fe0f15c5', 2841);

    // Assert
    expect(prompt.title).toBe('Cancel order #fe0f15c5?');
    expect(prompt.message).toContain('₱2,841.00');
    expect(prompt.message).toContain('cannot be undone');
  });

  it('labels both buttons with their outcome, never Yes/No', () => {
    const prompt = cancelOrderPrompt('#abc12345', 175);
    expect(prompt.confirmLabel).toBe('Cancel order');
    expect(prompt.dismissLabel).toBe('Keep order');
  });
});

describe('removeServicePrompt', () => {
  it('names the service and says where it disappears from', () => {
    const prompt = removeServicePrompt('Curtains');
    expect(prompt.title).toBe('Remove Curtains?');
    expect(prompt.message).toContain('New Order');
    expect(prompt.confirmLabel).toBe('Remove');
    expect(prompt.dismissLabel).toBe('Keep it');
  });

  it('reassures that past orders keep their prices', () => {
    expect(removeServicePrompt('Curtains').message).toContain('Past orders keep');
  });
});

describe('markPaidPrompt', () => {
  it('puts the amount on the title so the owner confirms the figure, not the gesture', () => {
    const prompt = markPaidPrompt(2841, 'Cash');
    expect(prompt.title).toBe('Mark ₱2,841.00 as paid?');
    expect(prompt.message).toContain('Cash');
    expect(prompt.confirmLabel).toBe('Mark as paid');
    expect(prompt.dismissLabel).toBe('Not yet');
  });

  it('reports the change owed when the customer handed over more', () => {
    const prompt = markPaidPrompt(2841, 'Cash', 3000);
    expect(prompt.message).toContain('₱3,000.00');
    expect(prompt.message).toContain('₱159.00 change');
  });

  it('omits change talk for a non-cash method', () => {
    expect(markPaidPrompt(500, 'GCash').message).not.toContain('change');
  });
});

describe('signOutPrompt', () => {
  it('warns that getting back in needs credentials', () => {
    const prompt = signOutPrompt();
    expect(prompt.title).toBe('Sign out?');
    expect(prompt.message).toContain('sign in again');
    expect(prompt.confirmLabel).toBe('Sign out');
    expect(prompt.dismissLabel).toBe('Stay signed in');
  });
});
