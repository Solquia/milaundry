/**
 * Asks before a destructive or committing tap, on every platform.
 *
 * `Alert.alert` with buttons is a no-op on react-native-web: no dialog, no
 * callback. Every confirm in the app went through it, so on the web build
 * "Remove from price list", "Cancel order" and "Sign out" silently did nothing.
 * The browser's own confirm is plain, but it asks, and the prompt's title and
 * consequence still read the same.
 */
import { Alert, Platform } from 'react-native';

import type { ConfirmPrompt } from './domain/confirm-prompts';

export function confirmAction(
  prompt: ConfirmPrompt,
  onConfirm: () => void,
  { isDestructive = true }: { isDestructive?: boolean } = {}
): void {
  const ask = (globalThis as { confirm?: (message: string) => boolean }).confirm;
  if (Platform.OS === 'web' && typeof ask === 'function') {
    if (ask(`${prompt.title}\n\n${prompt.message}`)) onConfirm();
    return;
  }

  Alert.alert(prompt.title, prompt.message, [
    { text: prompt.dismissLabel, style: 'cancel' },
    {
      text: prompt.confirmLabel,
      style: isDestructive ? 'destructive' : 'default',
      onPress: onConfirm,
    },
  ]);
}
