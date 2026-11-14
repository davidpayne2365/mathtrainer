/**
 * Step-by-step "fast way" explanations, written to teach. Every function returns
 * a Step[] whose last step carries the final answer in `value`. Each step has the
 * math (`text`) and a plain-English explanation (`why`); the first step may carry
 * an `intro` describing the idea behind the method.
 *
 * The taught methods (never column arithmetic):
 *  - Addition: left to right, biggest place value first, running total.
 *    Round-and-adjust when a number is 1–3 below a round number.
 *  - Subtraction: count up from the smaller number through a round number.
 *    Round-and-adjust when the number taken away is 1–3 below a round number.
 *  - Percentages: build from anchors 10%, 5%, 1%, 50%, 25%.
 *  - Facts 1–10: memorize; make-10, count-up-through-10 and ×10/×2/×5 anchors are memory aids.
 */
import type { Step } from './types';
import { clean, fmt } from './util';

type Fmt = (n: number) => string;

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** 0–100 in words, for saying facts out loud: 56 → "fifty-six". */
export function words(n: number): string {
  if (n === 100) return 'one hundred';
  if (n < 20) return ONES[n];
  const t = TENS[Math.floor(n / 10)];
  return n % 10 ? `${t}-${ONES[n % 10]}` : t;
}

function withIntro(steps: Step[], intro: string): Step[] {
  if (steps.length) steps[0] = { ...steps[0], intro };
  return steps;
}

/** If n is 1–3 below a round number (hundred for 3-digit, ten for 2-digit), return it. */
export function nearRoundUp(n: number): { round: number; diff: number } | null {
  if (n < 10) return null;
  const unit = n >= 100 ? 100 : 10;
  const round = Math.ceil(n / unit) * unit;
  const diff = round - n;
  return diff >= 1 && diff <= 3 ? { round, diff } : null;
}

/** Split into place-value parts, biggest first, skipping zeros: 346 -> [300, 40, 6]. */
export function placeParts(n: number): number[] {
  const parts: number[] = [];
  let unit = 1;
  while (unit * 10 <= n) unit *= 10;
  let rest = n;
  for (; unit >= 1; unit /= 10) {
    const part = Math.floor(rest / unit) * unit;
    if (part > 0) parts.push(part);
    rest -= part;
  }
  return parts;
}

const PLACE: Record<number, string> = { 1: 'ones', 10: 'tens', 100: 'hundreds', 1000: 'thousands' };

/** Explain adding one place-value piece onto a running total. */
function placeWhy(run: number, part: number): string {
  let unit = 1;
  while (unit * 10 <= part) unit *= 10;
  const name = PLACE[unit];
  const k = part / unit;
  const d = Math.floor(run / unit) % 10;
  if (d + k < 10) {
    return `Add the ${name}: ${k} ${name} onto ${fmt(run)}. Only the ${name} digit changes, ${d} → ${d + k}, so you get ${fmt(run + part)}.`;
  }
  return `Add the ${name}: ${d} + ${k} = ${d + k} ${name}. That's 10 or more, so it rolls over — one more in the next place up, and ${d + k - 10} left in the ${name}: ${fmt(run + part)}.`;
}

// ---------------------------------------------------------------- addition

export function make10Steps(a: number, b: number): Step[] {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const need = 10 - big;
  const rest = small - need;
  return withIntro(
    [
      {
        text: `${big} needs ${need} to make 10, so split ${small} into ${need} + ${rest}`,
        why: `Start from the bigger number, ${big}. It is ${need} away from 10. Borrow those ${need} from the ${small}, which leaves ${rest}.`,
      },
      { text: `${big} + ${need} = 10`, value: 10, why: `Fill ${big} up to a clean 10.` },
      { text: `10 + ${rest} = ${a + b}`, value: a + b, why: `Adding onto 10 is easy: 10 and ${rest} is ${a + b}.` },
    ],
    'Make 10: numbers are easiest to add once you reach 10, so fill up to 10 first, then add what is left.',
  );
}

export function leftToRightAddSteps(a: number, b: number): Step[] {
  const parts = placeParts(b);
  const steps: Step[] = [];
  if (parts.length > 1) {
    steps.push({
      text: `Split ${b} into ${parts.join(' + ')}`,
      why: `Break ${b} into its place values — ${parts.map((p) => fmt(p)).join(', ')}. You will add one piece at a time, biggest first, so you are only ever changing one digit.`,
    });
  }
  let run = a;
  parts.forEach((p, i) => {
    let why = placeWhy(run, p);
    if (i === 0) why = `Start with ${fmt(a)}. ${why}`;
    if (i === parts.length - 1) why += ' Nothing left to add — that is the answer.';
    steps.push({ text: `${fmt(run)} + ${p} = ${fmt(run + p)}`, value: run + p, why });
    run += p;
  });
  return withIntro(
    steps,
    'Add left to right: start with the biggest place value and keep a running total in your head. You say the answer as you build it — nothing to carry, nothing to write down.',
  );
}

export function roundAdjustAddSteps(a: number, b: number): Step[] | null {
  // Round whichever number is just below a round number.
  const nb = nearRoundUp(b);
  const na = nb ? null : nearRoundUp(a);
  const near = nb ?? na;
  if (!near) return null;
  const keep = nb ? a : b;
  const rounded = nb ? b : a;
  const up = keep + near.round;
  return withIntro(
    [
      {
        text: `${rounded} is ${near.diff} less than ${near.round}, so add ${near.round} and take ${near.diff} back`,
        why: `${rounded} is just ${near.diff} short of ${near.round}. Adding a round number like ${near.round} is a single easy jump, so use that instead.`,
      },
      {
        text: `${fmt(keep)} + ${near.round} = ${fmt(up)}`,
        value: up,
        why: `Add the round number in one jump: ${fmt(keep)} + ${near.round} = ${fmt(up)}.`,
      },
      {
        text: `${fmt(up)} − ${near.diff} = ${fmt(a + b)}`,
        value: a + b,
        why: `You added ${near.diff} too many (${near.round} instead of ${rounded}), so take ${near.diff} back: ${fmt(a + b)}.`,
      },
    ],
    `Round and adjust: ${rounded} is almost ${near.round}, and adding ${near.round} is easy. Add the round number, then fix the small difference.`,
  );
}

/** A basic fact (1–10 + 1–10). Recall is the goal; make-10 is the memory aid when it crosses 10. */
export function factSteps(a: number, b: number): Step[] {
  const sum = a + b;
  const say: Step = {
    text: `So ${a} + ${b} = ${sum}`,
    value: sum,
    why: `Say it to yourself: "${words(a)} plus ${words(b)} is ${words(sum)}." Saying the whole fact is what makes it stick, so next time you just know it.`,
  };
  if (a < 10 && b < 10 && sum > 10) {
    return withIntro([...make10Steps(a, b), say], 'Goal: know this instantly. Until you do, rebuild it with make 10 — fill up to 10 first, then add the rest.');
  }
  let why: string;
  if (a === 10 || b === 10) {
    const other = a === 10 ? b : a;
    why = `Adding 10 just puts a 1 in front: 10 and ${other} is ${sum}. Say it: "${words(a)} plus ${words(b)} is ${words(sum)}."`;
  } else if (sum === 10) {
    why = `${a} and ${b} are a pair that makes 10 — learn these pairs by heart, they are used everywhere. Say it: "${words(a)} plus ${words(b)} is ten."`;
  } else if (Math.min(a, b) <= 3) {
    why = `Start at the bigger number, ${Math.max(a, b)}, and count up ${Math.min(a, b)}: ${Array.from({ length: Math.min(a, b) }, (_, i) => Math.max(a, b) + i + 1).join(', ')}. Say it: "${words(a)} plus ${words(b)} is ${words(sum)}."`;
  } else if (a === b) {
    why = `A double: ${a} + ${a} is ${sum}. Doubles are the easiest facts to remember. Say it: "${words(a)} plus ${words(b)} is ${words(sum)}."`;
  } else {
    why = `Say it to yourself: "${words(a)} plus ${words(b)} is ${words(sum)}." Saying the whole fact is what makes it stick.`;
  }
  return withIntro([{ text: `${a} + ${b} = ${sum}`, value: sum, why }], 'Goal: know this instantly, without working it out.');
}

/** Subtraction fact c − b: count up from b through 10 (the same move as 3-digit count-up). */
export function subFactSteps(c: number, b: number): Step[] {
  const d = c - b;
  const say = `Say it: "${words(c)} minus ${words(b)} is ${words(d)}." Saying the whole fact is what makes it stick.`;
  if (c > 10 && b < 10) {
    return withIntro(
      [
        { text: `Count up ${b} → 10: +${10 - b}`, value: 10 - b, why: `Subtraction is the distance between the numbers. Start at ${b} and hop up to 10 — that is ${10 - b}.` },
        { text: `10 → ${c}: +${c - 10}`, value: c - 10, why: `From 10 up to ${c} is ${c - 10} more.` },
        { text: `So ${c} − ${b} = ${d}`, value: d, why: `Add the two hops: ${10 - b} + ${c - 10} = ${d}. ${say}` },
      ],
      'Goal: know this instantly. Until you do, count up through 10 — the same move you use for big subtraction.',
    );
  }
  return withIntro(
    [
      { text: `Think addition: ${b} + ? = ${c}`, why: `Every subtraction fact is an addition fact backwards. What goes with ${b} to make ${c}?` },
      { text: `So ${c} − ${b} = ${d}`, value: d, why: `${b} + ${d} = ${c}, so ${c} − ${b} = ${d}. ${say}` },
    ],
    'Goal: know this instantly. Until you do, turn it into the addition fact you already know.',
  );
}

/** Which factor to treat as the multiplier: the one with the easiest anchor. */
const MUL_EASE = [10, 1, 2, 5, 9, 4, 3, 6, 8, 7];

/** Times-table fact a × b, rebuilt from anchors (×10, ×2, ×5) as a memory aid. */
export function mulFactSteps(a: number, b: number): Step[] {
  const m = MUL_EASE.find((x) => x === a || x === b)!;
  const n = m === a ? b : a;
  const p = a * b;
  const s = (text: string, why: string, value?: number): Step => ({ text, value, why });
  const out: Step[] = [];
  let idea = '';
  switch (m) {
    case 10:
      idea = '× 10 is the easiest anchor: every digit moves one place left.';
      out.push(s(`${n} × 10: put a zero on the end`, `${n} tens is ${p}. Multiplying by 10 just puts a 0 on the end.`, p));
      break;
    case 1:
      idea = 'One group of something is just that thing.';
      out.push(s(`Anything × 1 is itself`, `One group of ${n} is ${n}.`, p));
      break;
    case 2:
      idea = '× 2 means two groups — that is doubling.';
      out.push(s(`× 2 is double: double ${n}`, `Two groups of ${n}: ${n} + ${n} = ${p}.`, p));
      break;
    case 5:
      idea = '5 is half of 10. Do × 10 (easy), then cut it in half.';
      out.push(
        s(`${n} × 10 = ${n * 10}`, `Start with the easy anchor: ${n} × 10 = ${n * 10}.`, n * 10),
        s(`× 5 is half of that`, `5 is half of 10, so ${n} × 5 is half of ${n * 10}: ${p}.`, p),
      );
      break;
    case 9:
      idea = '9 is one less than 10. Do × 10, then take away one group.';
      out.push(
        s(`${n} × 10 = ${n * 10}`, `Start with the easy anchor: ${n} × 10 = ${n * 10}. That is one ${n} too many.`, n * 10),
        s(`× 9 is one ${n} less: ${n * 10} − ${n}`, `Take one ${n} away: ${n * 10} − ${n} = ${p}.`, p),
      );
      break;
    case 4:
      idea = '4 is 2 × 2: double, then double again.';
      out.push(s(`Double ${n} = ${n * 2}`, `Double ${n} once: ${n * 2}. That is × 2.`, n * 2), s(`Double again = ${n * 4}`, `Double again: ${n * 2} + ${n * 2} = ${p}. That is × 4.`, p));
      break;
    case 3:
      idea = '3 is 2 + 1: double it, then add one more group.';
      out.push(s(`Double ${n} = ${n * 2}`, `Two groups of ${n}: ${n * 2}.`, n * 2), s(`Plus one more ${n}: ${n * 2} + ${n}`, `Add the third group: ${n * 2} + ${n} = ${p}.`, p));
      break;
    case 6:
      idea = '6 is 5 + 1: do × 5 (half of × 10), then add one more group.';
      out.push(
        s(`${n} × 5 = ${n * 5}  (half of ${n * 10})`, `${n} × 10 = ${n * 10}, and half of that is ${n} × 5 = ${n * 5}.`, n * 5),
        s(`Plus one more ${n}: ${n * 5} + ${n}`, `Five groups plus one more group is six groups: ${n * 5} + ${n} = ${p}.`, p),
      );
      break;
    case 8:
      idea = '8 is 2 × 2 × 2: double three times.';
      out.push(
        s(`Double ${n} = ${n * 2}`, `Double once: ${n * 2} (that is × 2).`, n * 2),
        s(`Double again = ${n * 4}`, `Double again: ${n * 4} (that is × 4).`, n * 4),
        s(`Double again = ${n * 8}`, `Double a third time: ${p} (that is × 8).`, p),
      );
      break;
    case 7:
      idea = '7 is 5 + 2: do × 5 and × 2, then add them.';
      out.push(
        s(`${n} × 5 = ${n * 5}  (half of ${n * 10})`, `${n} × 10 = ${n * 10}, and half of that is ${n} × 5 = ${n * 5}.`, n * 5),
        s(`${n} × 2 = ${n * 2}`, `Two groups of ${n} is ${n} doubled: ${n * 2}.`, n * 2),
        s(`${n * 5} + ${n * 2}`, `Five groups plus two groups is seven groups: ${n * 5} + ${n * 2} = ${p}.`, p),
      );
      break;
  }
  out.push(s(`So ${a} × ${b} = ${p}`, `Say it to yourself: "${words(a)} times ${words(b)} is ${words(p)}." Saying the whole fact is what makes it stick, so next time you just know it.`, p));
  return withIntro(out, `Goal: know this instantly. Until you do, rebuild it from an easy anchor. ${idea}`);
}

/** The fast way for a + b. */
export function addSteps(a: number, b: number): Step[] {
  if (a < 10 && b < 10 && a + b > 10) return make10Steps(a, b);
  return roundAdjustAddSteps(a, b) ?? leftToRightAddSteps(a, b);
}

// ------------------------------------------------------------- subtraction

export function roundAdjustSubSteps(a: number, b: number): Step[] | null {
  const near = nearRoundUp(b);
  if (!near || near.round > a) return null;
  const down = a - near.round;
  return withIntro(
    [
      {
        text: `${b} is ${near.diff} less than ${near.round}, so take away ${near.round} and give ${near.diff} back`,
        why: `${b} is just ${near.diff} short of ${near.round}. Taking away a round number is one easy jump, so use that instead.`,
      },
      { text: `${fmt(a)} − ${fmt(near.round)} = ${fmt(down)}`, value: down, why: `Take away the round number in one jump: ${fmt(a)} − ${fmt(near.round)} = ${fmt(down)}.` },
      {
        text: `${fmt(down)} + ${near.diff} = ${fmt(a - b)}`,
        value: a - b,
        why: `You took away ${near.diff} too many (${near.round} instead of ${b}), so give ${near.diff} back: ${fmt(a - b)}.`,
      },
    ],
    `Round and adjust: ${b} is almost ${near.round}. Take away the round number, then fix the small difference.`,
  );
}

export function countUpSteps(a: number, b: number): Step[] {
  const ans = a - b;
  const intro =
    'Count up: subtraction is the distance between two numbers. Start at the smaller number and hop up to the bigger one through a round number. You only ever add, so there is no borrowing.';
  // Pick the round number to count up through: next hundred, else next ten.
  let mid: number | null = null;
  if (b % 100 !== 0 && Math.ceil(b / 100) * 100 <= a) mid = Math.ceil(b / 100) * 100;
  else if (b % 10 !== 0 && Math.ceil(b / 10) * 10 <= a) mid = Math.ceil(b / 10) * 10;
  if (mid === null && b % 10 !== 0) {
    // Same ten (e.g. 56 − 51): nothing to bridge, just count the small gap.
    return withIntro(
      [{ text: `Count up ${fmt(b)} → ${fmt(a)}: +${fmt(ans)}`, value: ans, why: `${fmt(b)} and ${fmt(a)} are close together, so just count up from ${fmt(b)} to ${fmt(a)}: that is ${fmt(ans)}.` }],
      intro,
    );
  }
  if (mid === null || b % 100 === 0) {
    // Nothing to bridge (e.g. 703 − 400): just take it away.
    return withIntro(
      [{ text: `${fmt(a)} − ${fmt(b)} = ${fmt(ans)}`, value: ans, why: `${fmt(b)} is a round number, so take it away in one jump: ${fmt(ans)}.` }],
      'When the number you take away is round, just take it away in one jump.',
    );
  }
  const gap1 = mid - b;
  const gap2 = a - mid;
  const unit = mid % 100 === 0 ? 100 : 10;
  const tail = b % unit;
  const hint = tail > 0 && gap1 >= 10 ? `  (${tail} + ${gap1} = ${unit})` : '';
  const hopWhy =
    `From ${fmt(b)}, hop up to the next round ${unit === 100 ? 'hundred' : 'ten'}, ${fmt(mid)}. How far is that? ` +
    (tail > 0 && gap1 >= 10 ? `${tail} needs ${gap1} to make ${unit} (the tens add to 9, the ones add to 10), so the hop is ${gap1}.` : `It is ${gap1}.`);
  if (gap2 === 0) return withIntro([{ text: `Count up ${fmt(b)} → ${fmt(a)}: +${gap1}${hint}`, value: ans, why: `${hopWhy} That lands exactly on ${fmt(a)}, so the answer is ${gap1}.` }], intro);
  return withIntro(
    [
      { text: `Count up ${fmt(b)} → ${fmt(mid)}: +${gap1}${hint}`, value: gap1, why: hopWhy },
      { text: `Then ${fmt(mid)} → ${fmt(a)}: +${fmt(gap2)}`, value: gap2, why: `From the round number ${fmt(mid)} up to ${fmt(a)} is an easy hop: ${fmt(gap2)}.` },
      { text: `Gap = ${gap1} + ${fmt(gap2)} = ${fmt(ans)}`, value: ans, why: `Add the two hops together: ${gap1} + ${fmt(gap2)} = ${fmt(ans)}. That total distance is the answer.` },
    ],
    intro,
  );
}

/** The fast way for a − b (a > b). */
export function subSteps(a: number, b: number): Step[] {
  return roundAdjustSubSteps(a, b) ?? countUpSteps(a, b);
}

// ------------------------------------------------------------- percentages

const PCT_INTRO =
  'Build the percent from anchors you can find instantly: 10% (move the decimal one place), 1% (two places), 5% (half of 10%), 50% (half), 25% (half of half).';

/** p% of b built from anchors. */
export function pctOfSteps(p: number, b: number, f: Fmt = fmt): Step[] {
  const v = (q: number) => clean((b * q) / 100);
  const s = (text: string, q: number, why: string): Step => ({ text, value: v(q), why });
  const B = f(b);
  const tenWhy = `10% means one tenth. Move the decimal point one place left: ${B} → ${f(v(10))}.`;
  const oneWhy = `1% means one hundredth. Move the decimal point two places left: ${B} → ${f(v(1))}.`;
  switch (p) {
    case 100:
      return withIntro([s(`100% is the whole thing: ${B}`, 100, `100% means all of it: ${B}.`)], PCT_INTRO);
    case 50:
      return withIntro([s(`50% = half of ${B} = ${f(v(50))}`, 50, `50% means half. Cut ${B} in half: ${f(v(50))}.`)], PCT_INTRO);
    case 25:
      return withIntro(
        [s(`50% = half of ${B} = ${f(v(50))}`, 50, `First find 50%, which is half of ${B}: ${f(v(50))}.`), s(`25% = half again = ${f(v(25))}`, 25, `25% is half of 50% (a quarter): half of ${f(v(50))} is ${f(v(25))}.`)],
        PCT_INTRO,
      );
    case 75:
      return withIntro(
        [
          s(`50% = half of ${B} = ${f(v(50))}`, 50, `First find 50%, which is half of ${B}: ${f(v(50))}.`),
          s(`25% = half again = ${f(v(25))}`, 25, `25% is half of that: ${f(v(25))}.`),
          s(`75% = 50% + 25% = ${f(v(50))} + ${f(v(25))} = ${f(v(75))}`, 75, `75% is 50% plus 25%, so add them: ${f(v(75))}.`),
        ],
        PCT_INTRO,
      );
    case 10:
      return withIntro([s(`10% of ${B}: move the decimal one place = ${f(v(10))}`, 10, tenWhy)], PCT_INTRO);
    case 1:
      return withIntro([s(`1% of ${B}: move the decimal two places = ${f(v(1))}`, 1, oneWhy)], PCT_INTRO);
  }
  const tens = Math.floor(p / 10);
  const ones = p % 10;
  const steps: Step[] = [];
  const ten = s(`10% of ${B} = ${f(v(10))}  (move the decimal)`, 10, tenWhy);
  const one = s(`1% of ${B} = ${f(v(1))}  (move the decimal two places)`, 1, oneWhy);

  if (ones === 9) {
    // 19% = 20% − 1%, 29% = 30% − 1% ...
    const up = tens + 1;
    steps.push(ten);
    if (up > 1) steps.push(s(`${up * 10}% = ${up} × ${f(v(10))} = ${f(v(up * 10))}`, up * 10, `${p}% is just under ${up * 10}%. ${up * 10}% is ${up} lots of 10%: ${up} × ${f(v(10))} = ${f(v(up * 10))}.`));
    steps.push(one);
    steps.push(s(`${p}% = ${up * 10}% − 1% = ${f(v(up * 10))} − ${f(v(1))} = ${f(v(p))}`, p, `${p}% is ${up * 10}% minus 1%, so take 1% away: ${f(v(up * 10))} − ${f(v(1))} = ${f(v(p))}.`));
    return withIntro(steps, PCT_INTRO);
  }

  if (tens > 0 || ones === 5) steps.push(ten);
  if (tens > 1) steps.push(s(`${tens * 10}% = ${tens} × ${f(v(10))} = ${f(v(tens * 10))}`, tens * 10, `${tens * 10}% is ${tens} lots of 10%: ${tens} × ${f(v(10))} = ${f(v(tens * 10))}.`));
  if (ones === 5) {
    steps.push(s(`5% = half of 10% = ${f(v(5))}`, 5, `5% is half of 10%: half of ${f(v(10))} is ${f(v(5))}.`));
  } else if (ones > 0) {
    steps.push(one);
    if (ones > 1) steps.push(s(`${ones}% = ${ones} × ${f(v(1))} = ${f(v(ones))}`, ones, `${ones}% is ${ones} lots of 1%: ${ones} × ${f(v(1))} = ${f(v(ones))}.`));
  }
  if (tens > 0 && ones > 0) {
    steps.push(
      s(`${p}% = ${tens * 10}% + ${ones}% = ${f(v(tens * 10))} + ${f(v(ones))} = ${f(v(p))}`, p, `${p}% is ${tens * 10}% plus ${ones}%, so add the two pieces: ${f(v(tens * 10))} + ${f(v(ones))} = ${f(v(p))}.`),
    );
  }
  return withIntro(steps, PCT_INTRO);
}

/** x% of y = y% of x — use when the swapped version is an anchor. */
export function swapSteps(p: number, b: number): Step[] {
  return withIntro(
    [
      {
        text: `Swap: ${p}% of ${b} = ${b}% of ${p}  (same answer, easier anchor)`,
        why: `${p}% of ${b} means ${p} × ${b} ÷ 100, and multiplication works in either order. So it equals ${b}% of ${p} — and ${b}% is an easy anchor.`,
      },
      ...pctOfSteps(b, p).map(({ intro: _intro, ...s }) => s),
    ],
    'The swap trick: x% of y is always the same as y% of x. Flip it when the other way round is an easy anchor.',
  );
}

/** Increase/decrease: find the amount, then add or subtract it. */
export function changeBySteps(base: number, p: number, up: boolean, f: Fmt = fmt): Step[] {
  const amt = clean((base * p) / 100);
  const res = clean(up ? base + amt : base - amt);
  return withIntro(
    [
      ...pctOfSteps(p, base, f),
      {
        text: `${up ? 'Add it on' : 'Take it off'}: ${f(base)} ${up ? '+' : '−'} ${f(amt)} = ${f(res)}`,
        value: res,
        why: up
          ? `An increase means the amount is added on top of what you started with: ${f(base)} + ${f(amt)} = ${f(res)}.`
          : `A decrease means the amount comes off what you started with: ${f(base)} − ${f(amt)} = ${f(res)}.`,
      },
    ],
    `Two moves: first find ${p}% of ${f(base)} using anchors (that is the amount of change), then ${up ? 'add it on' : 'take it off'}.`,
  );
}

/** Percent change from `from` to `to`, measured in 10% blocks of the starting value. */
export function percentChangeSteps(from: number, to: number): Step[] {
  const change = Math.abs(to - from);
  const ten = clean(from / 10);
  const blocks = clean(change / ten);
  const p = clean(blocks * 10);
  return withIntro(
    [
      { text: `Change = ${fmt(Math.max(from, to))} − ${fmt(Math.min(from, to))} = ${fmt(change)}`, value: change, why: `First, how much did it change? ${fmt(Math.max(from, to))} − ${fmt(Math.min(from, to))} = ${fmt(change)}.` },
      { text: `10% of the start (${fmt(from)}) = ${fmt(ten)}`, value: ten, why: `Percent change is always measured against where you started, ${fmt(from)}. 10% of it is ${fmt(ten)} — that is your measuring stick.` },
      {
        text: `${fmt(change)} ÷ ${fmt(ten)} = ${fmt(blocks)} blocks of 10%, so ${fmt(blocks)} × 10% = ${fmt(p)}%`,
        value: p,
        why: `How many ${fmt(ten)}s fit in ${fmt(change)}? ${fmt(blocks)}. Each one is 10%, so the change is ${fmt(blocks)} × 10% = ${fmt(p)}%.`,
      },
    ],
    'Find the change, then measure it in 10% blocks of the starting number.',
  );
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** Reverse percentage: the value after a p% change is `after`; find the original. */
export function reverseSteps(after: number, p: number, off: boolean, f: Fmt = fmt): Step[] {
  const P = off ? 100 - p : 100 + p;
  const u = gcd(P, 100);
  const parts = P / u;
  const unitVal = clean(after / parts);
  const orig = clean(unitVal * (100 / u));
  return withIntro(
    [
      {
        text: `After ${off ? `${p}% off` : `a ${p}% increase`}, ${f(after)} is ${P}% of the original`,
        why: off ? `Taking ${p}% off leaves 100% − ${p}% = ${P}% of the original price. So ${f(after)} is ${P}%.` : `Adding ${p}% makes it 100% + ${p}% = ${P}% of the original. So ${f(after)} is ${P}%.`,
      },
      { text: `${u}% = ${f(after)} ÷ ${parts} = ${f(unitVal)}`, value: unitVal, why: `${P}% is ${parts} chunks of ${u}%. Split ${f(after)} into ${parts} equal chunks: each ${u}% is ${f(unitVal)}.` },
      { text: `100% = ${100 / u} × ${f(unitVal)} = ${f(orig)}`, value: orig, why: `The original is 100%, which is ${100 / u} chunks of ${u}%: ${100 / u} × ${f(unitVal)} = ${f(orig)}.` },
    ],
    'Work backwards: figure out what percent of the original you are looking at, find what one chunk is worth, then build back up to 100%.',
  );
}
