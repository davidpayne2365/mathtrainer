/**
 * The right-answer chime, synthesized with Web Audio (no audio files, works offline).
 * One sound only, the same every time.
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

/** Right answer: the same bright two-note chime every time. */
export function playCorrect(): void {
  const c = audio();
  if (!c) return;
  const t = c.currentTime;
  bell(c, 783.99, t, 0.45, 0.14); // G5
  bell(c, 1046.5, t + 0.075, 0.7, 0.16); // C6
}
