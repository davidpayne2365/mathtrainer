import { UNLOCK_WINDOW, factSetFor, factSummary, levelProgress, nextProblem, recordAnswer } from '../core/engine';
import { LEVELS, levelDef } from '../core/generators';
import { SKILLS, type Problem, type Skill } from '../core/types';
import { app, type View } from './app';
import { h, icon, toast } from './dom';
import { renderQuestion, type Flash } from './question';

const SHORT: Record<Skill, string> = { add: 'Add', sub: 'Subtract', mul: 'Times', pct: 'Percent' };

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
            title: locked ? (factSetFor(skill, d.level - 1) ? `Locked: master every fact in level ${d.level - 1}` : `Locked: reach 90% on level ${d.level - 1}`) : d.name,
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
    const factLevel = factSetFor(skill, level);
    const locked = !(level < app.prog.unlocked[skill] || isTop);
    const f = factLevel ? factSummary(app.prog, factLevel) : null;
    // One short status line keeps the header small so the answer box sits high on screen.
    const sub = f
      ? [h('strong', null, def.name), ` · ${f.mastered}/${f.total} mastered${locked ? ` (all unlock L${level + 1})` : ''} · `, h('a', { href: '#/progress' }, 'grid')]
      : [h('strong', null, def.name), ` · last ${lp.recentN}: ${lp.recentCorrect} right${locked ? ` · 90% unlocks L${level + 1}` : ''}`];
    const pctDone = f ? f.mastered / f.total : lp.recentCorrect / UNLOCK_WINDOW;
    meter.replaceChildren(
      h(
        'div',
        { class: 'bar', title: `${lp.recentCorrect}/${lp.recentN} correct` },
        h('span', { style: { width: `${pctDone * 100}%` } }),
        f ? null : h('i', { style: { left: '90%' } }),
      ),
      h('div', { class: 'meter-sub' }, ...sub),
    );
  }


  function ask(info?: { flash?: Flash }) {
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
      flash: info?.flash,
    });
    stage.replaceChildren(q.el);
    // New question starts at the top of the screen; never scroll the page itself.
    const view = document.getElementById('view');
    if (view) view.scrollTop = 0;
    q.focus();
  }

  function restart() {
    renderControls();
    ask();
  }

  restart();
  return { el };
}

