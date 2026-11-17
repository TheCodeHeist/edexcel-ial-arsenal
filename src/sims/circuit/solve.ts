/* The circuit solver. Pure functions, no DOM.

   1. Netlist: every terminal and every wire end is an attachment point. A wire joins all the attachment points that
      lie on it (ends or anywhere along it), so a T-junction connects but two wires that merely cross do not.
   2. Each part becomes one or more elements between its terminals: conductances, a cell (Norton: e.m.f. / r in
      parallel with r) or a non-linear element (lamp, diode, LED) given by its I(V) curve.
   3. Nodal analysis: G·V = I, solved by Gaussian elimination. Non-linear elements are linearised and the solve
      repeats (Newton–Raphson, with SPICE-style junction-voltage limiting for diodes) until it settles.
   4. Wire currents for the moving-charge animation: inside each net the wires form a small network; the currents
      the parts push into it are spread over its wires by solving that network with resistance ∝ wire length.

   5. Capacitors (time-stepping): solve(c, { dt, vc }) advances time by dt from the capacitor p.d.s in vc using the
      backward-Euler companion model (conductance C/dt in parallel with a current source C·v/dt), and returns the
      new p.d.s in sol.vc. A tiny dt gives the circuit at this instant without moving time on. Without dt a capacitor
      is an open circuit.

   Ideal meters and wires are modelled as tiny or huge resistances so the matrix is never singular: an ammeter is
   0.1 mΩ, a closed switch 0.1 mΩ, a cell's internal resistance is at least 0.1 mΩ, a voltmeter is 1 GΩ. */

import { KINDS, LAMPS, LEDS, thermR, ldrR, terminals, key, onSeg, type CircuitData, type Part, type Pt } from './parts';

const TINY = 1e-4;     // Ω: ideal ammeter, closed switch, minimum internal resistance
const HUGE = 1e9;      // Ω: ideal voltmeter
const GMIN = 1e-12;    // S: from every node to the reference, keeps floating nodes defined
const VT_D = 0.035;    // diode: n·kT/e
const IS_D = 1e-9;     // diode: saturation current (≈0.6 V at a few mA)
const VT_L = 0.05;     // LED: n·kT/e

/** An element between two terminals of one part (indices into the part's terminal list). Current is a → b. */
type El =
  | { k: 'R'; a: number; b: number; R: number }
  | { k: 'E'; a: number; b: number; E: number; r: number }                  // a is +, b is −
  | { k: 'N'; a: number; b: number; f: (v: number) => [number, number]; vt?: number; is?: number }
  | { k: 'C'; a: number; b: number; C: number };

/** The I(V) of a filament lamp: R rises from a quarter of its hot value as the filament heats up. */
export function lampIV(rating: keyof typeof LAMPS) {
  const L = LAMPS[rating], Rc = L.v / L.i / 4, Vk = L.v / 3;
  return (v: number): [number, number] => { const d = 1 + Math.abs(v) / Vk; return [v / (Rc * d), 1 / (Rc * d * d)]; };
}
/** Shockley diode, with a small leak so the reverse direction is not exactly zero. */
export function diodeIV(is: number, vt: number) {
  return (v: number): [number, number] => {
    const e = Math.exp(Math.min(v / vt, 80));
    return [is * (e - 1) + v * GMIN * 10, (is * e) / vt + GMIN * 10];
  };
}
export const ledIs = (vf: number) => 0.01 / Math.exp(vf / VT_L);

export function elements(p: Part): El[] {
  const P = p.p;
  switch (p.kind) {
    case 'cell': return [{ k: 'E', a: 0, b: 1, E: P.emf ?? 0, r: Math.max(P.r ?? 0, TINY) }];
    case 'resistor': return [{ k: 'R', a: 0, b: 1, R: Math.max(P.R ?? 10, TINY) }];
    case 'varres': return [{ k: 'R', a: 0, b: 1, R: Math.max(P.R ?? 0, TINY) }];
    case 'thermistor': return [{ k: 'R', a: 0, b: 1, R: thermR(P.T ?? 20) }];
    case 'ldr': return [{ k: 'R', a: 0, b: 1, R: ldrR(P.lux ?? 100) }];
    case 'switch': return P.on ? [{ k: 'R', a: 0, b: 1, R: TINY }] : [];
    case 'switch2': return [{ k: 'R', a: 0, b: P.on ? 1 : 2, R: TINY }];
    case 'capacitor': return [{ k: 'C', a: 0, b: 1, C: Math.max(P.C ?? 470e-6, 1e-12) }];
    case 'ammeter': return [{ k: 'R', a: 0, b: 1, R: TINY }];
    case 'voltmeter': return [{ k: 'R', a: 0, b: 1, R: HUGE }];
    case 'pot': {
      const R = Math.max(P.R ?? 100, TINY), w = Math.min(1, Math.max(0, P.wiper ?? 0.5));
      return [{ k: 'R', a: 0, b: 2, R: Math.max(R * w, TINY) }, { k: 'R', a: 2, b: 1, R: Math.max(R * (1 - w), TINY) }];
    }
    case 'lamp': return [{ k: 'N', a: 0, b: 1, f: lampIV(P.rating ?? '6V') }];
    case 'diode': return [{ k: 'N', a: 0, b: 1, f: diodeIV(IS_D, VT_D), vt: VT_D, is: IS_D }];
    case 'led': { const is = ledIs(LEDS[P.colour ?? 'red'].vf); return [{ k: 'N', a: 0, b: 1, f: diodeIV(is, VT_L), vt: VT_L, is }]; }
  }
}

export interface PartResult {
  v: number;        // p.d. from terminal 0 to terminal 1 (cell: terminal p.d., + to −)
  i: number;        // current through the part from terminal 0 to 1 (cell: current out of the + terminal)
  p: number;        // power dissipated (cell: power delivered to the circuit)
  out: number[];    // current leaving the part at each terminal into the wires
  R?: number;       // resistance as set or as it is now (lamps, diodes: V/I)
  reading?: number; // meters: what the display shows (magnitude)
  bright?: number;  // lamps and LEDs: 0–1
  short?: boolean;  // a cell whose terminals are effectively joined
  q?: number;       // capacitor: charge (C)
  energy?: number;  // capacitor: energy stored (J)
}
export interface WireFlow { a: Pt; b: Pt; i: number }   // current from a to b along one piece of wire
export interface Solution {
  parts: Record<string, PartResult>;
  flows: Record<string, WireFlow[]>;   // by wire id
  nodeV: Record<string, number>;       // potential at each attachment point, relative to its island's reference
  netOf: Record<string, number>;       // attachment point key → net index
  shorts: string[];                    // ids of short-circuited cells
  converged: boolean;
  vc: Record<string, number>;          // capacitor p.d.s after this step, by part id
}
export interface SolveOpts { dt?: number; vc?: Record<string, number> }

/* ---------- union-find ---------- */
class DSU {
  p = new Map<string, string>();
  find(x: string): string { let r = x; while (this.p.has(r) && this.p.get(r) !== r) r = this.p.get(r)!; if (!this.p.has(x)) this.p.set(x, x); let c = x; while (c !== r) { const n = this.p.get(c)!; this.p.set(c, r); c = n; } return r; }
  join(a: string, b: string) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

/** Dense Gaussian elimination with partial pivoting. Solves A·x = b in place; returns x (NaN-free, singular rows → 0). */
export function gauss(A: Float64Array[], b: Float64Array): Float64Array {
  const n = b.length;
  for (let c = 0; c < n; c++) {
    let m = c, mv = Math.abs(A[c][c]);
    for (let r = c + 1; r < n; r++) { const v = Math.abs(A[r][c]); if (v > mv) { m = r; mv = v; } }
    if (mv < 1e-300) continue;
    if (m !== c) { [A[c], A[m]] = [A[m], A[c]]; [b[c], b[m]] = [b[m], b[c]]; }
    const piv = A[c][c], row = A[c];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / piv; if (f === 0) continue;
      const rr = A[r];
      for (let k = c; k < n; k++) rr[k] -= f * row[k];
      b[r] -= f * b[c];
    }
  }
  const x = new Float64Array(n);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = Math.abs(A[r][r]) < 1e-300 ? 0 : s / A[r][r];
  }
  return x;
}

function pnjlim(vnew: number, vold: number, vt: number, is: number): number {
  const vcrit = vt * Math.log(vt / (Math.SQRT2 * is));
  if (vnew > vcrit && Math.abs(vnew - vold) > 2 * vt) {
    if (vold > 0) { const arg = 1 + (vnew - vold) / vt; return arg > 0 ? vold + vt * Math.log(arg) : vcrit; }
    return vt * Math.log(vnew / vt);
  }
  return vnew;
}

export function solve(c: CircuitData, opts: SolveOpts = {}): Solution {
  const dt = opts.dt, vc0 = opts.vc ?? {};
  /* 1. netlist */
  const dsu = new DSU();
  const termPts = new Map<string, Pt[]>();
  const attach: Pt[] = [];
  const seen = new Set<string>();
  const addPt = (p: Pt) => { const k = key(p); dsu.find(k); if (!seen.has(k)) { seen.add(k); attach.push(p); } };
  for (const p of c.parts) { const ts = terminals(p); termPts.set(p.id, ts); ts.forEach(addPt); }
  for (const w of c.wires) { addPt(w.a); addPt(w.b); }

  // the attachment points on each wire, in order from a to b
  const onWire = new Map<string, Pt[]>();
  for (const w of c.wires) {
    const len2 = (w.b[0] - w.a[0]) ** 2 + (w.b[1] - w.a[1]) ** 2;
    const pts = attach.filter((p) => onSeg(p, w.a, w.b))
      .map((p) => ({ p, t: len2 ? ((p[0] - w.a[0]) * (w.b[0] - w.a[0]) + (p[1] - w.a[1]) * (w.b[1] - w.a[1])) / len2 : 0 }))
      .sort((x, y) => x.t - y.t).map((x) => x.p);
    onWire.set(w.id, pts);
    for (let i = 1; i < pts.length; i++) dsu.join(key(pts[i - 1]), key(pts[i]));
  }

  const netIdx = new Map<string, number>();
  const netOf: Record<string, number> = {};
  for (const p of attach) { const r = dsu.find(key(p)); if (!netIdx.has(r)) netIdx.set(r, netIdx.size); netOf[key(p)] = netIdx.get(r)!; }
  const N = netIdx.size;
  const tnet = (id: string, t: number) => netOf[key(termPts.get(id)![t])];

  /* 2. elements */
  const els: { part: Part; e: El; na: number; nb: number }[] = [];
  for (const p of c.parts) for (const e of elements(p)) els.push({ part: p, e, na: tnet(p.id, e.a), nb: tnet(p.id, e.b) });

  // islands (nets joined by elements) and a reference net in each: a cell's − terminal if there is one
  const isl = new DSU();
  for (let i = 0; i < N; i++) isl.find(String(i));
  for (const x of els) isl.join(String(x.na), String(x.nb));
  const ref = new Map<string, number>();
  for (const x of els) if (x.e.k === 'E') { const r = isl.find(String(x.nb)); if (!ref.has(r)) ref.set(r, x.nb); }
  for (let i = 0; i < N; i++) { const r = isl.find(String(i)); if (!ref.has(r)) ref.set(r, i); }
  const isRef = new Set(ref.values());
  const row = new Int32Array(N).fill(-1);
  let n = 0;
  for (let i = 0; i < N; i++) if (!isRef.has(i)) row[i] = n++;

  /* 3. nodal analysis, Newton–Raphson for non-linear elements */
  const vd: number[] = els.map((x) => (x.e.k === 'N' && x.e.vt ? 0.6 : 0)); // linearisation voltage per element
  let V = new Float64Array(N);
  let converged = false;
  const hasNL = els.some((x) => x.e.k === 'N');
  for (let it = 0; it < 300; it++) {
    const A = Array.from({ length: n }, () => new Float64Array(n));
    const b = new Float64Array(n);
    const G = (a: number, bb: number, g: number) => {
      const ra = row[a], rb = row[bb];
      if (ra >= 0) A[ra][ra] += g;
      if (rb >= 0) A[rb][rb] += g;
      if (ra >= 0 && rb >= 0) { A[ra][rb] -= g; A[rb][ra] -= g; }
    };
    const I = (into: number, from: number, i: number) => { if (row[into] >= 0) b[row[into]] += i; if (row[from] >= 0) b[row[from]] -= i; };
    for (let i = 0; i < n; i++) A[i][i] += GMIN;
    els.forEach((x, j) => {
      const e = x.e;
      if (e.k === 'R') G(x.na, x.nb, 1 / e.R);
      else if (e.k === 'E') { G(x.na, x.nb, 1 / e.r); I(x.na, x.nb, e.E / e.r); }
      else if (e.k === 'C') { if (dt) { const g = e.C / dt; G(x.na, x.nb, g); I(x.na, x.nb, g * (vc0[x.part.id] ?? 0)); } }
      else { const [i0, g] = e.f(vd[j]); G(x.na, x.nb, g); I(x.nb, x.na, i0 - g * vd[j]); }
    });
    const x = gauss(A, b);
    V = new Float64Array(N);
    for (let i = 0; i < N; i++) if (row[i] >= 0) V[i] = x[row[i]];
    if (!hasNL) { converged = true; break; }
    let done = it > 0;
    els.forEach((x, j) => {
      const e = x.e; if (e.k !== 'N') return;
      let v = V[x.na] - V[x.nb];
      if (e.vt && e.is) v = pnjlim(v, vd[j], e.vt, e.is);
      else v = vd[j] + Math.max(-2, Math.min(2, v - vd[j])); // lamps: damp big jumps
      if (Math.abs(v - vd[j]) > 1e-9 + 1e-7 * Math.abs(v)) done = false;
      vd[j] = v;
    });
    if (done) { converged = true; break; }
  }

  /* results per part */
  const parts: Record<string, PartResult> = {};
  const shorts: string[] = [];
  const vc: Record<string, number> = {};
  for (const p of c.parts) {
    const nt = KINDS[p.kind].terms.length;
    parts[p.id] = { v: 0, i: 0, p: 0, out: new Array(nt).fill(0) };
  }
  els.forEach((x, j) => {
    const e = x.e, R = parts[x.part.id], v = V[x.na] - V[x.nb];
    let i: number;
    if (e.k === 'R') i = v / e.R;
    else if (e.k === 'E') i = (v - e.E) / e.r;
    else if (e.k === 'C') i = dt ? (e.C / dt) * (v - (vc0[x.part.id] ?? 0)) : 0;
    else i = e.f(hasNL ? vd[j] : v)[0];
    R.out[e.a] -= i; R.out[e.b] += i;
  });
  for (const p of c.parts) {
    const R = parts[p.id], ts = termPts.get(p.id)!;
    const Va = V[netOf[key(ts[0])]], Vb = V[netOf[key(ts[1])]];
    R.v = Va - Vb;
    R.i = p.kind === 'cell' ? R.out[0] : -R.out[0];
    R.p = p.kind === 'cell' ? (p.p.emf ?? 0) * R.i - R.i * R.i * Math.max(p.p.r ?? 0, 0) : R.v * R.i;
    if (p.kind === 'pot') R.p = -R.out.reduce((s, o, t) => s + o * V[netOf[key(ts[t])]], 0);
    switch (p.kind) {
      case 'resistor': case 'varres': R.R = Math.max(p.p.R ?? 0, 0); break;
      case 'pot': R.R = p.p.R; break;
      case 'thermistor': R.R = thermR(p.p.T ?? 20); break;
      case 'ldr': R.R = ldrR(p.p.lux ?? 100); break;
      case 'lamp': case 'diode': case 'led': R.R = Math.abs(R.i) > 1e-9 ? R.v / R.i : Infinity; break;
      case 'ammeter': R.reading = Math.abs(R.i); break;
      case 'voltmeter': R.reading = Math.abs(R.v); break;
      case 'cell': {
        const E = p.p.emf ?? 0;
        R.short = E > 0.05 && Math.abs(R.i) > 0.5 && Math.abs(R.v) < 0.02 * E;
        if (R.short) shorts.push(p.id);
        break;
      }
    }
    if (p.kind === 'capacitor') { const C = p.p.C ?? 470e-6; R.q = C * R.v; R.energy = 0.5 * C * R.v * R.v; R.R = undefined; vc[p.id] = R.v; }
    if (p.kind === 'lamp') { const L = LAMPS[p.p.rating ?? '6V']; R.bright = Math.min(1, Math.max(0, R.p / (L.v * L.i))); }
    if (p.kind === 'led') R.bright = Math.min(1, Math.max(0, R.i / 0.015));
  }

  /* 4. wire currents, net by net */
  const inj = new Map<string, number>();
  for (const p of c.parts) termPts.get(p.id)!.forEach((t, i) => inj.set(key(t), (inj.get(key(t)) ?? 0) + parts[p.id].out[i]));
  const edges: { w: string; a: Pt; b: Pt; len: number; net: number }[] = [];
  for (const w of c.wires) {
    const pts = onWire.get(w.id)!;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > 0) edges.push({ w: w.id, a, b, len, net: netOf[key(a)] });
    }
  }
  const flows: Record<string, WireFlow[]> = {};
  for (const w of c.wires) flows[w.id] = [];
  const byNet = new Map<number, typeof edges>();
  for (const e of edges) { if (!byNet.has(e.net)) byNet.set(e.net, []); byNet.get(e.net)!.push(e); }
  for (const es of byNet.values()) {
    const idx = new Map<string, number>();
    for (const e of es) for (const p of [e.a, e.b]) if (!idx.has(key(p))) idx.set(key(p), idx.size);
    const m = idx.size - 1; // first point is the reference
    const A = Array.from({ length: m }, () => new Float64Array(m)), b = new Float64Array(m);
    for (const e of es) {
      const ia = idx.get(key(e.a))! - 1, ib = idx.get(key(e.b))! - 1, g = 1 / e.len;
      if (ia >= 0) A[ia][ia] += g;
      if (ib >= 0) A[ib][ib] += g;
      if (ia >= 0 && ib >= 0) { A[ia][ib] -= g; A[ib][ia] -= g; }
    }
    for (const [k, i] of idx) if (i > 0) b[i - 1] = inj.get(k) ?? 0;
    const phi = gauss(A, b);
    const at = (p: Pt) => { const i = idx.get(key(p))!; return i === 0 ? 0 : phi[i - 1]; };
    for (const e of es) flows[e.w].push({ a: e.a, b: e.b, i: (at(e.a) - at(e.b)) / e.len });
  }

  const nodeV: Record<string, number> = {};
  for (const p of attach) nodeV[key(p)] = V[netOf[key(p)]];
  return { parts, flows, nodeV, netOf, shorts, converged, vc };
}
