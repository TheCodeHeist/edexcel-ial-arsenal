/* Kinetics Lab, Core Practicals 9a, 9b and 10 (spec 11.10, 11.12, 11.13): the chemistry behind each experiment, worked
   out as plain numbers so the tab can generate a student's own (slightly noisy) results.

   CP9a: the acid-catalysed iodination of propanone, CH₃COCH₃ + I₂ → CH₃COCH₂I + HI, rate = k[CH₃COCH₃][H⁺] and zero
   order in I₂. Propanone and acid are in large excess, so [I₂] falls in a straight line. Followed by withdrawing
   10.0 cm³ samples, quenching them in sodium hydrogencarbonate (which neutralises the acid catalyst) and titrating the
   iodine left with sodium thiosulfate (I₂ + 2S₂O₃²⁻ → 2I⁻ + S₄O₆²⁻), or continuously with a colorimeter.
   k ≈ 2.8 × 10⁻⁵ dm³ mol⁻¹ s⁻¹ at 25 °C (the literature value for this reaction is about 2.7–2.9 × 10⁻⁵).

   CP9b and CP10: the iodine clock (Harcourt–Esson): H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O, rate = k[H₂O₂][I⁻] in dilute acid.
   A small fixed amount of thiosulfate turns the iodine straight back into iodide until it is used up; then the next
   iodine meets the starch and the mixture turns blue-black. The same amount of iodine has formed by then in every
   run, so rate ∝ 1/t. Thiosulfate keeps [I⁻] constant and very little H₂O₂ is used, so this is an initial rate.
   k = 0.0115 dm³ mol⁻¹ s⁻¹ at 25 °C and Ea = 56 kJ mol⁻¹ (the H₂O₂ + I⁻ step). */

import { R } from './consts';

/** a normally distributed random number (mean 0, sd 1) */
export const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
const round = (x: number, step: number) => Math.round(x / step) * step;

/** least-squares straight line through points */
export function fit(pts: { x: number; y: number }[]) {
  const n = pts.length;
  if (n < 2) return null;
  const mx = pts.reduce((s, p) => s + p.x, 0) / n, my = pts.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of pts) { sxx += (p.x - mx) ** 2; sxy += (p.x - mx) * (p.y - my); syy += (p.y - my) ** 2; }
  if (sxx <= 0) return null;
  const m = sxy / sxx;
  return { m, c: my - m * mx, r2: syy > 0 ? (sxy * sxy) / (sxx * syy) : 1 };
}

/* ---------- CP9a: iodine–propanone ---------- */
export const P9 = {
  k: 2.8e-5,            // dm³ mol⁻¹ s⁻¹ at 25 °C
  vProp: 25, vAcid: 25, vI2: 50,    // cm³ mixed: 100 cm³ in all
  cI2: 0.020,           // mol dm⁻³ iodine stock (in KI) → 0.010 in the flask
  aliquot: 10.0,        // cm³ pipetted out each time
  cThio: 0.010,         // mol dm⁻³ thiosulfate
  every: 5,             // minutes between samples
  n: 7,                 // samples: 5, 10, … 35 min
  absPerM: 80,          // colorimeter absorbance per mol dm⁻³ of I₂ (A = 0.80 at the start)
};
/** initial concentrations in the 100 cm³ flask, from the stock concentrations chosen */
export function mix9(cProp: number, cAcid: number) {
  const P = (cProp * P9.vProp) / 100, Hp = (cAcid * P9.vAcid) / 100, I0 = (P9.cI2 * P9.vI2) / 100;
  return { P, Hp, I0, rate: P9.k * P * Hp };
}
/** [I₂] after t seconds (zero order in I₂: a straight line until it runs out) */
export const iodine = (m: ReturnType<typeof mix9>, t: number) => Math.max(0, m.I0 - m.rate * t);
/** the titre (cm³) for a sample taken at t s: I₂ + 2S₂O₃²⁻, so n(S₂O₃²⁻) = 2 n(I₂) */
export const titreOf = (i2: number) => (2 * i2 * P9.aliquot) / P9.cThio;
export interface Sample { min: number; t: number; titre: number; abs: number }
export function sample9(m: ReturnType<typeof mix9>, min: number): Sample {
  const tq = min * 60 + gauss() * 8;                     // a few seconds’ slip in noting when the sample was quenched
  const i2 = iodine(m, tq);
  return {
    min, t: min * 60,
    titre: Math.max(0, round(titreOf(i2) + gauss() * 0.08, 0.05)),       // burette read to ±0.05 cm³
    abs: Math.max(0, round(P9.absPerM * i2 + gauss() * 0.006, 0.01)),
  };
}

/* ---------- the iodine clock (CP9b, CP10) ---------- */
export const CLK = {
  k298: 0.0115,         // dm³ mol⁻¹ s⁻¹ at 25 °C
  Ea: 56000,            // J mol⁻¹
  cH2O2: 0.10, cKI: 0.10,           // stock / mol dm⁻³
  cThio: 0.005, vThio: 5,           // thiosulfate added: 2.5 × 10⁻⁵ mol
  vTotal: 50,                       // cm³ in every run
  room: 20,                         // °C for CP9b
};
export const kAt = (Tc: number) => CLK.k298 * Math.exp((-CLK.Ea / R) * (1 / (Tc + 273) - 1 / 298));
/** [I₂] that must form before the blue appears (half the thiosulfate) */
export const I2_NEEDED = ((CLK.cThio * CLK.vThio) / 1000 / 2) / (CLK.vTotal / 1000);
/** true time to the blue-black colour for vH2O2 and vKI cm³ of the stock solutions at Tc °C */
export function clockTime(vH2O2: number, vKI: number, Tc: number) {
  const h = (CLK.cH2O2 * vH2O2) / CLK.vTotal, i = (CLK.cKI * vKI) / CLK.vTotal;
  return { h, i, t: I2_NEEDED / (kAt(Tc) * h * i), rate: kAt(Tc) * h * i };
}
/** what a student with a stopwatch records: reaction time and a little scatter from mixing and temperature */
export const observed = (t: number) => Math.max(1, round(t * (1 + gauss() * 0.015) + 0.3 + Math.abs(gauss()) * 0.25, 0.1));

export interface ClockRun { v: number; t: number; true: number }
export interface HotRun { set: number; T: number; t: number }
