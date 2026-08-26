/**
 * Whether the splash has already played in this app launch.
 *
 * Deliberately module state and not storage: the splash should be seen once
 * per launch, so the flag must die with the process. Persisting it would mean
 * the splash never plays again; keeping it in React state would replay it on
 * every return to the index, including straight after signing out.
 */

let hasPlayed = false;

export function hasSeenSplash(): boolean {
  return hasPlayed;
}

export function markSplashSeen(): void {
  hasPlayed = true;
}
