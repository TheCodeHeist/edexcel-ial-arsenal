/* Practice: generated D1 questions with the working a mark scheme expects. Every answer comes from the same
   algorithms the steppers use, run on fresh random data. */
import { rng, ask, sum, type Rng } from './util';
import { bubbleSteps, quickSteps, binarySteps, pivotIndex, randomList } from './sorting';
import { binSteps, lowerBound, randomBinItems } from './bins';
import { randomGraph, randomInspectionGraph, kruskalSteps, primSteps, dijkstraSteps, routeInspection, distanceTable, nearestNeighbour, lowerBoundTSP, arcName, totalWeight, type Graph } from './graph';
import { PROJECTS, times, activityTable, criticalPaths, workersLowerBound } from './cpa';
import { LPS, optimum, integerOptimum, range, fmt } from './lp';

export type Topic = 'sort' | 'search' | 'bins' | 'mst' | 'dijkstra' | 'route' | 'tsp' | 'cpa' | 'lp';
export const TOPICS: [Topic | 'all', string][] = [
  ['all', 'Mixed'], ['sort', 'Bubble and quick sort'], ['search', 'Binary search'], ['bins', 'Bin packing'], ['mst', 'Minimum spanning trees'],
  ['dijkstra', 'Dijkstra'], ['route', 'Route inspection'], ['tsp', 'Travelling salesman'], ['cpa', 'Critical path'], ['lp', 'Linear programming'],
];
export const TOPIC_NAME = Object.fromEntries(TOPICS) as Record<Topic | 'all', string>;
export const SPEC: Record<Topic | 'all', string> = { all: 'D1', sort: 'D1.1', search: 'D1.1', bins: 'D1.1', mst: 'D1.2', dijkstra: 'D1.2', route: 'D1.3', tsp: 'D1.3', cpa: 'D1.4', lp: 'D1.5' };

export type Figure = { kind: 'graph'; g: Graph } | { kind: 'list'; items: (number | string)[] } | { kind: 'table'; head: string[]; rows: (string | number)[][] };
export interface Question { topic: Topic; prompt: string; options: string[]; answer: string; working: string[]; why: string; figure?: Figure }

const join = (xs: (number | string)[]) => xs.join('  ');

const GEN: Record<Topic, (r: Rng) => Question> = {
  sort(r) {
    const list = randomList(r.int(6, 8), r), order = r.pick(['asc', 'desc'] as const);
    if (r.next() < 0.5) {
      const { steps, passEnds } = bubbleSteps(list, order);
      const end = steps[passEnds[1]];
      const a = end.ask!;
      return { topic: 'sort', prompt: `Carry out the first pass of a bubble sort to put this list into ${order === 'asc' ? 'ascending' : 'descending'} order. What is the list after pass 1?`,
        options: a.options, answer: a.answer, figure: { kind: 'list', items: list },
        working: steps.slice(1, passEnds[1]).map((s) => s.say.replace('Pass 1: ', '')), why: 'Each pair is compared once, left to right; the swap happens before moving on, so a big item can travel all the way to the end in one pass.' };
    }
    const steps = quickSteps(list, order);
    const p = list[pivotIndex(list.length)];
    const a = steps[2].ask!;
    return { topic: 'sort', prompt: `Use a quick sort with the middle item as the pivot to put this list into ${order === 'asc' ? 'ascending' : 'descending'} order. What is the list after the first pass?`,
      options: a.options, answer: a.answer, figure: { kind: 'list', items: list },
      working: [`${list.length} items, so the pivot is item ${pivotIndex(list.length) + 1}: ${p}.`, `${order === 'asc' ? 'Smaller' : 'Larger'} items, in their original order: ${list.filter((v) => (order === 'asc' ? v < p : v > p)).join(' ') || 'none'}.`, `Then ${p}, then the rest: ${list.filter((v) => (order === 'asc' ? v > p : v < p)).join(' ') || 'none'}.`],
      why: 'The items either side of the pivot keep the order they had; they are not sorted yet.' };
  },
  search(r) {
    const list = [...randomList(r.int(9, 13), r)].sort((a, b) => a - b);
    const present = r.next() < 0.7, target = present ? r.pick(list) : (() => { let t; do t = r.int(list[0], list.at(-1)!); while (list.includes(t)); return t; })();
    const steps = binarySteps(list, target);
    const mids = steps.filter((s) => s.s.mid !== undefined).map((s) => list[s.s.mid!]);
    const ans = mids.join(', ');
    const floorMids = (() => { const out: number[] = []; let f = 0, l = list.length - 1; while (f <= l) { const m = Math.floor((f + l) / 2); out.push(list[m]); if (list[m] === target) break; if (target < list[m]) l = m - 1; else f = m + 1; } return out.join(', '); })();
    return { topic: 'search', prompt: `Use the binary search algorithm to search this ordered list for ${target}. Which items are compared with ${target}, in order?`,
      ...ask('', ans, [floorMids, mids.slice(0, -1).join(', ') || String(list[0]), [...mids].reverse().join(', '), mids.concat(list[0]).join(', ')], r), figure: { kind: 'list', items: list },
      working: steps.slice(1).map((s) => s.say), why: 'Edexcel takes the middle of first..last as ⌈(first + last) ÷ 2⌉. Rounding down picks different items, and loses the marks.' };
  },
  bins(r) {
    const { cap, items } = randomBinItems(r);
    const method = r.pick(['ff', 'ffd'] as const);
    const steps = binSteps(items, cap, method);
    const n = steps.at(-1)!.s.bins.length, lb = lowerBound(items, cap);
    if (r.next() < 0.35) return { topic: 'bins', prompt: `Bins of capacity ${cap}. Find a lower bound for the number of bins needed.`,
      ...ask('', String(lb), [String(Math.floor(sum(items) / cap)), String(lb + 1), String(items.length)], r), figure: { kind: 'list', items },
      working: [`Total = ${sum(items)}.`, `${sum(items)} ÷ ${cap} = ${(sum(items) / cap).toFixed(2)}, round up: ${lb}.`], why: 'Always round the lower bound UP: a fraction of a bin is still a bin.' };
    return { topic: 'bins', prompt: `Bins of capacity ${cap}. How many bins does ${method === 'ff' ? 'first-fit' : 'first-fit decreasing'} use?`,
      ...ask('', String(n), [String(n + 1), String(n - 1), String(lb === n ? n + 2 : lb)], r), figure: { kind: 'list', items },
      working: steps.at(-1)!.s.bins.map((b, k) => `Bin ${k + 1}: ${b.join(' ')}  (${sum(b)})`), why: method === 'ffd' ? 'Sort into decreasing order first, then each item goes in the first bin it fits.' : 'Items go in the order given, each in the first bin with room.' };
  },
  mst(r) {
    const g = randomGraph(r);
    const ks = kruskalSteps(g), tree = ks.at(-1)!.s.tree, w = totalWeight(tree);
    if (r.next() < 0.5) {
      const start = r.pick(g.v).id, ps = primSteps(g, start), order = ps.at(-1)!.s.tree.map(arcName).join(', ');
      const wrong = [ks.at(-1)!.s.tree.map(arcName).join(', '), [...ps.at(-1)!.s.tree].reverse().map(arcName).join(', '), ps.at(-1)!.s.tree.map(arcName).sort().join(', ')];
      return { topic: 'mst', prompt: `Use Prim's algorithm, starting at ${start}, to find a minimum spanning tree. In what order are the arcs added?`,
        ...ask('', order, wrong, r), figure: { kind: 'graph', g }, working: ps.slice(1, -1).map((s) => s.say), why: 'Prim always grows from the tree it has; Kruskal takes the globally shortest arc, so their orders usually differ even when the tree is the same.' };
    }
    return { topic: 'mst', prompt: 'Use Kruskal\'s algorithm to find a minimum spanning tree. What is its total weight?',
      ...ask('', String(w), [String(w + r.int(1, 4)), String(totalWeight(g.e.slice().sort((a, b) => a.w - b.w).slice(0, g.v.length - 1))), String(w - r.int(1, 3))], r),
      figure: { kind: 'graph', g }, working: ks.slice(1, -1).map((s) => s.say), why: 'The n − 1 shortest arcs often contain a cycle; Kruskal rejects those, so the answer is usually a bit more than their sum.' };
  },
  dijkstra(r) {
    const g = randomGraph(r);
    const from = g.v[0].id, to = g.v.at(-1)!.id;
    const st = dijkstraSteps(g, from, to), end = st.at(-1)!.s, d = end.box[to].final!;
    const direct = g.e.filter((e) => end.route?.includes(e.a) && end.route?.includes(e.b));
    return { topic: 'dijkstra', prompt: `Use Dijkstra's algorithm to find the shortest route from ${from} to ${to}. What is its length?`,
      ...ask('', String(d), [String(d + r.int(1, 5)), String(Math.max(...end.box[to].working)), String(totalWeight(direct) + 2)], r), figure: { kind: 'graph', g },
      working: st.slice(1).map((s) => s.say), why: 'A working value can be replaced by a smaller one later; only the final value counts.' };
  },
  route(r) {
    const g = randomInspectionGraph(r), res = routeInspection(g);
    const others = res.pairings.filter((p) => p !== res.best).map((p) => String(res.total + p.cost));
    return { topic: 'route', prompt: 'A route must travel along every arc at least once and return to its start. Find the length of the shortest such route.',
      ...ask('', String(res.length), [String(res.total), ...others, String(res.total + 2 * res.best.cost), String(res.length + r.int(2, 6))], r), figure: { kind: 'graph', g },
      working: [`Total of all arcs: ${res.total}.`, `Odd vertices: ${res.odd.join(', ')}.`, ...res.pairings.map((p) => `${p.pairs.map((x) => x.join('')).join(' + ')} = ${p.cost}`), `Least: ${res.best.cost}, so ${res.total} + ${res.best.cost} = ${res.length}.`],
      why: 'Every pairing of the odd vertices must be considered; the shortest single pair is not always part of the best pairing.' };
  },
  tsp(r) {
    const g = randomGraph(r, 3, 2), t = distanceTable(g), start = r.pick(t.ids);
    const nn = nearestNeighbour(t.ids, t.d, start);
    if (r.next() < 0.5) return { topic: 'tsp', prompt: `Using the table of shortest distances, apply the nearest neighbour algorithm from ${start}. What upper bound does it give?`,
      ...ask('', String(nn.length), [String(nn.length - nn.legs.at(-1)!), String(nn.length + r.int(2, 6)), String(sum(nn.legs.slice(0, -1)) * 2)], r),
      figure: { kind: 'table', head: ['', ...t.ids], rows: t.ids.map((a, i) => [a, ...t.d[i].map((v, j) => (i === j ? '–' : v))]) },
      working: [`Tour: ${nn.tour.join(' → ')}`, `${nn.legs.join(' + ')} = ${nn.length}`], why: 'Don\'t forget the final leg back to the start: the tour is a cycle.' };
    const lb = lowerBoundTSP(t.ids, t.d, start);
    return { topic: 'tsp', prompt: `By deleting ${start}, find a lower bound for the length of the optimal tour.`,
      ...ask('', String(lb.bound), [String(lb.mst), String(lb.mst + lb.two[0][1]), String(lb.bound + r.int(1, 4))], r),
      figure: { kind: 'table', head: ['', ...t.ids], rows: t.ids.map((a, i) => [a, ...t.d[i].map((v, j) => (i === j ? '–' : v))]) },
      working: [`MST of the remaining vertices: ${lb.arcs.map(([a, b, w]) => `${a}${b} (${w})`).join(', ')} = ${lb.mst}.`, `Two shortest arcs from ${start}: ${lb.two.map(([v, w]) => `${start}${v} (${w})`).join(', ')}.`, `${lb.mst} + ${lb.two[0][1]} + ${lb.two[1][1]} = ${lb.bound}.`],
      why: 'Residual MST + the two shortest arcs from the deleted vertex: the tour must use two arcs at that vertex, and the rest of it spans the others.' };
  },
  cpa(r) {
    const p = r.pick(PROJECTS), t = times(p), rows = activityTable(p, t);
    const kind = r.int(0, 2);
    if (kind === 0) return { topic: 'cpa', prompt: `${p.story} What is the minimum completion time of the project?`,
      ...ask('', String(t.T), [String(sum(p.acts.map((a) => a.d))), String(t.T - 2), String(Math.max(...t.early.slice(0, -1)) + 1)], r),
      figure: { kind: 'table', head: ['Activity', 'Event → event', 'Duration'], rows: p.acts.map((a) => [a.dummy ? 'dummy' : a.id, `${a.from} → ${a.to}`, a.d]) },
      working: [`Early event times: ${t.early.map((v, n) => `${n}: ${v}`).join(', ')}.`, `Critical path: ${criticalPaths(p, t).map((x) => x.join('')).join(', ')}.`], why: 'At a merge, the early event time is the LARGEST incoming total: every activity before it must be finished.' };
    if (kind === 1) {
      const nonCrit = rows.filter((x) => !x.critical), row = r.pick(nonCrit.length ? nonCrit : rows);
      return { topic: 'cpa', prompt: `${p.story} What is the total float on activity ${row.a.id}?`,
        ...ask('', String(row.float), [String(row.float + 1), String(t.late[row.a.from] - t.early[row.a.from]), String(Math.max(0, row.float - 1)), '0'], r),
        figure: { kind: 'table', head: ['Activity', 'Event → event', 'Duration'], rows: p.acts.map((a) => [a.dummy ? 'dummy' : a.id, `${a.from} → ${a.to}`, a.d]) },
        working: [`Early time at event ${row.a.from}: ${row.es}. Late time at event ${row.a.to}: ${row.lf}.`, `Float = ${row.lf} − ${row.a.d} − ${row.es} = ${row.float}.`], why: 'Total float uses the late time at the END event and the early time at the START event.' };
    }
    const lb = workersLowerBound(p, t);
    return { topic: 'cpa', prompt: `${p.story} Find a lower bound for the number of workers needed to finish in the minimum time.`,
      ...ask('', String(lb), [String(lb + 1), String(Math.floor(sum(p.acts.map((a) => a.d)) / t.T)), String(Math.max(1, lb - 1))], r),
      figure: { kind: 'table', head: ['Activity', 'Event → event', 'Duration'], rows: p.acts.map((a) => [a.dummy ? 'dummy' : a.id, `${a.from} → ${a.to}`, a.d]) },
      working: [`Sum of durations = ${sum(p.acts.map((a) => a.d))}; minimum completion time = ${t.T}.`, `⌈${sum(p.acts.map((a) => a.d))} ÷ ${t.T}⌉ = ${lb}.`], why: 'Round up: a fraction of a worker is still a whole worker.' };
  },
  lp(r) {
    const lp = r.pick(LPS), opt = optimum(lp)!, rg = range(lp);
    const sense = lp.obj.sense === 'max' ? 'maximum' : 'minimum';
    const others = opt.vs.filter((v) => v !== opt.best && (v[0] || v[1])).map((v) => fmt(lp.obj.p * v[0] + lp.obj.q * v[1]));
    if (lp.integer) {
      const io = integerOptimum(lp, rg.xmax, rg.ymax)!;
      const v = lp.obj.p * io[0] + lp.obj.q * io[1];
      return { topic: 'lp', prompt: `${lp.story}${/whole/.test(lp.story) ? '' : ' Only whole numbers make sense.'} What is the ${sense} value?`,
        ...ask('', fmt(v), [fmt(opt.value), ...others], r),
        working: [`Vertices: ${opt.vs.map((p) => `(${fmt(p[0])}, ${fmt(p[1])}) → ${fmt(lp.obj.p * p[0] + lp.obj.q * p[1])}`).join('; ')}.`, `Best whole-number point in R: (${io[0]}, ${io[1]}) → ${fmt(v)}.`],
        why: 'When the optimal vertex isn\'t whole, check the nearby whole-number points that are actually inside R.' };
    }
    return { topic: 'lp', prompt: `${lp.story} What is the ${sense} value?`, ...ask('', fmt(opt.value), others, r),
      working: opt.vs.map((p) => `(${fmt(p[0])}, ${fmt(p[1])}) → ${fmt(lp.obj.p * p[0] + lp.obj.q * p[1])}`), why: 'The optimum of a linear objective over R is always at a vertex: test them all (vertex method) or slide the objective line (ruler method).' };
  },
};

export function newQuestion(t: Topic | 'all', r = rng()): Question {
  const topic = t === 'all' ? r.pick(Object.keys(GEN) as Topic[]) : t;
  return GEN[topic](r);
}
