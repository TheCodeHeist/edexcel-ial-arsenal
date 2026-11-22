/* Kinetics Lab, Kc and Kp tab: the reactions, their equilibrium constants and the arithmetic (spec 13.1–13.3, 13.9).

   Each reaction lists its species with coefficient and state. Kc includes everything in solution or in the gas (and
   the liquids of a homogeneous liquid mixture such as esterification); solids, and pure liquids beside a solid, are
   left out. Kp includes the gases only, as partial pressures in atm.

   Literature constants: gas reactions from ΔG = ΔH − TΔS with data-book ΔH and S (taken as constant with T), so they
   agree with the Equilibrium and Industry tabs; esterification Kc ≈ 4 (the classic result); Fe²⁺ + Ag⁺ from the
   electrode potentials (E°cell = 0.80 − 0.77 = 0.03 V → K ≈ 3). Presets are solved from these constants, so a student
   working the table gets the literature value back (to the rounding of the "measured" amount). */

import { kp, RA } from './equil';

export type State = 'g' | 'l' | 'aq' | 's';
export interface KSp { f: string; st: State; nu: number; col: string; c3: [number, number, number] }
export interface KRx {
  id: string;
  name: string;
  sp: KSp[];
  T: number;                       // temperature of the data / K
  dH?: number; dS?: number;        // for gas reactions: K from ΔH, ΔS
  Kc?: number;                     // a direct Kc (solutions, liquids)
  vessel: 'flask' | 'liquid' | 'beaker';
  kc: boolean; kp: boolean;        // which constants make sense
  pre: { mode: 'Kc' | 'Kp'; n0: number[]; meas: number; V: number; P: number };
  note: string;
}

export const RXNS: KRx[] = [
  {
    id: 'haber', name: 'Haber process', T: 723, dH: -92.2e3, dS: -198.7, vessel: 'flask', kc: true, kp: true,
    sp: [
      { f: 'N₂', st: 'g', nu: -1, col: '#6f8fd8', c3: [0.45, 0.6, 1.1] },
      { f: 'H₂', st: 'g', nu: -3, col: '#9aa3b8', c3: [0.85, 0.88, 0.95] },
      { f: 'NH₃', st: 'g', nu: 2, col: '#3fae7a', c3: [0.35, 0.95, 0.55] },
    ],
    pre: { mode: 'Kp', n0: [1, 3, 0], meas: 2, V: 10, P: 200 },
    note: 'Ammonia: a typical question gives the moles at equilibrium and the total pressure.',
  },
  {
    id: 'hi', name: 'Hydrogen iodide', T: 698, dH: -9.6e3, dS: 19.5, vessel: 'flask', kc: true, kp: true,
    sp: [
      { f: 'H₂', st: 'g', nu: -1, col: '#9aa3b8', c3: [0.85, 0.88, 0.95] },
      { f: 'I₂', st: 'g', nu: -1, col: '#8e44c8', c3: [0.65, 0.25, 0.95] },
      { f: 'HI', st: 'g', nu: 2, col: '#c76a7e', c3: [0.95, 0.6, 0.66] },
    ],
    pre: { mode: 'Kc', n0: [1, 1, 0], meas: 2, V: 1, P: 1 },
    note: 'Equal numbers of moles on each side: Kc has no units, the volume cancels, and Kc = Kp.',
  },
  {
    id: 'no2', name: 'Dinitrogen tetroxide', T: 298, dH: 57.2e3, dS: 175.8, vessel: 'flask', kc: true, kp: true,
    sp: [
      { f: 'N₂O₄', st: 'g', nu: -1, col: '#9aa3b8', c3: [0.86, 0.88, 0.95] },
      { f: 'NO₂', st: 'g', nu: 2, col: '#c8642a', c3: [0.95, 0.36, 0.08] },
    ],
    pre: { mode: 'Kp', n0: [1, 0], meas: 1, V: 10, P: 1 },
    note: 'The brown gas of the Equilibrium tab.',
  },
  {
    id: 'ester', name: 'Esterification', T: 298, Kc: 4.0, vessel: 'liquid', kc: true, kp: false,
    sp: [
      { f: 'CH₃COOH', st: 'l', nu: -1, col: '#d8a03a', c3: [1.0, 0.72, 0.25] },
      { f: 'C₂H₅OH', st: 'l', nu: -1, col: '#6fb7d8', c3: [0.45, 0.8, 1.0] },
      { f: 'CH₃COOC₂H₅', st: 'l', nu: 1, col: '#c86fd8', c3: [0.9, 0.45, 1.0] },
      { f: 'H₂O', st: 'l', nu: 1, col: '#4a7fd0', c3: [0.3, 0.5, 1.0] },
    ],
    pre: { mode: 'Kc', n0: [1, 1, 0, 0], meas: 2, V: 0.1, P: 1 },
    note: 'All four are liquids mixed together (one phase), so all four appear in Kc. Equal moles each side: the volume cancels.',
  },
  {
    id: 'fe', name: 'Iron(II) and silver ions', T: 298, Kc: 3.2, vessel: 'beaker', kc: true, kp: false,
    sp: [
      { f: 'Fe²⁺', st: 'aq', nu: -1, col: '#5fa86a', c3: [0.45, 0.9, 0.5] },
      { f: 'Ag⁺', st: 'aq', nu: -1, col: '#b8c0d0', c3: [0.85, 0.9, 1.0] },
      { f: 'Fe³⁺', st: 'aq', nu: 1, col: '#d0883a', c3: [1.0, 0.6, 0.2] },
      { f: 'Ag', st: 's', nu: 1, col: '#8e96a6', c3: [0.8, 0.82, 0.88] },
    ],
    pre: { mode: 'Kc', n0: [0.05, 0.05, 0, 0], meas: 2, V: 0.1, P: 1 },
    note: 'Heterogeneous: the silver is a solid, so it is left out of Kc. Suggested practical: titrate the Fe²⁺ left with manganate(VII), or the Ag⁺ with thiocyanate.',
  },
  {
    id: 'caco3', name: 'Calcium carbonate', T: 1073, dH: 178.3e3, dS: 160.7, vessel: 'flask', kc: true, kp: true,
    sp: [
      { f: 'CaCO₃', st: 's', nu: -1, col: '#d8d8d0', c3: [0.95, 0.95, 0.9] },
      { f: 'CaO', st: 's', nu: 1, col: '#e8d8b0', c3: [1.0, 0.9, 0.7] },
      { f: 'CO₂', st: 'g', nu: 1, col: '#7a8a9a', c3: [0.6, 0.7, 0.8] },
    ],
    pre: { mode: 'Kp', n0: [1, 0, 0], meas: 2, V: 10, P: 1 },
    note: 'Heterogeneous: both solids are left out, so Kp is just the pressure of carbon dioxide.',
  },
  {
    id: 'nh4cl', name: 'Ammonium chloride', T: 600, dH: 176.0e3, dS: 284.8, vessel: 'flask', kc: true, kp: true,
    sp: [
      { f: 'NH₄Cl', st: 's', nu: -1, col: '#e0e0e8', c3: [0.95, 0.95, 1.0] },
      { f: 'NH₃', st: 'g', nu: 1, col: '#3fae7a', c3: [0.35, 0.95, 0.55] },
      { f: 'HCl', st: 'g', nu: 1, col: '#c8d850', c3: [0.85, 0.95, 0.35] },
    ],
    pre: { mode: 'Kp', n0: [0.5, 0, 0], meas: 1, V: 10, P: 1 },
    note: 'Heated in a sealed tube. The solid is left out; NH₃ and HCl are made in equal amounts, so each has half the pressure.',
  },
];

const SUP = (n: number) => String(n).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+c]);
export const sup = SUP;

/** Is this species in Kc / Kp? Solids never; Kp: gases only. */
export const inKc = (s: KSp) => s.st !== 's';
export const inKp = (s: KSp) => s.st === 'g';
/** Δn for the constant: Σν of the species that appear. */
export const dnK = (r: KRx, mode: 'Kc' | 'Kp') => r.sp.filter(mode === 'Kc' ? inKc : inKp).reduce((a, s) => a + s.nu, 0);

export function unitsKc(d: number) { return d === 0 ? 'no units' : `${d === 1 ? 'mol' : 'mol' + SUP(d)} dm${SUP(-3 * d)}`; }
export function unitsKp(d: number) { return d === 0 ? 'no units' : d === 1 ? 'atm' : `atm${SUP(d)}`; }

/** Literature K at r.T: [value, units]. */
export function litK(r: KRx, mode: 'Kc' | 'Kp'): number {
  if (r.dH !== undefined && r.dS !== undefined) {
    const Kp = kp({ dH: r.dH, dS: r.dS }, r.T);
    if (mode === 'Kp') return Kp;
    return Kp / (RA * r.T) ** dnK(r, 'Kp');           // Kc = Kp ÷ (RT)^Δn(gas)
  }
  return r.Kc ?? 1;
}

/** The quotient from equilibrium moles: Kc from concentrations (n/V), Kp from partial pressures (x × P). */
export function quotient(r: KRx, mode: 'Kc' | 'Kp', n: number[], V: number, P: number) {
  const ng = r.sp.reduce((a, s, i) => a + (s.st === 'g' ? Math.max(0, n[i]) : 0), 0);
  const val = r.sp.map((_s, i) => (mode === 'Kc' ? n[i] / V : ng > 0 ? (n[i] / ng) * P : 0));
  let K = 1;
  r.sp.forEach((s, i) => { if (mode === 'Kc' ? inKc(s) : inKp(s)) K *= val[i] ** s.nu; });
  return { val, ng, K };
}

/** Solve for the equilibrium moles from n0 (bisection on the extent), at fixed V (Kc) or fixed total P (Kp). */
export function solve(r: KRx, mode: 'Kc' | 'Kp', n0: number[], V: number, P: number) {
  const K = Math.log(litK(r, mode));
  let lo = -Infinity, hi = Infinity;
  r.sp.forEach((s, i) => { const lim = -n0[i] / s.nu; if (s.nu < 0) hi = Math.min(hi, lim); else lo = Math.max(lo, lim); });
  if (!isFinite(lo)) lo = -1e3; if (!isFinite(hi)) hi = 1e3;
  const at = (x: number) => r.sp.map((s, i) => n0[i] + s.nu * x);
  const lq = (x: number) => Math.log(Math.max(1e-300, quotient(r, mode, at(x).map((v) => Math.max(v, 1e-300)), V, P).K));
  for (let k = 0; k < 200; k++) { const m = (lo + hi) / 2; if (lq(m) > K) hi = m; else lo = m; }
  const x = (lo + hi) / 2;
  return { x, n: at(x).map((v) => Math.max(0, v)) };
}

/** Round to 3 significant figures (a "measured" amount). */
export const sf3 = (x: number) => (x === 0 ? 0 : Number(x.toPrecision(3)));

/** 13.9: what the size of K says. */
export function extent(K: number) {
  const L = Math.log10(K);
  if (L > 10) return 'K is enormous: the reaction goes, in effect, to completion. Hardly any reactant is left.';
  if (L > 2) return 'K is large: the position of equilibrium lies well to the right, with mostly products.';
  if (L >= -2) return 'K is near 1: the equilibrium mixture has significant amounts of both reactants and products.';
  if (L >= -10) return 'K is small: the position of equilibrium lies well to the left, with mostly reactants.';
  return 'K is tiny: in effect, the reaction does not happen.';
}
