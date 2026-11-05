/**
 * Problem generators, organised as skills → levels → problem types.
 * Every problem carries its fast-way `steps`; the final step's value is the answer.
 */
import type { Problem, Rng, Skill, Step } from './types';
import {
  addSteps,
  changeBySteps,
  nearRoundUp,
  pctOfSteps,
  percentChangeSteps,
  reverseSteps,
  subSteps,
  swapSteps,
} from './methods';
import { clean, fmt, int, isHalfClean, isWhole, money, multiple, pick, uid } from './util';

interface Draft {
  prompt: string;
  answer: number;
  steps: Step[];
  prefix?: string;
  suffix?: string;
}

export interface TypeDef {
  id: string;
  skill: Skill;
  label: string;
  /** Returns null to reject a candidate; the caller retries. */
  gen: (rng: Rng) => Draft | null;
}

export interface LevelDef {
  skill: Skill;
  level: number;
  name: string;
  blurb: string;
  /** Answers slower than this (seconds) are flagged "correct but slow". */
  targetSec: number;
  /** Type ids; repeat an id to weight it more. */
  types: string[];
}

const lastStep = (steps: Step[]) => steps[steps.length - 1]?.value;
const stepsHalfClean = (steps: Step[]) => steps.every((s) => s.value === undefined || isHalfClean(s.value));
const chance = (rng: Rng, p: number) => rng() < p;

// ------------------------------------------------------------------ addition

function addDraft(a: number, b: number): Draft {
  return { prompt: `${a} + ${b}`, answer: a + b, steps: addSteps(a, b) };
}

/** Prefer problems where adding a place value crosses into the next one. */
function addCarries(a: number, b: number): boolean {
  return a % 10 + (b % 10) >= 10 || (a % 100) - (a % 10) + (b % 100) - (b % 10) >= 100;
}

const addTypes: TypeDef[] = [
  {
    id: 'add.make10',
    skill: 'add',
    label: 'Make-10 pairs',
    gen: (rng) => {
      const a = int(rng, 2, 9);
      const b = int(rng, 2, 9);
      return a + b > 10 ? addDraft(a, b) : null;
    },
  },
  {
    id: 'add.32',
    skill: 'add',
    label: '3-digit + 2-digit',
    gen: (rng) => {
      const a = int(rng, 101, 899);
      const b = int(rng, 11, 99);
      if (b % 10 === 0 || nearRoundUp(a) || nearRoundUp(b)) return null;
      if (!addCarries(a, b) && chance(rng, 0.75)) return null;
      return addDraft(a, b);
    },
  },
  {
    id: 'add.33',
    skill: 'add',
    label: '3-digit + 3-digit',
    gen: (rng) => {
      const a = int(rng, 101, 899);
      const b = int(rng, 101, 899);
      if (b % 100 === 0 || b % 10 === 0 || nearRoundUp(a) || nearRoundUp(b)) return null;
      if (!addCarries(a, b) && chance(rng, 0.75)) return null;
      return addDraft(a, b);
    },
  },
  {
    id: 'add.round3',
    skill: 'add',
    label: 'Round & adjust (+ x99, x98, x97)',
    gen: (rng) => {
      const near = int(rng, 2, 8) * 100 - int(rng, 1, 3);
      const other = int(rng, 101, 899);
      if (nearRoundUp(other) || other % 10 === 0) return null;
      return chance(rng, 0.7) ? addDraft(other, near) : addDraft(near, other);
    },
  },
  {
    id: 'add.round2',
    skill: 'add',
    label: 'Round & adjust (+ 2-digit like 39, 58)',
    gen: (rng) => {
      const b = int(rng, 2, 9) * 10 - int(rng, 1, 3);
      const a = int(rng, 101, 899);
      if (nearRoundUp(a)) return null;
      return addDraft(a, b);
    },
  },
];

// --------------------------------------------------------------- subtraction

function subDraft(a: number, b: number): Draft {
  return { prompt: `${a} − ${b}`, answer: a - b, steps: subSteps(a, b) };
}

/** Column subtraction would need borrowing. */
function needsBorrow(a: number, b: number): boolean {
  return a % 10 < b % 10 || a % 100 < b % 100;
}

const subTypes: TypeDef[] = [
  {
    id: 'sub.fromRound',
    skill: 'sub',
    label: 'Round number − 3-digit',
    gen: (rng) => {
      const a = int(rng, 3, 10) * 100;
      const b = int(rng, 101, a - 11);
      if (b % 10 === 0 || nearRoundUp(b)) return null;
      return subDraft(a, b);
    },
  },
  {
    id: 'sub.32',
    skill: 'sub',
    label: '3-digit − 2-digit',
    gen: (rng) => {
      const a = int(rng, 101, 999);
      const b = int(rng, 12, 99);
      if (b % 10 === 0 || nearRoundUp(b) || a % 10 >= b % 10) return null;
      return subDraft(a, b);
    },
  },
  {
    id: 'sub.33',
    skill: 'sub',
    label: '3-digit − 3-digit',
    gen: (rng) => {
      const a = int(rng, 201, 999);
      const b = int(rng, 101, a - 20);
      if (b % 10 === 0 || nearRoundUp(b) || a % 100 === 0) return null;
      if (!needsBorrow(a, b) && chance(rng, 0.85)) return null;
      return subDraft(a, b);
    },
  },
  {
    id: 'sub.round3',
    skill: 'sub',
    label: 'Round & adjust (− x99, x98, x97)',
    gen: (rng) => {
      const r = int(rng, 1, 8) * 100;
      const b = r - int(rng, 1, 3);
      const a = int(rng, r + 11, 999);
      if (a % 100 === 0) return null;
      return subDraft(a, b);
    },
  },
  {
    id: 'sub.round2',
    skill: 'sub',
    label: 'Round & adjust (− 2-digit like 48, 79)',
    gen: (rng) => {
      const b = int(rng, 2, 9) * 10 - int(rng, 1, 3);
      const a = int(rng, 101, 999);
      if (a % 10 >= b % 10) return null; // keep the "borrow" cases
      return subDraft(a, b);
    },
  },
];

// --------------------------------------------------------------- percentages

const ANCHORS = [10, 50, 25, 20, 5, 1];
const MULT5 = [15, 30, 35, 40, 45, 55, 60, 65, 70, 75, 80, 85, 90, 95];
const CHANGE_PCTS = [5, 10, 15, 20, 25, 30, 40, 50, 2, 3, 4, 6, 8, 12, 35, 60, 75];

function pctDraft(p: number, b: number, needWhole: boolean): Draft | null {
  const steps = pctOfSteps(p, b);
  const answer = clean((b * p) / 100);
  if (needWhole ? !isWhole(answer) : !isHalfClean(answer)) return null;
  if (!stepsHalfClean(steps)) return null;
  return { prompt: `${p}% of ${fmt(b)}`, answer, steps };
}

/** Wrap a money word problem, rejecting messy amounts. */
function moneyDraft(prompt: string, answer: number, steps: Step[]): Draft | null {
  if (!isHalfClean(answer) || !stepsHalfClean(steps)) return null;
  return { prompt, answer: clean(answer), steps, prefix: '$' };
}

const pctTypes: TypeDef[] = [
  {
    id: 'pct.anchor',
    skill: 'pct',
    label: 'Anchors (10, 50, 25, 20, 5, 1%)',
    gen: (rng) => {
      const p = pick(rng, ANCHORS);
      const b =
        p === 1 ? multiple(rng, 100, 100, 9900) : p === 25 || p === 5 ? multiple(rng, 20, 40, 980) : multiple(rng, 10, 20, 990);
      return pctDraft(p, b, true);
    },
  },
  {
    id: 'pct.mult5',
    skill: 'pct',
    label: 'Multiples of 5% (15, 35, 45%...)',
    gen: (rng) => pctDraft(pick(rng, MULT5), multiple(rng, 20, 40, 980), true),
  },
  {
    id: 'pct.any',
    skill: 'pct',
    label: 'Any whole % (7, 12, 17%...)',
    gen: (rng) => {
      let p = int(rng, 2, 99);
      if (p % 5 === 0) p += pick(rng, [1, 2, -1, -2]);
      const b = chance(rng, 0.6) ? multiple(rng, 100, 100, 900) : multiple(rng, 50, 50, 950);
      return pctDraft(p, b, false);
    },
  },
  {
    id: 'pct.swap',
    skill: 'pct',
    label: 'Swap trick (8% of 50 = 50% of 8)',
    gen: (rng) => {
      const b = pick(rng, [50, 25]);
      const p = b === 50 ? 2 * int(rng, 1, 24) : 4 * int(rng, 1, 24);
      if (p % 10 === 0 || p === b) return null;
      const steps = swapSteps(p, b);
      const answer = (p * b) / 100;
      if (!isWhole(answer)) return null;
      return { prompt: `${p}% of ${b}`, answer, steps };
    },
  },
  {
    id: 'pct.inc',
    skill: 'pct',
    label: 'Increase by %',
    gen: (rng) => {
      const p = pick(rng, CHANGE_PCTS);
      const b = pick(rng, [multiple(rng, 20, 40, 980), multiple(rng, 50, 50, 1500), multiple(rng, 100, 100, 2000)]);
      const steps = changeBySteps(b, p, true);
      const answer = clean(b + (b * p) / 100);
      if (!isWhole(answer) || !stepsHalfClean(steps)) return null;
      return { prompt: `Increase ${fmt(b)} by ${p}%`, answer, steps };
    },
  },
  {
    id: 'pct.dec',
    skill: 'pct',
    label: 'Decrease by %',
    gen: (rng) => {
      const p = pick(rng, CHANGE_PCTS);
      const b = pick(rng, [multiple(rng, 20, 40, 980), multiple(rng, 50, 50, 1500), multiple(rng, 100, 100, 2000)]);
      const steps = changeBySteps(b, p, false);
      const answer = clean(b - (b * p) / 100);
      if (!isWhole(answer) || !stepsHalfClean(steps)) return null;
      return { prompt: `Decrease ${fmt(b)} by ${p}%`, answer, steps };
    },
  },
  {
    id: 'pct.sale',
    skill: 'pct',
    label: 'Sale price after discount',
    gen: (rng) => {
      const price = multiple(rng, 10, 20, 400);
      const p = pick(rng, [10, 15, 20, 25, 30, 35, 40, 50]);
      const item = pick(rng, ['jacket', 'pair of shoes', 'lamp', 'backpack', 'game', 'blender']);
      const steps = changeBySteps(price, p, false, money);
      return moneyDraft(`A ${money(price)} ${item} is ${p}% off. What's the sale price?`, price - (price * p) / 100, steps);
    },
  },
  {
    id: 'pct.discount',
    skill: 'pct',
    label: 'Discount amount',
    gen: (rng) => {
      const price = multiple(rng, 10, 20, 600);
      const p = pick(rng, [10, 15, 20, 25, 30, 40, 5]);
      return moneyDraft(`How much do you save on a ${money(price)} item at ${p}% off?`, (price * p) / 100, pctOfSteps(p, price, money));
    },
  },
  {
    id: 'pct.tax',
    skill: 'pct',
    label: 'Total with sales tax',
    gen: (rng) => {
      const p = pick(rng, [5, 6, 7, 8, 10]);
      const price = p === 5 || p === 10 ? multiple(rng, 20, 20, 400) : multiple(rng, 50, 50, 500);
      const steps = changeBySteps(price, p, true, money);
      return moneyDraft(`A ${money(price)} purchase plus ${p}% sales tax. What's the total?`, price + (price * p) / 100, steps);
    },
  },
  {
    id: 'pct.tip',
    skill: 'pct',
    label: 'Tip amount',
    gen: (rng) => {
      const p = pick(rng, [15, 18, 20, 25]);
      const bill = p === 18 ? multiple(rng, 50, 50, 300) : multiple(rng, 10, 20, 200);
      return moneyDraft(`Leave a ${p}% tip on a ${money(bill)} bill. How much is the tip?`, (bill * p) / 100, pctOfSteps(p, bill, money));
    },
  },
  {
    id: 'pct.markup',
    skill: 'pct',
    label: 'Price after markup',
    gen: (rng) => {
      const cost = multiple(rng, 10, 20, 300);
      const p = pick(rng, [10, 20, 25, 30, 40, 50, 15]);
      const steps = changeBySteps(cost, p, true, money);
      return moneyDraft(`A shop pays ${money(cost)} for an item and marks it up ${p}%. What's the selling price?`, cost + (cost * p) / 100, steps);
    },
  },
  {
    id: 'pct.change',
    skill: 'pct',
    label: 'Percent change between two numbers',
    gen: (rng) => {
      const from = multiple(rng, 20, 20, 400);
      const p = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50, 75]);
      const up = chance(rng, 0.5);
      const delta = (from * p) / 100;
      if (!isWhole(delta)) return null;
      const to = up ? from + delta : from - delta;
      const steps = percentChangeSteps(from, to);
      if (lastStep(steps) !== p) return null;
      return { prompt: `${fmt(from)} → ${fmt(to)}: what's the percent ${up ? 'increase' : 'decrease'}?`, answer: p, steps, suffix: '%' };
    },
  },
  {
    id: 'pct.reverse',
    skill: 'pct',
    label: 'Reverse % (price before the change)',
    gen: (rng) => {
      const off = chance(rng, 0.6);
      const p = off ? pick(rng, [10, 20, 25, 50, 40, 30]) : pick(rng, [10, 20, 25, 50]);
      const orig = multiple(rng, 20, 40, 400);
      const after = (orig * (off ? 100 - p : 100 + p)) / 100;
      if (!isWhole(after)) return null;
      const steps = reverseSteps(after, p, off, money);
      if (!steps.every((s) => s.value === undefined || isWhole(s.value))) return null;
      const prompt = off
        ? `After ${p}% off, something costs ${money(after)}. What was the original price?`
        : `A price went up ${p}% to ${money(after)}. What was it before?`;
      return { prompt, answer: orig, steps, prefix: '$' };
    },
  },
];

export const TYPES: Record<string, TypeDef> = Object.fromEntries(
  [...addTypes, ...subTypes, ...pctTypes].map((t) => [t.id, t]),
);

export const LEVELS: Record<Skill, LevelDef[]> = {
  add: [
    { skill: 'add', level: 1, name: 'Warm-up: make 10', blurb: '8 + 7 → 8 + 2 + 5. Get these instant.', targetSec: 3, types: ['add.make10'] },
    { skill: 'add', level: 2, name: '3-digit + 2-digit', blurb: 'Left to right: tens, then ones.', targetSec: 6, types: ['add.32'] },
    { skill: 'add', level: 3, name: '3-digit + 3-digit', blurb: 'Hundreds, tens, ones — keep a running total.', targetSec: 8, types: ['add.33'] },
    { skill: 'add', level: 4, name: 'Round & adjust', blurb: '478 + 199 → 478 + 200 − 1.', targetSec: 6, types: ['add.round3', 'add.round2'] },
    { skill: 'add', level: 5, name: 'Mixed mastery', blurb: 'Pick the fastest move for each problem.', targetSec: 7, types: ['add.32', 'add.33', 'add.33', 'add.round3', 'add.round2'] },
  ],
  sub: [
    { skill: 'sub', level: 1, name: 'Count up from round numbers', blurb: '500 − 268: 268 → 300 → 500.', targetSec: 7, types: ['sub.fromRound'] },
    { skill: 'sub', level: 2, name: '3-digit − 2-digit', blurb: '423 − 68: 68 → 100 → 423.', targetSec: 7, types: ['sub.32'] },
    { skill: 'sub', level: 3, name: '3-digit − 3-digit', blurb: '703 − 468: 468 → 500 → 703.', targetSec: 9, types: ['sub.33'] },
    { skill: 'sub', level: 4, name: 'Round & adjust', blurb: '625 − 298 → 625 − 300 + 2.', targetSec: 6, types: ['sub.round3', 'sub.round2'] },
    { skill: 'sub', level: 5, name: 'Mixed mastery', blurb: 'Count up or round — whichever is faster.', targetSec: 8, types: ['sub.fromRound', 'sub.32', 'sub.33', 'sub.33', 'sub.round3', 'sub.round2'] },
  ],
  pct: [
    { skill: 'pct', level: 1, name: 'Anchors', blurb: '10%, 50%, 25%, 20%, 5%, 1% of clean numbers.', targetSec: 5, types: ['pct.anchor'] },
    { skill: 'pct', level: 2, name: 'Multiples of 5%', blurb: '35% = 30% + 5%.', targetSec: 8, types: ['pct.mult5'] },
    { skill: 'pct', level: 3, name: 'Any whole percent', blurb: '12% = 10% + 2 × 1%. Plus the swap trick.', targetSec: 12, types: ['pct.any', 'pct.any', 'pct.any', 'pct.swap'] },
    { skill: 'pct', level: 4, name: 'Increase & decrease', blurb: 'Find the amount, then add or subtract it.', targetSec: 12, types: ['pct.inc', 'pct.dec'] },
    { skill: 'pct', level: 5, name: 'Real-world', blurb: 'Sale price, tax, tips, markup, discounts.', targetSec: 15, types: ['pct.sale', 'pct.discount', 'pct.tax', 'pct.tip', 'pct.markup'] },
    { skill: 'pct', level: 6, name: 'Stretch: change & reverse', blurb: '60 → 75 is +25%. $80 after 20% off was $100.', targetSec: 18, types: ['pct.change', 'pct.reverse'] },
  ],
};

export function levelDef(skill: Skill, level: number): LevelDef {
  return LEVELS[skill][level - 1];
}

export function maxLevel(skill: Skill): number {
  return LEVELS[skill].length;
}

/** Generate a problem of a specific type, attributed to `level`. */
export function generateOfType(typeId: string, level: number, rng: Rng = Math.random): Problem {
  const def = TYPES[typeId];
  if (!def) throw new Error(`Unknown problem type ${typeId}`);
  for (let i = 0; i < 1000; i++) {
    const d = def.gen(rng);
    if (!d) continue;
    if (lastStep(d.steps) === undefined || Math.abs((lastStep(d.steps) as number) - d.answer) > 1e-9) {
      throw new Error(`Walkthrough for ${d.prompt} does not end at the answer`);
    }
    return { id: uid(), skill: def.skill, level, type: typeId, ...d };
  }
  throw new Error(`Could not generate a problem of type ${typeId}`);
}

/** Generate a problem for a level, choosing among its types (optionally weighted). */
export function generate(skill: Skill, level: number, rng: Rng = Math.random, weight?: (typeId: string) => number): Problem {
  const types = levelDef(skill, level).types;
  const ws = types.map((t) => (weight ? Math.max(0.05, weight(t)) : 1));
  let r = rng() * ws.reduce((a, b) => a + b, 0);
  let chosen = types[types.length - 1];
  for (let i = 0; i < types.length; i++) {
    r -= ws[i];
    if (r <= 0) {
      chosen = types[i];
      break;
    }
  }
  return generateOfType(chosen, level, rng);
}
