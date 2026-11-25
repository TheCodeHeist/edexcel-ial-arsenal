/* Energetics Lab: Calorimetry & Cooling Curves (Spec 6.4–6.7, Topic 6). */

import { C_WATER } from './consts';

export type CalMode = 'cup' | 'burner';

export interface CalReaction {
  id: string;
  mode: CalMode;
  name: string;
  eq: string;
  dhLit: number;       // kJ mol⁻¹ (Data Booklet / literature value)
  defaultMass: number; // g of water / solution
  defaultMol: number;  // mol of limiting reagent
  molarMass?: number;  // g mol⁻¹ (for burner fuels / solid mass display)
  liquidHex: number;   // initial liquid colour
  endHex: number;      // final liquid colour
  note: string;
  facts: string[];
}

export const CAL_REACTIONS: CalReaction[] = [
  {
    id: 'zn_cuso4', mode: 'cup', name: 'Zn + CuSO₄ displacement',
    eq: 'Zn(s) + CuSO4(aq) -> ZnSO4(aq) + Cu(s)',
    dhLit: -217, defaultMass: 50, defaultMol: 0.025,
    liquidHex: 0x38bdf8, endHex: 0xdbeafe,
    note: 'Excess zinc powder added to CuSO₄(aq) at t = 4 min. Blue colour fades as Cu²⁺ is displaced.',
    facts: [
      'Assume density of aqueous solution = 1.00 g cm⁻³ and specific heat capacity c = 4.18 J g⁻¹ K⁻¹.',
      'Extrapolate the cooling line back to t = 4 min (time of mixing) to correct for heat lost to the surroundings during the reaction.',
      'Zinc is in excess so CuSO₄ is the limiting reagent: divide q by n(CuSO₄).',
    ],
  },
  {
    id: 'hcl_naoh', mode: 'cup', name: 'HCl + NaOH neutralisation',
    eq: 'HCl(aq) + NaOH(aq) -> NaCl(aq) + H2O(l)',
    dhLit: -57.3, defaultMass: 50, defaultMol: 0.05,
    liquidHex: 0xcbd5e1, endHex: 0xe2e8f0,
    note: 'Equal volumes of strong acid and alkali mixed in a polystyrene cup at t = 4 min.',
    facts: [
      'Standard enthalpy of neutralisation of any strong acid with a strong base is ≈ −57.3 kJ mol⁻¹ because the ionic equation is always H⁺(aq) + OH⁻(aq) → H₂O(l).',
      'Use the TOTAL volume of both solutions combined for m in q = mcΔT.',
      'Polystyrene cup + lid reduces heat loss by conduction and convection.',
    ],
  },
  {
    id: 'nh4no3', mode: 'cup', name: 'NH₄NO₃ dissolving (endothermic)',
    eq: 'NH4NO3(s) + aq -> NH4+(aq) + NO3-(aq)',
    dhLit: 25.7, defaultMass: 50, defaultMol: 0.10, molarMass: 80.0,
    liquidHex: 0xdbeafe, endHex: 0x93c5fd,
    note: 'Solid ammonium nitrate dissolves in water at t = 4 min: temperature drops, so ΔH is positive (endothermic).',
    facts: [
      'For an endothermic change, the solution cools (ΔT < 0) and then warms back up toward room temperature.',
      'Extrapolate the warming curve back to t = 4 min to find the true maximum temperature drop.',
      'Since heat is absorbed from the water, ΔH = −q/n is positive (+).',
    ],
  },
  {
    id: 'ethanol', mode: 'burner', name: 'Ethanol combustion',
    eq: 'C2H5OH(l) + 3O2(g) -> 2CO2(g) + 3H2O(l)',
    dhLit: -1367, defaultMass: 100, defaultMol: 0.012, molarMass: 46.0,
    liquidHex: 0x60a5fa, endHex: 0xfb923c,
    note: 'Spirit burner heats water in a copper calorimeter; weigh the burner before and after to find mass burned Δm and n = Δm / 46.0.',
    facts: [
      'Experimental |ΔcH| is always much smaller than the Data Booklet value (−1367 kJ mol⁻¹) due to heat loss to the air and calorimeter, incomplete combustion (soot), and evaporation of alcohol from the wick.',
      'Use a draught shield and place the flame close to the copper can to minimise heat loss.',
      'Data Booklet ΔcH assumes standard conditions (298 K, 100 kPa) with water formed as a liquid.',
    ],
  },
  {
    id: 'propanol', mode: 'burner', name: 'Propan-1-ol combustion',
    eq: 'C3H7OH(l) + 4.5O2(g) -> 3CO2(g) + 4H2O(l)',
    dhLit: -2021, defaultMass: 100, defaultMol: 0.010, molarMass: 60.0,
    liquidHex: 0x60a5fa, endHex: 0xf87171,
    note: 'Longer alcohol chain releases more energy per mole (~650 kJ mol⁻¹ per extra –CH₂– group); weigh burner before and after for Δm.',
    facts: [
      'Each extra –CH₂– group adds 1 C–C and 2 C–H bonds broken, and 1 extra CO₂ + 1 H₂O formed → ΔcH becomes more exothermic by a steady increment.',
      'Weigh the spirit burner with its cap on before and after heating to prevent evaporation error.',
    ],
  },
];

export interface CoolingPoint {
  t: number;     // minutes 0..10
  T: number;     // °C
}

export interface CalResult {
  t0: number;
  idealDeltaT: number;    // theoretical ΔT with zero heat loss
  peakDeltaT: number;     // raw max/min observed ΔT (or measured ΔT for burner)
  extrapDeltaT: number;   // extrapolated ΔT at t = 4 min (or measured ΔT for burner)
  massFuel: number | null;// g burned (for burner mode)
  qExp: number;           // J
  dhExp: number;          // kJ mol⁻¹
  points: CoolingPoint[]; // simulated thermometer readings 0..10 min (cup mode only)
  extrapLine: { t1: number; T1: number; t2: number; T2: number };
}

/** Generate realistic calorimeter readings: cooling-curve extrapolation (0..10 min) for cup mode, or ΔT + Δm for spirit burners. */
export function simulateCal(rxn: CalReaction, massWater: number, mol: number, heatLossFrac: number): CalResult {
  const t0 = 20.0;
  // Ideal ΔT from literature ΔH: q = -ΔH * 1000 * mol = m * c * ΔT
  const idealDeltaT = (-rxn.dhLit * 1000 * mol) / (massWater * C_WATER);

  if (rxn.mode === 'burner') {
    // Spirit burner: record initial T, final T and Δm of fuel burned (no cooling-curve extrapolation)
    const eff = Math.max(0.25, 0.72 * (1 - heatLossFrac * 0.55));
    const deltaT = idealDeltaT * eff;
    const qExp = massWater * C_WATER * deltaT;
    const dhExp = -(qExp / 1000) / Math.max(1e-6, mol);
    const massFuel = mol * (rxn.molarMass ?? 46.0);
    return {
      t0,
      idealDeltaT,
      peakDeltaT: deltaT,
      extrapDeltaT: deltaT,
      massFuel,
      qExp,
      dhExp,
      points: [],
      extrapLine: { t1: 0, T1: t0, t2: 0, T2: t0 },
    };
  }

  // Cup calorimetry: most heat loss appears as faster cooling k, which extrapolation recovers cleanly
  const eff = 0.99 - heatLossFrac * 0.04;
  const trueDeltaT = idealDeltaT * eff;
  const k = 0.012 + heatLossFrac * 0.08;

  const points: CoolingPoint[] = [];
  for (let t = 0; t <= 10; t++) {
    if (t <= 3) {
      points.push({ t, T: t0 });
    } else if (t === 4) {
      // Mixing instant at t = 4 (no thermometer reading plotted)
      continue;
    } else if (t === 5) {
      // Reaction nearly complete; finite mixing time means raw peak undershoots when k is large
      const T = t0 + trueDeltaT * Math.exp(-k * 2.3);
      points.push({ t, T });
    } else {
      // Post-reaction cooling/warming toward t0
      const T = t0 + trueDeltaT * Math.exp(-k * (t - 4));
      points.push({ t, T });
    }
  }

  // Linear fit on post-peak tail (t = 6..10) extrapolated back to t = 4
  const tail = points.filter((p) => p.t >= 6);
  const meanT = tail.reduce((s, p) => s + p.t, 0) / tail.length;
  const meanY = tail.reduce((s, p) => s + p.T, 0) / tail.length;
  let num = 0, den = 0;
  for (const p of tail) {
    num += (p.t - meanT) * (p.T - meanY);
    den += (p.t - meanT) ** 2;
  }
  const slope = den ? num / den : 0;
  const intercept = meanY - slope * meanT;
  const TAt4 = intercept + slope * 4;
  const extrapDeltaT = TAt4 - t0;

  const t5 = points.find((p) => p.t === 5)?.T ?? TAt4;
  const peakDeltaT = t5 - t0;

  const qExp = massWater * C_WATER * extrapDeltaT;
  const dhExp = -(qExp / 1000) / Math.max(1e-6, mol);

  return {
    t0,
    idealDeltaT,
    peakDeltaT,
    extrapDeltaT,
    massFuel: null,
    qExp,
    dhExp,
    points,
    extrapLine: { t1: 4, T1: TAt4, t2: 10, T2: intercept + slope * 10 },
  };
}
