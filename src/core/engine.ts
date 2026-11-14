/**
 * Adaptive engine: level unlocks, per-type weighting toward weak spots,
 * retry scheduling after a miss, and progress statistics. Pure functions over
 * a plain JSON `Progress` object so it is easy to persist and test.
 */
import { FACT_SETS, FACT_TYPES, type FactSet, type FactSkill } from './facts';
import { LEVELS, TYPES, factProblem, generateOfType, levelDef, maxLevel } from './generators';
import { SKILLS, type Problem, type Rng, type Skill } from './types';

export type Outcome = 'ok' | 'slow' | 'wrong';

export interface TypeStat {
  n: number;
  wrong: number;
  slow: number;
  totalMs: number;
  /** Most recent outcomes, newest last (max RECENT_TYPE). */
  recent: Outcome[];
}

export interface LevelStat {
  n: number;
  correct: number;
  /** Most recent results in this level, newest last (max UNLOCK_WINDOW). */
  recent: boolean[];
}

export interface DayStat {
  n: number;
  correct: number;
  ms: number;
}

export interface RetryItem {
  type: string;
  skill: Skill;
  level: number;
  due: number;
}

/** Recent outcomes for one addition fact (a + b and b + a share a record). */
export interface FactStat {
  n: number;
  recent: Outcome[];
}

export type FactStatus = 'new' | 'learning' | 'mastered';

export interface Progress {
  version: 2;
  facts: Record<string, FactStat>;
  unlocked: Record<Skill, number>;
  levels: Record<string, LevelStat>;
  types: Record<string, TypeStat>;
  days: Record<string, Partial<Record<Skill, DayStat>>>;
  retry: RetryItem[];
  answered: number;
  run: number;
  bestRun: number;
}

export const UNLOCK_WINDOW = 20;
export const UNLOCK_ACCURACY = 0.9;
export const RECENT_TYPE = 10;
/** A missed type comes back this many questions later. */
export const RETRY_GAP = 3;
/** A fact is mastered after this many fast, correct answers in a row. */
export const FACT_MASTERY_RUN = 3;
const RECENT_FACT = 6;

export function defaultProgress(): Progress {
  return {
    version: 2,
    unlocked: { add: 1, sub: 1, mul: 1, pct: 1 },
    levels: {},
    types: {},
    facts: {},
    days: {},
    retry: [],
    answered: 0,
    run: 0,
    bestRun: 0,
  };
}

export const levelKey = (skill: Skill, level: number) => `${skill}:${level}`;

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export interface AnswerInput {
  correct: boolean;
  ms: number;
  /** Used the "Show method" hint before answering. */
  hinted?: boolean;
}

export interface AnswerResult {
  outcome: Outcome;
  /** New level number if this answer unlocked one. */
  unlocked?: number;
}

export function isSlow(problem: Problem, ms: number): boolean {
  return ms > levelDef(problem.skill, problem.level).targetSec * 1000;
}

/** Record an answer. Mutates and returns information about the outcome. */
export function recordAnswer(prog: Progress, problem: Problem, input: AnswerInput, now = new Date()): AnswerResult {
  const { skill, level, type } = problem;
  const clean = input.correct && !input.hinted;
  const outcome: Outcome = !input.correct ? 'wrong' : input.hinted || isSlow(problem, input.ms) ? 'slow' : 'ok';

  // Level window (drives unlocking).
  const lk = levelKey(skill, level);
  const ls = (prog.levels[lk] ??= { n: 0, correct: 0, recent: [] });
  ls.n++;
  if (clean) ls.correct++;
  ls.recent.push(clean);
  if (ls.recent.length > UNLOCK_WINDOW) ls.recent.splice(0, ls.recent.length - UNLOCK_WINDOW);

  let unlocked: number | undefined;
  if (level === prog.unlocked[skill] && level < maxLevel(skill) && canUnlock(ls)) {
    prog.unlocked[skill] = level + 1;
    unlocked = level + 1;
  }

  // Problem-type stats (drive weighting and the weak-spots list).
  const ts = (prog.types[type] ??= { n: 0, wrong: 0, slow: 0, totalMs: 0, recent: [] });
  ts.n++;
  ts.totalMs += input.ms;
  if (outcome === 'wrong') ts.wrong++;
  if (outcome === 'slow') ts.slow++;
  ts.recent.push(outcome);
  if (ts.recent.length > RECENT_TYPE) ts.recent.splice(0, ts.recent.length - RECENT_TYPE);

  // Per-fact memory (facts 1–10).
  const set = FACT_TYPES[type];
  if (set && problem.operands) {
    const fs = (prog.facts[set.keyOf(problem.operands)] ??= { n: 0, recent: [] });
    fs.n++;
    fs.recent.push(outcome);
    if (fs.recent.length > RECENT_FACT) fs.recent.splice(0, fs.recent.length - RECENT_FACT);
  }

  // Daily totals (drive trends and the streak).
  const dk = dayKey(now);
  const day = (prog.days[dk] ??= {});
  const ds = (day[skill] ??= { n: 0, correct: 0, ms: 0 });
  ds.n++;
  if (input.correct) ds.correct++;
  ds.ms += input.ms;

  prog.run = input.correct ? prog.run + 1 : 0;
  prog.bestRun = Math.max(prog.bestRun, prog.run);
  prog.answered++;

  // After a miss: bring back a fresh problem of the same type a few questions later.
  if (!input.correct && !prog.retry.some((r) => r.type === type)) {
    prog.retry.push({ type, skill, level, due: prog.answered + RETRY_GAP });
  }
  return { outcome, unlocked };
}

export function canUnlock(ls: LevelStat): boolean {
  return ls.recent.length >= UNLOCK_WINDOW && ls.recent.filter(Boolean).length >= UNLOCK_ACCURACY * UNLOCK_WINDOW;
}

/** Weight for choosing a problem type: higher for types missed or answered slowly. */
export function typeWeight(prog: Progress, typeId: string): number {
  const ts = prog.types[typeId];
  if (!ts || ts.recent.length === 0) return 1.5; // unseen: mildly favoured
  const r = ts.recent;
  const wrong = r.filter((o) => o === 'wrong').length / r.length;
  const slow = r.filter((o) => o === 'slow').length / r.length;
  return 1 + 4 * wrong + 2 * slow;
}

export interface PoolEntry {
  skill: Skill;
  level: number;
}

/**
 * Pick the next problem from a pool of levels. Due retries come first; otherwise
 * types are chosen in proportion to `typeWeight`. Never repeats `avoidPrompt`.
 */
export function nextProblem(prog: Progress, pool: PoolEntry[], rng: Rng = Math.random, avoidPrompt?: string): Problem {
  const inPool = (r: RetryItem) =>
    pool.some((e) => e.skill === r.skill && LEVELS[e.skill][e.level - 1].types.includes(r.type));
  const dueIdx = prog.retry.findIndex((r) => r.due <= prog.answered && inPool(r));
  if (dueIdx >= 0) {
    const [r] = prog.retry.splice(dueIdx, 1);
    for (let i = 0; i < 10; i++) {
      const p = FACT_TYPES[r.type] ? pickFact(prog, FACT_TYPES[r.type], rng, r.level) : generateOfType(r.type, r.level, rng);
      if (p.prompt !== avoidPrompt) return p;
    }
  }
  // Drop retries for levels that are no longer in play so the queue can't grow forever.
  if (prog.retry.length > 20) prog.retry.splice(0, prog.retry.length - 20);

  const cands: { level: PoolEntry; type: string; w: number }[] = [];
  for (const e of pool) {
    const types = levelDef(e.skill, e.level).types;
    for (const t of types) cands.push({ level: e, type: t, w: typeWeight(prog, t) / types.length });
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    let r = rng() * cands.reduce((a, c) => a + c.w, 0);
    let c = cands[cands.length - 1];
    for (const x of cands) {
      r -= x.w;
      if (r <= 0) {
        c = x;
        break;
      }
    }
    const set = FACT_TYPES[c.type];
    const p = set ? pickFact(prog, set, rng, c.level.level) : generateOfType(c.type, c.level.level, rng);
    if (p.prompt !== avoidPrompt) return p;
  }
  return generateOfType(cands[0].type, cands[0].level.level, rng);
}

/** Levels used by Drill for the chosen skills: everything unlocked; facts stay in until all are mastered. */
export function drillPool(prog: Progress, skills: Skill[]): PoolEntry[] {
  const pool: PoolEntry[] = [];
  for (const skill of skills) {
    const top = prog.unlocked[skill];
    // Keep facts in the mix until every one is memorized.
    const set = FACT_SETS[skill as FactSkill];
    const start = set && top > 1 && factSummary(prog, set).mastered === set.facts.length ? 2 : 1;
    for (let l = start; l <= top; l++) pool.push({ skill, level: l });
  }
  return pool;
}

// ----------------------------------------------------------------- facts

export function factStatus(fs: FactStat | undefined): FactStatus {
  if (!fs || fs.n === 0) return 'new';
  const tail = fs.recent.slice(-FACT_MASTERY_RUN);
  return tail.length >= FACT_MASTERY_RUN && tail.every((o) => o === 'ok') ? 'mastered' : 'learning';
}

/** How often to show a fact: unseen and shaky facts often, mastered ones occasionally. */
export function factWeight(fs: FactStat | undefined): number {
  const status = factStatus(fs);
  if (status === 'new') return 2;
  if (status === 'mastered') return 0.25;
  const r = fs!.recent;
  const wrong = r.filter((o) => o === 'wrong').length / r.length;
  const slow = r.filter((o) => o === 'slow').length / r.length;
  // The latest answer matters most for memorizing: a fresh miss comes back soon.
  const last = r[r.length - 1];
  const recency = last === 'wrong' ? 3 : last === 'slow' ? 1.5 : 0;
  return 1 + 4 * wrong + 2 * slow + recency;
}

/** Choose the next fact, weighted toward ones not yet memorized. */
export function pickFact(prog: Progress, set: FactSet, rng: Rng = Math.random, level = 1): Problem {
  const ws = set.facts.map((f) => factWeight(prog.facts[set.keyOf(f)]));
  let r = rng() * ws.reduce((x, y) => x + y, 0);
  let i = 0;
  for (; i < ws.length - 1; i++) {
    r -= ws[i];
    if (r <= 0) break;
  }
  return factProblem(set, set.facts[i], rng, level);
}

export function factSummary(prog: Progress, set: FactSet) {
  const counts = { new: 0, learning: 0, mastered: 0 };
  for (const f of set.facts) counts[factStatus(prog.facts[set.keyOf(f)])]++;
  return { ...counts, total: set.facts.length };
}

// ---------------------------------------------------------------- statistics

export function levelProgress(prog: Progress, skill: Skill, level: number) {
  const ls = prog.levels[levelKey(skill, level)];
  const recent = ls?.recent ?? [];
  const correct = recent.filter(Boolean).length;
  return {
    total: ls?.n ?? 0,
    recentN: recent.length,
    recentCorrect: correct,
    accuracy: recent.length ? correct / recent.length : 0,
  };
}

/** Consecutive days with at least one answer, ending today (or yesterday if not practised yet today). */
export function streak(prog: Progress, today = new Date()): number {
  const has = (d: Date) => {
    const day = prog.days[dayKey(d)];
    return !!day && Object.values(day).some((s) => (s?.n ?? 0) > 0);
  };
  const d = new Date(today);
  if (!has(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (has(d)) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export interface TrendPoint {
  day: string;
  n: number;
  accuracy: number | null;
  avgSec: number | null;
}

export function trend(prog: Progress, skill: Skill, days = 14, today = new Date()): TrendPoint[] {
  const out: TrendPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = dayKey(d);
    const s = prog.days[k]?.[skill];
    out.push({
      day: k,
      n: s?.n ?? 0,
      accuracy: s && s.n ? s.correct / s.n : null,
      avgSec: s && s.n ? s.ms / s.n / 1000 : null,
    });
  }
  return out;
}

export function skillTotals(prog: Progress, skill: Skill) {
  let n = 0;
  let correct = 0;
  let ms = 0;
  for (const day of Object.values(prog.days)) {
    const s = day[skill];
    if (!s) continue;
    n += s.n;
    correct += s.correct;
    ms += s.ms;
  }
  return { n, correct, accuracy: n ? correct / n : null, avgSec: n ? ms / n / 1000 : null };
}

export interface WeakSpot {
  type: string;
  label: string;
  skill: Skill;
  n: number;
  wrongRate: number;
  slowRate: number;
  avgSec: number;
}

/** Problem types ranked from weakest (recent misses count double, slow answers once). */
export function weakest(prog: Progress, limit = 5): WeakSpot[] {
  const spots: (WeakSpot & { score: number })[] = [];
  for (const [type, ts] of Object.entries(prog.types)) {
    const def = TYPES[type];
    if (!def || ts.n < 3) continue;
    const r = ts.recent;
    const wrongRate = r.filter((o) => o === 'wrong').length / r.length;
    const slowRate = r.filter((o) => o === 'slow').length / r.length;
    const score = 2 * wrongRate + slowRate;
    if (score === 0) continue;
    spots.push({ type, label: def.label, skill: def.skill, n: ts.n, wrongRate, slowRate, avgSec: ts.totalMs / ts.n / 1000, score });
  }
  spots.sort((a, b) => b.score - a.score);
  return spots.slice(0, limit);
}

/**
 * v1 → v2: subtraction gained a facts level at the front, so old subtraction
 * levels move up by one (you keep everything you had unlocked).
 */
function migrate(r: Partial<Progress> & { version?: number }): Partial<Progress> {
  if ((r.version ?? 1) >= 2) return r;
  const out = { ...r };
  if (out.unlocked && typeof out.unlocked.sub === 'number') out.unlocked = { ...out.unlocked, sub: out.unlocked.sub + 1 };
  if (out.levels) {
    out.levels = Object.fromEntries(
      Object.entries(out.levels).map(([k, v]) => {
        const [skill, lvl] = k.split(':');
        return [skill === 'sub' ? `sub:${Number(lvl) + 1}` : k, v];
      }),
    );
  }
  if (Array.isArray(out.retry)) out.retry = out.retry.map((x) => (x?.skill === 'sub' ? { ...x, level: x.level + 1 } : x));
  return out;
}

/** Merge stored data over defaults, tolerating older or partial shapes. */
export function normalize(raw: unknown): Progress {
  const base = defaultProgress();
  if (!raw || typeof raw !== 'object') return base;
  const r = migrate(raw as Partial<Progress> & { version?: number });
  const unlocked = { ...base.unlocked };
  for (const s of SKILLS) {
    const v = r.unlocked?.[s];
    if (typeof v === 'number' && v >= 1) unlocked[s] = Math.min(Math.floor(v), maxLevel(s));
  }
  return {
    ...base,
    ...r,
    version: 2,
    unlocked,
    levels: r.levels ?? {},
    types: r.types ?? {},
    facts: r.facts ?? {},
    days: r.days ?? {},
    // Drop retries for problem types that no longer exist (e.g. the old make-10 level).
    retry: Array.isArray(r.retry) ? r.retry.filter((x) => x && TYPES[x.type]) : [],
  };
}
