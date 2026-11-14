/**
 * Reward sounds, synthesized with Web Audio (no audio files, works offline).
 * Soft bell tones: a chime that climbs with your streak, a sparkle when a fact
 * is mastered, and a short fanfare when a level unlocks.
 */
import { app } from './app';

type Ctor = typeof AudioContext;
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!app.prefs.sound) return null;
  try {
    if (!ctx) {
      const C: Ctor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: Ctor }).webkitAudioContext;
      if (!C) return null;
      // iOS 17+: play even when the ring/silent switch is on silent, like a game would.
      const nav = navigator as Navigator & { audioSession?: { type: string } };
      if (nav.audioSession) nav.audioSession.type = 'playback';
      ctx = new C();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** Call from a tap or keypress so the browser allows sound later. */
export function unlockAudio(): void {
  audio();
}

/** A soft bell: sine fundamental plus gentle overtones, quick attack, long fade. */
function bell(c: AudioContext, freq: number, at: number, dur = 0.6, vol = 0.18): void {
  const out = c.createGain();
  out.gain.setValueAtTime(0.0001, at);
  out.gain.exponentialRampToValueAtTime(vol, at + 0.008);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  out.connect(c.destination);
  for (const [mult, amp] of [
    [1, 1],
    [2, 0.28],
    [3, 0.08],
  ]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(freq * mult, at);
    g.gain.value = amp;
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
}

// C major pentatonic, two octaves: every combination sounds pleasant.
const SCALE = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

/** Right answer: a two-note "ding-ding" that climbs as the streak grows. */
export function playCorrect(streak: number): void {
  const c = audio();
  if (!c) return;
  const i = Math.min(Math.max(streak - 1, 0), SCALE.length - 3) % (SCALE.length - 2);
  const t = c.currentTime;
  bell(c, SCALE[i], t, 0.45, 0.14);
  bell(c, SCALE[i + 2], t + 0.075, 0.7, 0.16);
}

/** A fact just became mastered: a quick sparkling arpeggio. */
export function playMastered(): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 1318.51].forEach((f, k) => bell(c, f, t + k * 0.06, 0.8, 0.13));
}

/** New level unlocked: a short fanfare ending on a full chord. */
export function playUnlock(): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99].forEach((f, k) => bell(c, f, t + k * 0.11, 0.5, 0.15));
  [523.25, 659.25, 783.99, 1046.5].forEach((f) => bell(c, f, t + 0.4, 1.4, 0.12));
}
