/* D1.5 Linear programming in two variables: constraints ax + by (≤ | ≥) c with x, y ≥ 0, the feasible region R,
   the vertex method, the objective line (ruler) method and integer solutions. */
import { sum } from './util';

export interface Con { a: number; b: number; op: '<=' | '>='; c: number; label?: string }
export interface LP { name: string; story: string; x: string; y: string; obj: { p: number; q: number; sense: 'max' | 'min' }; cons: Con[]; integer: boolean }
export type Pt = [number, number];

export const LPS: LP[] = [
  { name: 'Bakery', story: 'A bakery makes x trays of bread and y trays of cakes. Bread needs 1 h of oven time and cakes 2 h; there are 16 h. Mixing takes 3 h and 2 h; there are 24 h. At most 7 trays of cake sell. Profit is £5 a tray of bread and £4 a tray of cake.',
    x: 'bread', y: 'cakes', obj: { p: 5, q: 4, sense: 'max' }, integer: true,
    cons: [{ a: 1, b: 2, op: '<=', c: 16, label: 'oven' }, { a: 3, b: 2, op: '<=', c: 24, label: 'mixing' }, { a: 0, b: 1, op: '<=', c: 7, label: 'demand' }] },
  { name: 'Diet', story: 'Feed mixes X and Y: each kg of X gives 3 units of protein and 1 of fibre, each kg of Y gives 1 and 2. A pen needs at least 12 protein and 10 fibre, and at least 2 kg of Y. X costs £2/kg and Y £3/kg. Minimise the cost.',
    x: 'X (kg)', y: 'Y (kg)', obj: { p: 2, q: 3, sense: 'min' }, integer: false,
    cons: [{ a: 3, b: 1, op: '>=', c: 12, label: 'protein' }, { a: 1, b: 2, op: '>=', c: 10, label: 'fibre' }, { a: 0, b: 1, op: '>=', c: 2, label: 'Y min' }] },
  { name: 'Furniture', story: 'A workshop makes x chairs and y tables. Wood: 2 units a chair, 5 a table, 40 available. Labour: 4 h a chair, 3 h a table, 36 h available. Profit £30 a chair and £50 a table; only whole items.',
    x: 'chairs', y: 'tables', obj: { p: 30, q: 50, sense: 'max' }, integer: true,
    cons: [{ a: 2, b: 5, op: '<=', c: 40, label: 'wood' }, { a: 4, b: 3, op: '<=', c: 36, label: 'labour' }] },
];

const EPS = 1e-9;
export const holds = (k: Con, [x, y]: Pt) => (k.op === '<=' ? k.a * x + k.b * y <= k.c + EPS : k.a * x + k.b * y >= k.c - EPS);
export const feasible = (lp: LP, p: Pt) => p[0] >= -EPS && p[1] >= -EPS && lp.cons.every((k) => holds(k, p));
export const objective = (lp: LP, [x, y]: Pt) => lp.obj.p * x + lp.obj.q * y;

/** Vertices of R: pairwise intersections of the constraint lines and the axes that satisfy everything. */
export function vertices(lp: LP): Pt[] {
  const lines: [number, number, number][] = [...lp.cons.map((k) => [k.a, k.b, k.c] as [number, number, number]), [1, 0, 0], [0, 1, 0]];
  const pts: Pt[] = [];
  for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
    const [a1, b1, c1] = lines[i], [a2, b2, c2] = lines[j], det = a1 * b2 - a2 * b1;
    if (Math.abs(det) < EPS) continue;
    const p: Pt = [(c1 * b2 - c2 * b1) / det, (a1 * c2 - a2 * c1) / det];
    if (feasible(lp, p) && !pts.some((q) => Math.abs(q[0] - p[0]) < 1e-6 && Math.abs(q[1] - p[1]) < 1e-6)) pts.push(p);
  }
  // order round the centroid so the polygon draws properly
  const cx = sum(pts.map((p) => p[0])) / pts.length, cy = sum(pts.map((p) => p[1])) / pts.length;
  return pts.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
}

/** Is R unbounded (a minimising problem with only ≥ constraints)? Then we clip it to the drawing box. */
export function bounded(lp: LP) {
  const big = 1e4;
  return !feasible(lp, [big, 0]) && !feasible(lp, [0, big]) && !feasible(lp, [big, big]);
}

export function optimum(lp: LP) {
  const vs = vertices(lp);
  if (!vs.length) return null;
  const better = (u: number, v: number) => (lp.obj.sense === 'max' ? u > v + EPS : u < v - EPS);
  let best = vs[0];
  for (const p of vs) if (better(objective(lp, p), objective(lp, best))) best = p;
  const ties = vs.filter((p) => Math.abs(objective(lp, p) - objective(lp, best)) < 1e-6);
  return { best, value: objective(lp, best), ties, vs };
}

/** Best integer point: searched over the grid inside R (small problems only). */
export function integerOptimum(lp: LP, xmax: number, ymax: number) {
  let best: Pt | null = null;
  for (let x = 0; x <= Math.ceil(xmax); x++) for (let y = 0; y <= Math.ceil(ymax); y++) {
    if (!feasible(lp, [x, y])) continue;
    if (!best || (lp.obj.sense === 'max' ? objective(lp, [x, y]) > objective(lp, best) : objective(lp, [x, y]) < objective(lp, best))) best = [x, y];
  }
  return best;
}

/** A tidy drawing range: just past the furthest axis intercept. */
export function range(lp: LP) {
  const xs = lp.cons.filter((k) => k.a > 0).map((k) => k.c / k.a), ys = lp.cons.filter((k) => k.b > 0).map((k) => k.c / k.b);
  const step = (v: number) => (v <= 12 ? 2 : v <= 25 ? 5 : 10);
  const top = (v: number) => Math.ceil((v * 1.08) / step(v)) * step(v);
  return { xmax: top(Math.max(4, ...xs)), ymax: top(Math.max(4, ...ys)) };
}

export const fmt = (v: number) => (Math.abs(v - Math.round(v)) < 1e-6 ? String(Math.round(v)) : Math.abs(v * 2 - Math.round(v * 2)) < 1e-6 ? (Math.round(v * 2) / 2).toString() : v.toFixed(2));
export const conText = (k: Con, x = 'x', y = 'y') => {
  const t = (n: number, v: string) => (n === 0 ? '' : `${n === 1 ? '' : n}${v}`);
  const lhs = [t(k.a, x), t(k.b, y)].filter(Boolean).join(' + ');
  return `${lhs} ${k.op === '<=' ? '≤' : '≥'} ${k.c}`;
};

/** R clipped to the drawing box (Sutherland–Hodgman), for drawing; works for unbounded regions too. */
export function regionPolygon(lp: LP, xmax: number, ymax: number): Pt[] {
  let poly: Pt[] = [[0, 0], [xmax, 0], [xmax, ymax], [0, ymax]];
  for (const k of lp.cons) {
    const f = ([x, y]: Pt) => (k.op === '<=' ? k.c - (k.a * x + k.b * y) : k.a * x + k.b * y - k.c);
    const out: Pt[] = [];
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i], q = poly[(i + 1) % poly.length], fp = f(p), fq = f(q);
      if (fp >= -EPS) out.push(p);
      if ((fp >= -EPS) !== (fq >= -EPS)) { const t = fp / (fp - fq); out.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); }
    }
    poly = out;
    if (!poly.length) break;
  }
  return poly;
}
