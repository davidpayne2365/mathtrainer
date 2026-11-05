import { UNLOCK_WINDOW, levelProgress, nextProblem, recordAnswer } from '../core/engine';
import { LEVELS, levelDef } from '../core/generators';
import { SKILLS, type Problem, type Skill } from '../core/types';
import { app, type View } from './app';
import { h, icon, toast } from './dom';
import { renderQuestion } from './question';

const SHORT: Record<Skill, string> = { add: 'Add', sub: 'Subtract', pct: 'Percent' };

/** Untimed practice for one skill and level, with hints. */
export function practiceView(): View {
  const prefs = app.prefs;
  let skill: Skill = prefs.practiceSkill;
  const levelFor = (s: Skill) => Math.min(prefs.practiceLevel[s] ?? app.prog.unlocked[s], app.prog.unlocked[s]);
  let level = levelFor(skill);
  let last: Problem | undefined;

  const skillBar = h('div', { class: 'seg', role: 'tablist' });
  const levelBar = h('div', { class: 'levels' });
  const meter = h('div', { class: 'meter' });
  const stage = h('div', { class: 'stage' });
  const el = h('div', { class: 'view practice' }, h('div', { class: 'controls' }, skillBar, levelBar, meter), stage);

  function renderControls() {
    skillBar.replaceChildren(
      ...SKILLS.map((s) =>
        h(
          'button',
          {
            type: 'button',
            role: 'tab',
            'aria-selected': String(s === skill),
            class: s === skill ? 'on' : '',
            onclick: () => {
              skill = s;
              level = levelFor(s);
              prefs.practiceSkill = s;
              app.save();
              restart();
            },
          },
          SHORT[s],
        ),
      ),
    );
    const top = app.prog.unlocked[skill];
    levelBar.replaceChildren(
      ...LEVELS[skill].map((d) => {
        const locked = d.level > top;
        return h(
          'button',
          {
            type: 'button',
            class: 'lvl' + (d.level === level ? ' on' : '') + (locked ? ' locked' : ''),
            disabled: locked,
            title: locked ? `Locked: reach 90% on level ${d.level - 1}` : d.name,
            'aria-label': `Level ${d.level}: ${d.name}${locked ? ' (locked)' : ''}`,
            onclick: () => {
              level = d.level;
              prefs.practiceLevel[skill] = level;
              app.save();
              restart();
            },
          },
          locked ? icon('lock', 14) : String(d.level),
        );
      }),
    );
    renderMeter();
  }

  function renderMeter() {
    const def = levelDef(skill, level);
    const lp = levelProgress(app.prog, skill, level);
    const isTop = level === LEVELS[skill].length;
    const need = level < app.prog.unlocked[skill] || isTop ? '' : ` · 90% over ${UNLOCK_WINDOW} unlocks level ${level + 1}`;
    meter.replaceChildren(
      h('div', { class: 'meter-name' }, h('strong', null, `L${level} · ${def.name}`), h('span', null, def.blurb)),
      h(
        'div',
        { class: 'bar', title: `${lp.recentCorrect}/${lp.recentN} correct` },
        h('span', { style: { width: `${(lp.recentCorrect / UNLOCK_WINDOW) * 100}%` } }),
        h('i', { style: { left: '90%' } }),
      ),
      h('div', { class: 'meter-sub' }, `Last ${lp.recentN}: ${lp.recentCorrect} right${need}`),
    );
  }

  function ask() {
    const problem = nextProblem(app.prog, [{ skill, level }], Math.random, last?.prompt);
    last = problem;
    const q = renderQuestion({
      problem,
      hint: true,
      record: (p, input) => {
        const res = recordAnswer(app.prog, p, input);
        app.save();
        renderMeter();
        if (res.unlocked) {
          toast(`Level ${res.unlocked} unlocked: ${levelDef(p.skill, res.unlocked).name}`);
          renderControls();
        }
        return res;
      },
      onNext: ask,
    });
    stage.replaceChildren(q.el);
    q.focus();
  }

  function restart() {
    renderControls();
    ask();
  }

  restart();
  return { el };
}

