import { UNLOCK_WINDOW, defaultProgress, levelProgress, skillTotals, streak, trend, weakest, type TrendPoint } from '../core/engine';
import { LEVELS, levelDef } from '../core/generators';
import { clearProgress, type Theme } from '../core/storage';
import { SKILLS, SKILL_NAMES, type Skill } from '../core/types';
import { app, navigate, type View } from './app';
import { h, pct, secs, svg } from './dom';
import { applyTheme } from './theme';

/** Small line chart for a 14-day trend; gaps where there was no practice. */
function sparkline(points: (number | null)[], max: number, label: string, invert = false): HTMLElement {
  const W = 140;
  const H = 36;
  const step = W / Math.max(1, points.length - 1);
  const y = (v: number) => {
    const t = Math.min(1, v / max);
    return 3 + (invert ? t : 1 - t) * (H - 6);
  };
  let d = '';
  let pen = false;
  const dots: SVGElement[] = [];
  points.forEach((v, i) => {
    if (v === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`;
    pen = true;
    dots.push(svg('circle', { cx: (i * step).toFixed(1), cy: y(v).toFixed(1), r: 2.2 }));
  });
  const has = points.some((v) => v !== null);
  return h(
    'figure',
    { class: 'spark' },
    has
      ? svg('svg', { viewBox: `-3 0 ${W + 6} ${H}`, width: '100%', height: H, role: 'img', 'aria-label': label }, svg('path', { d }), ...dots)
      : h('div', { class: 'spark-empty' }, 'No data yet'),
    h('figcaption', null, label),
  );
}

function skillCard(skill: Skill): HTMLElement {
  const prog = app.prog;
  const top = prog.unlocked[skill];
  const def = levelDef(skill, top);
  const lp = levelProgress(prog, skill, top);
  const tot = skillTotals(prog, skill);
  const t: TrendPoint[] = trend(prog, skill, 14);
  const maxSec = Math.max(def.targetSec * 2, ...t.map((p) => p.avgSec ?? 0));
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('h2', null, SKILL_NAMES[skill]), h('span', { class: 'pill' }, `Level ${top}/${LEVELS[skill].length}`)),
    h('p', { class: 'muted' }, def.name),
    h(
      'div',
      { class: 'stats' },
      h('div', null, h('b', null, pct(tot.accuracy)), h('span', null, 'accuracy')),
      h('div', null, h('b', null, secs(tot.avgSec)), h('span', null, 'avg time')),
      h('div', null, h('b', null, String(tot.n)), h('span', null, 'answered')),
    ),
    h(
      'div',
      { class: 'bar', title: 'Current level, last 20' },
      h('span', { style: { width: `${(lp.recentCorrect / UNLOCK_WINDOW) * 100}%` } }),
      h('i', { style: { left: '90%' } }),
    ),
    h('div', { class: 'meter-sub' }, `Current level: ${lp.recentCorrect}/${lp.recentN} of the last ${UNLOCK_WINDOW} right`),
    h(
      'div',
      { class: 'sparks' },
      sparkline(t.map((p) => p.accuracy), 1, 'Accuracy, 14 days'),
      sparkline(t.map((p) => p.avgSec), maxSec, 'Seconds / question (lower is better)', true),
    ),
  );
}

export function progressView(): View {
  const prog = app.prog;
  const days = streak(prog);
  const weak = weakest(prog, 6);

  const themeSel = h(
    'select',
    {
      'aria-label': 'Theme',
      onchange: (e: Event) => {
        app.prefs.theme = (e.target as HTMLSelectElement).value as Theme;
        app.save();
        applyTheme(app.prefs.theme);
      },
    },
    ...(['system', 'light', 'dark'] as Theme[]).map((t) => h('option', { value: t, selected: app.prefs.theme === t }, t[0].toUpperCase() + t.slice(1))),
  );

  return {
    el: h(
      'div',
      { class: 'view progress' },
      h('h1', null, 'Progress'),
      h(
        'div',
        { class: 'card stats big-stats' },
        h('div', null, h('b', null, String(days)), h('span', null, days === 1 ? 'day streak' : 'day streak')),
        h('div', null, h('b', null, String(prog.run)), h('span', null, 'correct in a row')),
        h('div', null, h('b', null, String(prog.bestRun)), h('span', null, 'best run')),
      ),
      ...SKILLS.map(skillCard),
      h(
        'section',
        { class: 'card' },
        h('h2', null, 'Weakest problem types'),
        weak.length
          ? h(
              'ul',
              { class: 'weak' },
              ...weak.map((w) =>
                h(
                  'li',
                  null,
                  h(
                    'div',
                    null,
                    h('strong', null, w.label),
                    h('div', { class: 'muted' }, `${SKILL_NAMES[w.skill]} · ${Math.round(w.wrongRate * 100)}% wrong · ${Math.round(w.slowRate * 100)}% slow · ${w.avgSec.toFixed(1)}s avg`),
                  ),
                  practiceButton(w.skill, w.type),
                ),
              ),
            )
          : h('p', { class: 'muted' }, 'Nothing flagged yet. Answer a few more questions and your slow or missed problem types show up here.'),
      ),
      h(
        'section',
        { class: 'card settings' },
        h('h2', null, 'Settings'),
        h('label', { class: 'setting' }, h('span', null, 'Theme'), themeSel),
        h(
          'button',
          {
            class: 'btn danger',
            type: 'button',
            onclick: () => {
              if (!confirm('Reset all progress? This cannot be undone.')) return;
              clearProgress();
              app.prog = defaultProgress();
              app.save();
              navigate('#/progress');
            },
          },
          'Reset progress',
        ),
      ),
    ),
  };
}

function practiceButton(skill: Skill, type: string): HTMLElement | null {
  const level = LEVELS[skill].find((d) => d.types.includes(type) && d.level <= app.prog.unlocked[skill]);
  if (!level) return null;
  return h(
    'button',
    {
      class: 'btn ghost small',
      type: 'button',
      onclick: () => {
        app.prefs.practiceSkill = skill;
        app.prefs.practiceLevel[skill] = level.level;
        app.save();
        navigate('#/practice');
      },
    },
    'Practice',
  );
}
