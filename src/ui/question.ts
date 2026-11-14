/**
 * One question on screen: big prompt, numeric input that auto-checks as you type,
 * optional step-by-step hint. A correct answer moves straight on (the previous problem's
 * fast way stays one tap away); a miss stops and shows the full walkthrough.
 */
import type { AnswerInput, AnswerResult } from '../core/engine';
import { isFactType } from '../core/facts';
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
  onNext: (info?: { flash?: Flash }) => void;
  /** Confirmation of the previous (correct) answer, shown above the prompt. */
  flash?: Flash;
  /** Fired once the answer is recorded. */
  onReview?: (res: AnswerResult & { correct: boolean; ms: number }) => void;
  nextLabel?: string;
}

export interface Flash {
  text: string;
  slow: boolean;
  steps: Step[];
  /** Show the walkthrough open under the next question (it was worth teaching). */
  teach: boolean;
}

function flashLine(f: Flash): HTMLElement {
  return h('div', { class: 'flash' + (f.slow ? ' slow' : '') }, h('div', { class: 'flash-text' }, icon('check', 16), ' ', f.text));
}

/** The previous problem's walkthrough, shown under the current question. */
function prevLesson(f: Flash): HTMLElement {
  return h('section', { class: 'prev-lesson' }, h('div', { class: 'review-title' }, `Last one: ${f.text.split(' · ')[0]}`), lesson(f.steps));
}

/** A full walkthrough: the idea, then each step with its explanation. */
export function lesson(steps: Step[]): HTMLElement {
  const intro = steps[0]?.intro;
  return h('div', { class: 'lesson' }, intro ? h('p', { class: 'idea' }, intro) : null, stepList(steps));
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
    steps.slice(0, upto).map((s, i) =>
      h('li', { class: i === steps.length - 1 ? 'final' : '' }, h('div', { class: 'math' }, s.text), h('div', { class: 'why' }, s.why)),
    ),
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
    spellcheck: false,
    enterKeyHint: 'done',
    'aria-label': 'Your answer',
  });
  // Set as an attribute: Safari's `autocorrect` property is a boolean, so 'off' would turn it on.
  input.setAttribute('autocorrect', 'off');

  // Under the answer box: first the previous answer's ✓ line, then this answer's result.
  const status = h('div', { class: 'status', 'aria-live': 'polite' }, opts.flash ? flashLine(opts.flash) : null);
  const hintBox = h('div', { class: 'hint' });
  const actions = h('div', { class: 'actions' });
  const review = h('div', { class: 'review' });

  // Tapping a button must not move focus out of the answer box, or the phone keyboard drops.
  const keepFocus = (e: Event) => e.preventDefault();
  const hintBtn = h('button', { class: 'btn ghost', type: 'button', onmousedown: keepFocus, onpointerdown: keepFocus, onclick: showHint }, 'Show method');
  // Doubles as "Check" once something is typed: the iPhone number pad has no Enter key,
  // so a wrong answer shorter than the real one would otherwise never be checked.
  const skipBtn = h(
    'button',
    { class: 'btn ghost', type: 'button', onmousedown: keepFocus, onpointerdown: keepFocus, onclick: () => check(input.value.trim() === '') },
    "I don't know",
  );
  const syncSkip = () => {
    skipBtn.textContent = input.value.trim() === '' ? "I don't know" : 'Check';
    skipBtn.classList.toggle('primary', input.value.trim() !== '');
  };
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
    opts.flash?.teach ? prevLesson(opts.flash) : null,
  );

  function showHint() {
    hintShown = problem.steps.length;
    hintBox.replaceChildren(h('div', { class: 'review-title' }, 'How to do it'), lesson(problem.steps));
    hintBtn.textContent = 'Method shown below';
    hintBtn.disabled = true;
    el.querySelector('.prev-lesson')?.remove();
    input.focus({ preventScroll: true });
  }

  /** After a miss: you type the right answer to move on, so the keyboard never drops. */
  let retype = false;

  function onInput() {
    if (answered && !retype) return;
    // Keep only digits (and one decimal point when allowed).
    let v = input.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, '');
    if (decimal) v = v.replace(/(\..*)\./g, '$1');
    if (v !== input.value) input.value = v;
    const typed = v.replace(/^0+(?=\d)/, '');
    if (retype) {
      if (typed.length >= target.length && !typed.endsWith('.')) retypeCheck();
      return;
    }
    syncSkip();
    // Auto-check once as many characters as the answer has are typed (not mid-way through "4.").
    if (typed.length >= target.length && !typed.endsWith('.')) check(false);
  }

  function retypeCheck() {
    const raw = input.value.trim();
    if (raw !== '' && Math.abs(Number(raw) - problem.answer) < 1e-9) {
      retype = false;
      opts.onNext();
      return;
    }
    // Not it yet: clear and try again, keyboard stays up.
    input.value = '';
    field.classList.remove('shake');
    void field.offsetWidth;
    field.classList.add('shake');
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

    // Right answer: go straight to the next one, still inside the typing event so the
    // phone keyboard stays up. Only misses stop for the walkthrough.
    if (correct) {
      const slow = res.outcome === 'slow';
      const note = hintShown > 0 ? ' · with hint' : slow ? ` · slow (aim ${level.targetSec}s)` : '';
      opts.onReview?.({ ...res, correct, ms });
      opts.onNext({
        flash: {
          text: `${problem.prompt} = ${answerLabel(problem)} · ${(ms / 1000).toFixed(1)}s${note}`,
          slow,
          steps: problem.steps,
          // Facts answered fast need no lesson (keep the rapid-fire flow); everything else gets taught.
          teach: !isFactType(problem.type) || slow,
        },
      });
      return;
    }

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
      status.replaceChildren(
        icon('x', 20),
        gaveUp || raw === '' ? ` Answer: ${answerText}` : ` You said ${raw} — it's ${answerText}`,
        h('span', { class: 'retype-note' }, ` · type ${answerText.replace(/^\$|%$/g, '')} to go on`),
      );
    }

    // Stay in the answer box with the keyboard up: type the right answer to move on.
    retype = true;
    input.value = '';
    input.placeholder = answerString(problem.answer);
    hintBox.replaceChildren();
    actions.replaceChildren(
      h('button', { class: 'btn ghost', type: 'button', onmousedown: keepFocus, onpointerdown: keepFocus, onclick: () => opts.onNext() }, opts.nextLabel ?? 'Skip'),
    );
    const title = isFactType(problem.type) ? 'Lock it in' : 'The fast way';
    review.replaceChildren(h('div', { class: 'review-title' }, title), lesson(problem.steps));
    el.querySelector('.prev-lesson')?.remove();
    opts.onReview?.({ ...res, correct, ms });
    input.focus({ preventScroll: true });
  }

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (retype) retypeCheck();
      else check(false);
    }
  });

  return {
    el,
    focus: () => input.focus({ preventScroll: true }),
    done: () => answered,
  };
}
