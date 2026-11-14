import './style.css';
import { app, type View } from './ui/app';
import { h, icon } from './ui/dom';
import { practiceView } from './ui/practice';
import { progressView } from './ui/progress';
import { applyTheme } from './ui/theme';

const TABS = [
  { hash: '#/practice', label: 'Practice', icon: 'practice' },
  { hash: '#/progress', label: 'Progress', icon: 'progress' },
];

const main = h('main', { id: 'view' });
const nav = h(
  'nav',
  { class: 'tabs', 'aria-label': 'Sections' },
  ...TABS.map((t) => h('a', { href: t.hash, 'data-tab': t.hash }, icon(t.icon), h('span', null, t.label))),
);
document.getElementById('app')!.append(main, nav);

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
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('on', hash.startsWith(a.dataset.tab!));
  if (!hash.startsWith('#/practice')) window.scrollTo(0, 0);
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
