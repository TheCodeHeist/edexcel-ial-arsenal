/* Acid–Base Lab: Brønsted–Lowry conjugate acid–base pairs & salt hydrolysis (Spec 14.1–14.2, 14.10). */

export interface ConjugateCase {
  id: string;
  title: string;
  eq: string;
  acid1: string;
  base1: string;
  base2: string;
  acid2: string;
  note: string;
}

export const CONJUGATES: ConjugateCase[] = [
  {
    id: 'ethanoic', title: 'Ethanoic acid in water',
    eq: 'CH3COOH + H2O <=> CH3COO- + H3O+',
    acid1: 'CH₃COOH', base1: 'CH₃COO⁻', base2: 'H₂O', acid2: 'H₃O⁺',
    note: 'CH₃COOH donates a proton (H⁺) to H₂O, forming its conjugate base CH₃COO⁻. Water acts as a Brønsted–Lowry base, forming conjugate acid H₃O⁺.',
  },
  {
    id: 'ammonia', title: 'Ammonia in water',
    eq: 'NH3 + H2O <=> NH4+ + OH-',
    acid1: 'H₂O', base1: 'OH⁻', base2: 'NH₃', acid2: 'NH₄⁺',
    note: 'Here water donates a proton (acts as an acid!) to NH₃. Water is amphoteric: it can act as either an acid or a base.',
  },
  {
    id: 'nitration', title: 'Nitrating mixture (HNO₃ acts as a BASE!)',
    eq: 'H2SO4 + HNO3 <=> HSO4- + H2NO3+',
    acid1: 'H₂SO₄', base1: 'HSO₄⁻', base2: 'HNO₃', acid2: 'H₂NO₃⁺',
    note: 'Classic Edexcel exam favourite: H₂SO₄ is a stronger acid than HNO₃, so H₂SO₄ donates a proton to HNO₃ — meaning HNO₃ acts as a Brønsted–Lowry BASE!',
  },
];

export interface SaltCase {
  id: string;
  formula: string;
  name: string;
  parentAcid: string;
  parentBase: string;
  approxPH: string;
  verdict: 'Neutral' | 'Alkaline' | 'Acidic';
  eq: string;
  why: string;
}

export const SALTS: SaltCase[] = [
  {
    id: 'nacl', formula: 'NaCl', name: 'Sodium chloride',
    parentAcid: 'HCl (strong)', parentBase: 'NaOH (strong)',
    approxPH: '7.0', verdict: 'Neutral',
    eq: 'Na+(aq) + Cl-(aq)  (no hydrolysis)',
    why: 'Neither Na⁺ nor Cl⁻ reacts with water, so [H⁺] = [OH⁻] and pH = 7.0.',
  },
  {
    id: 'ch3coona', formula: 'CH3COONa', name: 'Sodium ethanoate',
    parentAcid: 'CH₃COOH (weak)', parentBase: 'NaOH (strong)',
    approxPH: '8.7', verdict: 'Alkaline',
    eq: 'CH3COO-(aq) + H2O(l) <=> CH3COOH(aq) + OH-(aq)',
    why: 'Ethanoate (CH₃COO⁻) is the conjugate base of a weak acid, so it accepts H⁺ from water, leaving excess OH⁻ (pH > 7).',
  },
  {
    id: 'nh4cl', formula: 'NH4Cl', name: 'Ammonium chloride',
    parentAcid: 'HCl (strong)', parentBase: 'NH₃ (weak)',
    approxPH: '5.3', verdict: 'Acidic',
    eq: 'NH4+(aq) + H2O(l) <=> NH3(aq) + H3O+(aq)',
    why: 'Ammonium (NH₄⁺) is the conjugate acid of a weak base, so it donates H⁺ to water, producing excess H₃O⁺ (pH < 7).',
  },
  {
    id: 'fe3', formula: '[Fe(H2O)6]^3+', name: 'Hexaaquairon(III) ion',
    parentAcid: 'High charge-density cation', parentBase: 'Water ligands',
    approxPH: '2.2', verdict: 'Acidic',
    eq: '[Fe(H2O)6]^3+(aq) + H2O(l) <=> [Fe(H2O)5(OH)]^2+(aq) + H3O+(aq)',
    why: 'Small, highly charged Fe³⁺ strongly polarises the O–H bonds in coordinated H₂O ligands, releasing H⁺ ions into solution.',
  },
];
