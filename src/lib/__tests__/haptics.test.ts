import * as Haptics from 'expo-haptics';

import { performHaptic } from '../haptics';

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
}));

const engine = Haptics as jest.Mocked<typeof Haptics>;

beforeEach(() => {
  jest.clearAllMocks();
});

describe('performHaptic', () => {
  it('asks the engine for the impact it was given', () => {
    performHaptic({ kind: 'impact', style: 'Light' });

    expect(engine.impactAsync).toHaveBeenCalledWith('light');
  });

  it('asks for a notification by type', () => {
    performHaptic({ kind: 'notification', type: 'Error' });

    expect(engine.notificationAsync).toHaveBeenCalledWith('error');
  });

  it('asks for the selection tick', () => {
    performHaptic({ kind: 'selection' });

    expect(engine.selectionAsync).toHaveBeenCalledTimes(1);
  });

  it('touches nothing when there is no effect to perform', () => {
    // What a customer who turned haptics off has asked for.
    performHaptic(null);

    expect(engine.impactAsync).not.toHaveBeenCalled();
    expect(engine.notificationAsync).not.toHaveBeenCalled();
    expect(engine.selectionAsync).not.toHaveBeenCalled();
  });

  it('does not throw into the press when the hardware refuses', async () => {
    // No Taptic Engine, Low Power Mode, a browser that will not vibrate: the
    // haptic is lost, the button still works.
    engine.impactAsync.mockRejectedValue(new Error('no haptics engine'));

    expect(() => performHaptic({ kind: 'impact', style: 'Medium' })).not.toThrow();
    await Promise.resolve();
  });
});
