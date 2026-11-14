import { LEVELS, generate } from '../core/generators';
import { addSteps, changeBySteps, factSteps, mulFactSteps, subFactSteps, pctOfSteps, percentChangeSteps, reverseSteps, subSteps, swapSteps } from '../core/methods';
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
        title: 'Foundation: memorize facts 1–10',
        body: [
          'Every step above leans on single-digit facts like 8 + 7 = 15. These should be pure memory — instant, no working out. Level 1 drills all 55 facts from 1 + 1 to 10 + 10, brings back the ones you miss or hesitate on, and marks each one mastered after 3 fast, correct answers in a row.',
          'While a fact is still shaky, use make 10 as a memory aid: top up to 10, then add what is left. Once you know it, just say the answer.',
        ],
        examples: [ex('8 + 7', factSteps(8, 7)), ex('6 + 9', factSteps(6, 9))],
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
      {
        title: 'Foundation: memorize facts 1–10',
        body: [
          'Every jump above leans on facts like 15 − 7 = 8. Level 1 drills all 100 of them (2 − 1 up to 20 − 10) until each is instant: 3 fast, correct answers in a row marks a fact mastered, and shaky ones come back more often.',
          'While a fact is still shaky, count up through 10 — the same move as the big method: 7 → 10 is 3, 10 → 15 is 5, so 8.',
        ],
        examples: [ex('15 − 7', subFactSteps(15, 7)), ex('9 − 4', subFactSteps(9, 4))],
      },
    ],
  },
  mul: {
    tagline: 'Know the times tables 1–10 cold.',
    method:
      'Times tables are pure memory — the goal is to see 7 × 8 and just know 56. Level 1 drills all 55 facts (7 × 8 and 8 × 7 count as one). Answer each one 3 times in a row, fast and right, and it is mastered; the ones you miss or hesitate on keep coming back until they stick.',
    sections: [
      {
        title: 'Memory aids while you learn',
        body: [
          'When a fact is not there yet, rebuild it from an easy anchor instead of guessing. Then say the fact to yourself so it sticks.',
          h(
            'table',
            { class: 'anchors' },
            h('tr', null, h('th', null, '× 10'), h('td', null, 'put a zero on the end')),
            h('tr', null, h('th', null, '× 2'), h('td', null, 'double')),
            h('tr', null, h('th', null, '× 5'), h('td', null, 'half of × 10')),
            h('tr', null, h('th', null, '× 9'), h('td', null, '× 10, minus one more')),
            h('tr', null, h('th', null, '× 4'), h('td', null, 'double, double again')),
            h('tr', null, h('th', null, '× 3'), h('td', null, 'double, plus one more')),
            h('tr', null, h('th', null, '× 6'), h('td', null, '× 5, plus one more')),
            h('tr', null, h('th', null, '× 8'), h('td', null, 'double three times')),
            h('tr', null, h('th', null, '× 7'), h('td', null, '× 5 plus × 2')),
          ),
        ],
        examples: [ex('7 × 8', mulFactSteps(7, 8)), ex('6 × 9', mulFactSteps(6, 9)), ex('4 × 7', mulFactSteps(4, 7))],
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
