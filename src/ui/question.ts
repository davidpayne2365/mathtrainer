/**
 * One question on screen: big prompt, numeric input that auto-checks as you type,
 * optional step-by-step hint, then the full "fast way" walkthrough and a Next button.
 */
import type { AnswerInput, AnswerResult } from '../core/engine';
import { levelDef } from '../core/generators';
import type { Problem, Step } from '../core/types';
import { answerString, clean, fmt } from '../core/util';
import { h, icon } from './dom';

export interface QuestionOpts {
  problem: Problem;
  /** Show the "Show method" hint button. */
  hint: boolean;
  /** Persist the answer; returns the outcome. */
  record: (p: Problem, input: AnswerInput) => AnswerResult;
  /** Called synchronously from the Next tap so the next input can grab focus (keeps the phone keyboard up). */
  onNext: () => void;
  /** Fired when the walkthrough is shown (Drill pauses its clock). */
  onReview?: (res: AnswerResult & { correct: boolean; ms: number }) => void;
  nextLabel?: string;
}

export interface QuestionHandle {
  el: HTMLElement;
  focus(): void;
  /** True once answered. */
  done(): boolean;
}

export function stepList(steps: Step[], upto = steps.length): HTMLElement {
  return h(
    'ol',
    { class: 'steps' },
    steps.slice(0, upto).map((s, i) => h('li', { class: i === steps.length - 1 ? 'final' : '' }, s.text)),
  );
}

/** The answer as displayed: $12.50, 25%, 1,234. */
export function answerLabel(p: Pick<Problem, 'answer' | 'prefix' | 'suffix'>): string {
  const n = clean(p.answer);
  const body = p.prefix === '$' && !Number.isInteger(n) ? n.toFixed(2) : fmt(n);
  return `${p.prefix ?? ''}${body}${p.suffix ?? ''}`;
}

export function renderQuestion(opts: QuestionOpts): QuestionHandle {
  const { problem } = opts;
  const target = answerString(problem.answer);
  const decimal = !Number.isInteger(clean(problem.answer)) || problem.skill === 'pct' && problem.level >= 3;
  const start = performance.now();
  let answered = false;
  let hintShown = 0;

  const input = h('input', {
    class: 'answer',
    type: 'text',
    inputMode: decimal ? 'decimal' : 'numeric',
    pattern: decimal ? undefined : '[0-9]*',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: false,
    enterKeyHint: 'done',
    'aria-label': 'Your answer',
  });

  const status = h('div', { class: 'status', 'aria-live': 'polite' });
  const hintBox = h('div', { class: 'hint' });
  const actions = h('div', { class: 'actions' });
  const review = h('div', { class: 'review' });

  const hintBtn = h('button', { class: 'btn ghost', type: 'button', onclick: showHint }, 'Show method');
  const skipBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => check(true) }, "I don't know");
  if (opts.hint) actions.append(hintBtn);
  actions.append(skipBtn);

  const field = h(
    'label',
    { class: 'field' },
    problem.prefix ? h('span', { class: 'affix' }, problem.prefix) : null,
    input,
    problem.suffix ? h('span', { class: 'affix' }, problem.suffix) : null,
  );

  const level = levelDef(problem.skill, problem.level);
  const el = h(
    'section',
    { class: 'question' },
    h('div', { class: 'qmeta' }, `${level.name}`),
    h('div', { class: 'prompt' + (problem.prompt.length > 24 ? ' wordy' : '') }, problem.prompt),
    field,
    status,
    hintBox,
    actions,
    review,
  );

  function showHint() {
    hintShown = Math.min(hintShown + 1, problem.steps.length);
    hintBox.replaceChildren(stepList(problem.steps, hintShown));
    hintBtn.textContent = hintShown < problem.steps.length ? `Next step (${hintShown}/${problem.steps.length})` : 'All steps shown';
    hintBtn.disabled = hintShown >= problem.steps.length;
    input.focus();
  }

  function onInput() {
    if (answered) return;
    // Keep only digits (and one decimal point when allowed).
    let v = input.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
    if (decimal) v = v.replace(/(\..*)\./g, '$1');
    if (v !== input.value) input.value = v;
    const typed = v.replace(/^0+(?=\d)/, '');
    if (typed.length >= target.length) check(false);
  }

  function check(gaveUp: boolean) {
    if (answered) return;
    const raw = input.value.trim();
    if (!gaveUp && raw === '') return;
    answered = true;
    const ms = performance.now() - start;
    const value = Number(raw);
    const correct = !gaveUp && raw !== '' && Math.abs(value - problem.answer) < 1e-9;
    const res = opts.record(problem, { correct, ms, hinted: hintShown > 0 });

    input.readOnly = true;
    input.blur();
    el.classList.add(correct ? (res.outcome === 'slow' ? 'is-slow' : 'is-right') : 'is-wrong');
    const secsText = `${(ms / 1000).toFixed(1)}s`;
    const answerText = answerLabel(problem);
    if (correct && res.outcome === 'ok') {
      status.replaceChildren(icon('check', 20), ` Correct · ${secsText}`);
    } else if (correct) {
      status.replaceChildren(
        icon('check', 20),
        hintShown > 0 ? ` Correct with a hint · ${secsText}` : ` Correct but slow · ${secsText} (aim for ${level.targetSec}s)`,
      );
    } else {
      status.replaceChildren(icon('x', 20), gaveUp || raw === '' ? ` Answer: ${answerText}` : ` You said ${raw} — answer is ${answerText}`);
    }

    const nextBtn = h('button', { class: 'btn primary big', type: 'button', onclick: () => opts.onNext() }, opts.nextLabel ?? 'Next');
    hintBox.replaceChildren();
    actions.replaceChildren();
    review.replaceChildren(h('div', { class: 'review-title' }, 'The fast way'), stepList(problem.steps), nextBtn);
    opts.onReview?.({ ...res, correct, ms });
    nextBtn.focus({ preventScroll: true });
    requestAnimationFrame(() => nextBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      check(false);
    }
  });

  return {
    el,
    focus: () => input.focus({ preventScroll: true }),
    done: () => answered,
  };
}
