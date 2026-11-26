/* D1.2–D1.3 Algorithms on graphs. Networks are undirected and weighted; vertices carry a drawing position in a
   100 × 60 box. Ties are broken alphabetically (arc AB before AC), which is how mark schemes list them. */
import { ask, LETTERS, rng, sum, type Rng, type Step } from './util';

export interface V { id: string; x: number; y: number }
export interface E { a: string; b: string; w: number }
export interface Graph { v: V[]; e: E[] }

export const arcName = (e: E) => [e.a, e.b].sort().join('');
const byWeight = (x: E, y: E) => x.w - y.w || arcName(x).localeCompare(arcName(y));
export const totalWeight = (es: E[]) => sum(es.map((e) => e.w));
export const other = (e: E, v: string) => (e.a === v ? e.b : e.a);
export const degree = (g: Graph, v: string) => g.e.filter((e) => e.a === v || e.b === v).length;

/* ---- preset and random networks ---- */
const P = (s: string) => s.split(' ').map((t) => { const [id, x, y] = t.split(','); return { id, x: +x, y: +y }; });
const A = (s: string) => s.split(' ').map((t) => ({ a: t[0], b: t[1], w: +t.slice(2) }));

export const PRESETS: Record<string, { name: string; g: Graph }> = {
  town: { name: 'Seven towns', g: { v: P('A,6,30 B,28,8 C,28,52 D,50,30 E,72,8 F,72,52 G,94,30'),
    e: A('AB12 AC14 AD17 BC15 BD9 BE21 CD11 CF19 DE10 DF13 DG22 EG8 FG9') } },
  park: { name: 'Park paths', g: { v: P('A,6,8 B,36,4 C,68,8 D,94,20 E,10,52 F,40,34 G,64,52 H,92,52'),
    e: A('AB7 AE9 AF6 BC8 BF5 CD6 CF7 CG9 DG8 DH5 EF8 FG4 GH6') } },
  ring: { name: 'Ring road', g: { v: P('A,50,4 B,88,18 C,88,46 D,50,58 E,12,46 F,12,18 G,50,30'),
    e: A('AB10 BC12 CD9 DE11 EF13 AF8 AG7 CG6 DG8 FG12') } },
};

/** A random planar network: a jittered grid, its grid edges, and at most one diagonal per cell. */
export function randomGraph(r: Rng = rng(), cols = r.int(3, 4), rows = 2 + (cols === 3 ? 1 : r.int(0, 1))): Graph {
  const v: V[] = [];
  const at = (c: number, rr: number) => LETTERS[rr * cols + c];
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++)
    v.push({ id: at(c, rr), x: 6 + (88 * c) / (cols - 1) + r.int(-5, 5), y: 6 + (48 * rr) / (rows - 1) + r.int(-4, 4) });
  const e: E[] = [];
  const w = () => r.int(3, 25);
  for (let rr = 0; rr < rows; rr++) for (let c = 0; c < cols; c++) {
    if (c < cols - 1 && r.next() < 0.88) e.push({ a: at(c, rr), b: at(c + 1, rr), w: w() });
    if (rr < rows - 1 && r.next() < 0.88) e.push({ a: at(c, rr), b: at(c, rr + 1), w: w() });
    if (c < cols - 1 && rr < rows - 1 && r.next() < 0.55) e.push(r.next() < 0.5 ? { a: at(c, rr), b: at(c + 1, rr + 1), w: w() } : { a: at(c + 1, rr), b: at(c, rr + 1), w: w() });
  }
  const g = { v, e: e.map((x) => (x.a < x.b ? x : { a: x.b, b: x.a, w: x.w })) };
  return connected(g) ? g : randomGraph(r, cols, rows);
}

export function connected(g: Graph) {
  const seen = new Set([g.v[0].id]), stack = [g.v[0].id];
  while (stack.length) { const u = stack.pop()!; for (const e of g.e) if (e.a === u || e.b === u) { const o = other(e, u); if (!seen.has(o)) { seen.add(o); stack.push(o); } } }
  return seen.size === g.v.length;
}

/** For route inspection: a random network with exactly 2 or 4 odd vertices (the spec allows up to four). */
export function randomInspectionGraph(r: Rng = rng()): Graph {
  for (let k = 0; k < 400; k++) {
    const g = randomGraph(r);
    const odd = g.v.filter((x) => degree(g, x.id) % 2).length;
    if (odd === 2 || odd === 4) return g;
  }
  return PRESETS.town.g;
}

/* ---- shortest paths (Floyd), used by route inspection and the TSP table ---- */
export function allPairs(g: Graph) {
  const ids = g.v.map((x) => x.id), n = ids.length, ix = new Map(ids.map((id, i) => [id, i]));
  const d = ids.map((_, i) => ids.map((_, j) => (i === j ? 0 : Infinity)));
  const via = ids.map(() => ids.map(() => -1));
  for (const e of g.e) { const i = ix.get(e.a)!, j = ix.get(e.b)!; if (e.w < d[i][j]) { d[i][j] = d[j][i] = e.w; } }
  for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) for (let j = 0; j < n; j++)
    if (d[i][k] + d[k][j] < d[i][j]) { d[i][j] = d[i][k] + d[k][j]; via[i][j] = k; }
  const path = (a: string, b: string): string[] => {
    const rec = (i: number, j: number): number[] => { const k = via[i][j]; return k < 0 ? [] : [...rec(i, k), k, ...rec(k, j)]; };
    const i = ix.get(a)!, j = ix.get(b)!;
    return [a, ...rec(i, j).map((k) => ids[k]), b];
  };
  return { ids, dist: (a: string, b: string) => d[ix.get(a)!][ix.get(b)!], path };
}

/* ---- minimum spanning trees ---- */
export interface TreeState { tree: E[]; rejected: E[]; considering?: E; inTree: string[]; done: boolean; order?: E[] }

export function kruskalSteps(g: Graph): Step<TreeState>[] {
  const r = rng(g.e.length * 101);
  const order = [...g.e].sort(byWeight);
  const parent = new Map(g.v.map((x) => [x.id, x.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : find(parent.get(x)!));
  const tree: E[] = [], rejected: E[] = [];
  const steps: Step<TreeState>[] = [{ s: { tree: [], rejected: [], inTree: [], done: false, order },
    say: `Kruskal: list the arcs in order of weight: ${order.map((e) => `${arcName(e)}(${e.w})`).join(', ')}.` }];
  for (const e of order) {
    if (tree.length === g.v.length - 1) break;
    const remaining = order.filter((x) => !tree.includes(x) && !rejected.includes(x));
    const ra = find(e.a), rb = find(e.b), ok = ra !== rb;
    const qa = ask(`What does Kruskal do next?`, ok ? `Add ${arcName(e)}` : `Reject ${arcName(e)}`,
      [ok ? `Reject ${arcName(e)}` : `Add ${arcName(e)}`, ...remaining.filter((x) => x !== e).slice(0, 3).map((x) => `Add ${arcName(x)}`)], r);
    if (ok) { parent.set(ra, rb); tree.push(e); } else rejected.push(e);
    const inTree = [...new Set(tree.flatMap((x) => [x.a, x.b]))];
    steps.push({ s: { tree: [...tree], rejected: [...rejected], considering: e, inTree, done: false, order },
      say: ok ? `${arcName(e)} (${e.w}): add it.` : `${arcName(e)} (${e.w}): reject it, it would make a cycle.`, ask: qa });
  }
  steps.push({ s: { tree: [...tree], rejected: [...rejected], inTree: g.v.map((x) => x.id), done: true, order },
    say: `Done: ${tree.length} arcs join all ${g.v.length} vertices. Weight of the minimum spanning tree = ${totalWeight(tree)}.` });
  return steps;
}

export function primSteps(g: Graph, start: string): Step<TreeState>[] {
  const r = rng(g.e.length * 103 + start.charCodeAt(0));
  const inT = new Set([start]), tree: E[] = [];
  const steps: Step<TreeState>[] = [{ s: { tree: [], rejected: [], inTree: [start], done: false }, say: `Prim: start at ${start}.` }];
  while (inT.size < g.v.length) {
    const cands = g.e.filter((e) => inT.has(e.a) !== inT.has(e.b)).sort(byWeight);
    const e = cands[0];
    const nearCycle = g.e.filter((x) => inT.has(x.a) && inT.has(x.b) && !tree.includes(x)).sort(byWeight)[0];
    const qa = ask('Which arc does Prim add next?', arcName(e), [...cands.slice(1, 3).map(arcName), nearCycle ? arcName(nearCycle) : '',
      ...g.e.filter((x) => !inT.has(x.a) && !inT.has(x.b)).sort(byWeight).slice(0, 2).map(arcName)], r);
    tree.push(e);
    const nv = inT.has(e.a) ? e.b : e.a; inT.add(nv);
    steps.push({ s: { tree: [...tree], rejected: [], considering: e, inTree: [...inT], done: false },
      say: `The shortest arc from the tree to a new vertex is ${arcName(e)} (${e.w}). Add it, bringing in ${nv}.`, ask: qa });
  }
  steps.push({ s: { tree: [...tree], rejected: [], inTree: [...inT], done: true },
    say: `Done: order of arcs ${tree.map(arcName).join(', ')}. Weight = ${totalWeight(tree)}.` });
  return steps;
}

/** Prim on a distance matrix: rows deleted, columns numbered, the circled entry each time. */
export interface MatrixState { ids: string[]; m: (number | null)[][]; deleted: string[]; numbered: string[]; circled: [string, string][]; last?: [string, string]; done: boolean }

export function matrixOf(g: Graph) {
  const ids = g.v.map((x) => x.id);
  const m = ids.map((a) => ids.map((b) => { if (a === b) return null; const e = g.e.find((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)); return e ? e.w : null; }));
  return { ids, m };
}

export function primMatrixSteps(g: Graph, start: string): Step<MatrixState>[] {
  const { ids, m } = matrixOf(g);
  const numbered = [start], deleted = [start], circled: [string, string][] = [];
  const steps: Step<MatrixState>[] = [{ s: { ids, m, deleted: [...deleted], numbered: [...numbered], circled: [], done: false },
    say: `Start at ${start}: number column ${start} "1" and delete row ${start}.` }];
  const r = rng(ids.length * 7);
  while (numbered.length < ids.length) {
    let best: [string, string, number] | null = null;
    for (const c of numbered) for (const rId of ids) {
      if (deleted.includes(rId)) continue;
      const w = m[ids.indexOf(rId)][ids.indexOf(c)];
      if (w !== null && (!best || w < best[2] || (w === best[2] && (c + rId) < (best[0] + best[1])))) best = [c, rId, w];
    }
    if (!best) break;
    const [c, rowId, w] = best;
    const wrong = numbered.flatMap((cc) => ids.filter((x) => !deleted.includes(x) && m[ids.indexOf(x)][ids.indexOf(cc)] !== null).map((x) => `${x} (${m[ids.indexOf(x)][ids.indexOf(cc)]})`));
    const qa = ask(`Looking down the numbered columns, which undeleted entry is circled next?`, `${rowId} (${w})`, r.shuffle(wrong.filter((x) => x !== `${rowId} (${w})`)), r);
    circled.push([rowId, c]); numbered.push(rowId); deleted.push(rowId);
    steps.push({ s: { ids, m, deleted: [...deleted], numbered: [...numbered], circled: [...circled], last: [rowId, c], done: false },
      say: `Smallest undeleted entry in the numbered columns: ${w}, in column ${c}, row ${rowId}. Circle it (arc ${[c, rowId].sort().join('')}), number column ${rowId} "${numbered.length}" and delete row ${rowId}.`, ask: qa });
  }
  steps.push({ s: { ids, m, deleted, numbered, circled, done: true }, say: `Done: every column is numbered. Weight = ${sum(circled.map(([a, b]) => m[ids.indexOf(a)][ids.indexOf(b)] ?? 0))}.` });
  return steps;
}

/* ---- Dijkstra ---- */
export interface DBox { order?: number; final?: number; working: number[] }
export interface DijkstraState { box: Record<string, DBox>; latest?: string; done: boolean; route?: string[]; target: string }

export function dijkstraSteps(g: Graph, start: string, target: string): Step<DijkstraState>[] {
  const r = rng(g.e.length * 211 + start.charCodeAt(0));
  const box: Record<string, DBox> = Object.fromEntries(g.v.map((x) => [x.id, { working: [] }]));
  const snap = (extra: Partial<DijkstraState> = {}): DijkstraState => ({ box: JSON.parse(JSON.stringify(box)), target, done: false, ...extra });
  box[start] = { order: 1, final: 0, working: [0] };
  const steps: Step<DijkstraState>[] = [{ s: snap({ latest: start }), say: `Label ${start} with order 1 and final value 0.` }];
  let latest = start, k = 1;
  while (box[target].final === undefined) {
    // update the working values of vertices joined to the latest permanent one
    const upd: string[] = [];
    for (const e of g.e) {
      if (e.a !== latest && e.b !== latest) continue;
      const o = other(e, latest);
      if (box[o].final !== undefined) continue;
      const val = box[latest].final! + e.w, cur = box[o].working.at(-1);
      if (cur === undefined || val < cur) { box[o].working.push(val); upd.push(`${o}: ${val}`); }
    }
    steps.push({ s: snap({ latest }), say: upd.length ? `From ${latest} (final ${box[latest].final}), update working values: ${upd.join(', ')}.` : `From ${latest}: no working value improves.` });
    const temps = g.v.filter((x) => box[x.id].final === undefined && box[x.id].working.length).sort((a, b) => box[a.id].working.at(-1)! - box[b.id].working.at(-1)! || a.id.localeCompare(b.id));
    if (!temps.length) break;
    const nxt = temps[0], v = box[nxt.id].working.at(-1)!;
    const firstVals = g.v.filter((x) => box[x.id].final === undefined && box[x.id].working.length > 1).map((x) => `${x.id} (${box[x.id].working[0]})`);
    const qa = ask('Which vertex gets the next permanent label?', `${nxt.id} (${v})`, [...temps.slice(1, 3).map((x) => `${x.id} (${box[x.id].working.at(-1)})`), ...firstVals], r);
    box[nxt.id].order = ++k; box[nxt.id].final = v; latest = nxt.id;
    steps.push({ s: snap({ latest }), say: `Smallest working value: ${nxt.id} with ${v}. Make it permanent: order ${k}, final value ${v}.`, ask: qa });
  }
  // trace the route back: an arc is on it if the final values differ by its weight
  const route = [target];
  let cur = target;
  while (cur !== start) {
    const e = g.e.filter((x) => x.a === cur || x.b === cur).find((x) => { const o = other(x, cur); return box[o].final !== undefined && box[cur].final! - box[o].final! === x.w; });
    if (!e) break;
    cur = other(e, cur); route.unshift(cur);
  }
  steps.push({ s: snap({ done: true, route, latest: target }),
    say: `${target} is permanent with ${box[target].final}: the shortest distance. Trace back using arcs where the final values differ by the arc's weight: ${route.join(' → ')}.` });
  return steps;
}

/* ---- route inspection (Chinese postman) ---- */
export interface Pairing { pairs: [string, string][]; cost: number; paths: string[][] }
export interface InspectionResult { odd: string[]; pairings: Pairing[]; best: Pairing; total: number; length: number; open?: { start: string; end: string; pairing: Pairing; length: number } }

export function routeInspection(g: Graph): InspectionResult {
  const { dist, path } = allPairs(g);
  const odd = g.v.map((x) => x.id).filter((id) => degree(g, id) % 2);
  const total = totalWeight(g.e);
  const pairingsOf = (xs: string[]): [string, string][][] => {
    if (!xs.length) return [[]];
    const [a, ...rest] = xs;
    return rest.flatMap((b, i) => pairingsOf(rest.filter((_, j) => j !== i)).map((p) => [[a, b] as [string, string], ...p]));
  };
  const pairings = pairingsOf(odd).map((pairs) => ({ pairs, cost: sum(pairs.map(([a, b]) => dist(a, b))), paths: pairs.map(([a, b]) => path(a, b)) }));
  const best = pairings.length ? [...pairings].sort((x, y) => x.cost - y.cost)[0] : { pairs: [], cost: 0, paths: [] };
  let open: InspectionResult['open'];
  if (odd.length === 4) {
    // start and finish at two different odd vertices: repeat only the cheapest single pair
    let bestPair: [string, string] | null = null, c = Infinity;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { const d = dist(odd[i], odd[j]); if (d < c) { c = d; bestPair = [odd[i], odd[j]]; } }
    const ends = odd.filter((x) => !bestPair!.includes(x));
    open = { start: ends[0], end: ends[1], pairing: { pairs: [bestPair!], cost: c, paths: [path(...bestPair!)] }, length: total + c };
  } else if (odd.length === 2) {
    open = { start: odd[0], end: odd[1], pairing: { pairs: [], cost: 0, paths: [] }, length: total };
  }
  return { odd, pairings, best, total, length: total + best.cost, open };
}

/* ---- travelling salesman: bounds on the classical problem from the table of shortest distances ---- */
export function distanceTable(g: Graph) {
  const { ids, dist } = allPairs(g);
  return { ids, d: ids.map((a) => ids.map((b) => dist(a, b))) };
}

export function nearestNeighbour(ids: string[], d: number[][], start: string) {
  const at = (a: string, b: string) => d[ids.indexOf(a)][ids.indexOf(b)];
  const tour = [start], legs: number[] = [];
  while (tour.length < ids.length) {
    const cur = tour.at(-1)!;
    const next = ids.filter((x) => !tour.includes(x)).sort((a, b) => at(cur, a) - at(cur, b) || a.localeCompare(b))[0];
    legs.push(at(cur, next)); tour.push(next);
  }
  legs.push(at(tour.at(-1)!, start)); tour.push(start);
  return { tour, legs, length: sum(legs) };
}

/** Residual minimum spanning tree: delete a vertex, MST of the rest (Prim), plus its two shortest arcs. */
export function lowerBoundTSP(ids: string[], d: number[][], del: string) {
  const rest = ids.filter((x) => x !== del);
  const at = (a: string, b: string) => d[ids.indexOf(a)][ids.indexOf(b)];
  const inT = [rest[0]], arcs: [string, string, number][] = [];
  while (inT.length < rest.length) {
    let best: [string, string, number] | null = null;
    for (const a of inT) for (const b of rest) if (!inT.includes(b) && (!best || at(a, b) < best[2])) best = [a, b, at(a, b)];
    arcs.push(best!); inT.push(best![1]);
  }
  const two = rest.map((x) => [x, at(del, x)] as [string, number]).sort((a, b) => a[1] - b[1]).slice(0, 2);
  const mst = sum(arcs.map((a) => a[2]));
  return { arcs, mst, two, bound: mst + two[0][1] + two[1][1] };
}

/** The network a tab shows: a preset, or a random one rebuilt from its seed (so it survives a reload). */
export const NETS = [...Object.entries(PRESETS).map(([k, p]) => [k, p.name] as const), ['random', 'Random'] as const];
export function graphFor(net: string, seed: number, inspection = false): Graph {
  if (net !== 'random' && PRESETS[net]) return PRESETS[net].g;
  return inspection ? randomInspectionGraph(rng(seed)) : randomGraph(rng(seed));
}

/** Route inspection as steps: total, odd vertices, the pairings, the least, the route length. */
export function inspectionSteps(g: Graph, open: boolean): Step<{ phase: number; show?: Pairing }>[] {
  const res = routeInspection(g), r = rng(g.e.length * 307);
  const steps: Step<{ phase: number; show?: Pairing }>[] = [];
  steps.push({ s: { phase: 0 }, say: `Add up every arc: total weight ${res.total}. A route along every arc once is possible only if every vertex has even degree.` });
  const deg = (v: string) => degree(g, v);
  const fakeOdd = g.v.filter((v) => deg(v.id) % 2 === 0).slice(0, 2).map((v) => v.id);
  steps.push({ s: { phase: 1 }, say: res.odd.length ? `Odd vertices: ${res.odd.map((v) => `${v} (degree ${deg(v)})`).join(', ')}.` : 'Every vertex has even degree: no arcs need repeating.',
    ask: ask('Which vertices have odd degree?', res.odd.join(', ') || 'none', [[...res.odd.slice(1), ...fakeOdd.slice(0, 1)].sort().join(', '), [...res.odd.slice(0, -1), ...fakeOdd.slice(1)].sort().join(', '), fakeOdd.join(', ')], r) });
  if (!res.odd.length) { steps.push({ s: { phase: 4 }, say: `The route is just the total, ${res.total}.` }); return steps; }
  if (open && res.open) {
    const o = res.open;
    steps.push({ s: { phase: 2 }, say: `Starting and finishing at different vertices: those two can stay odd, so only ${res.odd.length === 2 ? 'no pair' : 'one pair'} needs repeating. Compare the shortest distances between the pairs.` });
    steps.push({ s: { phase: 3, show: o.pairing }, say: res.odd.length === 2 ? `Start at ${o.start} and finish at ${o.end}: no arcs repeat.` : `Repeat the shortest pair, ${o.pairing.pairs[0].join('')} (${o.pairing.cost}, via ${o.pairing.paths[0].join('')}). Start at ${o.start} and finish at ${o.end}.` });
    steps.push({ s: { phase: 4, show: o.pairing }, say: `Length: ${res.total} + ${o.pairing.cost} = ${o.length}.`,
      ask: ask('How long is the shortest route?', String(o.length), [String(res.length), String(res.total), String(o.length + 2)], r) });
    return steps;
  }
  steps.push({ s: { phase: 2 }, say: `Pair up the odd vertices every possible way and add the shortest distances: ${res.pairings.map((p) => `${p.pairs.map((x) => x.join('')).join(' + ')} = ${p.cost}`).join('; ')}.` });
  const show = (p: Pairing) => p.pairs.map((x) => x.join('')).join(' + ');
  steps.push({ s: { phase: 3, show: res.best }, say: `The least is ${show(res.best)} = ${res.best.cost}: repeat ${res.best.paths.map((p) => p.join('')).join(' and ')}.`,
    ask: ask('Which pairing should be repeated?', show(res.best), res.pairings.filter((p) => p !== res.best).map(show), r) });
  steps.push({ s: { phase: 4, show: res.best }, say: `Length of the inspection route: ${res.total} + ${res.best.cost} = ${res.length}.`,
    ask: ask('How long is the route?', String(res.length), [String(res.total), ...res.pairings.filter((p) => p !== res.best).map((p) => String(res.total + p.cost))], r) });
  return steps;
}

/** Arcs walked by the repeated shortest paths of a pairing (with multiplicity). */
export const pathArcs = (p: Pairing) => p.paths.flatMap((path) => path.slice(1).map((v, k) => [path[k], v].sort().join('')));
