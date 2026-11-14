/**
 * Basic facts with 1–10: addition, subtraction and times tables.
 * Each set is memorized fact by fact; the steps are a memory aid shown on a miss.
 */
import { factSteps, mulFactSteps, subFactSteps } from './methods';
import type { Rng, Step } from './types';

export type FactSkill = 'add' | 'sub' | 'mul';
export type Pair = [number, number];

export interface FactDraft {
  prompt: string;
  answer: number;
  steps: Step[];
  operands: Pair;
}

export interface FactSet {
  skill: FactSkill;
  /** Problem type id, e.g. "add.fact". */
  type: string;
  title: string;
  /** Canonical list of distinct facts. */
  facts: Pair[];
  /** Storage key for a problem's operands (order-insensitive where the operation is). */
  keyOf(operands: Pair): string;
  /** Build a problem from a canonical fact, choosing a display order when it doesn't matter. */
  make(f: Pair, rng: Rng): FactDraft;
  /** 10×10 grid on the Progress page. */
  grid: { help: string; corner: string; cell(row: number, col: number): { operands: Pair; text: string; title: string } };
}

const range = Array.from({ length: 10 }, (_, i) => i + 1);
const pairsUnordered = (): Pair[] => range.flatMap((a) => range.filter((b) => b >= a).map((b): Pair => [a, b]));
const flip = (f: Pair, rng: Rng): Pair => (rng() < 0.5 ? f : [f[1], f[0]]);

const ADD: FactSet = {
  skill: 'add',
  type: 'add.fact',
  title: 'Addition facts 1–10',
  facts: pairsUnordered(),
  keyOf: ([a, b]) => `${Math.min(a, b)}+${Math.max(a, b)}`,
  make(f, rng) {
    const [a, b] = flip(f, rng);
    return { prompt: `${a} + ${b}`, answer: a + b, steps: factSteps(a, b), operands: [a, b] };
  },
  grid: {
    help: '8 + 7 and 7 + 8 count as one fact.',
    corner: '+',
    cell: (r, c) => ({ operands: [r, c], text: String(r + c), title: `${r} + ${c} = ${r + c}` }),
  },
};

const SUB: FactSet = {
  skill: 'sub',
  type: 'sub.fact',
  title: 'Subtraction facts 1–10',
  // c − b = d with b, d in 1–10: every "take back" of an addition fact. 15 − 7 and 15 − 8 are different facts.
  facts: range.flatMap((b) => range.map((d): Pair => [b + d, b])),
  keyOf: ([c, b]) => `${c}-${b}`,
  make([c, b]) {
    return { prompt: `${c} − ${b}`, answer: c - b, steps: subFactSteps(c, b), operands: [c, b] };
  },
  grid: {
    help: 'Row: the number taken away. Column: the answer. Each square shows the starting number (row 7, column 8 is 15 − 7 = 8).',
    corner: '−',
    cell: (r, c) => ({ operands: [r + c, r], text: String(r + c), title: `${r + c} − ${r} = ${c}` }),
  },
};

const MUL: FactSet = {
  skill: 'mul',
  type: 'mul.fact',
  title: 'Times tables 1–10',
  facts: pairsUnordered(),
  keyOf: ([a, b]) => `${Math.min(a, b)}x${Math.max(a, b)}`,
  make(f, rng) {
    const [a, b] = flip(f, rng);
    return { prompt: `${a} × ${b}`, answer: a * b, steps: mulFactSteps(a, b), operands: [a, b] };
  },
  grid: {
    help: '7 × 8 and 8 × 7 count as one fact.',
    corner: '×',
    cell: (r, c) => ({ operands: [r, c], text: String(r * c), title: `${r} × ${c} = ${r * c}` }),
  },
};

export const FACT_SETS: Record<FactSkill, FactSet> = { add: ADD, sub: SUB, mul: MUL };

export const FACT_TYPES: Record<string, FactSet> = { [ADD.type]: ADD, [SUB.type]: SUB, [MUL.type]: MUL };

export const isFactType = (type: string): boolean => type in FACT_TYPES;
