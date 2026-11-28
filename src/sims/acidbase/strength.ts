/* Acid–Base Lab: Strong vs weak acids/bases, Ka, pKa, Kw(T) and pH calculations (Spec 14.1–14.8). */

import { KW_298, kwAtTemp } from './consts';

export type SpeciesKind = 'strong_acid' | 'weak_acid' | 'strong_base' | 'water';

export interface AcidSpecies {
  id: string;
  name: string;
  formula: string;
  kind: SpeciesKind;
  ka?: number;       // mol dm⁻³ (for weak acids)
  proticity?: number; // 1 for HCl/NaOH, 2 for H2SO4/Ba(OH)2
  eq: string;
  note: string;
  facts: string[];
}

export const SPECIES: AcidSpecies[] = [
  {
    id: 'hcl', name: 'Hydrochloric acid', formula: 'HCl', kind: 'strong_acid', proticity: 1,
    eq: 'HCl(aq) -> H+(aq) + Cl-(aq)',
    note: 'Strong monoprotic acid: dissociates 100% in water, so [H⁺] = [HCl] and pH = −log₁₀[H⁺].',
    facts: [
      'A 10-fold dilution of a strong acid increases pH by exactly 1.00 unit.',
      'Strong acid means complete dissociation — do NOT confuse “strong” with “concentrated”.',
    ],
  },
  {
    id: 'h2so4', name: 'Sulfuric acid', formula: 'H2SO4', kind: 'strong_acid', proticity: 2,
    eq: 'H2SO4(aq) -> 2H+(aq) + SO4^2-(aq)',
    note: 'Diprotic acid: at IAL level treated as supplying 2 mol H⁺ per mole of H₂SO₄ ([H⁺] = 2c).',
    facts: [
      'For diprotic H₂SO₄, multiply concentration by 2 before taking −log₁₀[H⁺].',
      '0.10 mol dm⁻³ H₂SO₄ has [H⁺] = 0.20 mol dm⁻³ → pH = 0.70 (lower than 0.10 mol dm⁻³ HCl at pH 1.00).',
    ],
  },
  {
    id: 'ch3cooh', name: 'Ethanoic acid', formula: 'CH3COOH', kind: 'weak_acid', ka: 1.74e-5,
    eq: 'CH3COOH(aq) <=> H+(aq) + CH3COO-(aq)',
    note: 'Weak acid (pKa = 4.76): only ~1.3% dissociated at 0.10 mol dm⁻³! Most molecules remain intact HA.',
    facts: [
      'Weak-acid approximation: Ka = [H⁺]² / [HA] ⇒ [H⁺] = √(Ka × c).',
      'Two assumptions: (1) [H⁺] = [A⁻] (H⁺ from water is negligible); (2) [HA]eq ≈ [HA]initial (dissociation is very small).',
      'A 10-fold dilution of a weak acid increases pH by only 0.50 units (equilibrium shifts right to dissociate more).',
    ],
  },
  {
    id: 'hcooh', name: 'Methanoic acid', formula: 'HCOOH', kind: 'weak_acid', ka: 1.78e-4,
    eq: 'HCOOH(aq) <=> H+(aq) + HCOO-(aq)',
    note: 'Stronger weak acid than ethanoic acid (pKa = 3.75, Ka is 10× larger → higher % dissociation and lower pH).',
    facts: [
      'Larger Ka = smaller pKa = stronger weak acid (position of equilibrium lies further right).',
      'At very low concentrations or larger Ka, the [HA]eq ≈ [HA]initial assumption starts to drift slightly from the exact quadratic.',
    ],
  },
  {
    id: 'hcn', name: 'Hydrocyanic acid', formula: 'HCN', kind: 'weak_acid', ka: 4.9e-10,
    eq: 'HCN(aq) <=> H+(aq) + CN-(aq)',
    note: 'Very weak acid (pKa = 9.31): less than 0.01% dissociated at 0.10 mol dm⁻³.',
    facts: [
      'Tiny Ka means almost every molecule stays as intact HCN.',
    ],
  },
  {
    id: 'naoh', name: 'Sodium hydroxide', formula: 'NaOH', kind: 'strong_base', proticity: 1,
    eq: 'NaOH(aq) -> Na+(aq) + OH-(aq)',
    note: 'Strong alkali: 100% dissociated, so [OH⁻] = c, [H⁺] = Kw / [OH⁻], and pH = 14 + log₁₀[OH⁻] at 298 K.',
    facts: [
      'Always use Kw = [H⁺][OH⁻] = 1.00 × 10⁻¹⁴ mol² dm⁻⁶ at 298 K to convert [OH⁻] to [H⁺].',
      'For Ba(OH)₂, [OH⁻] = 2c.',
    ],
  },
  {
    id: 'water', name: 'Pure water (Kw vs T)', formula: 'H2O', kind: 'water',
    eq: 'H2O(l) <=> H+(aq) + OH-(aq)   (ΔH = +55.8 kJ mol⁻¹)',
    note: 'Endothermic self-ionisation: raising temperature shifts equilibrium right, increasing Kw and lowering pH — yet water stays NEUTRAL!',
    facts: [
      'Neutral means [H⁺] = [OH⁻], NOT necessarily pH = 7!',
      'At 50 °C, Kw ≈ 5.48 × 10⁻¹⁴ → [H⁺] = √Kw = 2.34 × 10⁻⁷ → pH = 6.63 (still completely neutral!).',
    ],
  },
];

export interface StrengthCalc {
  hPlus: number;
  ohMinus: number;
  pH: number;
  exactPH: number;
  alpha: number; // fraction dissociated (0..1)
  kw: number;
  pKa: number | null;
}

export function calcStrength(sp: AcidSpecies, conc: number, tempC: number): StrengthCalc {
  const kw = sp.kind === 'water' ? kwAtTemp(tempC) : KW_298;
  if (sp.kind === 'water') {
    const h = Math.sqrt(kw);
    return { hPlus: h, ohMinus: h, pH: -Math.log10(h), exactPH: -Math.log10(h), alpha: 1e-7, kw, pKa: null };
  }
  if (sp.kind === 'strong_acid') {
    const h = conc * (sp.proticity ?? 1);
    const pH = -Math.log10(Math.max(1e-14, h));
    return { hPlus: h, ohMinus: kw / h, pH, exactPH: pH, alpha: 1.0, kw, pKa: null };
  }
  if (sp.kind === 'strong_base') {
    const oh = conc * (sp.proticity ?? 1);
    const h = kw / Math.max(1e-14, oh);
    const pH = -Math.log10(h);
    return { hPlus: h, ohMinus: oh, pH, exactPH: pH, alpha: 1.0, kw, pKa: null };
  }
  // Weak acid: both Edexcel approximation & exact quadratic
  const ka = sp.ka ?? 1.74e-5;
  const hApprox = Math.sqrt(ka * conc);
  const hExact = (-ka + Math.sqrt(ka * ka + 4 * ka * conc)) / 2;
  return {
    hPlus: hApprox,
    ohMinus: kw / hApprox,
    pH: -Math.log10(hApprox),
    exactPH: -Math.log10(hExact),
    alpha: Math.min(1, hExact / Math.max(1e-9, conc)),
    kw,
    pKa: -Math.log10(ka),
  };
}
