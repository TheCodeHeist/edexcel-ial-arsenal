/* Energetics Lab: Mean bond enthalpies & bond breaking vs bond making (Spec 6.10–6.12). */

export interface BondItem {
  bond: string;
  count: number;
  be: number; // kJ mol⁻¹ (Edexcel Data Booklet mean bond enthalpies)
}

export interface BondReaction {
  id: string;
  name: string;
  eq: string;
  broken: BondItem[];
  made: BondItem[];
  dhLit: number; // actual standard enthalpy change ΔrH⊖ (kJ mol⁻¹)
  whyDiff: string;
  facts: string[];
}

export const BOND_REACTIONS: BondReaction[] = [
  {
    id: 'ch4_comb', name: 'Combustion of methane',
    eq: 'CH4(g) + 2O2(g) -> CO2(g) + 2H2O(g)',
    broken: [
      { bond: 'C–H', count: 4, be: 413 },
      { bond: 'O=O', count: 2, be: 498 },
    ],
    made: [
      { bond: 'C=O', count: 2, be: 805 },
      { bond: 'O–H', count: 4, be: 464 },
    ],
    dhLit: -890,
    whyDiff: 'Mean bond enthalpies give ΔH for H₂O(g) (−818 kJ mol⁻¹); standard ΔcH⊖ forms H₂O(l) (−890 kJ mol⁻¹) and releases extra latent heat of condensation.',
    facts: [
      'Bond breaking is ALWAYS endothermic (+); bond making is ALWAYS exothermic (−).',
      'ΔH = Σ(bonds broken) − Σ(bonds made).',
      'Mean bond enthalpy is averaged across many different molecules in the gaseous state.',
    ],
  },
  {
    id: 'h2_cl2', name: 'Hydrogen + chlorine',
    eq: 'H2(g) + Cl2(g) -> 2HCl(g)',
    broken: [
      { bond: 'H–H', count: 1, be: 436 },
      { bond: 'Cl–Cl', count: 1, be: 243 },
    ],
    made: [
      { bond: 'H–Cl', count: 2, be: 432 },
    ],
    dhLit: -185,
    whyDiff: 'Every species is a diatomic gas with an exact (not mean) bond enthalpy, so the bond-enthalpy value matches the true ΔrH⊖ almost exactly!',
    facts: [
      'Exact bond enthalpies exist for diatomic gases (H₂, Cl₂, HCl), so there is no averaging error.',
      'Broken: 436 + 243 = +679 kJ mol⁻¹; Made: 2 × 432 = 864 kJ mol⁻¹ → ΔH = −185 kJ mol⁻¹.',
    ],
  },
  {
    id: 'c2h4_h2', name: 'Hydrogenation of ethene',
    eq: 'C2H4(g) + H2(g) -> C2H6(g)',
    broken: [
      { bond: 'C=C', count: 1, be: 612 },
      { bond: 'H–H', count: 1, be: 436 },
    ],
    made: [
      { bond: 'C–C', count: 1, be: 347 },
      { bond: 'C–H', count: 2, be: 413 },
    ],
    dhLit: -137,
    whyDiff: 'Cancelling the 4 unchanged C–H bonds speeds up the sum; the small gap vs −137 kJ mol⁻¹ comes from using mean C–H and C–C values.',
    facts: [
      'You can break ALL bonds or only the bonds that change — both give the exact same ΔH.',
      'Exothermic because forming 1 C–C + 2 C–H bonds releases more energy than breaking 1 C=C + 1 H–H.',
    ],
  },
  {
    id: 'haber', name: 'Haber process (ammonia)',
    eq: 'N2(g) + 3H2(g) -> 2NH3(g)',
    broken: [
      { bond: 'N≡N', count: 1, be: 945 },
      { bond: 'H–H', count: 3, be: 436 },
    ],
    made: [
      { bond: 'N–H', count: 6, be: 391 },
    ],
    dhLit: -92,
    whyDiff: 'The huge N≡N triple bond (945 kJ mol⁻¹) causes a very high activation energy even though the overall reaction is exothermic.',
    facts: [
      'Broken: 945 + 3(436) = +2253 kJ mol⁻¹; Made: 6(391) = 2346 kJ mol⁻¹ → ΔH = −93 kJ mol⁻¹.',
      'Strong N≡N triple bond explains why N₂ is unreactive at room temperature and needs an iron catalyst.',
    ],
  },
];

export function sumBonds(items: BondItem[]): number {
  return items.reduce((s, b) => s + b.count * b.be, 0);
}
