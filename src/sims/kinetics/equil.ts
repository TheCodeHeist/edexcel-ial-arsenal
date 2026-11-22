/* Kinetics Lab, Equilibrium tab: the chemistry, as plain numbers (no three.js here).

   A gas equilibrium in a sealed syringe is integrated as two opposing reactions:
     rate forward  r_f = k_f × Π[reactant]^a      rate backward  r_b = k_b × Π[product]^b
   with k_f / k_b = K_c(T) at every temperature, so the mixture always settles where Q_c = K_c. K_p(T) comes from
   ΔG = ΔH − TΔS (data-book ΔH and ΔS, taken as constant), and K_c = K_p ÷ (RT)^Δn with R = 0.08206 dm³ atm K⁻¹ mol⁻¹.

   Time is slowed for the screen: N₂O₄ ⇌ 2NO₂ really settles in microseconds. Only the ratio k_f/k_b matters to the
   position of equilibrium; the size of each k is chosen so the change takes a second or two to watch.

   The engine also keeps whole-particle counts for the 3D view (scale particles per mole). Every forward or backward
   event it fires is queued, so the view can split or join the actual particles involved: the reactions go on in both
   directions at equilibrium, at equal rates.

   ICl + Cl₂ ⇌ ICl₃ is heterogeneous (liquid + gas ⇌ solid): K_p = 1/p(Cl₂), so at a given temperature solid ICl₃ is
   stable only while p(Cl₂) is above p*(T) = 1/K_p. */

export const RJ = 8.314;           // J K⁻¹ mol⁻¹
export const RA = 0.08206;         // dm³ atm K⁻¹ mol⁻¹

export interface Sp {
  f: string;                      // formula, with Unicode subscripts
  name: string;
  col: [number, number, number];  // particle colour (3D, may exceed 1 for glow)
  css: string;                    // colour for plots
  size: number;                   // particle size (world units)
  tint?: [number, number, number, number];  // colour it gives the gas [r, g, b, absorbance per mol dm⁻³]
}

export interface GasSys {
  id: 'no2' | 'hi';
  name: string;
  eq: string;                     // the equation, with ⇌
  sp: Sp[];
  nu: number[];                   // stoichiometric coefficients: − reactants, + products
  dH: number;                     // ΔH (forward) J mol⁻¹
  dS: number;                     // ΔS (forward) J K⁻¹ mol⁻¹
  T: [number, number, number];    // min, start, max / K
  n0: number[];                   // starting moles
  kb0: number;                    // k_b at the start temperature
  Eab: number;                    // activation energy of the backward reaction (screen kinetics only) / J mol⁻¹
  add: number;                    // which species the "add" button adds
  scale: number;                  // particles per mole
  vessel: string;
}

export const SYSTEMS: GasSys[] = [
  {
    id: 'no2', name: 'Nitrogen dioxide', eq: 'N₂O₄(g) ⇌ 2NO₂(g)', vessel: 'sealed gas syringe',
    sp: [
      { f: 'N₂O₄', name: 'dinitrogen tetroxide', col: [0.68, 0.7, 0.76], css: '#9aa3b8', size: 0.24 },
      { f: 'NO₂', name: 'nitrogen dioxide', col: [0.95, 0.36, 0.08], css: '#c8642a', size: 0.17, tint: [0.5, 0.2, 0.04, 34] },
    ],
    nu: [-1, 2], dH: 57.2e3, dS: 175.8, T: [260, 298, 380], n0: [0.004, 0], kb0: 12, Eab: 0, add: 1, scale: 40000,
  },
  {
    id: 'hi', name: 'Hydrogen iodide', eq: 'H₂(g) + I₂(g) ⇌ 2HI(g)', vessel: 'sealed vessel with a piston',
    sp: [
      { f: 'H₂', name: 'hydrogen', col: [0.82, 0.86, 0.95], css: '#8a93a8', size: 0.13 },
      { f: 'I₂', name: 'iodine', col: [0.62, 0.2, 0.85], css: '#8e44c8', size: 0.24, tint: [0.4, 0.1, 0.48, 40] },
      { f: 'HI', name: 'hydrogen iodide', col: [0.95, 0.6, 0.66], css: '#c76a7e', size: 0.18 },
    ],
    nu: [-1, -1, 2], dH: -9.6e3, dS: 19.5, T: [600, 698, 800], n0: [0.002, 0.002, 0], kb0: 2, Eab: 30e3, add: 0, scale: 40000,
  },
];

/** K_p(T) in atm^Δn from constant ΔH and ΔS. */
export const kp = (s: Pick<GasSys, 'dH' | 'dS'>, T: number) => Math.exp(-s.dH / (RJ * T) + s.dS / RJ);
export const dn = (s: GasSys) => s.nu.reduce((a, b) => a + b, 0);
/** K_c(T) in (mol dm⁻³)^Δn. */
export const kc = (s: GasSys, T: number) => kp(s, T) / (RA * T) ** dn(s);
/** Units of K_c from Δn, e.g. "mol dm⁻³", "mol⁻² dm⁶", "no units". */
export function kcUnits(d: number) {
  if (d === 0) return 'no units';
  const sup = (n: number) => String(n).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]);
  const m = d === 1 ? 'mol' : `mol${sup(d)}`, v = `dm${sup(-3 * d)}`;
  return `${m} ${v}`;
}
export function kpUnits(d: number) {
  if (d === 0) return 'no units';
  const sup = (n: number) => String(n).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]);
  return d === 1 ? 'atm' : `atm${sup(d)}`;
}

export interface Sample { t: number; c: number[]; rf: number; rb: number }
export type Ev = 1 | -1 | { add: number; k: number };

/** The running gas equilibrium. */
export class Gas {
  s: GasSys;
  T: number;           // gas temperature / K (follows Tset with a lag, like a water bath)
  Tset: number;
  V: number;           // volume / dm³
  n: number[];         // moles
  cat = false;
  t = 0;               // screen time / s
  disp: number[];      // whole particles of each species
  queue: Ev[] = [];
  hist: Sample[] = [];
  gen = 0;             // bumps on every reset (the view rebuilds its particles)
  #accF = 0;
  #accB = 0;
  #lastS = -1;

  constructor(s: GasSys) {
    this.s = s; this.T = this.Tset = s.T[1]; this.V = 0.1; this.n = [...s.n0];
    this.settle();
    this.disp = this.n.map((x) => Math.round(x * s.scale));
  }

  reset(s: GasSys = this.s, settle = true) {
    this.s = s; this.T = this.Tset = s.T[1]; this.V = 0.1; this.n = [...s.n0]; this.cat = false; this.t = 0;
    this.hist = []; this.queue = []; this.#accF = this.#accB = 0; this.#lastS = -1;
    if (settle) this.settle();
    this.disp = this.n.map((x) => Math.round(x * s.scale));
    this.gen++;
  }

  conc() { return this.n.map((x) => Math.max(0, x) / this.V); }
  kc() { return kc(this.s, this.T); }
  kb() { return this.s.kb0 * Math.exp((-this.s.Eab / RJ) * (1 / this.T - 1 / this.s.T[1])) * (this.cat ? 5 : 1); }
  kf() { return this.kb() * this.kc(); }
  rates() {
    const c = this.conc(), nu = this.s.nu;
    let rf = this.kf(), rb = this.kb();
    nu.forEach((v, i) => { if (v < 0) rf *= c[i] ** -v; else rb *= c[i] ** v; });
    return { rf, rb };
  }
  /** The reaction quotient Q_c with the current concentrations. */
  q() { const c = this.conc(); let q = 1; this.s.nu.forEach((v, i) => { q *= Math.max(c[i], 1e-12) ** v; }); return q; }
  /** Total pressure / atm (ideal gas). */
  p() { return (this.n.reduce((a, b) => a + b, 0) * RA * this.T) / this.V; }

  /** Jump straight to equilibrium (used at the start): solve for the extent by bisection. */
  settle() {
    const K = Math.log(this.kc()), nu = this.s.nu, n0 = [...this.n];
    let lo = -Infinity, hi = Infinity;
    nu.forEach((v, i) => { const lim = -n0[i] / v; if (v < 0) hi = Math.min(hi, lim); else lo = Math.max(lo, lim); });
    const lq = (x: number) => nu.reduce((a, v, i) => a + v * Math.log(Math.max((n0[i] + v * x) / this.V, 1e-300)), 0);
    for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (lq(m) > K) hi = m; else lo = m; }
    const x = (lo + hi) / 2;
    this.n = n0.map((y, i) => Math.max(0, y + nu[i] * x));
  }

  addMol(i: number, mol: number) {
    this.n[i] += mol;
    const k = Math.round(mol * this.s.scale);
    this.disp[i] += k;
    this.queue.push({ add: i, k });
  }

  step(dt: number) {
    // the water bath: the gas follows the set temperature over about a second
    this.T += (this.Tset - this.T) * (1 - Math.exp(-dt / 0.9));
    const N = 60, h = dt / N, nu = this.s.nu;
    let fSum = 0, bSum = 0;
    for (let k = 0; k < N; k++) {
      const { rf, rb } = this.rates();
      let x = (rf - rb) * this.V * h;
      // never use up more than there is
      nu.forEach((v, i) => { if (v * x < 0) { const lim = this.n[i] / Math.abs(v); if (Math.abs(x) > lim) x = Math.sign(x) * lim; } });
      nu.forEach((v, i) => { this.n[i] = Math.max(0, this.n[i] + v * x); });
      fSum += rf * this.V * h; bSum += rb * this.V * h;
    }
    this.t += dt;
    // events for the particles: both directions, at their own rates
    this.#accF += fSum * this.s.scale; this.#accB += bSum * this.s.scale;
    const fire = (dir: 1 | -1) => {
      const ok = nu.every((v, i) => (v * dir < 0 ? this.disp[i] >= Math.abs(v) : true));
      if (!ok) return false;
      nu.forEach((v, i) => { this.disp[i] += v * dir; });
      if (this.queue.length < 400) this.queue.push(dir);
      return true;
    };
    let guard = 0;
    while (this.#accF >= 1 && guard++ < 200) { this.#accF -= 1; if (!fire(1)) { this.#accF = 0; break; } }
    guard = 0;
    while (this.#accB >= 1 && guard++ < 200) { this.#accB -= 1; if (!fire(-1)) { this.#accB = 0; break; } }
    // keep the particle counts honest (the integrator is the truth): nudge with extra events if they drift
    const j = nu.findIndex((v) => v > 0), want = Math.round(this.n[j] * this.s.scale);
    guard = 0;
    while (Math.abs(this.disp[j] - want) >= 2 && guard++ < 50) { if (!fire(this.disp[j] < want ? 1 : -1)) break; }
    // history for the graphs, every 0.1 s, the last 30 s
    const sNow = Math.floor(this.t * 10);
    if (sNow !== this.#lastS) {
      this.#lastS = sNow;
      const { rf, rb } = this.rates();
      this.hist.push({ t: this.t, c: this.conc(), rf, rb });
      if (this.hist.length > 300) this.hist.shift();
    }
  }
}

/* ---------- ICl + Cl₂ ⇌ ICl₃ in a U-tube ---------- */
export const ICL = { dH: -65.6e3, dS: -190.7 };   // ICl(l) + Cl₂(g) → ICl₃(s): ΔH_f ICl(l) −23.9, ICl₃(s) −89.5 kJ mol⁻¹
/** p*(T): the chlorine pressure (atm) at which solid ICl₃ and liquid ICl are in equilibrium. K_p = 1/p(Cl₂). */
export const pStar = (T: number) => 1 / kp(ICL, T);

export class UTube {
  T = 293;
  Tset = 293;
  liq = 1;          // ICl (relative amount)
  sol = 0;          // ICl₃
  gas = 0;          // Cl₂ in the tube, as pressure / atm
  flow = false;     // chlorine being passed in
  t = 0;
  step(dt: number) {
    this.T += (this.Tset - this.T) * (1 - Math.exp(-dt / 0.9));
    const N = 20, h = dt / N;
    for (let k = 0; k < N; k++) {
      if (this.flow) this.gas += (1 - this.gas) * (1 - Math.exp(-h / 0.35));      // fresh Cl₂ at 1 atm
      const ps = pStar(this.T);
      let r = 0.9 * (this.gas - ps);                                               // forward if Cl₂ is above p*
      if (r > 0) r = Math.min(r, this.liq / h, this.gas / (3 * h));
      else r = Math.max(r, -this.sol / h);
      const x = r * h;
      this.liq -= x; this.sol += x; this.gas -= 3 * x;                              // 1 atm of Cl₂ in the tube makes a third of the solid
      this.liq = Math.max(0, this.liq); this.sol = Math.max(0, this.sol); this.gas = Math.max(0, this.gas);
    }
    this.t += dt;
  }
}
