/* Energetics Lab: Entropy (ΔSsystem, ΔSsurroundings, ΔStotal) and Gibbs Free Energy (ΔG = ΔH − TΔS; Spec 12.8–12.14). */

export type EntropyPhase = 'solid' | 'liquid' | 'gas' | 'decomp';

export interface FeasPreset {
  id: string;
  name: string;
  eq: string;
  dh: number;       // kJ mol⁻¹
  ds: number;       // J K⁻¹ mol⁻¹ (ΔSsystem)
  phase: EntropyPhase;
  quadrant: string;
  note: string;
}

export const FEAS_PRESETS: FeasPreset[] = [
  {
    id: 'caco3', name: 'CaCO₃ decomposition (high-T only)',
    eq: 'CaCO3(s) -> CaO(s) + CO2(g)',
    dh: 178, ds: 161, phase: 'decomp',
    quadrant: 'ΔH > 0, ΔS > 0 (feasible at high T)',
    note: 'Endothermic, but 1 mol of gas is produced from a solid (large +ΔS). Becomes feasible above T = ΔH / ΔS ≈ 1106 K (833 °C).',
  },
  {
    id: 'haber', name: 'Haber process (low-T feasible)',
    eq: 'N2(g) + 3H2(g) -> 2NH3(g)',
    dh: -92, ds: -199, phase: 'gas',
    quadrant: 'ΔH < 0, ΔS < 0 (feasible at low T)',
    note: '4 mol of gas → 2 mol of gas gives negative ΔS. Exothermic ΔH drives it below T = ΔH / ΔS ≈ 462 K.',
  },
  {
    id: 'comb', name: 'Combustion of methane (always feasible)',
    eq: 'CH4(g) + 2O2(g) -> CO2(g) + 2H2O(g)',
    dh: -802, ds: 5, phase: 'gas',
    quadrant: 'ΔH < 0, ΔS > 0 (always feasible)',
    note: 'Both ΔH < 0 and ΔS > 0 mean ΔG < 0 (and ΔStotal > 0) at EVERY temperature — though it still needs activation energy to start!',
  },
  {
    id: 'photosyn', name: 'CO₂ + H₂O → glucose (never spontaneous)',
    eq: '6CO2(g) + 6H2O(l) -> C6H12O6(s) + 6O2(g)',
    dh: 2803, ds: -259, phase: 'solid',
    quadrant: 'ΔH > 0, ΔS < 0 (never feasible)',
    note: 'Endothermic AND entropy decreases → ΔG > 0 at every temperature. Plants must continuously supply light energy to drive it.',
  },
];

export interface ThermoCalc {
  dsSys: number;    // J K⁻¹ mol⁻¹
  dsSurr: number;   // J K⁻¹ mol⁻¹
  dsTotal: number;  // J K⁻¹ mol⁻¹
  dg: number;       // kJ mol⁻¹
  feasible: boolean;
  crossoverK: number | null; // temperature K where ΔG = 0 (if > 0)
}

export function calcThermo(dhKJ: number, dsJ: number, T: number): ThermoCalc {
  const dsSurr = -(dhKJ * 1000) / T;
  const dsTotal = dsJ + dsSurr;
  const dg = dhKJ - (T * dsJ) / 1000;
  let crossoverK: number | null = null;
  if ((dhKJ > 0 && dsJ > 0) || (dhKJ < 0 && dsJ < 0)) {
    crossoverK = (dhKJ * 1000) / dsJ;
  }
  return {
    dsSys: dsJ,
    dsSurr,
    dsTotal,
    dg,
    feasible: dg <= 0,
    crossoverK,
  };
}
