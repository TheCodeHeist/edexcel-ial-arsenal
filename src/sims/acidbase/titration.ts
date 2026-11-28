/* Acid–Base Lab: Exact titration curve solver (4 Edexcel types), half-neutralisation pKa & indicator suitability (Spec 14.9–14.11). */

import { KW_298 } from './consts';

export type TitrationKind = 'sa_sb' | 'wa_sb' | 'sa_wb' | 'wa_wb';

export interface IndicatorDef {
  id: 'phenol' | 'methyl' | 'bromo';
  name: string;
  low: number;
  high: number;
  acidCol: string;
  baseCol: string;
  bandCss: string;
}

export const INDICATORS: IndicatorDef[] = [
  { id: 'phenol', name: 'Phenolphthalein', low: 8.2, high: 10.0, acidCol: 'Colourless', baseCol: 'Pink', bandCss: 'var(--cond)' },
  { id: 'methyl', name: 'Methyl orange', low: 3.1, high: 4.4, acidCol: 'Red', baseCol: 'Yellow', bandCss: 'var(--amph)' },
  { id: 'bromo', name: 'Bromothymol blue', low: 6.0, high: 7.6, acidCol: 'Yellow', baseCol: 'Blue', bandCss: 'var(--acidbase)' },
];

export interface TitrationMeta {
  id: TitrationKind;
  name: string;
  analyte: string;
  titrant: string;
  steepLow: number;
  steepHigh: number;
  eqPH: number;
  hasHalfEquiv: boolean;
  pKa?: number;
  facts: string[];
}

export const TITRATIONS: Record<TitrationKind, TitrationMeta> = {
  sa_sb: {
    id: 'sa_sb', name: 'Strong acid + Strong base',
    analyte: '25.0 cm³ of 0.10 mol dm⁻³ HCl',
    titrant: '0.10 mol dm⁻³ NaOH',
    steepLow: 3.0, steepHigh: 11.0, eqPH: 7.0, hasHalfEquiv: false,
    facts: [
      'Very long vertical section (pH ~3 to ~11) with equivalence point at exactly pH 7.0.',
      'BOTH phenolphthalein (8.2–10.0) and methyl orange (3.1–4.4) fall completely inside the vertical section and are suitable.',
    ],
  },
  wa_sb: {
    id: 'wa_sb', name: 'Weak acid + Strong base',
    analyte: '25.0 cm³ of 0.10 mol dm⁻³ CH₃COOH',
    titrant: '0.10 mol dm⁻³ NaOH',
    steepLow: 7.0, steepHigh: 10.8, eqPH: 8.72, hasHalfEquiv: true, pKa: 4.76,
    facts: [
      'At half-equivalence (12.5 cm³ NaOH), [HA] = [A⁻], so Ka = [H⁺] and pH = pKa (= 4.76)!',
      'The flat slope around 12.5 cm³ is the buffer region (CH₃COOH / CH₃COO⁻).',
      'Equivalence point is ALKALINE (~8.7) because CH₃COO⁻ hydrolyses water → phenolphthalein is suitable, methyl orange is NOT.',
    ],
  },
  sa_wb: {
    id: 'sa_wb', name: 'Strong acid + Weak base',
    analyte: '25.0 cm³ of 0.10 mol dm⁻³ HCl',
    titrant: '0.10 mol dm⁻³ NH₃',
    steepLow: 3.0, steepHigh: 7.2, eqPH: 5.28, hasHalfEquiv: false,
    facts: [
      'Equivalence point is ACIDIC (~5.3) because NH₄⁺ is a weak conjugate acid.',
      'Vertical section spans pH ~3 to ~7 → methyl orange is suitable, phenolphthalein is NOT.',
    ],
  },
  wa_wb: {
    id: 'wa_wb', name: 'Weak acid + Weak base',
    analyte: '25.0 cm³ of 0.10 mol dm⁻³ CH₃COOH',
    titrant: '0.10 mol dm⁻³ NH₃',
    steepLow: 6.8, steepHigh: 7.2, eqPH: 7.0, hasHalfEquiv: true, pKa: 4.76,
    facts: [
      'There is NO sharp vertical section at the equivalence point!',
      'NO colour indicator gives a sharp end-point — use a pH meter instead.',
    ],
  },
};

/** Compute exact pH for 25.0 cm³ of 0.10 mol dm⁻³ analyte titrated with V cm³ of 0.10 mol dm⁻³ titrant. */
export function titrationPH(kind: TitrationKind, vAdded: number): number {
  const va = 25.0, ca = 0.10, cb = 0.10;
  const vTot = va + vAdded;
  const na = (va * ca) / 1000;
  const nb = (vAdded * cb) / 1000;
  const Ka = 1.74e-5; // CH3COOH
  const Kb = 1.78e-5; // NH3

  if (kind === 'sa_sb') {
    const diff = (na - nb) / (vTot / 1000);
    if (Math.abs(diff) < 1e-9) return 7.0;
    if (diff > 0) return -Math.log10(diff);
    return 14 + Math.log10(-diff);
  }

  if (kind === 'wa_sb') {
    if (vAdded <= 0.001) return -Math.log10(Math.sqrt(Ka * ca));
    if (nb < na - 1e-7) {
      // Buffer region
      const ratio = (na - nb) / nb;
      const h = Ka * ratio;
      return -Math.log10(h);
    }
    if (Math.abs(nb - na) <= 1e-7) {
      // Equivalence: weak base A- hydrolysis
      const cSalt = na / (vTot / 1000);
      const oh = Math.sqrt((KW_298 / Ka) * cSalt);
      return 14 + Math.log10(oh);
    }
    // Excess strong base
    const oh = (nb - na) / (vTot / 1000);
    return 14 + Math.log10(oh);
  }

  if (kind === 'sa_wb') {
    if (nb < na - 1e-7) {
      const h = (na - nb) / (vTot / 1000);
      return -Math.log10(h);
    }
    if (Math.abs(nb - na) <= 1e-7) {
      // Equivalence: NH4+ weak acid hydrolysis
      const cSalt = na / (vTot / 1000);
      const h = Math.sqrt((KW_298 / Kb) * cSalt);
      return -Math.log10(h);
    }
    // Excess weak base buffer (NH3 / NH4+)
    const oh = Kb * ((nb - na) / na);
    return 14 + Math.log10(oh);
  }

  // wa_wb: smooth S-curve without steep jump
  if (vAdded <= 0.001) return -Math.log10(Math.sqrt(Ka * ca));
  if (nb < na - 1e-7) return -Math.log10(Ka * ((na - nb) / nb));
  if (Math.abs(nb - na) <= 1e-7) return 7.0;
  const oh = Kb * ((nb - na) / na);
  return 14 + Math.log10(oh);
}

export function indicatorSuitable(kind: TitrationKind, ind: IndicatorDef): boolean {
  if (kind === 'wa_wb') return false;
  const m = TITRATIONS[kind];
  return ind.low >= m.steepLow - 0.1 && ind.high <= m.steepHigh + 0.1;
}
