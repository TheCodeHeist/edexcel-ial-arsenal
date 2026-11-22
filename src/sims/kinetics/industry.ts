/* Kinetics Lab, Industry tab: equilibrium yield, rate and cost for the industrial processes (spec 9.11, 13.6, 13.8).

   K_p(T) from ΔG = ΔH − TΔS with data-book ΔH and ΔS (taken as constant), the same numbers as the Kc and Kp tab.
   These reproduce the classic charts: Haber with a 1 : 3 feed gives 36% ammonia at equilibrium at 450 °C and 200 atm
   (57% at 350 °C), and the contact process converts about 97% of the SO₂ at 450 °C and 1 atm.

   The yield is the equilibrium conversion of the limiting reactant (found by bisection), plus the mole fraction of
   product, for the real feed: Haber N₂ : H₂ = 1 : 3; contact 10% SO₂, 11% O₂, 79% N₂ (from air); methanol
   CO : H₂ = 1 : 2.

   Rate: an Arrhenius factor for the catalysed reaction (activation energy Ea) times the effect of pressure
   (concentration of gas ∝ p), relative to the real operating conditions. Cost: compression work grows with ln p, and
   thick-walled plant and its upkeep grow with p; heating costs grow with T. These are indices, not money. */

export const R = 8.314;

export interface Proc {
  id: 'haber' | 'contact' | 'methanol';
  name: string;
  eq: string;
  product: string;
  dH: number;               // J mol⁻¹
  dS: number;               // J K⁻¹ mol⁻¹
  dn: number;               // change in moles of gas
  Ea: number;               // activation energy on the catalyst / J mol⁻¹
  Tr: [number, number];     // temperature range / °C
  Pr: [number, number];     // pressure range / atm
  real: { T: number; P: number };
  catalyst: string;
  feed: number[];           // moles in the feed: reactant 1, reactant 2, inert
  nu: [number, number, number];  // coefficients: reactant 1, reactant 2, product
  units: string;            // of K_p
  use: string;
  why: string[];
}

export const PROCS: Proc[] = [
  {
    id: 'haber', name: 'Haber process', eq: 'N₂(g) + 3H₂(g) ⇌ 2NH₃(g)', product: 'NH₃', dH: -92.2e3, dS: -198.7, dn: -2,
    Ea: 105e3, Tr: [300, 650], Pr: [1, 400], real: { T: 450, P: 200 }, catalyst: 'iron (with promoters)', feed: [1, 3, 0], nu: [1, 3, 2],
    units: 'atm⁻²', use: 'fertilisers (ammonium nitrate, urea), nitric acid, explosives',
    why: [
      'Low temperature gives a higher equilibrium yield (the forward reaction is exothermic), but the rate would be far too slow, even with the catalyst; below about 400 °C the iron catalyst barely works.',
      '450 °C is a compromise: a reasonable yield at a good rate.',
      'High pressure favours the side with fewer moles of gas (2 against 4), so it raises the yield, and it also raises the rate. But it is expensive: energy for the compressors, and thick-walled pipes and vessels that cost a lot to build and maintain, with a safety risk. About 200 atm is the compromise.',
      'Only about 15% is converted in each pass (equilibrium is not reached). The ammonia is cooled and liquefied out, and the unreacted nitrogen and hydrogen are recycled, so the overall conversion is about 98%.',
    ],
  },
  {
    id: 'contact', name: 'Contact process', eq: '2SO₂(g) + O₂(g) ⇌ 2SO₃(g)', product: 'SO₃', dH: -197.8e3, dS: -188.1, dn: -1,
    Ea: 90e3, Tr: [350, 750], Pr: [1, 10], real: { T: 450, P: 2 }, catalyst: 'vanadium(V) oxide, V₂O₅', feed: [10, 11, 79], nu: [2, 1, 2],
    units: 'atm⁻¹', use: 'sulfuric acid (fertilisers, detergents, paints, batteries)',
    why: [
      'The forward reaction is exothermic, so a lower temperature gives a higher yield; 450 °C keeps the rate high enough and the V₂O₅ active.',
      'Higher pressure would favour SO₃ (3 moles of gas → 2), but the conversion is already about 97–99% at 1–2 atm, so the extra cost of high pressure is not worth it.',
      'The gas passes over several beds of catalyst, cooled between them; SO₃ is absorbed between beds, which moves the equilibrium to the right, so overall about 99.5% is converted.',
      'SO₃ is absorbed in concentrated sulfuric acid (not water: that makes a corrosive mist) to make oleum, then diluted.',
    ],
  },
  {
    id: 'methanol', name: 'Methanol', eq: 'CO(g) + 2H₂(g) ⇌ CH₃OH(g)', product: 'CH₃OH', dH: -90.7e3, dS: -219.2, dn: -2,
    Ea: 80e3, Tr: [150, 450], Pr: [1, 150], real: { T: 250, P: 75 }, catalyst: 'copper, zinc oxide and alumina', feed: [1, 2, 0], nu: [1, 2, 1],
    units: 'atm⁻²', use: 'fuel, methanal (plastics), solvents',
    why: [
      'Exothermic with fewer moles of gas on the right: low temperature and high pressure favour methanol.',
      'The modern copper catalyst is active at about 250 °C, so a lower temperature (higher yield) can be used than the old 350 °C zinc–chromium catalyst allowed.',
      'About 50–100 atm: a compromise between yield and the cost of compressing the gas. Unreacted gas is recycled.',
    ],
  },
];

/** K_p at T (K) in the process's units. */
export const Kp = (p: Pick<Proc, 'dH' | 'dS'>, T: number) => Math.exp(-p.dH / (R * T) + p.dS / R);

/** Equilibrium conversion α of the limiting reactant (0–1) and the mole fraction of the product, at T (K), P (atm). */
export function yieldAt(p: Proc, T: number, P: number) {
  const K = Kp(p, T), [a, b, c] = p.nu, f = p.feed;
  const lim = Math.min(f[0] / a, f[1] / b);           // extent at complete conversion
  const comp = (x: number) => {
    const n = [f[0] - a * x, f[1] - b * x, c * x], tot = n[0] + n[1] + n[2] + f[2];
    return { n, tot };
  };
  const lq = (x: number) => {
    const { n, tot } = comp(x);
    const pp = n.map((v) => (Math.max(v, 1e-300) / tot) * P);
    return c * Math.log(pp[2]) - a * Math.log(pp[0]) - b * Math.log(pp[1]);
  };
  const lk = Math.log(K);
  let lo = 0, hi = lim;
  for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (lq(m) > lk) hi = m; else lo = m; }
  const x = (lo + hi) / 2, { n, tot } = comp(x);
  return { conv: x / lim, frac: n[2] / tot };
}

/** Rate relative to the real conditions (Arrhenius × pressure). */
export const rateRel = (p: Proc, Tc: number, P: number) => Math.exp((-p.Ea / R) * (1 / (Tc + 273) - 1 / (p.real.T + 273))) * (P / p.real.P);

/** A cost index (1 at the real conditions): compression, plant and heating. */
export function costRel(p: Proc, Tc: number, P: number) {
  const c = (t: number, q: number) => 1 + 0.6 * Math.log(q) + 0.012 * q + 0.004 * t;
  return c(Tc, P) / c(p.real.T, p.real.P);
}

/** 13.8: entropy changes at T (K). */
export function entropy(p: Pick<Proc, 'dH' | 'dS'>, T: number) {
  const surr = -p.dH / T, tot = p.dS + surr;
  return { sys: p.dS, surr, tot, lnK: tot / R, K: Math.exp(tot / R) };
}

/** Endothermic examples for the K–T graph. */
export const ENDO = [
  { name: 'N₂O₄ ⇌ 2NO₂', dH: 57.2e3, dS: 175.8 },
  { name: 'CaCO₃ ⇌ CaO + CO₂', dH: 178.3e3, dS: 160.7 },
];
