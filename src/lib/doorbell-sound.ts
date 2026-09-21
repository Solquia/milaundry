/**
 * The sound the shop doorbell makes.
 *
 * Domain decides *when* to ring. This is the speaker: a two-note ding-dong
 * on the web, a vibration pattern on a phone that has no Web Audio, and a
 * system notice when the browser lets us post one. Nothing here throws into
 * a press handler — a muted phone, a blocked autoplay, a missing Notification
 * API, all just stay quiet.
 */

import { Platform, Vibration } from 'react-native';

type AudioCtx = {
  currentTime: number;
  state: string;
  resume: () => Promise<void>;
  createOscillator: () => {
    type: string;
    frequency: { value: number };
    connect: (node: unknown) => void;
    start: (when: number) => void;
    stop: (when: number) => void;
  };
  createGain: () => {
    gain: {
      setValueAtTime: (value: number, when: number) => void;
      exponentialRampToValueAtTime: (value: number, when: number) => void;
    };
    connect: (node: unknown) => void;
  };
  destination: unknown;
};

let ctx: AudioCtx | null = null;

function audioContext(): AudioCtx | null {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const Ctor =
    (window as unknown as { AudioContext?: new () => AudioCtx }).AudioContext ??
    (window as unknown as { webkitAudioContext?: new () => AudioCtx }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

function tone(audio: AudioCtx, frequency: number, start: number, duration: number, peak: number): void {
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.type = 'sine';
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(peak, start + 0.018);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

function playDingDong(): void {
  const audio = audioContext();
  if (!audio) return;
  void audio.resume().catch(() => undefined);
  const t = audio.currentTime + 0.02;
  // A shop bell, not a notification chirp: high then low, like a door.
  tone(audio, 880, t, 0.16, 0.28);
  tone(audio, 659.25, t + 0.18, 0.36, 0.22);
}

const RING_PATTERN = [0, 180, 80, 180, 80, 420];

/** Call from a tap so the browser allows sound on the next incoming order. */
export function unlockDoorbell(): void {
  const audio = audioContext();
  if (audio && audio.state !== 'running') void audio.resume().catch(() => undefined);
}

export function playDoorbell(): void {
  try {
    playDingDong();
  } catch {
    // No speaker is a quiet shop, not a crashed one.
  }
  try {
    if (Platform.OS !== 'web') Vibration.vibrate(RING_PATTERN);
  } catch {
    // Same: a phone that cannot vibrate just does not.
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
