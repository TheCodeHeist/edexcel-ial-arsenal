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
    id: 'h2o2', name: 'H₂O₂ decomposition (always feasible)',
    eq: '2H2O2(l) -> 2H2O(l) + O2(g)',
    dh: -196, ds: 126, phase: 'decomp',
    quadrant: 'ΔH < 0, ΔS > 0 (always feasible)',
    note: 'Both exothermic (ΔH < 0) and entropy-increasing (liquid → liquid + O₂ gas, ΔS = +126 J K⁻¹ mol⁻¹), so ΔG < 0 and ΔStotal > 0 at EVERY temperature — yet it still decomposes slowly without a catalyst due to high activation energy.',
  },
  {
    id: 'photosyn', name: 'CO₂ + H₂O → glucose (never feasible)',
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
