import type { Progress } from '../core/engine';
import { loadPrefs, loadProgress, savePrefs, saveProgress, type Prefs } from '../core/storage';

/** Shared, persisted app state. */
export const app: { prog: Progress; prefs: Prefs; save(): void } = {
  prog: loadProgress(),
  prefs: loadPrefs(),
  save() {
    saveProgress(this.prog);
    savePrefs(this.prefs);
  },
};

/** A rendered view; `cleanup` stops timers when navigating away. */
export interface View {
  el: HTMLElement;
  cleanup?: () => void;
}

export function navigate(hash: string): void {
  if (location.hash === hash) window.dispatchEvent(new HashChangeEvent('hashchange'));
  else location.hash = hash;
}
