import { describe, expect, it } from 'vitest';
import { FACT_SETS } from '../src/core/facts';
import { factProblem, generateOfType } from '../src/core/generators';
import { mulberry32 } from '../src/core/util';

const rng = mulberry32(11);

describe('fact sets', () => {
  it('have the right number of distinct facts', () => {
    expect(FACT_SETS.add.facts).toHaveLength(55);
    expect(FACT_SETS.sub.facts).toHaveLength(100);
    expect(FACT_SETS.mul.facts).toHaveLength(55);
    for (const set of Object.values(FACT_SETS)) {
      expect(new Set(set.facts.map((f) => set.keyOf(f))).size).toBe(set.facts.length);
    }
  });

  it('every fact walkthrough ends at the right answer with the fact itself', () => {
    for (const set of Object.values(FACT_SETS)) {
      for (const f of set.facts) {
        const p = factProblem(set, f, rng);
        const [x, y] = p.operands!;
        const truth = set.skill === 'add' ? x + y : set.skill === 'sub' ? x - y : x * y;
        expect(p.answer).toBe(truth);
        const last = p.steps[p.steps.length - 1];
        expect(last.value).toBe(truth);
        expect(last.text.endsWith(`= ${truth}`), last.text).toBe(true);
        for (const s of p.steps) if (s.value !== undefined) expect(Number.isInteger(s.value)).toBe(true);
      }
    }
  });

  it('operands stay within 1–10 (subtraction: answer and amount taken away)', () => {
    for (const set of Object.values(FACT_SETS)) {
      for (let i = 0; i < 300; i++) {
        const p = generateOfType(set.type, 1, rng);
        const [x, y] = p.operands!;
        if (set.skill === 'sub') {
          expect(y).toBeGreaterThanOrEqual(1);
          expect(y).toBeLessThanOrEqual(10);
          expect(x - y).toBeGreaterThanOrEqual(1);
          expect(x - y).toBeLessThanOrEqual(10);
        } else {
          for (const n of [x, y]) expect(n >= 1 && n <= 10).toBe(true);
        }
      }
    }
  });

  it('a + b and b + a share one record; 15 − 7 and 15 − 8 do not', () => {
    expect(FACT_SETS.add.keyOf([8, 7])).toBe(FACT_SETS.add.keyOf([7, 8]));
    expect(FACT_SETS.mul.keyOf([8, 7])).toBe(FACT_SETS.mul.keyOf([7, 8]));
    expect(FACT_SETS.sub.keyOf([15, 7])).not.toBe(FACT_SETS.sub.keyOf([15, 8]));
  });

  it('grid cells map to real facts', () => {
    for (const set of Object.values(FACT_SETS)) {
      const keys = new Set(set.facts.map((f) => set.keyOf(f)));
      for (let r = 1; r <= 10; r++) for (let c = 1; c <= 10; c++) expect(keys.has(set.keyOf(set.grid.cell(r, c).operands))).toBe(true);
    }
  });

  it('memory aids use the expected anchors', () => {
    const steps = (a: number, b: number) => factProblem(FACT_SETS.mul, [a, b], () => 0.1).steps.map((s) => s.text).join(' | ');
    expect(steps(6, 9)).toMatch(/6 × 10 = 60.*minus|60 − 6/);
    expect(steps(7, 8)).toMatch(/Double 7/);
    expect(factProblem(FACT_SETS.sub, [15, 7], rng).steps[0].text).toBe('Count up 7 → 10: +3');
  });
});
