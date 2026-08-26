/**
 * The one place that touches the haptics engine.
 *
 * `domain/haptic-feedback` decides *what* should happen and stays free of
 * native modules so it can be reasoned about and tested; this performs it.
 *
 * Nothing here is awaited and nothing here can throw into a press handler. A
 * device with no Taptic Engine, a phone in Low Power Mode, a web browser that
 * refuses to vibrate — every one of those is a haptic that simply does not
 * happen, and none of them is a reason for a button not to work.
 */

import * as Haptics from 'expo-haptics';

import type { HapticEffect } from './domain/haptic-feedback';

export function performHaptic(effect: HapticEffect | null): void {
  if (effect === null) return;

  const done = (() => {
    switch (effect.kind) {
      case 'impact':
        return Haptics.impactAsync(Haptics.ImpactFeedbackStyle[effect.style]);
      case 'notification':
        return Haptics.notificationAsync(
          Haptics.NotificationFeedbackType[effect.type]
        );
      case 'selection':
        return Haptics.selectionAsync();
    }
  })();

  void done.catch(() => {
    // Silence is the correct outcome of a haptic the hardware cannot give.
  });
}
