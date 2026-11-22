/* Kinetics Lab, Rate equations: rate = k[A]^m[B]^n with m, n = 0, 1 or 2 (spec 11.1, 11.2, 11.4, 11.5).

   A run is integrated with RK4 on a fine grid. With B in large excess, [B] stays put and the reaction behaves as if
   it were order m in A alone, with k′ = k[B]ⁿ (pseudo-order): then the half-lives follow the textbook patterns
   (zero order: each one half the last; first order: all equal, ln 2/k′; second order: each one double the last).
   Without the excess, A and B are used up one for one and both concentrations fall. */

import { pick, shuffle } from '../../lib/util';

export type Ord = 0 | 1 | 2;
export interface OSet { m: Ord; n: Ord; k: number; A0: number; B0: number; excess: boolean }

export interface ORun {
  tEnd: number;
  A: (t: number) => number;
  B: (t: number) => number;
  rate: (t: number) => number;
  /** times at which [A] reaches A0/2, A0/4, A0/8 (those reached) */
  halves: number[];
  kp: number;            // pseudo rate constant k[B]0ⁿ
}

export const rateOf = (s: OSet, a: number, b: number) => (a <= 0 && s.m > 0 ? 0 : a <= 0 ? 0 : s.k * Math.pow(a, s.m) * Math.pow(Math.max(0, b), s.n));

export function runOrders(s: OSet): ORun {
  const kp = s.k * Math.pow(s.B0, s.n);
  const guess = s.m === 0 ? s.A0 / kp : s.m === 1 ? (4 * Math.LN2) / kp : 7 / (kp * s.A0);
  const N = 2400;
  let tEnd = guess * (s.excess ? 1.05 : 1.6);
  const f = (a: number, b: number) => rateOf(s, a, b);
  const step = (tE: number) => {
    const As = new Float64Array(N + 1), Bs = new Float64Array(N + 1), h = tE / N;
    let a = s.A0, b = s.B0;
    As[0] = a; Bs[0] = b;
    for (let i = 1; i <= N; i++) {
      const sub = 4, hh = h / sub;
      for (let j = 0; j < sub; j++) {
        const db = s.excess ? 0 : 1;
        const k1 = f(a, b), k2 = f(Math.max(0, a - (hh / 2) * k1), b - db * (hh / 2) * k1), k3 = f(Math.max(0, a - (hh / 2) * k2), b - db * (hh / 2) * k2), k4 = f(Math.max(0, a - hh * k3), b - db * hh * k3);
        const d = (hh / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        const used = Math.min(a, d);
        a = Math.max(0, a - used); b = Math.max(0, b - db * used);
      }
      As[i] = a; Bs[i] = b;
    }
    return { As, Bs, h };
  };
  let r = step(tEnd);
  // without the excess the run can be slower than the guess: stretch until A falls below A0/10 (or B runs out)
  for (let tries = 0; tries < 4 && !s.excess && r.As[N] > s.A0 / 10 && r.Bs[N] > 1e-6; tries++) { tEnd *= 2.5; r = step(tEnd); }
  const { As, Bs, h } = r;
  const interp = (arr: Float64Array, t: number) => {
    const u = Math.min(N, Math.max(0, t / h)), i = Math.min(N - 1, Math.floor(u)), fr = u - i;
    return arr[i] + (arr[i + 1] - arr[i]) * fr;
  };
  const halves: number[] = [];
  for (let j = 1; j <= 3; j++) {
    const target = s.A0 / 2 ** j;
    for (let i = 1; i <= N; i++) if (As[i] <= target) { const fr = (As[i - 1] - target) / (As[i - 1] - As[i] || 1); halves.push((i - 1 + fr) * h); break; }
  }
  return { tEnd, A: (t) => interp(As, t), B: (t) => interp(Bs, t), rate: (t) => f(interp(As, t), interp(Bs, t)), halves, kp };
}

/* ---------- units of k ---------- */
const SUP: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
const sup = (n: number) => String(n).split('').map((c) => SUP[c]).join('');
/** units of k for an overall order o: mol^(1−o) dm^(3(o−1)) s⁻¹ */
export function kUnits(o: number) {
  if (o === 0) return 'mol dm⁻³ s⁻¹';
  if (o === 1) return 's⁻¹';
  return `dm${sup(3 * (o - 1))} mol${sup(1 - o)} s⁻¹`;
}
/** how the units come out: rate ÷ concentration^o */
export function kUnitsWorking(o: number) {
  if (o === 0) return 'k = rate, so its units are those of a rate: mol dm⁻³ s⁻¹';
  const conc = o === 1 ? 'mol dm⁻³' : `(mol dm⁻³)${sup(o)}`;
  return `k = rate ÷ [ ]${sup(o)} → (mol dm⁻³ s⁻¹) ÷ ${conc} = ${kUnits(o)}`;
}

/* ---------- the initial-rates problem (11.4i, 11.5iii) ---------- */
export interface IRSystem { eq: string; A: string; B: string; m: Ord; n: Ord; real: boolean }
export const SYSTEMS: IRSystem[] = [
  { eq: '2NO(g) + O₂(g) → 2NO₂(g)', A: 'NO', B: 'O₂', m: 2, n: 1, real: true },
  { eq: 'H₂O₂(aq) + 2I⁻(aq) + 2H⁺(aq) → I₂(aq) + 2H₂O(l)  (H⁺ in excess)', A: 'H₂O₂', B: 'I⁻', m: 1, n: 1, real: true },
  { eq: 'CH₃COCH₃(aq) + I₂(aq) → CH₃COCH₂I(aq) + HI(aq)  (H⁺ kept constant)', A: 'CH₃COCH₃', B: 'I₂', m: 1, n: 0, real: true },
  { eq: '(CH₃)₃CBr + OH⁻ → (CH₃)₃COH + Br⁻', A: '(CH₃)₃CBr', B: 'OH⁻', m: 1, n: 0, real: true },
  { eq: 'CH₃CH₂Br + OH⁻ → CH₃CH₂OH + Br⁻', A: 'CH₃CH₂Br', B: 'OH⁻', m: 1, n: 1, real: true },
  { eq: '2NO(g) + 2H₂(g) → N₂(g) + 2H₂O(g)', A: 'NO', B: 'H₂', m: 2, n: 1, real: true },
  { eq: 'NO₂(g) + CO(g) → NO(g) + CO₂(g)  (below 500 K)', A: 'NO₂', B: 'CO', m: 2, n: 0, real: true },
  { eq: 'S₂O₈²⁻(aq) + 2I⁻(aq) → 2SO₄²⁻(aq) + I₂(aq)', A: 'S₂O₈²⁻', B: 'I⁻', m: 1, n: 1, real: true },
];

export interface IRProblem {
  sys: IRSystem;
  k: number;
  rows: { a: number; b: number; r: number }[];   // the 4th row's rate is to be predicted
  fa: number; fb: number;                         // the factors used in rows 2 and 3
}

const C0 = [0.010, 0.020, 0.025, 0.040, 0.050, 0.10, 0.15, 0.20];
const r3 = (x: number) => Number(x.toPrecision(3));

export function newProblem(): IRProblem {
  let sys: IRSystem;
  if (Math.random() < 0.35) {
    const m = pick([0, 1, 2] as Ord[]), n = pick([0, 1, 2] as Ord[]);
    sys = { eq: 'A + B → products', A: 'A', B: 'B', m, n, real: false };
  } else sys = pick(SYSTEMS);
  const o = sys.m + sys.n;
  // a k that gives rates of a sensible size (about 10⁻⁵ to 10⁻² mol dm⁻³ s⁻¹)
  const a = pick(C0), b = pick(C0);
  const target = 10 ** (-4 + Math.random() * 2);
  const k = Number((target / (Math.pow(a, sys.m) * Math.pow(b, sys.n))).toPrecision(2));
  const fa = pick([2, 3, 4]), fb = pick([2, 3, 0.5]);
  const fb4 = pick([2, 3]), fa4 = pick([2, 0.5]);
  const R = (x: number, y: number) => r3(k * Math.pow(x, sys.m) * Math.pow(y, sys.n));
  const rows = [
    { a, b, r: R(a, b) },
    { a: r3(a * fa), b, r: R(a * fa, b) },
    { a, b: r3(b * fb), r: R(a, b * fb) },
    { a: r3(a * fa4), b: r3(b * fb4), r: R(a * fa4, b * fb4) },
  ];
  void o;
  return { sys, k, rows, fa, fb };
}

export const UNIT_CHOICES = [0, 1, 2, 3, 4].map(kUnits);
export const shuffledUnits = () => shuffle([...UNIT_CHOICES]);

/* ---------- the terms of 11.1 ---------- */
export const TERMS: [string, string][] = [
  ['Rate of reaction', 'The change in concentration of a reactant or product per unit time; units mol dm⁻³ s⁻¹.'],
  ['Rate equation', 'rate = k[A]ᵐ[B]ⁿ: how the rate depends on the concentrations. It can only be found by experiment, not from the balanced equation.'],
  ['Order with respect to a substance', 'The power of its concentration in the rate equation (m for A). 0: changing [A] has no effect; 1: rate ∝ [A]; 2: rate ∝ [A]².'],
  ['Overall order', 'The sum of the orders, m + n.'],
  ['Rate constant, k', 'The constant in the rate equation. Fixed at a given temperature; it rises with temperature (and with a catalyst). Its units depend on the overall order.'],
  ['Half-life, t½', 'The time for the concentration of a reactant to fall to half its value. Constant for a first-order reaction, whatever the starting concentration.'],
  ['Rate-determining step', 'The slowest step in the mechanism. Species in the rate equation take part in (or before) this step.'],
  ['Activation energy, Ea', 'The minimum energy that colliding particles need for a reaction to happen.'],
  ['Heterogeneous / homogeneous catalyst', 'Heterogeneous: in a different phase from the reactants (iron in the Haber process). Homogeneous: in the same phase (H⁺(aq) in the iodination of propanone).'],
];
