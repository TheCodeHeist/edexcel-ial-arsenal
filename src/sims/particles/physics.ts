/* Particle Lab: the formulas shared by the accelerators, the detectors and the practice questions.

   The course uses Newtonian kinetic energy (Eₖ = ½mv², eV = ½mv²) and r = p/BQ with p = mv. Near the speed of light
   that breaks down: the lab computes the true (relativistic) speed and momentum and says when the two differ by more
   than a per cent or so, which is the honest way to show why accelerators need special relativity without asking
   the student to use it (the specification does not require the relativistic equations). */

import { E, C, ME, MP, U, H, MEV } from './data';

export interface Beam { id: string; name: string; sym: string; m: number; q: number /* C, signed */; mev: number /* rest energy */ }
export const BEAMS: Record<string, Beam> = {
  e: { id: 'e', name: 'electron', sym: 'e⁻', m: ME, q: -E, mev: 0.511 },
  p: { id: 'p', name: 'proton', sym: 'p', m: MP, q: E, mev: 938.3 },
  d: { id: 'd', name: 'deuteron', sym: '²H⁺', m: 2.014 * U, q: E, mev: 1875.6 },
  a: { id: 'a', name: 'α particle', sym: 'α', m: 4.0015 * U, q: 2 * E, mev: 3727.4 },
  pos: { id: 'pos', name: 'positron', sym: 'e⁺', m: ME, q: E, mev: 0.511 },
};

/** Newtonian speed from kinetic energy (J): v = √(2Eₖ/m). */
export const vClassic = (KE: number, m: number) => Math.sqrt((2 * KE) / m);
/** Lorentz factor from kinetic energy: γ = 1 + Eₖ/mc². */
export const gammaOf = (KE: number, m: number) => 1 + KE / (m * C * C);
/** True speed from kinetic energy. */
export const vTrue = (KE: number, m: number) => { const g = gammaOf(KE, m); return C * Math.sqrt(1 - 1 / (g * g)); };
/** True momentum from kinetic energy: pc = √(Eₖ² + 2Eₖmc²). */
export const pTrue = (KE: number, m: number) => Math.sqrt(KE * KE + 2 * KE * m * C * C) / C;
/** Newtonian momentum: p = √(2mEₖ). */
export const pClassic = (KE: number, m: number) => Math.sqrt(2 * m * KE);
/** Radius of the circle in a magnetic field: r = p/BQ. */
export const radiusOf = (p: number, B: number, q: number) => p / (B * Math.abs(q));
/** Cyclotron frequency (the alternating p.d. must match it): f = BQ/2πm, the same at every radius. */
export const cycloF = (B: number, q: number, m: number) => (B * Math.abs(q)) / (2 * Math.PI * m);
/** de Broglie wavelength λ = h/p. */
export const lambdaOf = (p: number) => H / p;
/** Kinetic energy from momentum (relativistic). */
export const keFromP = (p: number, m: number) => Math.sqrt((p * C) ** 2 + (m * C * C) ** 2) - m * C * C;

/** How far a particle of lifetime τ (s) gets at speed v: without and with time dilation. */
export function reach(tau: number, v: number) {
  const g = 1 / Math.sqrt(1 - (v / C) ** 2);
  return { g, classic: v * tau, dilated: g * v * tau, life: g * tau };
}

export const J2MEV = (j: number) => j / MEV;
export const MEV2J = (m: number) => m * MEV;
