import type { Rng } from './types';

/** Deterministic PRNG (mulberry32) so tests can be reproducible. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random integer in [lo, hi] inclusive. */
export function int(rng: Rng, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

export function pick<T>(rng: Rng, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Random multiple of `step` in [lo, hi]. */
export function multiple(rng: Rng, step: number, lo: number, hi: number): number {
  return step * int(rng, Math.ceil(lo / step), Math.floor(hi / step));
}

/** Kill floating point noise (e.g. 0.1 + 0.2). */
export function clean(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

export function isWhole(n: number): boolean {
  return Math.abs(n - Math.round(n)) < 1e-9;
}

/** True for whole numbers and clean halves (x.5). */
export function isHalfClean(n: number): boolean {
  return isWhole(n * 2);
}

/** Format a number for display: no float noise, thousands separators, minus sign. */
export function fmt(n: number): string {
  const c = clean(n);
  const s = Math.abs(c).toLocaleString('en-US', { maximumFractionDigits: 2 });
  return (c < 0 ? '−' : '') + s;
}

/** Money: $27.50, $30 */
export function money(n: number): string {
  const c = clean(n);
  return '$' + (isWhole(c) ? fmt(c) : c.toFixed(2));
}

/** Answer as the user would type it (no separators). */
export function answerString(n: number): string {
  return String(clean(n));
}

let counter = 0;
export function uid(): string {
  counter = (counter + 1) % 1e9;
  return Date.now().toString(36) + '-' + counter.toString(36);
}
