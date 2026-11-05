import { drillPool, nextProblem, recordAnswer, type Outcome } from '../core/engine';
import { levelDef } from '../core/generators';
import { SKILLS, SKILL_NAMES, type Problem, type Skill } from '../core/types';
import { app, type View } from './app';
import { h, pct, secs, toast } from './dom';
import { answerLabel, renderQuestion, stepList } from './question';

type Mode = 'timed' | 'set';
const ROUND_MS = 60_000;
const SET_SIZE = 10;

interface Result {
  problem: Problem;
  correct: boolean;
  outcome: Outcome;
  ms: number;
}

/** Timed 60-second rounds or fixed 10-question sets mixing unlocked skills. */
export function drillView(): View {
  const el = h('div', { class: 'view drill' });
  let mode: Mode = 'timed';
  const chosen = new Set<Skill>(SKILLS);
  let timer: number | undefined;

  const stop = () => {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
  };

  function setup() {
    stop();
    const modeBtns = h(
      'div',
      { class: 'seg' },
      ...(['timed', 'set'] as Mode[]).map((m) =>
        h(
          'button',
          { type: 'button', class: m === mode ? 'on' : '', onclick: () => ((mode = m), setup()) },
          m === 'timed' ? '60-second round' : `${SET_SIZE} questions`,
        ),
      ),
    );
    const skillBtns = h(
      'div',
      { class: 'chips' },
      ...SKILLS.map((s) =>
        h(
          'button',
          {
            type: 'button',
            class: 'chip' + (chosen.has(s) ? ' on' : ''),
            'aria-pressed': String(chosen.has(s)),
            onclick: () => {
              if (chosen.has(s) && chosen.size > 1) chosen.delete(s);
              else chosen.add(s);
              setup();
            },
          },
          `${SKILL_NAMES[s]} · L${app.prog.unlocked[s]}`,
        ),
      ),
    );
    el.replaceChildren(
      h(
        'div',
        { class: 'card center' },
        h('h1', null, 'Drill'),
        h('p', { class: 'muted' }, 'Mixed problems from every level you have unlocked. The clock pauses while you read the fast way.'),
        modeBtns,
        h('div', { class: 'label' }, 'Skills'),
        skillBtns,
        h('button', { class: 'btn primary big', type: 'button', onclick: run }, 'Start'),
      ),
    );
  }

  function run() {
    const results: Result[] = [];
    const pool = drillPool(app.prog, [...chosen]);
    let remaining = ROUND_MS;
    let lastTick = performance.now();
    let paused = false;
    let last: Problem | undefined;

    const clock = h('div', { class: 'clock' });
    const bar = h('div', { class: 'timebar' }, h('span'));
    const stage = h('div', { class: 'stage' });
    el.replaceChildren(h('div', { class: 'drillhead' }, clock, mode === 'timed' ? bar : null), stage);

    const paint = () => {
      if (mode === 'timed') {
        clock.textContent = `${Math.ceil(remaining / 1000)}s${paused ? ' · paused' : ''}`;
        (bar.firstChild as HTMLElement).style.width = `${(remaining / ROUND_MS) * 100}%`;
      } else {
        clock.textContent = `${Math.min(results.length + (paused ? 0 : 1), SET_SIZE)} / ${SET_SIZE}`;
      }
    };

    if (mode === 'timed') {
      timer = window.setInterval(() => {
        const now = performance.now();
        if (!paused) remaining -= now - lastTick;
        lastTick = now;
        if (remaining <= 0) {
          remaining = 0;
          finish();
          return;
        }
        paint();
      }, 100);
    }

    function ask() {
      if (mode === 'set' && results.length >= SET_SIZE) return finish();
      if (mode === 'timed' && remaining <= 0) return finish();
      paused = false;
      lastTick = performance.now();
      const problem = nextProblem(app.prog, pool, Math.random, last?.prompt);
      last = problem;
      const q = renderQuestion({
        problem,
        hint: false,
        record: (p, input) => {
          const res = recordAnswer(app.prog, p, input);
          app.save();
          if (res.unlocked) toast(`${SKILL_NAMES[p.skill]} level ${res.unlocked} unlocked!`);
          return res;
        },
        onReview: (res) => {
          paused = true;
          results.push({ problem, correct: res.correct, outcome: res.outcome, ms: res.ms });
          paint();
        },
        onNext: ask,
        nextLabel: mode === 'set' && results.length >= SET_SIZE - 1 ? 'See results' : 'Next',
      });
      stage.replaceChildren(q.el);
      paint();
      q.focus();
    }

    function finish() {
      stop();
      summary(results);
    }

    ask();
  }

  function summary(results: Result[]) {
    const n = results.length;
    const right = results.filter((r) => r.correct).length;
    const slow = results.filter((r) => r.outcome === 'slow').length;
    const avg = n ? results.reduce((a, r) => a + r.ms, 0) / n / 1000 : null;
    const misses = results.filter((r) => r.outcome !== 'ok');
    el.replaceChildren(
      h(
        'div',
        { class: 'card center' },
        h('h1', null, mode === 'timed' ? 'Time!' : 'Set complete'),
        h(
          'div',
          { class: 'stats' },
          h('div', null, h('b', null, pct(n ? right / n : null)), h('span', null, 'accuracy')),
          h('div', null, h('b', null, secs(avg)), h('span', null, 'avg / question')),
          h('div', null, h('b', null, `${right}/${n}`), h('span', null, 'correct')),
          h('div', null, h('b', null, String(slow)), h('span', null, 'correct but slow')),
        ),
        h('div', { class: 'row' }, h('button', { class: 'btn primary big', type: 'button', onclick: run }, 'Go again'), h('button', { class: 'btn ghost', type: 'button', onclick: setup }, 'Change settings')),
      ),
      ...(misses.length
        ? [h(
            'div',
            { class: 'card' },
            h('h2', null, 'Review'),
            ...misses.map((r) =>
              h(
                'details',
                { class: 'miss ' + r.outcome },
                h(
                  'summary',
                  null,
                  h('span', { class: 'tag' }, r.outcome === 'wrong' ? 'Wrong' : 'Slow'),
                  ` ${r.problem.prompt} = ${answerLabel(r.problem)}`,
                  h('span', { class: 'muted' }, ` · ${(r.ms / 1000).toFixed(1)}s (aim ${levelDef(r.problem.skill, r.problem.level).targetSec}s)`),
                ),
                stepList(r.problem.steps),
              ),
            ),
          )]
        : []),
    );
  }

  setup();
  return { el, cleanup: stop };
}
