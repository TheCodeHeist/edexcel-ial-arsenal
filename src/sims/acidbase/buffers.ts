/* Acid–Base Lab: Buffer solutions, blood H2CO3/HCO3⁻ buffer & acid/alkali spike resistance (Spec 14.12–14.14). */

export interface BufferPreset {
  id: string;
  name: string;
  haName: string;
  aName: string;
  pKa: number;
  defaultHA: number; // mol in 1 dm³
  defaultA: number;  // mol in 1 dm³
  eq: string;
  note: string;
  facts: string[];
}

export const BUFFER_PRESETS: BufferPreset[] = [
  {
    id: 'ethanoate', name: 'Ethanoic acid / ethanoate',
    haName: 'CH₃COOH', aName: 'CH₃COO⁻', pKa: 4.76, defaultHA: 0.50, defaultA: 0.50,
    eq: 'CH3COOH(aq) <=> H+(aq) + CH3COO-(aq)',
    note: 'Classic acidic buffer (pH ≈ 4.76 when [HA] = [A⁻]). Made by mixing ethanoic acid with sodium ethanoate, or by half-neutralising excess ethanoic acid with NaOH.',
    facts: [
      'A buffer solution resists small changes in pH when small amounts of acid or alkali are added.',
      'Add H⁺: A⁻ + H⁺ → HA (equilibrium shifts left; large A⁻ reservoir removes added H⁺).',
      'Add OH⁻: HA + OH⁻ → A⁻ + H₂O (equilibrium shifts right; large HA reservoir removes added OH⁻).',
      'Because the ratio [HA]/[A⁻] barely changes, [H⁺] = Ka × ([HA]/[A⁻]) stays almost constant!',
    ],
  },
  {
    id: 'blood', name: 'Human blood (H₂CO₃ / HCO₃⁻)',
    haName: 'H₂CO₃', aName: 'HCO₃⁻', pKa: 6.37, defaultHA: 0.10, defaultA: 1.07,
    eq: 'H2CO3(aq) <=> H+(aq) + HCO3-(aq)',
    note: 'Keeps human blood tightly controlled at pH 7.35–7.45! Note [HCO₃⁻] is ~10× larger than [H₂CO₃] so blood has extra capacity to neutralise lactic acid.',
    facts: [
      'Carbonic acid is in equilibrium with dissolved CO₂: H₂O + CO₂ ⇌ H₂CO₃ ⇌ H⁺ + HCO₃⁻.',
      'During exercise, lactic acid adds H⁺ → HCO₃⁻ + H⁺ → H₂CO₃ → H₂O + CO₂ (breathed out by lungs!).',
      'Target blood pH is 7.40; outside 7.35–7.45 enzymes denature rapidly.',
    ],
  },
  {
    id: 'ammonia', name: 'Ammonia / ammonium (alkaline)',
    haName: 'NH₄⁺', aName: 'NH₃', pKa: 9.25, defaultHA: 0.50, defaultA: 0.50,
    eq: 'NH4+(aq) <=> H+(aq) + NH3(aq)',
    note: 'Alkaline buffer (pH ≈ 9.25) made from weak base NH₃ and its conjugate acid salt NH₄Cl.',
    facts: [
      'Add H⁺: NH₃ + H⁺ → NH₄⁺.',
      'Add OH⁻: NH₄⁺ + OH⁻ → NH₃ + H₂O.',
    ],
  },
];

export interface BufferState {
  ha: number;
  a: number;
  pH: number;
  basePH: number;
  deltaPH: number;
  waterPH: number; // what happens if the same spike is added to 1 dm³ of pure water!
  broken: boolean;
}

export function calcBuffer(p: BufferPreset, haInit: number, aInit: number, spikeMol: number): BufferState {
  // spikeMol > 0 = added H+; spikeMol < 0 = added OH-
  const basePH = p.pKa + Math.log10(aInit / haInit);
  const ha = haInit + spikeMol;
  const a = aInit - spikeMol;
  const broken = ha <= 0.005 || a <= 0.005;
  const pH = broken
    ? (spikeMol > 0 ? Math.max(0.5, -Math.log10(Math.max(1e-6, spikeMol - aInit))) : Math.min(13.5, 14 + Math.log10(Math.max(1e-6, -spikeMol - haInit))))
    : p.pKa + Math.log10(a / ha);
  const waterPH = Math.abs(spikeMol) < 1e-6
    ? 7.0
    : spikeMol > 0
    ? -Math.log10(spikeMol)
    : 14 + Math.log10(-spikeMol);

  return { ha: Math.max(0, ha), a: Math.max(0, a), pH, basePH, deltaPH: pH - basePH, waterPH, broken };
}
