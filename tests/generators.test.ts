import { describe, expect, it } from 'vitest';
import { FACTS, LEVELS, TYPES, factProblem, generate, generateOfType } from '../src/core/generators';
import { SKILLS, type Problem } from '../src/core/types';
import { isHalfClean, isWhole, mulberry32 } from '../src/core/util';

const N = 400;

function sample(typeId: string, seed = 1): Problem[] {
  const rng = mulberry32(seed);
  return Array.from({ length: N }, () => generateOfType(typeId, 1, rng));
}

/** Independently recompute the answer from the prompt text. */
function solve(p: Problem): number | null {
  const nums = (p.prompt.replace(/,/g, '').match(/\d+(\.\d+)?/g) ?? []).map(Number);
  const [x, y] = nums;
  switch (p.type) {
    case 'add.fact':
    case 'add.32':
    case 'add.33':
    case 'add.round3':
    case 'add.round2':
      return x + y;
    case 'sub.fromRound':
    case 'sub.32':
    case 'sub.33':
    case 'sub.round3':
    case 'sub.round2':
      return x - y;
    case 'pct.anchor':
    case 'pct.mult5':
    case 'pct.any':
    case 'pct.swap':
      return (x * y) / 100;
    case 'pct.inc':
      return x + (x * y) / 100;
    case 'pct.dec':
      return x - (x * y) / 100;
    case 'pct.sale': // "$80 item is 25% off"
      return x - (x * y) / 100;
    case 'pct.discount': // "$120 item at 15% off"
      return (x * y) / 100;
    case 'pct.tax': // "$60 purchase plus 8%"
      return x + (x * y) / 100;
    case 'pct.tip': // "15% tip on a $40 bill"
      return (x * y) / 100;
    case 'pct.markup': // "pays $40 ... marks it up 30%"
      return x + (x * y) / 100;
    case 'pct.change': // "60 → 75"
      return (Math.abs(y - x) / x) * 100;
    case 'pct.reverse': {
      // "After 20% off ... $80"  |  "went up 25% to $150"
      const off = p.prompt.includes('off');
      return y / ((off ? 100 - x : 100 + x) / 100);
    }
  }
  return null;
}

describe('every problem type', () => {
  for (const typeId of Object.keys(TYPES)) {
    describe(typeId, () => {
      const probs = sample(typeId);

      it('walkthrough final step equals the true answer', () => {
        for (const p of probs) {
          const truth = solve(p);
          expect(truth, `no solver for ${typeId}`).not.toBeNull();
          expect(p.answer).toBeCloseTo(truth as number, 9);
          const last = p.steps[p.steps.length - 1];
          expect(last.value, p.prompt).toBeDefined();
          expect(last.value as number).toBeCloseTo(truth as number, 9);
        }
      });

      it('never produces messy decimals', () => {
        for (const p of probs) {
          expect(isHalfClean(p.answer), `${p.prompt} = ${p.answer}`).toBe(true);
          for (const s of p.steps) if (s.value !== undefined) expect(isHalfClean(s.value), s.text).toBe(true);
        }
      });

      it('has a positive answer and non-empty steps', () => {
        for (const p of probs) {
          expect(p.answer).toBeGreaterThan(0);
          expect(p.steps.length).toBeGreaterThan(0);
          for (const s of p.steps) expect(s.text.length).toBeGreaterThan(0);
        }
      });

      it('produces varied problems', () => {
        expect(new Set(probs.map((p) => p.prompt)).size).toBeGreaterThan(Math.min(20, N / 10));
      });
    });
  }
});

describe('addition rules', () => {
  it('3-digit + 3-digit and 3-digit + 2-digit operands', () => {
    for (const p of sample('add.33')) {
      const [a, b] = p.prompt.split(' + ').map(Number);
      expect(a).toBeGreaterThanOrEqual(100);
      expect(a).toBeLessThan(1000);
      expect(b).toBeGreaterThanOrEqual(100);
      expect(b).toBeLessThan(1000);
    }
    for (const p of sample('add.32')) {
      const [a, b] = p.prompt.split(' + ').map(Number);
      expect(a).toBeGreaterThanOrEqual(100);
      expect(b).toBeGreaterThanOrEqual(10);
      expect(b).toBeLessThan(100);
    }
  });

  it('round-and-adjust problems contain a number 1–3 below a round number', () => {
    for (const p of sample('add.round3')) {
      const nums = p.prompt.split(' + ').map(Number);
      expect(nums.some((n) => [1, 2, 3].includes(100 - (n % 100)))).toBe(true);
      expect(p.steps[0].text).toMatch(/less than/);
    }
  });

  it('facts use 1–10 + 1–10 and cover all 55 facts', () => {
    const seen = new Set<string>();
    for (const p of sample('add.fact')) {
      const [a, b] = p.operands!;
      expect(a).toBeGreaterThanOrEqual(1);
      expect(b).toBeLessThanOrEqual(10);
      expect(p.prompt).toBe(`${a} + ${b}`);
      seen.add(`${Math.min(a, b)}+${Math.max(a, b)}`);
    }
    expect(FACTS).toHaveLength(55);
    expect(seen.size).toBe(55);
  });

  it('fact walkthroughs end with the fact itself', () => {
    for (const [a, b] of FACTS) {
      const p = factProblem(a, b);
      expect(p.steps[p.steps.length - 1].text).toMatch(new RegExp(`${a} \\+ ${b} = ${a + b}$`));
      if (a < 10 && b < 10 && a + b > 10) expect(p.steps[0].text).toMatch(/make 10/);
    }
  });
});

describe('subtraction rules', () => {
  it('result is always positive', () => {
    for (const t of ['sub.fromRound', 'sub.32', 'sub.33', 'sub.round3', 'sub.round2']) {
      for (const p of sample(t)) expect(p.answer).toBeGreaterThan(0);
    }
  });

  it('favours cases where column subtraction would need borrowing', () => {
    for (const t of ['sub.32', 'sub.33']) {
      const probs = sample(t);
      const borrow = probs.filter((p) => {
        const [a, b] = p.prompt.split(' − ').map(Number);
        return a % 10 < b % 10 || a % 100 < b % 100;
      });
      expect(borrow.length / probs.length).toBeGreaterThan(0.8);
    }
  });

  it('count-up walkthroughs pass through a round number', () => {
    for (const p of sample('sub.33')) {
      expect(p.steps[0].text).toMatch(/Count up \d+ → \d*0\b/);
    }
  });
});

describe('percentage rules', () => {
  it('levels 1, 2 and 4 give whole-number answers', () => {
    for (const t of ['pct.anchor', 'pct.mult5', 'pct.inc', 'pct.dec']) {
      for (const p of sample(t)) expect(isWhole(p.answer), p.prompt).toBe(true);
    }
  });

  it('level 1 only uses anchor percents', () => {
    for (const p of sample('pct.anchor')) {
      const pct = Number(p.prompt.split('%')[0]);
      expect([10, 50, 25, 20, 5, 1]).toContain(pct);
    }
  });

  it('level 3 uses percents that are not multiples of 5', () => {
    for (const p of sample('pct.any')) expect(Number(p.prompt.split('%')[0]) % 5).not.toBe(0);
  });
});

describe('level generation', () => {
  it('generates for every skill and level with weights', () => {
    const rng = mulberry32(7);
    for (const skill of SKILLS) {
      for (const def of LEVELS[skill]) {
        for (let i = 0; i < 50; i++) {
          const p = generate(skill, def.level, rng, (t) => (t === def.types[0] ? 5 : 1));
          expect(p.skill).toBe(skill);
          expect(p.level).toBe(def.level);
          expect(def.types).toContain(p.type);
        }
      }
    }
  });

  it('every level type id exists', () => {
    for (const skill of SKILLS) for (const def of LEVELS[skill]) for (const t of def.types) expect(TYPES[t]).toBeDefined();
  });
});
