import { defaultProgress, normalize, type Progress } from './engine';
import type { Skill } from './types';

const KEY = 'mathtrainer.progress.v1';
const PREFS_KEY = 'mathtrainer.prefs.v1';

export function loadProgress(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? normalize(JSON.parse(raw)) : defaultProgress();
  } catch {
    return defaultProgress();
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    // Storage full or blocked (private mode): keep going in memory.
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export type Theme = 'system' | 'light' | 'dark';

export interface Prefs {
  theme: Theme;
  practiceSkill: Skill;
  practiceLevel: Record<string, number>;
  sound: boolean;
}

const defaultPrefs = (): Prefs => ({ theme: 'system', practiceSkill: 'add', practiceLevel: {}, sound: true });

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? { ...defaultPrefs(), ...JSON.parse(raw) } : defaultPrefs();
  } catch {
    return defaultPrefs();
  }
}

export function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
