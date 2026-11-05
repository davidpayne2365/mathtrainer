export type Skill = 'add' | 'sub' | 'pct';

export const SKILLS: Skill[] = ['add', 'sub', 'pct'];

export const SKILL_NAMES: Record<Skill, string> = {
  add: 'Addition',
  sub: 'Subtraction',
  pct: 'Percentages',
};

/** One line of a "fast way" walkthrough. `value` is the running result after this step, if any. */
export interface Step {
  text: string;
  value?: number;
}

export interface Problem {
  /** Unique per generated instance. */
  id: string;
  skill: Skill;
  level: number;
  /** Problem-type key used for adaptive weighting, e.g. "add.33". */
  type: string;
  /** What the user sees, e.g. "478 + 346" or a word problem. */
  prompt: string;
  answer: number;
  /** The fast-way walkthrough. The final step's value always equals `answer`. */
  steps: Step[];
  /** Display decoration for the answer field. */
  prefix?: string;
  suffix?: string;
}

export type Rng = () => number;
