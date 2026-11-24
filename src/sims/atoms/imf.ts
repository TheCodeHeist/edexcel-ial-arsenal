/* Atoms & Bonding Lab: Intermolecular forces & boiling-point trends (Spec 3.25–3.29 / Topic 8). */

export type ImfKind = 'london' | 'dipole' | 'hbond';

export interface ImfInfo {
  id: ImfKind;
  name: string;
  strength: string;
  occursIn: string;
  summary: string;
  facts: string[];
}

export const IMF_INFO: Record<ImfKind, ImfInfo> = {
  london: {
    id: 'london',
    name: 'London (dispersion) forces',
    strength: 'Weakest (1–15 kJ mol⁻¹), but grows with electron count',
    occursIn: 'ALL simple molecules and noble gas atoms',
    summary: 'Random movement of electrons creates an instantaneous dipole, which induces a dipole in a neighbouring molecule, causing a weak electrostatic attraction.',
    facts: [
      'More electrons (higher Mr) → larger instantaneous dipoles → stronger London forces → higher boiling point (e.g. F₂ < Cl₂ < Br₂ < I₂).',
      'Straight-chain alkanes pack closer with a larger surface area of contact than branched isomers → stronger London forces and higher boiling point.',
      'Present in EVERY molecular substance, even polar and hydrogen-bonded ones.',
    ],
  },
  dipole: {
    id: 'dipole',
    name: 'Permanent dipole–dipole forces',
    strength: 'Moderate (5–25 kJ mol⁻¹)',
    occursIn: 'Polar molecules (asymmetrical distribution of polar bonds)',
    summary: 'The δ+ end of one polar molecule attracts the δ− end of a neighbouring polar molecule.',
    facts: [
      'Acts in addition to London forces in polar molecules such as HCl, CHCl₃ and propanone.',
      'Compare molecules with similar electron counts: propanone (Mr 58, polar, b.p. 56 °C) boils higher than butane (Mr 58, non-polar, b.p. −0.5 °C).',
      'Between HCl, HBr and HI, boiling point still rises down the group because the huge increase in London forces outweighs the drop in dipole polarity.',
    ],
  },
  hbond: {
    id: 'hbond',
    name: 'Hydrogen bonding',
    strength: 'Strongest intermolecular force (15–40 kJ mol⁻¹)',
    occursIn: 'Molecules with H covalently bonded to N, O or F',
    summary: 'A strong electrostatic attraction between an electron-deficient Hδ+ (bonded to N, O or F) and a lone pair of electrons on an N, O or F atom in another molecule.',
    facts: [
      'Explains the anomalously high boiling points of H₂O (100 °C), HF (20 °C) and NH₃ (−33 °C) compared with other Period 3–5 hydrides.',
      'H₂O boils higher than HF because each H₂O can form an average of 2 hydrogen bonds per molecule (2 lone pairs + 2 δ+ H atoms), whereas HF forms only 1.',
      'Always draw hydrogen bonds as dashed lines from the lone pair on N/O/F to the δ+ H atom, with a 180° angle around H.',
    ],
  },
};

export interface HydrideSeries {
  group: string;
  colorVar: string;
  points: { period: number; formula: string; bp: number }[];
}

export const HYDRIDES: HydrideSeries[] = [
  {
    group: 'Group 6', colorVar: 'var(--redox)',
    points: [
      { period: 2, formula: 'H₂O', bp: 100 },
      { period: 3, formula: 'H₂S', bp: -60 },
      { period: 4, formula: 'H₂Se', bp: -41 },
      { period: 5, formula: 'H₂Te', bp: -2 },
    ],
  },
  {
    group: 'Group 7', colorVar: 'var(--acidbase)',
    points: [
      { period: 2, formula: 'HF', bp: 20 },
      { period: 3, formula: 'HCl', bp: -85 },
      { period: 4, formula: 'HBr', bp: -67 },
      { period: 5, formula: 'HI', bp: -35 },
    ],
  },
  {
    group: 'Group 5', colorVar: 'var(--accent)',
    points: [
      { period: 2, formula: 'NH₃', bp: -33 },
      { period: 3, formula: 'PH₃', bp: -88 },
      { period: 4, formula: 'AsH₃', bp: -62 },
      { period: 5, formula: 'SbH₃', bp: -17 },
    ],
  },
  {
    group: 'Group 4', colorVar: 'var(--amph)',
    points: [
      { period: 2, formula: 'CH₄', bp: -162 },
      { period: 3, formula: 'SiH₄', bp: -112 },
      { period: 4, formula: 'GeH₄', bp: -89 },
      { period: 5, formula: 'SnH₄', bp: -52 },
    ],
  },
];

export const ALKANE_ISOMERS = [
  { name: 'Pentane', formula: 'CH₃(CH₂)₃CH₃', branches: 0, bp: 36, note: 'Straight chain: largest surface area of contact → strongest London forces.' },
  { name: '2-methylbutane', formula: '(CH₃)₂CHCH₂CH₃', branches: 1, bp: 28, note: 'One branch: slightly more compact, fewer points of contact.' },
  { name: '2,2-dimethylpropane', formula: 'C(CH₃)₄', branches: 2, bp: 10, note: 'Nearly spherical: smallest surface area of contact → weakest London forces.' },
];
