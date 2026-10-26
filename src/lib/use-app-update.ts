/**
 * Picks up a published update while the app is open.
 *
 * Out of the box an update is fetched in the background at launch and only
 * applied on the launch after that, so staff kept working on yesterday's app
 * and asked where a new option was. Now the app checks at launch and every
 * time it comes back to the front, downloads quietly, and says when a new
 * version is ready. It never restarts by itself: a half-filled order at the
 * counter is worth more than an update a moment sooner.
 */
import * as Updates from 'expo-updates';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

/** Don't ask the server again on every app switch. */
const CHECK_EVERY_MS = 5 * 60 * 1000;

export function useAppUpdate() {
  // Flips once a downloaded update is waiting to be applied.
  const { isUpdatePending } = Updates.useUpdates();
  const lastCheck = useRef(0);

  const check = useCallback(async () => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;
    const now = Date.now();
    if (now - lastCheck.current < CHECK_EVERY_MS) return;
    lastCheck.current = now;
    try {
      const found = await Updates.checkForUpdateAsync();
      if (!found.isAvailable) return;
      await Updates.fetchUpdateAsync();
    } catch {
      // Offline or the server is busy: the next launch or return tries again.
    }
  }, []);

  useEffect(() => {
    void check();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => subscription.remove();
  }, [check]);

  const apply = useCallback(() => {
    void Updates.reloadAsync().catch(() => undefined);
  }, []);

  return { isReady: isUpdatePending && Platform.OS !== 'web', apply };
}
