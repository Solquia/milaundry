import { Alert, Platform } from 'react-native';

import { confirmAction } from '../confirm';

const prompt = {
  title: 'Remove Tide?',
  message: 'It disappears from your price list.',
  confirmLabel: 'Remove',
  dismissLabel: 'Keep it',
};

describe('confirmAction', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
  });

  it('asks through the browser on web, where Alert.alert does nothing', () => {
    // Arrange
    Platform.OS = 'web';
    const confirm = jest.fn(() => true);
    (globalThis as { confirm?: unknown }).confirm = confirm;
    const onConfirm = jest.fn();

    // Act
    confirmAction(prompt, onConfirm);

    // Assert
    expect(confirm).toHaveBeenCalledWith('Remove Tide?\n\nIt disappears from your price list.');
    expect(onConfirm).toHaveBeenCalled();
  });

  it('does nothing on web when the owner backs out', () => {
    Platform.OS = 'web';
    (globalThis as { confirm?: unknown }).confirm = jest.fn(() => false);
    const onConfirm = jest.fn();

    confirmAction(prompt, onConfirm);

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('uses the native dialog with both outcomes named on the buttons', () => {
    Platform.OS = 'ios';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const onConfirm = jest.fn();

    confirmAction(prompt, onConfirm);

    const buttons = alert.mock.calls[0][2]!;
    expect(buttons.map((button) => button.text)).toEqual(['Keep it', 'Remove']);
    buttons[1].onPress?.();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('can mark the confirming button as not destructive', () => {
    Platform.OS = 'android';
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    confirmAction(prompt, jest.fn(), { isDestructive: false });

    expect(alert.mock.calls[0][2]![1].style).toBe('default');
  });
});
