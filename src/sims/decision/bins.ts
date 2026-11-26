/* D1.1 Bin packing: first-fit, first-fit decreasing and full-bin, plus the lower bound ⌈total ÷ capacity⌉. */
import { ask, rng, sum, type Step } from './util';

export type BinMethod = 'ff' | 'ffd' | 'full';
export interface BinState { bins: number[][]; queue: number[]; current?: number; into?: number; note?: 'full' | 'rest' }

export const lowerBound = (items: number[], cap: number) => Math.ceil(sum(items) / cap);

/** Subsets that exactly fill a bin, found greedily from the largest items (how students do full-bin by inspection). */
function fullBins(items: number[], cap: number): { full: number[][]; rest: number[] } {
  let left = [...items];
  const full: number[][] = [];
  for (;;) {
    const sorted = [...left].sort((a, b) => b - a);
    let found: number[] | null = null;
    const dfs = (i: number, acc: number[], total: number) => {
      if (found) return;
      if (total === cap) { found = [...acc]; return; }
      for (let j = i; j < sorted.length; j++) {
        if (total + sorted[j] > cap) continue;
        if (j > i && sorted[j] === sorted[j - 1]) continue;
        acc.push(sorted[j]); dfs(j + 1, acc, total + sorted[j]); acc.pop();
        if (found) return;
      }
    };
    dfs(0, [], 0);
    if (!found) break;
    full.push(found);
    const rest = [...left];
    for (const v of found as number[]) rest.splice(rest.indexOf(v), 1);
    left = rest;
  }
  return { full, rest: left };
}

export function binSteps(items: number[], cap: number, method: BinMethod): Step<BinState>[] {
  const r = rng(items.length * 13 + cap);
  const bins: number[][] = [];
  const steps: Step<BinState>[] = [];
  let queue = method === 'ffd' ? [...items].sort((a, b) => b - a) : [...items];
  const snap = (extra: Partial<BinState> = {}): BinState => ({ bins: bins.map((b) => [...b]), queue: [...queue], ...extra });

  if (method === 'ffd') steps.push({ s: snap(), say: `First-fit decreasing: sort the items into decreasing order first: ${queue.join(', ')}.` });
  else if (method === 'ff') steps.push({ s: snap(), say: 'First-fit: take the items in the order given; each goes into the first bin with enough room.' });

  if (method === 'full') {
    const { full, rest } = fullBins(items, cap);
    steps.push({ s: snap(), say: `Full-bin: look for combinations of items that fill a bin of ${cap} exactly.` });
    for (const combo of full) {
      bins.push([...combo]);
      for (const v of combo) queue.splice(queue.indexOf(v), 1);
      steps.push({ s: snap({ into: bins.length - 1, note: 'full' }), say: `Bin ${bins.length}: ${combo.join(' + ')} = ${cap}, a full bin.` });
    }
    if (!full.length) steps.push({ s: snap(), say: 'No combination fills a bin exactly, so this is just first-fit.' });
    queue = [...rest];
    if (rest.length) steps.push({ s: snap({ note: 'rest' }), say: `The remaining items ${rest.join(', ')} go in by first-fit.` });
  }

  while (queue.length) {
    const v = queue.shift()!;
    let k = bins.findIndex((b) => sum(b) + v <= cap);
    const newBin = k < 0;
    if (newBin) { bins.push([]); k = bins.length - 1; }
    // the question is asked before the item is placed, against the bins as they stood
    const room = bins.map((b) => cap - sum(b));
    const best = room.reduce((bi, rm, i) => (rm >= v && (bi < 0 || rm < room[bi]) ? i : bi), -1);
    const label = (i: number) => `Bin ${i + 1}`;
    const qa = ask(`Item ${v}: which bin does it go into?`, label(k), [best >= 0 ? label(best) : '', label(bins.length - 1 === k && bins.length > 1 ? k - 1 : bins.length), label(Math.max(0, k - 1)), label(k + 1)], r);
    bins[k].push(v);
    steps.push({ s: snap({ current: v, into: k }),
      say: newBin ? `${v} doesn't fit in any open bin, so it starts bin ${k + 1}.` : `${v} goes into bin ${k + 1}, the first with room (${room[k]} left before it).`,
      ask: qa });
  }
  const lb = lowerBound(items, cap);
  steps.push({ s: snap(), say: `Done: ${bins.length} bins. Lower bound ⌈${sum(items)} ÷ ${cap}⌉ = ${lb}${bins.length === lb ? ', so this packing is optimal.' : `, so this packing might not be optimal.`}` });
  return steps;
}

export function randomBinItems(r = rng()) {
  const cap = r.pick([10, 12, 15, 20, 25, 30]);
  const n = r.int(8, 12);
  const items = Array.from({ length: n }, () => r.int(Math.max(1, Math.round(cap * 0.12)), Math.round(cap * 0.7)));
  return { cap, items };
}
