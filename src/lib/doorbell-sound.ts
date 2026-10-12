/**
 * The sound the shop doorbell makes.
 *
 * Domain decides *when* to ring. This is the speaker: the bundled
 * `new-order.mp3` through expo-audio (web and phone alike), a vibration
 * pattern on a phone, and a system notice when the browser lets us post one.
 *
 * The phone used to only vibrate: the old two-note tone was drawn with Web
 * Audio, which an Android or iOS app does not have. Nothing here throws into
 * a press handler — a muted phone, a blocked autoplay, a missing Notification
 * API, all just stay quiet.
 */

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { Platform, Vibration } from 'react-native';

const NEW_ORDER_SOUND = require('../../assets/sounds/new-order.mp3');

const RING_PATTERN = [0, 180, 80, 180, 80, 420];

/**
 * The clip is under a second, easy to miss over running machines, so one new
 * order rings it three times. The gap is the clip's length plus a breath.
 */
const RING_COUNT = 3;
const RING_GAP_MS = 1100;

let pendingRings: ReturnType<typeof setTimeout>[] = [];

let player: AudioPlayer | null = null;
let modeSet = false;

function bell(): AudioPlayer | null {
  if (player) return player;
  try {
    player = createAudioPlayer(NEW_ORDER_SOUND);
    return player;
  } catch {
    return null;
  }
}

/** Ring even when the phone's silent switch is on: a missed load costs the shop. */
async function ensureAudioMode(): Promise<void> {
  if (modeSet || Platform.OS === 'web') return;
  await setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'duckOthers' });
  modeSet = true;
}

async function playChime(): Promise<void> {
  await ensureAudioMode().catch(() => undefined);
  const sound = bell();
  if (!sound) return;
  // Rewind first, or a second order in the same session plays nothing.
  await sound.seekTo(0).catch(() => undefined);
  sound.play();
}

/** Call from a tap so the browser allows sound on the next incoming order. */
export function unlockDoorbell(): void {
  bell();
}

export function playDoorbell(): void {
  // A second order mid-ring starts the run over rather than talking over it.
  pendingRings.forEach(clearTimeout);
  pendingRings = Array.from({ length: RING_COUNT - 1 }, (_, i) =>
    setTimeout(() => void playChime().catch(() => undefined), RING_GAP_MS * (i + 1))
  );
  void playChime().catch(() => undefined);
  try {
    if (Platform.OS !== 'web') Vibration.vibrate(RING_PATTERN);
  } catch {
    // A phone that cannot vibrate just does not.
  }
}

export function postSystemNotice(title: string, body: string): void {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'granted') return;
    new Notification(title, { body, tag: 'milaundry-doorbell', silent: false });
  } catch {
    // A blocked or missing Notification API is not a reason to fail the ring.
  }
}

/** Asked from the test button, so a background tab can ring later. */
export function askToNotify(): void {
  try {
    if (typeof Notification === 'undefined') return;
    if (Notification.permission === 'default') void Notification.requestPermission();
  } catch {
    // Permission is optional. The in-app ring still works.
  }
}
