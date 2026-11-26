/* D1.1 Algorithms: bubble sort, quick sort and binary search, written the way Edexcel mark schemes want them.
   - Bubble sort: compare adjacent pairs left to right, swap if out of order; after pass k the last k items are fixed;
     stop after a pass with no swaps.
   - Quick sort: the pivot is the middle item, or the item right of the middle when a sublist has even length
     (position ⌈(n + 1)/2⌉). Items before the pivot keep their order. Ties go to the left of the pivot.
   - Binary search: the middle of first..last is ⌈(first + last)/2⌉ (Edexcel rounds up); discard that item and the
     half that can't hold the target. */
import { ask, rng, type Step } from './util';

export type Order = 'asc' | 'desc';
const before = (a: number, b: number, o: Order) => (o === 'asc' ? a <= b : a >= b);
const show = (xs: (number | string)[]) => xs.join('  ');

/* ---- bubble sort ---- */
export interface BubbleState { list: number[]; pass: number; i: number; fixed: number; swapped: boolean; cmp: number; swaps: number; done: boolean; compare?: [number, number]; justSwapped?: boolean }

/** Every comparison is a step; `endOfPass` marks the frames that close a pass, so the UI can step pass by pass. */
export function bubbleSteps(start: number[], order: Order): { steps: Step<BubbleState>[]; passEnds: number[] } {
  const list = [...start], n = list.length, r = rng(start.length * 31 + start[0]);
  const steps: Step<BubbleState>[] = [{ s: { list: [...list], pass: 0, i: -1, fixed: 0, swapped: false, cmp: 0, swaps: 0, done: false }, say: `Start: ${n} items to sort in ${order === 'asc' ? 'ascending' : 'descending'} order.` }];
  const passEnds: number[] = [0];
  let cmp = 0, swaps = 0;
  for (let pass = 1; pass < n; pass++) {
    let swapped = false;
    const passStart = [...list];
    for (let i = 0; i < n - pass; i++) {
      cmp++;
      const a = list[i], b = list[i + 1];
      const sw = !before(a, b, order);
      if (sw) { list[i] = b; list[i + 1] = a; swaps++; swapped = true; }
      steps.push({ s: { list: [...list], pass, i, fixed: pass - 1, swapped, cmp, swaps, done: false, compare: [i, i + 1], justSwapped: sw },
        say: `Pass ${pass}: compare ${a} and ${b}: ${sw ? 'swap them' : 'no swap'}.` });
    }
    // the pass-end frame carries the "what's the list now?" question
    const after = [...list];
    const naive = [...passStart].sort((x, y) => (order === 'asc' ? x - y : y - x));
    const oneSwap = [...passStart]; { const k = oneSwap.findIndex((v, j) => j < n - 1 && !before(v, oneSwap[j + 1], order)); if (k >= 0) [oneSwap[k], oneSwap[k + 1]] = [oneSwap[k + 1], oneSwap[k]]; }
    const wrongWay = (() => { const l = [...passStart]; for (let i = 0; i < n - pass; i++) if (before(l[i], l[i + 1], order) && l[i] !== l[i + 1]) [l[i], l[i + 1]] = [l[i + 1], l[i]]; return l; })();
    steps.push({ s: { list: after, pass, i: -1, fixed: pass, swapped, cmp, swaps, done: !swapped },
      say: swapped ? `End of pass ${pass}: ${show(after)}. The last ${pass} item${pass > 1 ? 's are' : ' is'} now in place.` : `End of pass ${pass}: no swaps in this pass, so the list is sorted.`,
      ask: ask(`What is the list at the end of pass ${pass}?`, show(after), [show(naive), show(oneSwap), show(wrongWay), show(passStart)], r) });
    passEnds.push(steps.length - 1);
    if (!swapped) break;
  }
  const last = steps.at(-1)!;
  if (!last.s.done) {
    last.s = { ...last.s, done: true };
    last.say += ' Every pass is done, so the list is sorted.';
  }
  return { steps, passEnds };
}

/* ---- quick sort ---- */
export interface Sub { items: number[]; pivot?: number; placed?: boolean }
export interface QuickState { pass: number; subs: Sub[]; done: boolean }

export const pivotIndex = (len: number) => Math.ceil((len + 1) / 2) - 1;

export function quickSteps(start: number[], order: Order): Step<QuickState>[] {
  const r = rng(start.length * 17 + start[0]);
  let subs: Sub[] = [{ items: [...start] }];
  const steps: Step<QuickState>[] = [{ s: { pass: 0, subs, done: false }, say: 'Start: the whole list is one sublist.' }];
  for (let pass = 1; pass < 40; pass++) {
    if (subs.every((s) => s.placed || s.items.length <= 1)) break;
    // choose pivots
    const withPivots = subs.map((s) => (s.placed || s.items.length <= 1 ? { ...s, placed: true } : { ...s, pivot: pivotIndex(s.items.length) }));
    const pivots = withPivots.filter((s) => s.pivot !== undefined).map((s) => s.items[s.pivot!]);
    const first = withPivots.find((s) => s.pivot !== undefined)!;
    steps.push({ s: { pass, subs: withPivots, done: false },
      say: `Pass ${pass}: choose the middle item of each sublist as its pivot: ${pivots.join(', ')}.`,
      ask: ask(`Which item is the pivot of the sublist ${first.items.join(' ')}?`, String(first.items[first.pivot!]),
        [String(first.items[Math.floor((first.items.length - 1) / 2)]), String(first.items[0]), String(first.items.at(-1)), String(first.items[Math.min(first.items.length - 1, first.pivot! + 1)])], r) });
    // split
    const next: Sub[] = [];
    for (const s of withPivots) {
      if (s.pivot === undefined) { next.push(s); continue; }
      const p = s.items[s.pivot];
      const rest = s.items.filter((_, i) => i !== s.pivot);
      const left = rest.filter((v) => before(v, p, order)), right = rest.filter((v) => !before(v, p, order));
      if (left.length) next.push({ items: left });
      next.push({ items: [p], placed: true });
      if (right.length) next.push({ items: right });
    }
    for (const s of next) if (s.items.length === 1) s.placed = true;
    subs = next;
    const flat = subs.flatMap((s) => s.items);
    // a common slip: the items on each side written in sorted order instead of keeping their order
    const tidied = subs.flatMap((s) => [...s.items].sort((a, b) => (order === 'asc' ? a - b : b - a)));
    steps.push({ s: { pass, subs, done: subs.every((s) => s.placed) },
      say: `Pass ${pass}: items ${order === 'asc' ? 'smaller' : 'larger'} than a pivot go before it, keeping their order; the rest go after. List: ${show(flat)}.`,
      ask: ask(`What is the list after pass ${pass}?`, show(flat),
        [show(tidied), show(withPivots.flatMap((s) => s.items)), show([...flat].reverse()), show([...flat].sort((a, b) => (order === 'asc' ? a - b : b - a)))], r) });
  }
  const last = steps.at(-1)!;
  last.s = { ...last.s, done: true, subs: last.s.subs.map((s) => ({ ...s, placed: true })) };
  last.say += ' Every item is now a pivot or alone in its sublist, so the list is sorted.';
  return steps;
}

/* ---- binary search ---- */
export interface BinState { first: number; last: number; mid?: number; found?: number; gone: boolean[]; done: boolean; result?: 'found' | 'absent' }

export function binarySteps(list: (number | string)[], target: number | string): Step<BinState>[] {
  const r = rng(list.length * 7 + 3);
  const n = list.length;
  let first = 0, last = n - 1;
  const gone = list.map(() => false);
  const steps: Step<BinState>[] = [{ s: { first, last, gone: [...gone], done: false }, say: `Search the ordered list for ${target}. first = 1, last = ${n}.` }];
  const cmp = (a: number | string, b: number | string) => (typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b)));
  while (first <= last) {
    const mid = Math.ceil((first + last) / 2);
    const v = list[mid], c = cmp(target, v);
    const pos = `⌈(${first + 1} + ${last + 1}) / 2⌉ = ${mid + 1}`;
    const qa = ask(`Which position is the middle item, with first = ${first + 1} and last = ${last + 1}?`, String(mid + 1),
      [String(Math.floor((first + last) / 2) + 1), String(mid), String(mid + 2)].filter((x) => +x >= 1 && +x <= n), r);
    if (c === 0) {
      steps.push({ s: { first, last, mid, found: mid, gone: [...gone], done: true, result: 'found' }, say: `Middle: ${pos}, item ${v}. It's the target, so the search ends: ${target} is found at position ${mid + 1}.`, ask: qa });
      return steps;
    }
    if (c < 0) { for (let i = mid; i <= last; i++) gone[i] = true; steps.push({ s: { first, last, mid, gone: [...gone], done: false }, say: `Middle: ${pos}, item ${v}. ${target} comes before ${v}, so discard ${v} and everything after it. New last = ${mid}.`, ask: qa }); last = mid - 1; }
    else { for (let i = first; i <= mid; i++) gone[i] = true; steps.push({ s: { first, last, mid, gone: [...gone], done: false }, say: `Middle: ${pos}, item ${v}. ${target} comes after ${v}, so discard ${v} and everything before it. New first = ${mid + 2}.`, ask: qa }); first = mid + 1; }
  }
  steps.push({ s: { first, last, gone: [...gone], done: true, result: 'absent' }, say: `The list is used up (first > last), so ${target} is not in the list.` });
  return steps;
}

export const randomList = (n: number, r = rng(), lo = 5, hi = 99) => {
  const s = new Set<number>(); while (s.size < n) s.add(r.int(lo, hi)); return r.shuffle([...s]);
};
