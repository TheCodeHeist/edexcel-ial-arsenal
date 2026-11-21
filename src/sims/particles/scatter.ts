/* Particle Lab: α-particle scattering (Geiger and Marsden, 1909–1913; Rutherford's explanation, 1911).

   An α particle (charge +2e) passing a nucleus (charge +Ze) at impact parameter b follows a hyperbola and is turned
   through θ with
       tan(θ/2) = d / 2b,     d = kQq / Eₖ  (the closest a head-on α gets: all its Eₖ turned into electric PE).
   In a foil of n atoms per m³ and thickness t, each α effectively meets one nucleus closest, at an impact parameter
   spread evenly over the area 1/(nt) that each nucleus "owns" (single scattering: true for thin foils and all but
   the smallest angles). So the chance of a deflection of more than θ is
       P(> θ) = n t π (d/2)² cot²(θ/2),
   and the number reaching a detector of fixed size at angle θ goes as 1/sin⁴(θ/2): Rutherford's formula,
       dN/dΩ = N n t (d/4)² / sin⁴(θ/2).
   The lab samples every α from exactly this, so the counts it builds up are honest.

   The plum-pudding (Thomson) atom spreads the positive charge over the whole atom (radius R ≈ 10⁻¹⁰ m). One atom can
   then deflect an α by only about d/R (≈ 0.01°), and the thousands of atoms across the foil add up like a random walk:
   a typical deflection of a fraction of a degree, and essentially never more than a few degrees. That is the
   order-of-magnitude estimate the lab uses for its comparison. */

import { E, K, MEV, sci, plain } from './data';

export interface Target {
  id: string; sym: string; name: string;
  Z: number; A: number;
  n: number;        // atoms per m³ (ρN_A/M)
  R: number;        // atomic (metallic) radius / m
  iso: string;      // isotopes note
}
export const TARGETS: Target[] = [
  { id: 'au', sym: 'Au', name: 'gold', Z: 79, A: 197, n: 5.9e28, R: 1.44e-10, iso: 'Gold has only one stable isotope, gold-197 (¹⁹⁷₇₉Au): 79 protons and 118 neutrons. Geiger and Marsden used gold because it can be beaten into foil only a few hundred atoms thick.' },
  { id: 'ag', sym: 'Ag', name: 'silver', Z: 47, A: 107, n: 5.85e28, R: 1.44e-10, iso: 'Silver has two stable isotopes: silver-107 (52%) and silver-109 (48%). Same proton number 47, so the same element; 60 or 62 neutrons.' },
  { id: 'al', sym: 'Al', name: 'aluminium', Z: 13, A: 27, n: 6.02e28, R: 1.43e-10, iso: 'Aluminium has one stable isotope, aluminium-27 (²⁷₁₃Al): 13 protons and 14 neutrons.' },
];
export const ALPHA = { Z: 2, A: 4, sym: 'He' };
/** r₀ for nuclear radii, r = r₀A^⅓ (beyond the spec). */
export const R0 = 1.2e-15;

/** Distance of closest approach for a head-on α: d = kQq/Eₖ (m). E in MeV. */
export const closest = (tg: Target, mev: number) => (K * tg.Z * E * ALPHA.Z * E) / (mev * MEV);
export const nucRadius = (A: number) => R0 * Math.cbrt(A);
/** Whether the α reaches the nucleus's surface (then the strong force acts and the Coulomb law alone fails). */
export const touches = (tg: Target, mev: number) => closest(tg, mev) < nucRadius(tg.A) + nucRadius(ALPHA.A);

/** Deflection for impact parameter b: θ = 2 arctan(d / 2b). */
export const thetaOf = (b: number, d: number) => 2 * Math.atan2(d, 2 * b);
/** Chance of a deflection of more than θ (rad), single scattering. */
export const pMore = (theta: number, d: number, nt: number) => Math.min(1, nt * Math.PI * (d / 2) ** 2 / Math.tan(theta / 2) ** 2);
/** Expected count per steradian at θ after N α. */
export const perSr = (theta: number, d: number, nt: number, N: number) => (N * nt * (d / 4) ** 2) / Math.sin(theta / 2) ** 4;

/** Typical (rms) deflection in the plum-pudding model, rad: one atom gives about d/R; √(atoms crossed) of them add up. */
export function thomsonRms(tg: Target, mev: number, t: number) {
  const one = closest(tg, mev) / tg.R;
  const atoms = t / (2 * tg.R);
  return one * Math.sqrt(atoms);
}

/** One sampled α: deflection θ (rad) for the nuclear atom or the plum pudding. */
export function sample(nuclear: boolean, d: number, nt: number, rms: number): number {
  if (nuclear) {
    const u = 1 - Math.random();
    const b = Math.sqrt(u / (Math.PI * nt));
    return thetaOf(b, d);
  }
  // a 2D random walk: the angle has a Rayleigh distribution
  const u = 1 - Math.random();
  return rms * Math.sqrt(-Math.log(u));
}

export const BIN = 5;                       // degrees
export const NBIN = 180 / BIN;
/** Solid angle of the cone shell between θ1 and θ2 (degrees). */
export const shell = (a: number, b: number) => 2 * Math.PI * (Math.cos((a * Math.PI) / 180) - Math.cos((b * Math.PI) / 180));

export const fmtM = (m: number) => `${sci(m)} m`;
export const fm = (m: number) => `${plain(m * 1e15)} fm`;
