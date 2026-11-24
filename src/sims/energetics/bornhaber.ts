/* Energetics Lab: Born–Haber cycles, lattice energy, polarisation & enthalpy of solution (Spec 12.1–12.7).
   Values in kJ mol⁻¹ from the Edexcel IAL Data Booklet. */

export interface BHStep {
  id: string;
  name: string;
  symbol: string;
  dh: number;        // kJ mol⁻¹ (signed)
  stateAfter: string;
  note: string;
}

export interface BHCycle {
  id: string;
  formula: string;
  name: string;
  elements: string;
  steps: BHStep[];   // ordered from Elements (0) up to gaseous ions, then down via Lattice Energy to ionic solid
  dfH: number;       // experimental ΔfH⊖ (Elements -> Solid)
  leExp: number;     // experimental lattice energy (always negative, gaseous ions -> solid)
  leTheo: number;    // theoretical ionic-model lattice energy (kJ mol⁻¹)
  hydCat: number;    // ΔhydH of cation (kJ mol⁻¹)
  hydAn: number;     // ΔhydH of anion (per mole of anion, kJ mol⁻¹)
  nAn: number;       // number of anions per formula unit
  polarNote: string;
  facts: string[];
}

export const BH_CYCLES: BHCycle[] = [
  {
    id: 'nacl', formula: 'NaCl', name: 'Sodium chloride',
    elements: 'Na(s) + ½Cl₂(g)',
    dfH: -411, leExp: -780, leTheo: -770,
    hydCat: -406, hydAn: -364, nAn: 1,
    steps: [
      { id: 'atM', name: 'Atomisation of Na', symbol: 'ΔatH(Na)', dh: 107, stateAfter: 'Na(g) + ½Cl₂(g)',
        note: 'Endothermic: breaks metallic bonds in solid Na to form 1 mol of gaseous Na atoms.' },
      { id: 'ie1', name: '1st ionisation energy of Na', symbol: '1st IE(Na)', dh: 496, stateAfter: 'Na⁺(g) + e⁻ + ½Cl₂(g)',
        note: 'Endothermic: removes 1 mol of electrons from 1 mol of gaseous Na atoms.' },
      { id: 'atX', name: 'Atomisation of Cl', symbol: 'ΔatH(Cl)', dh: 122, stateAfter: 'Na⁺(g) + e⁻ + Cl(g)',
        note: 'Endothermic: breaks ½ mol of Cl–Cl covalent bonds (½ × 244 = +122 kJ mol⁻¹).' },
      { id: 'ea1', name: '1st electron affinity of Cl', symbol: '1st EA(Cl)', dh: -349, stateAfter: 'Na⁺(g) + Cl⁻(g)',
        note: 'Exothermic: incoming electron is attracted to the positive nucleus of Cl(g).' },
      { id: 'le', name: 'Lattice energy of NaCl', symbol: 'ΔLEH(NaCl)', dh: -787, stateAfter: 'NaCl(s)',
        note: 'Strongly exothermic: gaseous Na⁺ and Cl⁻ ions come together to form 1 mol of solid ionic lattice.' },
    ],
    polarNote: 'Experimental (−780) and theoretical (−770 kJ mol⁻¹) values agree within ~1%: NaCl is almost purely ionic with very little polarisation.',
    facts: [
      'ΔfH = ΔatH(Na) + 1st IE(Na) + ΔatH(Cl) + 1st EA(Cl) + ΔLEH(NaCl).',
      'Always include state symbols (s), (g) and electrons e⁻ on every horizontal level of a Born–Haber diagram.',
      'ΔsolH(NaCl) = −ΔLEH + ΔhydH(Na⁺) + ΔhydH(Cl⁻) = +780 − 406 − 364 = +10 kJ mol⁻¹ (slightly endothermic, yet soluble because ΔS > 0).',
    ],
  },
  {
    id: 'mgcl2', formula: 'MgCl2', name: 'Magnesium chloride',
    elements: 'Mg(s) + Cl₂(g)',
    dfH: -641, leExp: -2526, leTheo: -2326,
    hydCat: -1920, hydAn: -364, nAn: 2,
    steps: [
      { id: 'atM', name: 'Atomisation of Mg', symbol: 'ΔatH(Mg)', dh: 148, stateAfter: 'Mg(g) + Cl₂(g)',
        note: 'Forms 1 mol of gaseous Mg atoms.' },
      { id: 'ie1', name: '1st IE of Mg', symbol: '1st IE(Mg)', dh: 738, stateAfter: 'Mg⁺(g) + e⁻ + Cl₂(g)',
        note: 'Removes first electron from Mg(g).' },
      { id: 'ie2', name: '2nd IE of Mg', symbol: '2nd IE(Mg)', dh: 1451, stateAfter: 'Mg²⁺(g) + 2e⁻ + Cl₂(g)',
        note: 'Much larger than 1st IE because the electron is removed from a positive Mg⁺ ion.' },
      { id: 'atX', name: '2 × Atomisation of Cl', symbol: '2ΔatH(Cl)', dh: 244, stateAfter: 'Mg²⁺(g) + 2e⁻ + 2Cl(g)',
        note: 'Multiply by 2 because 2 mol of Cl(g) atoms are needed for MgCl₂!' },
      { id: 'ea1', name: '2 × 1st EA of Cl', symbol: '2 × 1st EA(Cl)', dh: -698, stateAfter: 'Mg²⁺(g) + 2Cl⁻(g)',
        note: 'Multiply 1st EA (−349) by 2 for two Cl⁻ ions.' },
      { id: 'le', name: 'Lattice energy of MgCl₂', symbol: 'ΔLEH(MgCl₂)', dh: -2524, stateAfter: 'MgCl₂(s)',
        note: 'Much more exothermic than NaCl because Mg²⁺ has a higher charge (+2) and smaller ionic radius.' },
    ],
    polarNote: 'Experimental (−2526) is ~200 kJ mol⁻¹ more exothermic than theoretical (−2326): small, high-charge Mg²⁺ polarises Cl⁻, adding covalent character.',
    facts: [
      'Remember to multiply BOTH ΔatH(Cl) and 1st EA(Cl) by 2 for MgCl₂!',
      'Higher charge density on Mg²⁺ makes ΔLEH(MgCl₂) over three times more exothermic than NaCl.',
      'ΔsolH(MgCl₂) = +2526 − 1920 + 2(−364) = −122 kJ mol⁻¹ (strongly exothermic dissolving).',
    ],
  },
  {
    id: 'mgo', formula: 'MgO', name: 'Magnesium oxide',
    elements: 'Mg(s) + ½O₂(g)',
    dfH: -602, leExp: -3791, leTheo: -3795,
    hydCat: -1920, hydAn: -1000, nAn: 1,
    steps: [
      { id: 'atM', name: 'Atomisation of Mg', symbol: 'ΔatH(Mg)', dh: 148, stateAfter: 'Mg(g) + ½O₂(g)',
        note: 'Forms 1 mol of Mg(g) atoms.' },
      { id: 'ie1', name: '1st IE of Mg', symbol: '1st IE(Mg)', dh: 738, stateAfter: 'Mg⁺(g) + e⁻ + ½O₂(g)',
        note: 'Removes first electron from Mg(g).' },
      { id: 'ie2', name: '2nd IE of Mg', symbol: '2nd IE(Mg)', dh: 1451, stateAfter: 'Mg²⁺(g) + 2e⁻ + ½O₂(g)',
        note: 'Removes second electron to form Mg²⁺(g).' },
      { id: 'atX', name: 'Atomisation of O', symbol: 'ΔatH(O)', dh: 249, stateAfter: 'Mg²⁺(g) + 2e⁻ + O(g)',
        note: 'Breaks ½ mol of O=O double bonds.' },
      { id: 'ea1', name: '1st EA of O', symbol: '1st EA(O)', dh: -141, stateAfter: 'Mg²⁺(g) + e⁻ + O⁻(g)',
        note: 'Exothermic: neutral O attracts an electron.' },
      { id: 'ea2', name: '2nd EA of O (ENDOTHERMIC!)', symbol: '2nd EA(O)', dh: 798, stateAfter: 'Mg²⁺(g) + O²⁻(g)',
        note: 'Strongly ENDOTHERMIC (+798): forcing a negatively charged electron onto a negative O⁻ ion requires energy to overcome electrostatic repulsion!' },
      { id: 'le', name: 'Lattice energy of MgO', symbol: 'ΔLEH(MgO)', dh: -3845, stateAfter: 'MgO(s)',
        note: 'Huge exothermic lattice energy from +2 and −2 small ions overcomes the endothermic 2nd IE and 2nd EA.' },
    ],
    polarNote: 'Both Mg²⁺ and O²⁻ are small, doubly charged ions → massive electrostatic attraction (melting point 2852 °C).',
    facts: [
      '2nd electron affinity of oxygen is ALWAYS endothermic (+798 kJ mol⁻¹) because the incoming electron is repelled by the negative O⁻ ion.',
      'MgO is still stable because its huge exothermic lattice energy (−3791 kJ mol⁻¹) outweighs the endothermic IE and 2nd EA steps.',
    ],
  },
  {
    id: 'agcl', formula: 'AgCl', name: 'Silver chloride (polarisation)',
    elements: 'Ag(s) + ½Cl₂(g)',
    dfH: -127, leExp: -905, leTheo: -770,
    hydCat: -464, hydAn: -364, nAn: 1,
    steps: [
      { id: 'atM', name: 'Atomisation of Ag', symbol: 'ΔatH(Ag)', dh: 285, stateAfter: 'Ag(g) + ½Cl₂(g)',
        note: 'Stronger metallic bonding in Ag than Na.' },
      { id: 'ie1', name: '1st IE of Ag', symbol: '1st IE(Ag)', dh: 731, stateAfter: 'Ag⁺(g) + e⁻ + ½Cl₂(g)',
        note: 'Higher than Na due to poorer shielding by 4d¹⁰ electrons.' },
      { id: 'atX', name: 'Atomisation of Cl', symbol: 'ΔatH(Cl)', dh: 122, stateAfter: 'Ag⁺(g) + e⁻ + Cl(g)',
        note: 'Forms 1 mol of gaseous Cl atoms.' },
      { id: 'ea1', name: '1st EA of Cl', symbol: '1st EA(Cl)', dh: -349, stateAfter: 'Ag⁺(g) + Cl⁻(g)',
        note: 'Exothermic electron gain.' },
      { id: 'le', name: 'Lattice energy of AgCl', symbol: 'ΔLEH(AgCl)', dh: -916, stateAfter: 'AgCl(s)',
        note: 'Significantly more exothermic than the purely ionic theoretical prediction (−770 kJ mol⁻¹)!' },
    ],
    polarNote: 'Big discrepancy (−905 vs −770 kJ mol⁻¹ = 135 kJ mol⁻¹ difference!): Ag⁺ strongly polarises the Cl⁻ electron cloud, giving significant covalent character and extra bond strength.',
    facts: [
      'The theoretical model assumes perfectly spherical, point-charge ions with 100% ionic bonding.',
      'When experimental |ΔLEH| is much larger than theoretical |ΔLEH|, the compound has covalent character due to cation polarisation of the anion.',
      'Polarisation is greatest with a small, high-charge cation (high charge density) and a large, easily distorted anion (like I⁻).',
    ],
  },
];

export function solEnthalpy(c: BHCycle): number {
  return -c.leExp + c.hydCat + c.nAn * c.hydAn;
}
