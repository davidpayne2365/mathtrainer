import { describe, expect, it } from 'vitest';
import {
  RETRY_GAP,
  defaultProgress,
  factStatus,
  pickFact,
  nextProblem,
  normalize,
  recordAnswer,
  streak,
  typeWeight,
  weakest,
} from '../src/core/engine';
import { FACT_SETS, type Pair } from '../src/core/facts';
import { factProblem, generate, generateOfType } from '../src/core/generators';

const ADD = FACT_SETS.add;
const keepOrder = () => 0.1; // rng < 0.5 keeps the order as written
const fact = (a: number, b: number) => factProblem(ADD, [a, b], keepOrder);
const masterAll = (prog: ReturnType<typeof defaultProgress>, facts: Pair[] = ADD.facts) => {
  for (const f of facts) for (let i = 0; i < 3; i++) recordAnswer(prog, factProblem(ADD, f, keepOrder), { correct: true, ms: 800 });
};
import { mulberry32 } from '../src/core/util';

const rng = mulberry32(42);

describe('level unlocking', () => {
  it('unlocks a non-facts level at 90% over the last 20', () => {
    const prog = defaultProgress();
    for (let i = 0; i < 19; i++) recordAnswer(prog, generate('pct', 1, rng), { correct: true, ms: 1000 });
    expect(prog.unlocked.pct).toBe(1);
    const res = recordAnswer(prog, generate('pct', 1, rng), { correct: true, ms: 1000 });
    expect(res.unlocked).toBe(2);
    expect(prog.unlocked.pct).toBe(2);
  });

  it('does not unlock below 90%', () => {
    const prog = defaultProgress();
    for (let i = 0; i < 20; i++) recordAnswer(prog, generate('pct', 1, rng), { correct: i % 5 !== 0, ms: 1000 });
    expect(prog.unlocked.pct).toBe(1); // 16/20 = 80%
  });

  it('facts level 1 stays locked at 100% accuracy until every fact is mastered', () => {
    const prog = defaultProgress();
    for (let i = 0; i < 40; i++) recordAnswer(prog, generate('add', 1, rng), { correct: true, ms: 800 });
    expect(prog.unlocked.add).toBe(1);
    const all = ADD.facts;
    const unlockedAt: number[] = [];
    let n = 0;
    for (const f of all) {
      for (let i = 0; i < 3; i++) {
        n++;
        if (recordAnswer(prog, factProblem(ADD, f, keepOrder), { correct: true, ms: 800 }).unlocked === 2) unlockedAt.push(n);
      }
      // Never unlocked while any fact is still unmastered.
      if (prog.unlocked.add === 2) expect(all.every((g) => factStatus(prog.facts[ADD.keyOf(g)]) === 'mastered')).toBe(true);
    }
    expect(unlockedAt).toHaveLength(1);
    expect(prog.unlocked.add).toBe(2);
  });

  it('subtraction facts gate subtraction level 2 the same way', () => {
    const prog = defaultProgress();
    const SUB = FACT_SETS.sub;
    for (const f of SUB.facts.slice(1)) for (let i = 0; i < 3; i++) recordAnswer(prog, factProblem(SUB, f, keepOrder), { correct: true, ms: 800 });
    expect(prog.unlocked.sub).toBe(1); // one fact still not mastered
    for (let i = 0; i < 3; i++) recordAnswer(prog, factProblem(SUB, SUB.facts[0], keepOrder), { correct: true, ms: 800 });
    expect(prog.unlocked.sub).toBe(2);
  });

  it('an unlocked level stays unlocked after reloading, even if a fact slips', () => {
    const prog = defaultProgress();
    masterAll(prog);
    expect(prog.unlocked.add).toBe(2);
    // One slow answer drops 8 + 7 back to "learning"...
    recordAnswer(prog, fact(8, 7), { correct: true, ms: 9000 });
    expect(factStatus(prog.facts['7+8'])).toBe('learning');
    // ...but reloading the app must not take level 2 away.
    expect(normalize(JSON.parse(JSON.stringify(prog))).unlocked.add).toBe(2);
  });

  it('gives back a level 2 that the old re-lock bug took away', () => {
    const prog = defaultProgress();
    masterAll(prog);
    recordAnswer(prog, fact(8, 7), { correct: true, ms: 9000 }); // slipped after unlocking
    const buggy = { ...JSON.parse(JSON.stringify(prog)), version: 3, unlocked: { add: 1, sub: 1, mul: 1, pct: 1 } };
    const p = normalize(buggy);
    expect(p.unlocked.add).toBe(2);
    expect(p.version).toBe(4);
    expect(p.unlocked.sub).toBe(1); // nothing earned there, nothing given
  });

  it('does not hand out level 2 when the facts were never all mastered', () => {
    const prog = defaultProgress();
    masterAll(prog, ADD.facts.slice(1)); // one fact never mastered
    const stored = { ...JSON.parse(JSON.stringify(prog)), version: 3 };
    expect(normalize(stored).unlocked.add).toBe(1);
  });

  it('restores any level you have answers in', () => {
    const p = normalize({ version: 3, unlocked: { add: 1, sub: 1, mul: 1, pct: 1 }, levels: { 'sub:3': { n: 4, correct: 4, recent: [true] } } });
    expect(p.unlocked.sub).toBe(3);
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
    const pool = [{ skill: 'add' as const, level: 5 }];
    const missed = generateOfType('add.round2', 5, rng);
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

});

describe('facts 1–10', () => {
  it('masters a fact after 3 fast correct answers in a row, either order', () => {
    const prog = defaultProgress();
    recordAnswer(prog, fact(8, 7), { correct: true, ms: 900 });
    recordAnswer(prog, fact(7, 8), { correct: true, ms: 900 });
    expect(factStatus(prog.facts['7+8'])).toBe('learning');
    recordAnswer(prog, fact(8, 7), { correct: true, ms: 900 });
    expect(factStatus(prog.facts['7+8'])).toBe('mastered');
    recordAnswer(prog, fact(8, 7), { correct: true, ms: 5000 }); // slow = not instant
    expect(factStatus(prog.facts['7+8'])).toBe('learning');
  });

  it('picks missed facts far more often than mastered ones', () => {
    const prog = defaultProgress();
    masterAll(prog);
    recordAnswer(prog, fact(6, 9), { correct: false, ms: 3000 });
    const r = mulberry32(5);
    let hits = 0;
    for (let i = 0; i < 2000; i++) if (pickFact(prog, ADD, r).operands!.slice().sort((x, y) => x - y).join() === '6,9') hits++;
    // 1 of 55 facts, weighted 5 vs 0.25 for the rest: expect roughly 2000 * 5 / 18.5 ≈ 540
    expect(hits).toBeGreaterThan(300);
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
    expect(normalize({ unlocked: { pct: 99 } }).unlocked.pct).toBe(6);
  });
});

describe('migrating stored progress', () => {
  it('v1: shifts subtraction up for facts, then add/sub up for the 2-digit level', () => {
    const old = {
      version: 1,
      unlocked: { add: 2, sub: 3, pct: 1 },
      levels: { 'sub:3': { n: 5, correct: 5, recent: [true] }, 'add:2': { n: 1, correct: 1, recent: [true] } },
      retry: [{ type: 'sub.33', skill: 'sub', level: 3, due: 4 }],
    };
    const p = normalize(old);
    expect(p.version).toBe(4);
    expect(p.unlocked).toEqual({ add: 3, sub: 5, mul: 1, pct: 1 }); // unlocked levels follow the renumbering
    // old sub L3 (3-digit − 3-digit) → v2 L4 → v3 L5; old add L2 (3-digit + 2-digit) → v3 L3
    expect(Object.keys(p.levels).sort()).toEqual(['add:3', 'sub:5']);
    expect(p.retry[0].level).toBe(5);
    expect(Object.keys(normalize(p).levels).sort()).toEqual(['add:3', 'sub:5']); // idempotent once migrated
  });

  it('v2: makes room for the new 2-digit level 2 and keeps what you unlocked', () => {
    const prog = defaultProgress();
    masterAll(prog); // addition facts mastered, so addition can stay unlocked
    const stored = {
      ...JSON.parse(JSON.stringify(prog)),
      version: 2,
      unlocked: { add: 3, sub: 1, mul: 1, pct: 2 },
      levels: { 'add:1': { n: 1, correct: 1, recent: [true] }, 'add:2': { n: 4, correct: 4, recent: [true] }, 'add:3': { n: 2, correct: 1, recent: [true, false] } },
    };
    const p = normalize(stored);
    expect(p.unlocked).toEqual({ add: 4, sub: 1, mul: 1, pct: 2 });
    expect(Object.keys(p.levels).sort()).toEqual(['add:1', 'add:3', 'add:4']);
    expect(p.levels['add:3'].n).toBe(4); // old "3-digit + 2-digit" stats now live at level 3
  });
});
