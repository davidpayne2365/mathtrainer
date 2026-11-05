/**
 * Step-by-step "fast way" explanations. Every function returns a Step[] whose
 * last step carries the final answer in `value`.
 *
 * The taught methods (never column arithmetic):
 *  - Addition: left to right, biggest place value first, running total.
 *    Round-and-adjust when a number is 1–3 below a round number.
 *  - Subtraction: count up from the smaller number through a round number.
 *    Round-and-adjust when the number taken away is 1–3 below a round number.
 *  - Percentages: build from anchors 10%, 5%, 1%, 50%, 25%.
 */
import type { Step } from './types';
import { clean, fmt } from './util';

type Fmt = (n: number) => string;

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

// ---------------------------------------------------------------- addition

export function make10Steps(a: number, b: number): Step[] {
  const big = Math.max(a, b);
  const small = Math.min(a, b);
  const need = 10 - big;
  const rest = small - need;
  return [
    { text: `${big} needs ${need} to make 10, so split ${small} into ${need} + ${rest}` },
    { text: `${big} + ${need} = 10`, value: 10 },
    { text: `10 + ${rest} = ${a + b}`, value: a + b },
  ];
}

export function leftToRightAddSteps(a: number, b: number): Step[] {
  const parts = placeParts(b);
  const steps: Step[] = [];
  if (parts.length > 1) steps.push({ text: `Split ${b} into ${parts.join(' + ')}` });
  let run = a;
  for (const p of parts) {
    steps.push({ text: `${fmt(run)} + ${p} = ${fmt(run + p)}`, value: run + p });
    run += p;
  }
  return steps;
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
  return [
    { text: `${rounded} is ${near.diff} less than ${near.round}, so add ${near.round} and take ${near.diff} back` },
    { text: `${fmt(keep)} + ${near.round} = ${fmt(up)}`, value: up },
    { text: `${fmt(up)} − ${near.diff} = ${fmt(a + b)}`, value: a + b },
  ];
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
  return [
    { text: `${b} is ${near.diff} less than ${near.round}, so take away ${near.round} and give ${near.diff} back` },
    { text: `${fmt(a)} − ${fmt(near.round)} = ${fmt(down)}`, value: down },
    { text: `${fmt(down)} + ${near.diff} = ${fmt(a - b)}`, value: a - b },
  ];
}

export function countUpSteps(a: number, b: number): Step[] {
  const ans = a - b;
  // Pick the round number to count up through: next hundred, else next ten.
  let mid: number | null = null;
  if (b % 100 !== 0 && Math.ceil(b / 100) * 100 <= a) mid = Math.ceil(b / 100) * 100;
  else if (b % 10 !== 0 && Math.ceil(b / 10) * 10 <= a) mid = Math.ceil(b / 10) * 10;
  if (mid === null || b % 100 === 0) {
    // Nothing to bridge (e.g. 703 − 400): just take it away.
    return [{ text: `${fmt(a)} − ${fmt(b)} = ${fmt(ans)}`, value: ans }];
  }
  const gap1 = mid - b;
  const gap2 = a - mid;
  const unit = mid % 100 === 0 ? 100 : 10;
  const tail = b % unit;
  const hint = tail > 0 && gap1 >= 10 ? `  (${tail} + ${gap1} = ${unit})` : '';
  const steps: Step[] = [{ text: `Count up ${fmt(b)} → ${fmt(mid)}: +${gap1}${hint}`, value: gap1 }];
  if (gap2 === 0) return [{ text: `Count up ${fmt(b)} → ${fmt(a)}: +${gap1}${hint}`, value: ans }];
  steps.push({ text: `Then ${fmt(mid)} → ${fmt(a)}: +${fmt(gap2)}`, value: gap2 });
  steps.push({ text: `Gap = ${gap1} + ${fmt(gap2)} = ${fmt(ans)}`, value: ans });
  return steps;
}

/** The fast way for a − b (a > b). */
export function subSteps(a: number, b: number): Step[] {
  return roundAdjustSubSteps(a, b) ?? countUpSteps(a, b);
}

// ------------------------------------------------------------- percentages

/** p% of b built from anchors. */
export function pctOfSteps(p: number, b: number, f: Fmt = fmt): Step[] {
  const v = (q: number) => clean((b * q) / 100);
  const s = (text: string, q: number): Step => ({ text, value: v(q) });
  const B = f(b);
  switch (p) {
    case 100:
      return [s(`100% is the whole thing: ${B}`, 100)];
    case 50:
      return [s(`50% = half of ${B} = ${f(v(50))}`, 50)];
    case 25:
      return [s(`50% = half of ${B} = ${f(v(50))}`, 50), s(`25% = half again = ${f(v(25))}`, 25)];
    case 75:
      return [
        s(`50% = half of ${B} = ${f(v(50))}`, 50),
        s(`25% = half again = ${f(v(25))}`, 25),
        s(`75% = 50% + 25% = ${f(v(50))} + ${f(v(25))} = ${f(v(75))}`, 75),
      ];
    case 10:
      return [s(`10% of ${B}: move the decimal one place = ${f(v(10))}`, 10)];
    case 1:
      return [s(`1% of ${B}: move the decimal two places = ${f(v(1))}`, 1)];
  }
  const tens = Math.floor(p / 10);
  const ones = p % 10;
  const steps: Step[] = [];
  const ten = s(`10% of ${B} = ${f(v(10))}  (move the decimal)`, 10);
  const one = s(`1% of ${B} = ${f(v(1))}  (move the decimal two places)`, 1);

  if (ones === 9) {
    // 19% = 20% − 1%, 29% = 30% − 1% ...
    const up = tens + 1;
    steps.push(ten);
    if (up > 1) steps.push(s(`${up * 10}% = ${up} × ${f(v(10))} = ${f(v(up * 10))}`, up * 10));
    steps.push(one);
    steps.push(s(`${p}% = ${up * 10}% − 1% = ${f(v(up * 10))} − ${f(v(1))} = ${f(v(p))}`, p));
    return steps;
  }

  if (tens > 0 || ones === 5) steps.push(ten);
  if (tens > 1) steps.push(s(`${tens * 10}% = ${tens} × ${f(v(10))} = ${f(v(tens * 10))}`, tens * 10));
  if (ones === 5) {
    steps.push(s(`5% = half of 10% = ${f(v(5))}`, 5));
  } else if (ones > 0) {
    steps.push(one);
    if (ones > 1) steps.push(s(`${ones}% = ${ones} × ${f(v(1))} = ${f(v(ones))}`, ones));
  }
  if (tens > 0 && ones > 0) {
    steps.push(s(`${p}% = ${tens * 10}% + ${ones}% = ${f(v(tens * 10))} + ${f(v(ones))} = ${f(v(p))}`, p));
  }
  return steps;
}

/** x% of y = y% of x — use when the swapped version is an anchor. */
export function swapSteps(p: number, b: number): Step[] {
  return [{ text: `Swap: ${p}% of ${b} = ${b}% of ${p}  (same answer, easier anchor)` }, ...pctOfSteps(b, p)];
}

/** Increase/decrease: find the amount, then add or subtract it. */
export function changeBySteps(base: number, p: number, up: boolean, f: Fmt = fmt): Step[] {
  const amt = clean((base * p) / 100);
  const res = clean(up ? base + amt : base - amt);
  return [
    ...pctOfSteps(p, base, f),
    { text: `${up ? 'Add it on' : 'Take it off'}: ${f(base)} ${up ? '+' : '−'} ${f(amt)} = ${f(res)}`, value: res },
  ];
}

/** Percent change from `from` to `to`, measured in 10% blocks of the starting value. */
export function percentChangeSteps(from: number, to: number): Step[] {
  const change = Math.abs(to - from);
  const ten = clean(from / 10);
  const blocks = clean(change / ten);
  const p = clean(blocks * 10);
  return [
    { text: `Change = ${fmt(Math.max(from, to))} − ${fmt(Math.min(from, to))} = ${fmt(change)}`, value: change },
    { text: `10% of the start (${fmt(from)}) = ${fmt(ten)}`, value: ten },
    { text: `${fmt(change)} ÷ ${fmt(ten)} = ${fmt(blocks)} blocks of 10%, so ${fmt(blocks)} × 10% = ${fmt(p)}%`, value: p },
  ];
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
  return [
    { text: `After ${off ? `${p}% off` : `a ${p}% increase`}, ${f(after)} is ${P}% of the original` },
    { text: `${u}% = ${f(after)} ÷ ${parts} = ${f(unitVal)}`, value: unitVal },
    { text: `100% = ${100 / u} × ${f(unitVal)} = ${f(orig)}`, value: orig },
  ];
}
