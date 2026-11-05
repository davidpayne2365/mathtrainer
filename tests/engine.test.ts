import { describe, expect, it } from 'vitest';
import {
  RETRY_GAP,
  defaultProgress,
  drillPool,
  nextProblem,
  normalize,
  recordAnswer,
  streak,
  typeWeight,
  weakest,
} from '../src/core/engine';
import { generate, generateOfType } from '../src/core/generators';
import { mulberry32 } from '../src/core/util';

const rng = mulberry32(42);

describe('level unlocking', () => {
  it('unlocks the next level at 90% over the last 20', () => {
    const prog = defaultProgress();
    for (let i = 0; i < 19; i++) recordAnswer(prog, generate('add', 1, rng), { correct: true, ms: 1000 });
    expect(prog.unlocked.add).toBe(1);
    const res = recordAnswer(prog, generate('add', 1, rng), { correct: true, ms: 1000 });
    expect(res.unlocked).toBe(2);
    expect(prog.unlocked.add).toBe(2);
  });

  it('does not unlock below 90%', () => {
    const prog = defaultProgress();
    for (let i = 0; i < 20; i++) recordAnswer(prog, generate('sub', 1, rng), { correct: i % 5 !== 0, ms: 1000 });
    expect(prog.unlocked.sub).toBe(1); // 16/20 = 80%
  });

  it('hinted answers do not count toward unlocking', () => {
    const prog = defaultProgress();
    for (let i = 0; i < 20; i++) recordAnswer(prog, generate('pct', 1, rng), { correct: true, ms: 1000, hinted: true });
    expect(prog.unlocked.pct).toBe(1);
  });
});

describe('outcomes', () => {
  it('flags correct-but-slow separately from wrong', () => {
    const prog = defaultProgress();
    const p = generate('add', 3, rng);
    expect(recordAnswer(prog, p, { correct: true, ms: 1000 }).outcome).toBe('ok');
    expect(recordAnswer(prog, p, { correct: true, ms: 60000 }).outcome).toBe('slow');
    expect(recordAnswer(prog, p, { correct: false, ms: 1000 }).outcome).toBe('wrong');
  });
});

describe('adaptive selection', () => {
  it('weights missed and slow types higher', () => {
    const prog = defaultProgress();
    const p = generateOfType('add.33', 3, rng);
    for (let i = 0; i < 5; i++) recordAnswer(prog, p, { correct: true, ms: 1000 });
    const good = typeWeight(prog, 'add.33');
    const q = generateOfType('add.32', 2, rng);
    for (let i = 0; i < 5; i++) recordAnswer(prog, q, { correct: false, ms: 1000 });
    expect(typeWeight(prog, 'add.32')).toBeGreaterThan(good);
  });

  it('brings back a similar problem a few questions after a miss', () => {
    const prog = defaultProgress();
    const pool = [{ skill: 'add' as const, level: 4 }];
    const missed = generateOfType('add.round2', 4, rng);
    recordAnswer(prog, missed, { correct: false, ms: 2000 });
    const seen: string[] = [];
    for (let i = 0; i < RETRY_GAP; i++) {
      const p = nextProblem(prog, pool, rng, missed.prompt);
      expect(p.prompt).not.toBe(missed.prompt);
      seen.push(p.type);
      recordAnswer(prog, p, { correct: true, ms: 1000 });
    }
    const retry = nextProblem(prog, pool, rng, missed.prompt);
    expect(retry.type).toBe('add.round2');
    expect(retry.prompt).not.toBe(missed.prompt);
    expect(prog.retry).toHaveLength(0);
  });

  it('drill pool covers unlocked levels and skips the passed warm-up', () => {
    const prog = defaultProgress();
    prog.unlocked.add = 3;
    expect(drillPool(prog, ['add', 'pct'])).toEqual([
      { skill: 'add', level: 2 },
      { skill: 'add', level: 3 },
      { skill: 'pct', level: 1 },
    ]);
  });
});

describe('stats', () => {
  it('counts a daily streak', () => {
    const prog = defaultProgress();
    const p = generate('add', 1, rng);
    const today = new Date(2026, 10, 5, 12);
    for (const offset of [0, 1, 2, 4]) {
      const d = new Date(today);
      d.setDate(d.getDate() - offset);
      recordAnswer(prog, p, { correct: true, ms: 1000 }, d);
    }
    expect(streak(prog, today)).toBe(3);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(streak(prog, tomorrow)).toBe(3); // not broken until a full day is missed
  });

  it('lists weakest types', () => {
    const prog = defaultProgress();
    for (let i = 0; i < 4; i++) recordAnswer(prog, generateOfType('sub.33', 3, rng), { correct: false, ms: 5000 });
    for (let i = 0; i < 4; i++) recordAnswer(prog, generateOfType('sub.32', 2, rng), { correct: true, ms: 60000 });
    for (let i = 0; i < 4; i++) recordAnswer(prog, generateOfType('add.33', 3, rng), { correct: true, ms: 1000 });
    const w = weakest(prog);
    expect(w.map((x) => x.type)).toEqual(['sub.33', 'sub.32']);
  });

  it('normalizes junk storage', () => {
    expect(normalize(null).unlocked.add).toBe(1);
    expect(normalize({ unlocked: { add: 99 } }).unlocked.add).toBe(5);
  });
});
