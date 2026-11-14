import './style.css';
import { app, type View } from './ui/app';
import { h, icon } from './ui/dom';
import { practiceView } from './ui/practice';
import { progressView } from './ui/progress';
import { playCorrect, unlockAudio } from './ui/sound';
import { applyTheme } from './ui/theme';

const TABS = [
  { hash: '#/practice', label: 'Practice', icon: 'practice' },
  { hash: '#/progress', label: 'Progress', icon: 'progress' },
];

const main = h('main', { id: 'view' });

// Sound on/off, remembered. Turning it on plays a chime so you know it works.
const soundBtn = h('button', {
  class: 'sound-toggle',
  type: 'button',
  onmousedown: (e: Event) => e.preventDefault(),
  onclick: () => {
    app.prefs.sound = !app.prefs.sound;
    app.save();
    paintSound();
    if (app.prefs.sound) playCorrect();
  },
});
function paintSound() {
  soundBtn.textContent = app.prefs.sound ? '🔊' : '🔇';
  soundBtn.setAttribute('aria-label', app.prefs.sound ? 'Sound on (tap to mute)' : 'Sound off (tap to turn on)');
  soundBtn.setAttribute('aria-pressed', String(app.prefs.sound));
}
paintSound();

// Tabs live at the top so they stay reachable while the phone keyboard is up.
const nav = h(
  'nav',
  { class: 'tabs', 'aria-label': 'Sections' },
  ...TABS.map((t) =>
    h(
      'a',
      {
        href: t.hash,
        'data-tab': t.hash,
        onclick: (e: Event) => {
          // Route inside the tap itself so Practice can reopen the keyboard straight away.
          e.preventDefault();
          if (location.hash !== t.hash) history.pushState(null, '', t.hash);
          route();
        },
      },
      icon(t.icon, 18),
      h('span', null, t.label),
    ),
  ),
  soundBtn,
);
document.getElementById('app')!.append(nav, main);
// Browsers only allow sound after a user gesture: wake the audio on the first touch or key.
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, unlockAudio, { once: true, capture: true });

let current: View | undefined;

function route() {
  const hash = location.hash || '#/practice';
  const [, section] = hash.split('/');
  current?.cleanup?.();
  switch (section) {
    case 'progress':
      current = progressView();
      break;
    default:
      current = practiceView();
  }
  main.replaceChildren(current.el);
  current.focus?.();
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('on', hash.startsWith(a.dataset.tab!));
  main.scrollTop = 0;
}

applyTheme(app.prefs.theme);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(app.prefs.theme));
window.addEventListener('hashchange', route);
route();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is best-effort */
    });
  });
}
