/* Kernel's helpers for Decision Lab (Edexcel IAL Maths D1):
   - Parse student lists, custom weighted undirected graphs (with clean 2D layout for GraphView), custom CPA activity
     networks (from either a precedence table or an activity-on-arc edge list, with automatic minimal dummies and
     topological event numbering 0..N-1), and custom 2-variable linear programs.
   - Format complete mark-scheme working for every algorithm on screen. */

import { bubbleSteps, quickSteps, binarySteps, type Order, type BubbleState, type QuickState, type BinState } from './sorting';
import { binSteps, lowerBound, type BinMethod } from './bins';
import {
  PRESETS, connected, arcName, totalWeight, kruskalSteps, primSteps, primMatrixSteps, dijkstraSteps,
  routeInspection, distanceTable, nearestNeighbour, lowerBoundTSP, degree,
  type Graph, type V, type E, type TreeState, type MatrixState, type DijkstraState,
} from './graph';
import { PROJECTS, times, activityTable, criticalPaths, precedence, workersLowerBound, mustHappen, passSteps, type Project, type Ev, type Act } from './cpa';
import { LPS, vertices, optimum, integerOptimum, range, objective, fmt, conText, type LP, type Con } from './lp';
import { sum } from './util';

export type DecisionMode = 'sort' | 'bins' | 'trees' | 'dijkstra' | 'routes' | 'cpa' | 'lp' | 'practice';

const norm = (s: string) => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');

export function matchDecisionMode(q: string): DecisionMode {
  const k = norm(q);
  const map: Record<DecisionMode, string[]> = {
    sort: ['sort', 'sorting', 'search', 'searching', 'bubble', 'bubblesort', 'quick', 'quicksort', 'binary', 'binarysearch'],
    bins: ['bins', 'bin', 'binpacking', 'packing', 'firstfit', 'ff', 'ffd', 'fullbin'],
    trees: ['trees', 'tree', 'mst', 'spanning', 'spanningtree', 'spanningtrees', 'kruskal', 'prim'],
    dijkstra: ['dijkstra', 'dijkstras', 'path', 'shortestpath'],
    routes: ['routes', 'route', 'inspection', 'routeinspection', 'chinesepostman', 'postman', 'tsp', 'travellingsalesman', 'travelingsalesman'],
    cpa: ['cpa', 'critical', 'criticalpath', 'activity', 'activitynetwork', 'gantt', 'cascade'],
    lp: ['lp', 'linear', 'linearprogramming', 'feasible'],
    practice: ['practice', 'quiz'],
  };
  for (const [m, als] of Object.entries(map) as [DecisionMode, string[]][]) if (als.includes(k)) return m;
  throw new Error(`No Decision Lab tab matches "${q}". Valid tabs: sort, bins, trees, dijkstra, routes, cpa, lp, practice.`);
}

export function parseNumberList(raw: unknown, minLen: number, maxLen: number, label = 'items'): number[] {
  const xs = Array.isArray(raw)
    ? raw.map(Number)
    : typeof raw === 'string'
    ? raw.trim().split(/[\s,;]+/).filter(Boolean).map(Number)
    : [];
  if (!xs.length || xs.some((x) => !Number.isFinite(x))) {
    throw new Error(`${label} must be an array of numbers or a space/comma-separated string of numbers.`);
  }
  if (xs.length < minLen || xs.length > maxLen) {
    throw new Error(`${label} must have between ${minLen} and ${maxLen} numbers (got ${xs.length}).`);
  }
  return xs;
}

/* ---------- custom weighted undirected graph ---------- */

function cleanVertexId(s: string): string {
  const t = s.trim();
  if (!t) throw new Error('Empty vertex name in edge.');
  return t.length <= 2 ? t.toUpperCase() : t;
}

/** Parse edges from [{from,to,weight}], ["A-B:5", "AB 5"], or "A-B 5, B-C 3" into a connected Graph with 2D layout. */
export function buildCustomGraph(raw: unknown, startHint?: string): Graph {
  const items: unknown[] = typeof raw === 'string'
    ? raw.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean)
    : Array.isArray(raw) ? raw : [];
  if (!items.length) throw new Error('Provide edges as an array of { from, to, weight } objects or strings like "A-B 5, B-C 3".');

  const edgeMap = new Map<string, E>();
  const vSet = new Set<string>();

  for (const item of items) {
    let a = '', b = '', w = NaN;
    if (typeof item === 'string') {
      const s = item.trim();
      // forms: "A-B:5", "A-B 5", "A B 5", "AB 5", "AB:5", "AB5"
      let m = s.match(/^([A-Za-z0-9]+)\s*[-–—:]\s*([A-Za-z0-9]+)\s*[:=\s]+\s*([0-9.]+)$/);
      if (!m) m = s.match(/^([A-Za-z0-9]+)\s+([A-Za-z0-9]+)\s*[:=\s]+\s*([0-9.]+)$/);
      if (!m) m = s.match(/^([A-Za-z])([A-Za-z])\s*[:=\s]*([0-9.]+)$/);
      if (!m) throw new Error(`Could not parse edge "${s}". Use e.g. "A-B 5" or { from: "A", to: "B", weight: 5 }.`);
      a = cleanVertexId(m[1]); b = cleanVertexId(m[2]); w = Number(m[3]);
    } else if (item && typeof item === 'object') {
      const o = item as Record<string, unknown>;
      a = cleanVertexId(String(o.from ?? o.a ?? o.u ?? ''));
      b = cleanVertexId(String(o.to ?? o.b ?? o.v ?? ''));
      w = Number(o.weight ?? o.w ?? o.cost ?? o.length);
    } else {
      throw new Error('Each edge must be { from, to, weight } or a string like "A-B 5".');
    }
    if (a === b) throw new Error(`Self-loop on vertex ${a} is not allowed.`);
    if (!Number.isFinite(w) || w <= 0) throw new Error(`Edge ${a}-${b} must have a positive weight (got ${w}).`);
    vSet.add(a); vSet.add(b);
    const [u, v] = a < b ? [a, b] : [b, a];
    const key = `${u}\0${v}`;
    const prev = edgeMap.get(key);
    if (!prev || w < prev.w) edgeMap.set(key, { a: u, b: v, w });
  }

  const ids = [...vSet].sort();
  if (ids.length < 2 || ids.length > 14) throw new Error(`Graph must have 2 to 14 vertices (got ${ids.length}).`);
  const e = [...edgeMap.values()];

  // BFS-layered left-to-right layout inside 100×60 box (keeps Dijkstra boxes well-spaced)
  const root = startHint && vSet.has(cleanVertexId(startHint)) ? cleanVertexId(startHint) : ids[0];
  const dist = new Map<string, number>([[root, 0]]);
  const q = [root];
  while (q.length) {
    const u = q.shift()!;
    for (const ed of e) {
      const nb = ed.a === u ? ed.b : ed.b === u ? ed.a : null;
      if (nb && !dist.has(nb)) { dist.set(nb, dist.get(u)! + 1); q.push(nb); }
    }
  }
  const unreach = ids.filter((id) => !dist.has(id));
  if (unreach.length) throw new Error(`Graph is disconnected: ${unreach.join(', ')} cannot be reached from ${root}.`);

  const layers = new Map<number, string[]>();
  for (const id of ids) {
    const d = dist.get(id)!;
    (layers.get(d) ?? layers.set(d, []).get(d)!).push(id);
  }
  const maxD = Math.max(...layers.keys());
  const v: V[] = [];
  if (maxD <= 1 && ids.length >= 4) {
    // star or complete graph: oval layout
    ids.forEach((id, idx) => {
      const ang = (idx / ids.length) * Math.PI * 2 - Math.PI;
      v.push({ id, x: Math.round(50 + 42 * Math.cos(ang)), y: Math.round(30 + 23 * Math.sin(ang)) });
    });
  } else {
    for (const [d, group] of [...layers.entries()].sort((a, b) => a[0] - b[0])) {
      const bx = maxD === 0 ? 50 : 6 + (88 * d) / maxD;
      group.forEach((id, k) => {
        const y = group.length === 1 ? 30 : 8 + (44 * k) / (group.length - 1);
        // tiny x stagger on tall layers prevents vertical collinear arcs overlapping weight pills
        const dx = group.length >= 3 ? (k % 2 === 0 ? -3 : 3) : 0;
        v.push({ id, x: Math.max(5, Math.min(95, Math.round(bx + dx))), y: Math.round(y) });
      });
    }
  }
  const g: Graph = { v, e };
  if (!connected(g)) throw new Error('Graph must be connected.');
  return g;
}

/* ---------- custom CPA activity network (precedence table OR activity-on-arc) ---------- */

function parseDeps(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') return [];
  const arr = Array.isArray(raw) ? raw.map(String) : String(raw).split(/[\s,;]+/);
  return [...new Set(arr.map((s) => s.trim().toUpperCase()).filter((s) => s && s !== '-' && s !== '–' && s !== 'NONE'))];
}

/** Build a valid topologically-numbered activity-on-arc Project from either a precedence table or an AOA arc list. */
export function buildCustomProject(raw: unknown, name = 'Custom project'): Project {
  if (!Array.isArray(raw) || !raw.length) {
    throw new Error('Provide activities as an array of { id, duration, depends_on } (precedence table) or { id, from, to, duration } (activity-on-arc).');
  }
  const first = raw[0] as Record<string, unknown>;
  const isAOA = first && typeof first === 'object' && ('from' in first || 'to' in first);

  interface RawArc { id: string; from: number; to: number; d: number; dummy: boolean }
  let rawArcs: RawArc[] = [];
  let nodeCount = 0;

  if (isAOA) {
    const idMap = new Map<string, number>();
    const nodeOf = (x: unknown) => {
      const k = String(x ?? '').trim();
      if (!k) throw new Error('Each AOA activity needs "from" and "to" event numbers.');
      if (!idMap.has(k)) idMap.set(k, idMap.size);
      return idMap.get(k)!;
    };
    const seenIds = new Set<string>();
    for (const item of raw as Record<string, unknown>[]) {
      const dummy = Boolean(item.dummy) || String(item.id ?? '').trim() === '~' || String(item.id ?? '').trim() === '';
      const id = dummy ? '' : String(item.id).trim().toUpperCase();
      if (!dummy) {
        if (seenIds.has(id)) throw new Error(`Duplicate activity id "${id}".`);
        seenIds.add(id);
      }
      const d = dummy ? 0 : Number(item.duration ?? item.d);
      if (!dummy && (!Number.isFinite(d) || d <= 0)) throw new Error(`Activity ${id} must have a positive duration.`);
      const from = nodeOf(item.from), to = nodeOf(item.to);
      if (from === to) throw new Error(`Activity ${id || 'dummy'} cannot start and end at the same event.`);
      rawArcs.push({ id, from, to, d, dummy });
    }
    nodeCount = idMap.size;
  } else {
    // Precedence table: { id, duration, depends_on }
    interface Row { id: string; d: number; deps: string[] }
    const rows: Row[] = [];
    const seen = new Set<string>();
    for (const item of raw as Record<string, unknown>[]) {
      const id = String(item.id ?? item.activity ?? '').trim().toUpperCase();
      const d = Number(item.duration ?? item.d);
      const deps = parseDeps(item.depends_on ?? item.deps ?? item.precedes ?? item.predecessors ?? item.immediately_preceding);
      if (!id) throw new Error('Each activity needs an "id" (e.g. "A").');
      if (seen.has(id)) throw new Error(`Duplicate activity id "${id}".`);
      if (!Number.isFinite(d) || d <= 0) throw new Error(`Activity ${id} must have a positive duration (got ${d}).`);
      seen.add(id);
      rows.push({ id, d, deps });
    }
    for (const r of rows) {
      for (const dep of r.deps) {
        if (!seen.has(dep)) throw new Error(`Activity ${r.id} depends on unknown activity "${dep}".`);
        if (dep === r.id) throw new Error(`Activity ${r.id} cannot depend on itself.`);
      }
    }

    // Build AOA with minimal dummies:
    // source = 0, sink = 1; allocate an event for each distinct non-empty predecessor set P
    let nextNode = 2;
    const SRC = 0, SINK = 1;
    const setNode = new Map<string, number>();
    const keyOf = (ds: string[]) => [...ds].sort().join(',');
    for (const r of rows) {
      if (r.deps.length) {
        const k = keyOf(r.deps);
        if (!setNode.has(k)) setNode.set(k, nextNode++);
      }
    }
    // For each activity a, find all distinct predecessor sets that contain a
    const setsContaining = new Map<string, string[]>();
    for (const r of rows) setsContaining.set(r.id, []);
    for (const k of setNode.keys()) {
      for (const a of k.split(',')) setsContaining.get(a)!.push(k);
    }

    for (const r of rows) {
      const start = r.deps.length ? setNode.get(keyOf(r.deps))! : SRC;
      const usedIn = setsContaining.get(r.id)!;
      let end: number;
      if (usedIn.length === 0) {
        end = SINK;
      } else if (usedIn.length === 1) {
        end = setNode.get(usedIn[0])!;
      } else if (usedIn.includes(r.id)) {
        // singleton set {r.id} serves as r's finish event; add dummies to larger sets
        end = setNode.get(r.id)!;
        for (const k of usedIn) if (k !== r.id) rawArcs.push({ id: '', from: end, to: setNode.get(k)!, d: 0, dummy: true });
      } else {
        end = nextNode++;
        for (const k of usedIn) rawArcs.push({ id: '', from: end, to: setNode.get(k)!, d: 0, dummy: true });
      }
      rawArcs.push({ id: r.id, from: start, to: end, d: r.d, dummy: false });
    }
    nodeCount = nextNode;

    // Split any parallel arcs sharing the exact same (from, to) using an extra event + dummy
    const pairUsed = new Set<string>();
    const dedup: RawArc[] = [];
    for (const a of rawArcs) {
      const k = `${a.from}->${a.to}`;
      if (!pairUsed.has(k)) { pairUsed.add(k); dedup.push(a); }
      else if (a.dummy) continue; // duplicate dummy between same pair
      else {
        const mid = nodeCount++;
        dedup.push({ id: a.id, from: a.from, to: mid, d: a.d, dummy: false });
        dedup.push({ id: '', from: mid, to: a.to, d: 0, dummy: true });
      }
    }
    rawArcs = dedup;
  }

  // Ensure single source and single sink (if AOA had multiple, connect with dummies)
  const indeg = Array(nodeCount).fill(0), outdeg = Array(nodeCount).fill(0);
  for (const a of rawArcs) { outdeg[a.from]++; indeg[a.to]++; }
  const sources = Array.from({ length: nodeCount }, (_, i) => i).filter((i) => indeg[i] === 0 && outdeg[i] > 0);
  const sinks = Array.from({ length: nodeCount }, (_, i) => i).filter((i) => outdeg[i] === 0 && indeg[i] > 0);
  if (!sources.length || !sinks.length) throw new Error('Activity network contains a cycle or has no valid start/end.');
  if (sources.length > 1) {
    const ns = nodeCount++;
    for (const s of sources) rawArcs.push({ id: '', from: ns, to: s, d: 0, dummy: true });
  }
  if (sinks.length > 1) {
    const nt = nodeCount++;
    for (const t of sinks) rawArcs.push({ id: '', from: t, to: nt, d: 0, dummy: true });
  }

  // Topological sort (Kahn's) so events are 0..N-1 with a.from < a.to
  const active = new Set<number>(rawArcs.flatMap((a) => [a.from, a.to]));
  const inDeg = new Map<number, number>([...active].map((n) => [n, 0]));
  for (const a of rawArcs) inDeg.set(a.to, (inDeg.get(a.to) ?? 0) + 1);
  const queue = [...active].filter((n) => inDeg.get(n) === 0);
  const order: number[] = [];
  while (queue.length) {
    const u = queue.shift()!;
    order.push(u);
    for (const a of rawArcs) {
      if (a.from !== u) continue;
      const nd = inDeg.get(a.to)! - 1;
      inDeg.set(a.to, nd);
      if (nd === 0) queue.push(a.to);
    }
  }
  if (order.length !== active.size) throw new Error('Activity network contains a cycle (circular dependency).');
  const remap = new Map(order.map((old, idx) => [old, idx]));
  const acts: Act[] = rawArcs.map((a) => ({ id: a.id, from: remap.get(a.from)!, to: remap.get(a.to)!, d: a.d, dummy: a.dummy }));

  // Longest-path layer layout into 100×60
  const N = order.length;
  const depth = Array(N).fill(0);
  for (let n = 0; n < N; n++) for (const a of acts) if (a.to === n) depth[n] = Math.max(depth[n], depth[a.from] + 1);
  const maxD = Math.max(1, ...depth);
  const byDepth = new Map<number, number[]>();
  for (let n = 0; n < N; n++) (byDepth.get(depth[n]) ?? byDepth.set(depth[n], []).get(depth[n])!).push(n);
  const ev: Ev[] = Array(N);
  for (const [d, group] of byDepth.entries()) {
    const x = Math.round(4 + (92 * d) / maxD);
    group.forEach((n, k) => {
      const y = group.length === 1 ? 30 : Math.round(8 + (44 * k) / (group.length - 1));
      ev[n] = { n, x, y };
    });
  }
  const realCount = acts.filter((a) => !a.dummy).length;
  return { name, story: `Custom activity network (${realCount} activities).`, ev, acts };
}

/* ---------- LP constraint parser ---------- */

export function parseConstraint(raw: unknown): Con {
  if (typeof raw === 'string') {
    const s = raw.replace(/\s+/g, '').replace(/≤/g, '<=').replace(/≥/g, '>=');
    const m = s.match(/^(.+)(<=|>=)([-+]?\d*\.?\d+)$/);
    if (!m) throw new Error(`Could not parse constraint "${raw}". Use e.g. "x + 2y <= 16" or { a: 1, b: 2, op: "<=", c: 16 }.`);
    const [, lhs, op, cStr] = m;
    let a = 0, b = 0;
    const terms = lhs.match(/[+-]?[^+-]+/g) ?? [];
    for (const t of terms) {
      const mx = t.match(/^([+-]?\d*\.?\d*)x$/i);
      const my = t.match(/^([+-]?\d*\.?\d*)y$/i);
      const coeff = (cs: string) => (cs === '' || cs === '+' ? 1 : cs === '-' ? -1 : Number(cs));
      if (mx) a += coeff(mx[1]);
      else if (my) b += coeff(my[1]);
      else throw new Error(`Unexpected term "${t}" in constraint "${raw}". Use variables x and y.`);
    }
    const c = Number(cStr);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c)) throw new Error(`Invalid numbers in constraint "${raw}".`);
    return { a, b, op: op as '<=' | '>=', c };
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const a = Number(o.a ?? 0), b = Number(o.b ?? 0), c = Number(o.c);
    const opRaw = String(o.op ?? '<=').replace('≤', '<=').replace('≥', '>=');
    if (opRaw !== '<=' && opRaw !== '>=') throw new Error(`Constraint operator must be "<=" or ">=" (got "${o.op}").`);
    if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || (a === 0 && b === 0)) {
      throw new Error('Each constraint needs finite numbers a, b (not both 0), and c.');
    }
    return { a, b, op: opRaw, c, label: o.label ? String(o.label) : undefined };
  }
  throw new Error('Each constraint must be { a, b, op: "<=" | ">=", c } or a string like "x + 2y <= 16".');
}

/* ---------- mark-scheme working formatters ---------- */

export function formatSort(algo: 'bubble' | 'quick' | 'binary', order: Order, list: number[], target: number, stepIdx: number): string {
  if (algo === 'bubble') {
    const { steps, passEnds } = bubbleSteps(list, order);
    const idx = Math.min(stepIdx, steps.length - 1);
    const cur = steps[idx];
    const s = cur.s as BubbleState;
    const passes = passEnds.filter((k) => k > 0 && k <= idx).map((k) => {
      const st = steps[k].s as BubbleState;
      return `Pass ${st.pass}: ${st.list.join('  ')}${!st.swapped ? ' (no swaps → sorted)' : ''}`;
    });
    return [
      `Bubble sort (${order === 'asc' ? 'ascending' : 'descending'}) on [${list.join(', ')}] — step ${idx + 1}/${steps.length}.`,
      `Start: ${list.join('  ')}`,
      ...passes,
      `Now: ${cur.say}`,
      `Comparisons: ${s.cmp}, swaps: ${s.swaps}.`,
    ].join('\n');
  }
  if (algo === 'quick') {
    const steps = quickSteps(list, order);
    const idx = Math.min(stepIdx, steps.length - 1);
    const cur = steps[idx];
    const lines = [`Quick sort (${order === 'asc' ? 'ascending' : 'descending'}, middle-right pivot) on [${list.join(', ')}] — step ${idx + 1}/${steps.length}.`, `Start: ${list.join('  ')}`];
    for (let k = 1; k <= idx; k++) {
      const qs = steps[k].s as QuickState;
      if (k % 2 === 1) {
        const pivs = qs.subs.filter((x) => x.pivot !== undefined).map((x) => x.items[x.pivot!]);
        lines.push(`Pass ${qs.pass} pivots: ${pivs.join(', ')}`);
      } else {
        lines.push(`After pass ${qs.pass}: ${qs.subs.map((x) => x.items.join(' ')).join(' | ')}`);
      }
    }
    lines.push(`Now: ${cur.say}`);
    return lines.join('\n');
  }
  const sorted = [...list].sort((a, b) => a - b);
  const steps = binarySteps(sorted, target);
  const idx = Math.min(stepIdx, steps.length - 1);
  const lines = [
    `Binary search for ${target} in sorted list [${sorted.join(', ')}] — step ${idx + 1}/${steps.length}.`,
    ...steps.slice(1, idx + 1).map((st, k) => `${k + 1}. ${st.say}`),
  ];
  const last = steps[idx].s as BinState;
  if (last.done) lines.push(last.result === 'found' ? `Result: found ${target} at position ${last.found! + 1}.` : `Result: ${target} is not in the list.`);
  return lines.join('\n');
}

export function formatBins(method: BinMethod, items: number[], cap: number, stepIdx: number): string {
  const steps = binSteps(items, cap, method);
  const idx = Math.min(stepIdx, steps.length - 1);
  const cur = steps[idx].s;
  const lb = lowerBound(items, cap);
  const mName = method === 'ff' ? 'First-fit' : method === 'ffd' ? 'First-fit decreasing' : 'Full-bin';
  const binLines = cur.bins.map((b, k) => `Bin ${k + 1}: [${b.join(', ')}] = ${sum(b)}/${cap}`);
  return [
    `${mName} bin packing (capacity ${cap}) on [${items.join(', ')}] — step ${idx + 1}/${steps.length}.`,
    ...(method === 'ffd' ? [`Sorted decreasing: ${[...items].sort((a, b) => b - a).join(', ')}`] : []),
    ...binLines,
    ...(cur.queue.length ? [`Remaining: ${cur.queue.join(', ')}`] : []),
    `Lower bound: ⌈${sum(items)} ÷ ${cap}⌉ = ${lb} bins.`,
    `Now: ${steps[idx].say}`,
  ].join('\n');
}

export function formatTrees(algo: 'kruskal' | 'prim' | 'matrix', g: Graph, start: string, stepIdx: number): string {
  const steps = algo === 'kruskal' ? kruskalSteps(g) : algo === 'prim' ? primSteps(g, start) : primMatrixSteps(g, start);
  const idx = Math.min(stepIdx, steps.length - 1);
  const cur = steps[idx].s;
  if (algo === 'matrix') {
    const ms = cur as MatrixState;
    const arcs = ms.circled.map(([r, c]) => `${[c, r].sort().join('')}(${ms.m[ms.ids.indexOf(r)][ms.ids.indexOf(c)]})`);
    const w = ms.circled.reduce((t, [r, c]) => t + (ms.m[ms.ids.indexOf(r)][ms.ids.indexOf(c)] ?? 0), 0);
    return [
      `Prim on distance matrix (start ${start}) — step ${idx + 1}/${steps.length}.`,
      `Column numbering order: ${ms.numbered.map((v, k) => `${v}=${k + 1}`).join(', ')}.`,
      `Arcs added in order: ${arcs.join(', ') || 'none yet'}. Weight = ${w}.`,
      `Now: ${steps[idx].say}`,
    ].join('\n');
  }
  const ts = cur as TreeState;
  return [
    `${algo === 'kruskal' ? 'Kruskal' : `Prim (start ${start})`} MST — step ${idx + 1}/${steps.length}.`,
    ...(ts.order ? [`Arcs sorted by weight: ${ts.order.map((e) => `${arcName(e)}(${e.w})`).join(', ')}.`] : []),
    `Arcs in tree (in order): ${ts.tree.map((e) => `${arcName(e)}(${e.w})`).join(', ') || 'none yet'}.`,
    ...(ts.rejected.length ? [`Rejected (cycle): ${ts.rejected.map((e) => `${arcName(e)}(${e.w})`).join(', ')}.`] : []),
    `Weight: ${totalWeight(ts.tree)} (${ts.tree.length}/${g.v.length - 1} arcs).`,
    `Now: ${steps[idx].say}`,
  ].join('\n');
}

export function formatDijkstra(g: Graph, from: string, to: string, stepIdx: number): string {
  const steps = dijkstraSteps(g, from, to);
  const idx = Math.min(stepIdx, steps.length - 1);
  const cur = steps[idx].s as DijkstraState;
  const ordered = Object.entries(cur.box).filter(([, b]) => b.order !== undefined).sort((a, b) => a[1].order! - b[1].order!);
  const boxLines = g.v.map((v) => {
    const b = cur.box[v.id];
    return `  ${v.id}: order=${b.order ?? '–'}, final=${b.final ?? '–'}, working=[${b.working.join(', ')}]`;
  });
  return [
    `Dijkstra shortest path from ${from} to ${to} — step ${idx + 1}/${steps.length}.`,
    `Order of permanent labels: ${ordered.map(([id, b]) => `${b.order}. ${id} (${b.final})`).join(', ')}.`,
    'Boxes (vertex | order | final | working values):',
    ...boxLines,
    ...(cur.route ? [`Shortest distance ${from} → ${to} = ${cur.box[to].final}; route: ${cur.route.join(' → ')}.`] : []),
    `Now: ${steps[idx].say}`,
  ].join('\n');
}

export function formatInspection(g: Graph, open: boolean, stepIdx: number): string {
  const res = routeInspection(g);
  const degs = g.v.map((v) => `${v.id}:${degree(g, v.id)}`).join(', ');
  const lines = [
    `Route inspection (Chinese postman${open ? ', open route: different start/finish' : ''}) — step ${stepIdx + 1}.`,
    `Total weight of all arcs = ${res.total}. Vertex degrees: ${degs}.`,
    `Odd vertices (${res.odd.length}): ${res.odd.join(', ') || 'none (network is Eulerian)'}.`,
  ];
  if (open && res.open) {
    const o = res.open;
    lines.push(o.pairing.pairs.length
      ? `Open route: start at ${o.start}, finish at ${o.end}; repeat ${o.pairing.pairs[0].join('')} via ${o.pairing.paths[0].join('')} (cost ${o.pairing.cost}). Length = ${res.total} + ${o.pairing.cost} = ${o.length}.`
      : `Open route: start at ${o.start}, finish at ${o.end}; no arcs repeated. Length = ${o.length}.`);
  } else if (res.pairings.length) {
    lines.push('Pairings: ' + res.pairings.map((p) => `${p.pairs.map((x) => x.join('')).join(' + ')} = ${p.cost} (${p.paths.map((x) => x.join('')).join(', ')})`).join('; ') + '.');
    lines.push(`Best pairing: ${res.best.pairs.map((x) => x.join('')).join(' + ')} = ${res.best.cost}. Minimum route length = ${res.total} + ${res.best.cost} = ${res.length}.`);
  } else {
    lines.push(`Minimum route length = ${res.total}.`);
  }
  return lines.join('\n');
}

export function formatTSP(g: Graph, nnStart: string, delV: string): string {
  const { ids, d } = distanceTable(g);
  const s = ids.includes(nnStart) ? nnStart : ids[0];
  const dl = ids.includes(delV) ? delV : ids[0];
  const nn = nearestNeighbour(ids, d, s);
  const lb = lowerBoundTSP(ids, d, dl);
  const bestUpper = Math.min(...ids.map((v) => nearestNeighbour(ids, d, v).length));
  const bestLower = Math.max(...ids.map((v) => lowerBoundTSP(ids, d, v).bound));
  return [
    `Travelling salesman problem (classical, shortest-distance table) on vertices ${ids.join(', ')}.`,
    `Upper bound (nearest neighbour from ${s}): ${nn.tour.join(' → ')} = ${nn.legs.join(' + ')} = ${nn.length}.`,
    `Lower bound (delete ${dl}): residual MST arcs ${lb.arcs.map(([a, b, w]) => `${a}${b}(${w})`).join(', ')} = ${lb.mst}; + two shortest from ${dl}: ${lb.two.map(([v, w]) => `${dl}${v}(${w})`).join(', ')} → bound = ${lb.bound}.`,
    `Best bounds over all starts / deletions: ${bestLower} ≤ optimal tour ≤ ${bestUpper}.`,
  ].join('\n');
}

export function formatCPA(p: Project, view: 'network' | 'gantt' | 'table', tVal: number, stepIdx: number): string {
  const t = times(p), rows = activityTable(p, t), paths = criticalPaths(p, t), prec = precedence(p), lbw = workersLowerBound(p, t);
  const steps = passSteps(p), idx = Math.min(stepIdx, steps.length - 1), cur = steps[idx].s;
  const evLines = p.ev.map((e) => `Event ${e.n}: early=${cur.early[e.n] ?? '?'}, late=${cur.late[e.n] ?? '?'}`).join('; ');
  const actLines = rows.map((r) => `  ${r.a.id} (${r.a.from}→${r.a.to}, d=${r.a.d}, deps=${prec[r.a.id].join(',') || '–'}): ES=${r.es}, EF=${r.ef}, LS=${r.ls}, LF=${r.lf}, float=${r.float}${r.critical ? ' [CRITICAL]' : ''}`);
  const must = mustHappen(rows, tVal);
  return [
    `Critical path analysis: ${p.name} (view: ${view}, step ${idx + 1}/${steps.length}).`,
    `Event times on screen: ${evLines}.`,
    `Minimum completion time: ${t.T}. Critical path${paths.length > 1 ? 's' : ''}: ${paths.map((x) => x.join(' – ')).join(', ')}.`,
    `Workers lower bound: ⌈${sum(p.acts.map((a) => a.d))} ÷ ${t.T}⌉ = ${lbw}.`,
    'Activity table:',
    ...actLines,
    ...(view === 'gantt' ? [`At time t = ${tVal}, activities that must be happening: ${must.join(', ') || 'none'}.`] : []),
    `Now: ${steps[idx].say}`,
  ].join('\n');
}

export function formatLP(lp: LP, kFrac: number): string {
  const rg = range(lp), opt = optimum(lp), vs = vertices(lp), intOpt = lp.integer ? integerOptimum(lp, rg.xmax, rg.ymax) : null;
  const kVal = kFrac * objective(lp, [rg.xmax, rg.ymax]);
  return [
    `Linear programming: ${lp.name} — ${lp.obj.sense === 'max' ? 'Maximise' : 'Minimise'} ${lp.obj.p}x + ${lp.obj.q}y (x = ${lp.x}, y = ${lp.y}${lp.integer ? ', whole numbers only' : ''}).`,
    `Constraints: ${lp.cons.map((c) => conText(c)).join('; ')}; x, y ≥ 0.`,
    `Objective line currently at ${lp.obj.p}x + ${lp.obj.q}y = ${fmt(kVal)}.`,
    vs.length
      ? 'Vertices: ' + vs.map((v) => `(${fmt(v[0])}, ${fmt(v[1])}) → ${fmt(objective(lp, v))}`).join('; ') + '.'
      : 'No feasible region.',
    opt ? `Continuous optimum: ${fmt(opt.value)} at (${fmt(opt.best[0])}, ${fmt(opt.best[1])})${opt.ties.length > 1 ? ` (tied with ${opt.ties.slice(1).map((u) => `(${fmt(u[0])}, ${fmt(u[1])})`).join(', ')})` : ''}.` : '',
    lp.integer && opt ? (intOpt ? `Integer optimum: (${intOpt[0]}, ${intOpt[1]}) giving ${fmt(objective(lp, intOpt))}.` : 'No integer point in R.') : '',
  ].filter(Boolean).join('\n');
}

export { PRESETS as GRAPH_PRESETS, PROJECTS as CPA_PROJECTS, LPS as LP_PRESETS };
