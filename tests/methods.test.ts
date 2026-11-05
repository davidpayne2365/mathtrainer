import { describe, expect, it } from 'vitest';
import {
  addSteps,
  changeBySteps,
  countUpSteps,
  pctOfSteps,
  percentChangeSteps,
  placeParts,
  reverseSteps,
  subSteps,
  swapSteps,
} from '../src/core/methods';
import type { Step } from '../src/core/types';

const final = (s: Step[]) => s[s.length - 1].value;
const texts = (s: Step[]) => s.map((x) => x.text);

describe('addition walkthroughs', () => {
  it('left to right: 478 + 346', () => {
    const s = addSteps(478, 346);
    expect(texts(s)).toEqual(['Split 346 into 300 + 40 + 6', '478 + 300 = 778', '778 + 40 = 818', '818 + 6 = 824']);
    expect(final(s)).toBe(824);
  });

  it('round and adjust: 478 + 199', () => {
    const s = addSteps(478, 199);
    expect(texts(s).slice(1)).toEqual(['478 + 200 = 678', '678 − 1 = 677']);
    expect(final(s)).toBe(677);
  });

  it('rounds the first number when it is the near-round one', () => {
    const s = addSteps(298, 456);
    expect(s[1].text).toBe('456 + 300 = 756');
    expect(final(s)).toBe(754);
  });

  it('make 10: 8 + 7', () => {
    const s = addSteps(8, 7);
    expect(texts(s)).toEqual(['8 needs 2 to make 10, so split 7 into 2 + 5', '8 + 2 = 10', '10 + 5 = 15']);
  });

  it('place parts skip zeros', () => {
    expect(placeParts(306)).toEqual([300, 6]);
    expect(placeParts(40)).toEqual([40]);
  });

  it('final step matches a + b exhaustively for a sample grid', () => {
    for (let a = 100; a < 1000; a += 37) for (let b = 2; b < 1000; b += 13) expect(final(addSteps(a, b))).toBe(a + b);
  });
});

describe('subtraction walkthroughs', () => {
  it('count up: 703 − 468', () => {
    const s = subSteps(703, 468);
    expect(texts(s)).toEqual(['Count up 468 → 500: +32  (68 + 32 = 100)', 'Then 500 → 703: +203', 'Gap = 32 + 203 = 235']);
  });

  it('round and adjust: 625 − 298', () => {
    const s = subSteps(625, 298);
    expect(texts(s).slice(1)).toEqual(['625 − 300 = 325', '325 + 2 = 327']);
  });

  it('same hundred counts up through a ten', () => {
    const s = countUpSteps(483, 468);
    expect(s[0].text).toMatch(/468 → 470/);
    expect(final(s)).toBe(15);
  });

  it('final step matches a − b for a sample grid', () => {
    for (let a = 100; a < 1000; a += 23) for (let b = 10; b < a; b += 11) expect(final(subSteps(a, b))).toBe(a - b);
  });
});

describe('percentage walkthroughs', () => {
  it('15% of 240', () => {
    const s = pctOfSteps(15, 240);
    expect(s.map((x) => x.value)).toEqual([24, 12, 36]);
  });

  it('35% of 80', () => {
    expect(pctOfSteps(35, 80).map((x) => x.value)).toEqual([8, 24, 4, 28]);
  });

  it('12% of 450 uses 10% and 1%', () => {
    expect(pctOfSteps(12, 450).map((x) => x.value)).toEqual([45, 4.5, 9, 54]);
  });

  it('19% uses 20% − 1%', () => {
    const s = pctOfSteps(19, 300);
    expect(final(s)).toBe(57);
    expect(s[s.length - 1].text).toMatch(/20% − 1%/);
  });

  it('increase 240 by 15% and decrease 360 by 20%', () => {
    expect(final(changeBySteps(240, 15, true))).toBe(276);
    const d = changeBySteps(360, 20, false);
    expect(d.map((x) => x.value)).toEqual([36, 72, 288]);
  });

  it('increase 450 by 12%', () => {
    expect(final(changeBySteps(450, 12, true))).toBe(504);
  });

  it('swap: 8% of 50 = 50% of 8 = 4', () => {
    expect(final(swapSteps(8, 50))).toBe(4);
  });

  it('percent change and reverse percentages', () => {
    expect(final(percentChangeSteps(60, 75))).toBe(25);
    expect(final(percentChangeSteps(80, 60))).toBe(25);
    expect(final(reverseSteps(80, 20, true))).toBe(100);
    expect(final(reverseSteps(150, 25, false))).toBe(120);
  });

  it('every percent 1–100 of 1000 ends at the right value', () => {
    for (let p = 1; p <= 100; p++) expect(final(pctOfSteps(p, 1000))).toBeCloseTo(p * 10, 9);
  });
});
