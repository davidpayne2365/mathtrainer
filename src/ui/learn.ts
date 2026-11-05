import { LEVELS, generate } from '../core/generators';
import { addSteps, changeBySteps, pctOfSteps, percentChangeSteps, reverseSteps, subSteps, swapSteps } from '../core/methods';
import { SKILLS, SKILL_NAMES, type Skill, type Step } from '../core/types';
import { fmt, money } from '../core/util';
import { app, navigate, type View } from './app';
import { h, icon } from './dom';
import { answerLabel, stepList } from './question';

interface Example {
  prompt: string;
  steps: Step[];
}

interface Section {
  title: string;
  body: (string | HTMLElement)[];
  examples?: Example[];
}

interface Lesson {
  tagline: string;
  method: string;
  sections: Section[];
}

const ex = (prompt: string, steps: Step[]): Example => ({ prompt, steps });

const LESSONS: Record<Skill, Lesson> = {
  add: {
    tagline: 'Left to right, biggest place first.',
    method:
      'Start with the first number. Add the other number one place value at a time — hundreds, then tens, then ones — keeping a running total in your head. You say the answer as you build it, so there is nothing to carry and nothing to write down.',
    sections: [
      {
        title: 'The method',
        body: ['Split the second number by place value and add each part to a running total.'],
        examples: [ex('478 + 346', addSteps(478, 346)), ex('256 + 137', addSteps(256, 137)), ex('642 + 85', addSteps(642, 85))],
      },
      {
        title: 'Round and adjust',
        body: ['When a number is 1–3 below a round number (199, 298, 49…), add the round number instead, then take back the difference.'],
        examples: [ex('478 + 199', addSteps(478, 199)), ex('356 + 98', addSteps(356, 98))],
      },
      {
        title: 'Warm-up: make 10',
        body: ['Crossing a ten is where most slips happen. Top up to 10 first, then add what is left. Drill level 1 until these are instant.'],
        examples: [ex('8 + 7', addSteps(8, 7)), ex('6 + 9', addSteps(6, 9))],
      },
    ],
  },
  sub: {
    tagline: 'Count up through a round number — no borrowing.',
    method:
      'Subtraction is the gap between two numbers. Start at the smaller number and count up to the next round number, then on to the bigger number. Add the two jumps. Because you only ever add, there is never any borrowing.',
    sections: [
      {
        title: 'The method',
        body: ['Jump from the smaller number to the next hundred, then to the bigger number. The gap is the sum of the jumps.'],
        examples: [ex('703 − 468', subSteps(703, 468)), ex('500 − 268', subSteps(500, 268)), ex('423 − 68', subSteps(423, 68))],
      },
      {
        title: 'Round and adjust',
        body: ['When the number you take away is 1–3 below a round number, take away the round number and give the extra back.'],
        examples: [ex('625 − 298', subSteps(625, 298)), ex('512 − 49', subSteps(512, 49))],
      },
      {
        title: 'Tip: the jump to 100',
        body: ['The first jump is always a "make 100" pair: 68 + 32, 47 + 53. Tens add to 9, ones add to 10.'],
      },
    ],
  },
  pct: {
    tagline: 'Build any percent from anchors.',
    method:
      'You only need a few anchors: 10% (move the decimal one place), 1% (move it two places), 5% (half of 10%), 50% (half), 25% (half of half). Every other percent is a combination of these.',
    sections: [
      {
        title: 'The anchors',
        body: [
          h(
            'table',
            { class: 'anchors' },
            h('tr', null, h('th', null, '10%'), h('td', null, 'move the decimal one place — 10% of 240 = 24')),
            h('tr', null, h('th', null, '5%'), h('td', null, 'half of 10% — 12')),
            h('tr', null, h('th', null, '1%'), h('td', null, 'move the decimal two places — 2.4')),
            h('tr', null, h('th', null, '50%'), h('td', null, 'half — 120')),
            h('tr', null, h('th', null, '25%'), h('td', null, 'half of half — 60')),
          ),
        ],
      },
      {
        title: 'Combine anchors',
        body: ['Tens of percent are multiples of 10%. Add 5% or a few 1%s for the rest.'],
        examples: [ex('15% of 240', pctOfSteps(15, 240)), ex('35% of 80', pctOfSteps(35, 80)), ex('12% of 450', pctOfSteps(12, 450))],
      },
      {
        title: 'The swap trick',
        body: ['x% of y = y% of x. If the second number is a friendly percent, swap them.'],
        examples: [ex('8% of 50', swapSteps(8, 50)), ex('16% of 25', swapSteps(16, 25))],
      },
      {
        title: 'Increase and decrease',
        body: ['Find the amount first, then add it on or take it off.'],
        examples: [
          ex('Increase 240 by 15%', changeBySteps(240, 15, true)),
          ex('Decrease 360 by 20%', changeBySteps(360, 20, false)),
          ex('Increase 450 by 12%', changeBySteps(450, 12, true)),
        ],
      },
      {
        title: 'Real world',
        body: ['Sale price, tax, tips and markups are all increase/decrease problems.'],
        examples: [
          ex(`A ${money(80)} jacket is 25% off`, changeBySteps(80, 25, false, money)),
          ex(`18% tip on ${money(50)}`, pctOfSteps(18, 50, money)),
        ],
      },
      {
        title: 'Stretch: change and reverse',
        body: ['Percent change: measure the change in 10% blocks of the start. Reverse: work out what 1 “part” is worth, then scale to 100%.'],
        examples: [
          ex(`${fmt(60)} → ${fmt(75)}: % increase?`, percentChangeSteps(60, 75)),
          ex(`${money(80)} after 20% off — original?`, reverseSteps(80, 20, true, money)),
        ],
      },
    ],
  },
};

function exampleCard(e: Example): HTMLElement {
  return h('div', { class: 'example' }, h('div', { class: 'ex-prompt' }, e.prompt), stepList(e.steps));
}

/** "Try one": generate a problem and reveal the walkthrough one tap at a time. */
function tryOne(skill: Skill): HTMLElement {
  const top = app.prog.unlocked[skill];
  let level = top;
  const box = h('div', { class: 'card tryone' });

  function render() {
    const p = generate(skill, level);
    let shown = 0;
    const list = h('div');
    const btn = h('button', { class: 'btn primary big', type: 'button' }, 'Reveal first step');
    const again = h('button', { class: 'btn ghost', type: 'button', onclick: render }, 'New problem');
    btn.addEventListener('click', () => {
      shown++;
      list.replaceChildren(stepList(p.steps, shown));
      if (shown >= p.steps.length) {
        btn.replaceWith(h('div', { class: 'reveal-done' }, icon('check', 18), ` Answer: ${answerLabel(p)}`));
      } else btn.textContent = `Reveal step ${shown + 1} of ${p.steps.length}`;
    });
    box.replaceChildren(
      h('h2', null, 'Try one'),
      h(
        'div',
        { class: 'levels small' },
        ...LEVELS[skill].map((d) =>
          h(
            'button',
            {
              type: 'button',
              class: 'lvl' + (d.level === level ? ' on' : ''),
              'aria-label': `Level ${d.level}: ${d.name}`,
              onclick: () => ((level = d.level), render()),
            },
            String(d.level),
          ),
        ),
      ),
      h('p', { class: 'muted' }, 'Work it out in your head, then tap to check each step.'),
      h('div', { class: 'prompt' + (p.prompt.length > 24 ? ' wordy' : '') }, p.prompt),
      list,
      h('div', { class: 'row' }, btn, again),
    );
  }
  render();
  return box;
}

export function learnIndexView(): View {
  return {
    el: h(
      'div',
      { class: 'view learn' },
      h('h1', null, 'Learn'),
      h('p', { class: 'muted' }, 'One fast method per skill. Read it once, then let the drills burn it in — every answer shows the method again.'),
      ...SKILLS.map((s) =>
        h(
          'a',
          { class: 'card skill-card', href: `#/learn/${s}` },
          h('h2', null, SKILL_NAMES[s]),
          h('p', null, LESSONS[s].tagline),
        ),
      ),
    ),
  };
}

export function lessonView(skill: Skill): View {
  const L = LESSONS[skill];
  return {
    el: h(
      'div',
      { class: 'view lesson' },
      h('a', { class: 'back', href: '#/learn' }, icon('back', 18), 'Learn'),
      h('h1', null, SKILL_NAMES[skill]),
      h('p', { class: 'lead' }, L.method),
      ...L.sections.map((s) =>
        h('section', { class: 'card' }, h('h2', null, s.title), ...s.body.map((b) => (typeof b === 'string' ? h('p', null, b) : b)), ...(s.examples ?? []).map(exampleCard)),
      ),
      tryOne(skill),
      h(
        'button',
        {
          class: 'btn primary big',
          type: 'button',
          onclick: () => {
            app.prefs.practiceSkill = skill;
            app.save();
            navigate('#/practice');
          },
        },
        `Practice ${SKILL_NAMES[skill].toLowerCase()}`,
      ),
    ),
  };
}
