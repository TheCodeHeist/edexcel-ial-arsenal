/* Atoms & Bonding Lab: VSEPR shapes, bond angles, electronegativity and molecular polarity (Spec 3.13–3.18, 3.22–3.24). */

import { EN } from './consts';

export type Vec3 = [number, number, number];

export interface BondSpec {
  dir: Vec3;       // unit direction vector from central atom
  el: string;      // outer atom symbol
  order: 1 | 2 | 3;
  dative?: boolean;
}

export interface MoleculePreset {
  id: string;
  formula: string;
  name: string;
  central: string;
  bp: number;      // bonding regions (double bond counts as 1 region)
  lp: number;      // lone pairs on central atom
  shape: string;
  angle: string;
  angleDeg: number;
  arcPair?: [number, number];
  secondArc?: { pair: [number, number]; label: string };
  ethene?: boolean;
  polar: boolean;
  polarWhy: string;
  bonds: BondSpec[];
  lones: Vec3[];   // unit direction vectors for lone pairs
  beyond?: boolean;
  facts: string[];
}

function norm(v: Vec3): Vec3 {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

const TET: Vec3[] = [
  norm([0, 1, 0]),
  norm([Math.sqrt(8 / 9), -1 / 3, 0]),
  norm([-Math.sqrt(2 / 9), -1 / 3, Math.sqrt(2 / 3)]),
  norm([-Math.sqrt(2 / 9), -1 / 3, -Math.sqrt(2 / 3)]),
];

/** Construct tetrahedral-family vectors compressed by lone-pair repulsion (e.g. 107° for NH3, 104.5° for H2O). */
function trigPyramidal(deg: number): { bonds: Vec3[]; lones: Vec3[] } {
  // Angle between two bonds is deg. Let each bond make angle alpha with -y axis:
  // cos(deg) = cos²(alpha) - 0.5*sin²(alpha) => cos(deg) = 1.5*cos²(alpha) - 0.5
  const cosA = Math.sqrt(Math.max(0, (Math.cos((deg * Math.PI) / 180) + 0.5) / 1.5));
  const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
  return {
    lones: [[0, 1, 0]],
    bonds: [0, 120, 240].map((phi) => {
      const r = (phi * Math.PI) / 180;
      return norm([sinA * Math.cos(r), -cosA, sinA * Math.sin(r)]);
    }),
  };
}

function bentTet(deg: number): { bonds: Vec3[]; lones: Vec3[] } {
  const half = ((deg / 2) * Math.PI) / 180;
  const lpHalf = ((114 / 2) * Math.PI) / 180;
  return {
    bonds: [
      norm([Math.sin(half), -Math.cos(half), 0]),
      norm([-Math.sin(half), -Math.cos(half), 0]),
    ],
    lones: [
      norm([0, Math.cos(lpHalf), Math.sin(lpHalf)]),
      norm([0, Math.cos(lpHalf), -Math.sin(lpHalf)]),
    ],
  };
}

const TP: Vec3[] = [
  [0, 1, 0],
  [Math.sqrt(3) / 2, -0.5, 0],
  [-Math.sqrt(3) / 2, -0.5, 0],
];

const TBP_AX: Vec3[] = [[0, 1, 0], [0, -1, 0]];
const TBP_EQ: Vec3[] = [
  [1, 0, 0],
  [-0.5, 0, Math.sqrt(3) / 2],
  [-0.5, 0, -Math.sqrt(3) / 2],
];

const OCT: Vec3[] = [
  [1, 0, 0], [-1, 0, 0],
  [0, 1, 0], [0, -1, 0],
  [0, 0, 1], [0, 0, -1],
];

const nh3 = trigPyramidal(107);
const h2o = bentTet(104.5);

export const MOLECULES: MoleculePreset[] = [
  {
    id: 'becl2', formula: 'BeCl2', name: 'Beryllium chloride', central: 'Be', bp: 2, lp: 0,
    shape: 'Linear', angle: '180°', angleDeg: 180, polar: false,
    polarWhy: 'Each Be–Cl bond is polar (ΔEN = 1.59), but the two equal bond dipoles point in exactly opposite directions and cancel out.',
    bonds: [{ dir: [-1, 0, 0], el: 'Cl', order: 1 }, { dir: [1, 0, 0], el: 'Cl', order: 1 }],
    lones: [],
    facts: [
      '2 bonding pairs, 0 lone pairs around Be (electron-deficient: only 4 outer electrons).',
      'Electron pairs repel equally to get as far apart as possible: 180°.',
      'Symmetrical linear shape → bond dipoles cancel → non-polar molecule.',
    ],
  },
  {
    id: 'co2', formula: 'CO2', name: 'Carbon dioxide', central: 'C', bp: 2, lp: 0,
    shape: 'Linear', angle: '180°', angleDeg: 180, polar: false,
    polarWhy: 'Each C=O bond is polar (ΔEN = 0.89), but the linear symmetry means the two dipoles are equal and opposite and cancel.',
    bonds: [{ dir: [-1, 0, 0], el: 'O', order: 2 }, { dir: [1, 0, 0], el: 'O', order: 2 }],
    lones: [],
    facts: [
      '2 double-bond regions and 0 lone pairs on carbon; a double bond counts as one region of electron density.',
      'Regions repel equally to 180° (linear).',
      'Polar bonds, non-polar molecule: dipoles cancel by symmetry.',
    ],
  },
  {
    id: 'bf3', formula: 'BF3', name: 'Boron trifluoride', central: 'B', bp: 3, lp: 0,
    shape: 'Trigonal planar', angle: '120°', angleDeg: 120, polar: false,
    polarWhy: 'B–F bonds are strongly polar (ΔEN = 1.94), but the three dipoles lie symmetrically at 120° in one plane and cancel.',
    bonds: TP.map((dir) => ({ dir, el: 'F', order: 1 })),
    lones: [],
    facts: [
      '3 bonding pairs, 0 lone pairs around B (electron-deficient: 6 outer electrons).',
      'All three bonding pairs repel equally in one plane → 120°.',
      'Symmetrical trigonal planar shape → non-polar overall.',
    ],
  },
  {
    id: 'ch4', formula: 'CH4', name: 'Methane', central: 'C', bp: 4, lp: 0,
    shape: 'Tetrahedral', angle: '109.5°', angleDeg: 109.5, polar: false,
    polarWhy: 'C–H bonds are almost non-polar (ΔEN = 0.35), and the tetrahedral symmetry cancels any tiny bond dipoles.',
    bonds: TET.map((dir) => ({ dir, el: 'H', order: 1 })),
    lones: [],
    facts: [
      '4 bonding pairs, 0 lone pairs around C.',
      'All four bonding pairs repel equally in 3D → tetrahedral, 109.5°.',
      'Same shape and angle as NH₄⁺ (ammonium ion, which has 3 covalent + 1 dative covalent bond).',
    ],
  },
  {
    id: 'chcl3', formula: 'CHCl3', name: 'Trichloromethane', central: 'C', bp: 4, lp: 0,
    shape: 'Tetrahedral', angle: '109.5°', angleDeg: 109.5, polar: true,
    polarWhy: 'Three polar C–Cl bonds pull electron density to one side, not balanced by the single C–H bond → net dipole towards the Cl atoms.',
    bonds: [
      { dir: TET[0], el: 'H', order: 1 },
      { dir: TET[1], el: 'Cl', order: 1 },
      { dir: TET[2], el: 'Cl', order: 1 },
      { dir: TET[3], el: 'Cl', order: 1 },
    ],
    lones: [],
    facts: [
      '4 bonding pairs, 0 lone pairs → tetrahedral (~109.5°).',
      'Unlike CCl₄ (non-polar), replacing one Cl with H breaks the symmetry.',
      'Net permanent dipole → permanent dipole–dipole forces between molecules.',
    ],
  },
  {
    id: 'nh3', formula: 'NH3', name: 'Ammonia', central: 'N', bp: 3, lp: 1,
    shape: 'Trigonal pyramidal', angle: '107°', angleDeg: 107, polar: true,
    polarWhy: 'Three polar N–H bonds point downwards while N is at the apex, so the dipoles add up to a net dipole towards N.',
    bonds: nh3.bonds.map((dir) => ({ dir, el: 'H', order: 1 })),
    lones: nh3.lones,
    facts: [
      '3 bonding pairs and 1 lone pair (4 regions of electron density → tetrahedral arrangement of pairs).',
      'Lone pairs are closer to the nucleus and repel more strongly than bonding pairs (LP–BP > BP–BP).',
      'Each lone pair closes the bond angle by ~2.5°: 109.5° → 107°.',
    ],
  },
  {
    id: 'h2o', formula: 'H2O', name: 'Water', central: 'O', bp: 2, lp: 2,
    shape: 'V-shaped (non-linear)', angle: '104.5°', angleDeg: 104.5, polar: true,
    polarWhy: 'Two strongly polar O–H bonds (ΔEN = 1.24) meet at 104.5°, not 180°, so their dipoles do not cancel.',
    bonds: h2o.bonds.map((dir) => ({ dir, el: 'H', order: 1 })),
    lones: h2o.lones,
    facts: [
      '2 bonding pairs and 2 lone pairs around O (4 electron pairs in total).',
      'Repulsion order: LP–LP > LP–BP > BP–BP.',
      'Two lone pairs compress the tetrahedral 109.5° angle by ~5° down to 104.5°.',
    ],
  },
  {
    id: 'so2', formula: 'SO2', name: 'Sulfur dioxide', central: 'S', bp: 2, lp: 1,
    shape: 'V-shaped (non-linear)', angle: '119°', angleDeg: 119, polar: true,
    polarWhy: 'Two polar S=O bonds at 119° do not oppose each other, leaving a net dipole towards the oxygens.',
    bonds: [
      { dir: norm([Math.sin((59.5 * Math.PI) / 180), -Math.cos((59.5 * Math.PI) / 180), 0]), el: 'O', order: 2 },
      { dir: norm([-Math.sin((59.5 * Math.PI) / 180), -Math.cos((59.5 * Math.PI) / 180), 0]), el: 'O', order: 2 },
    ],
    lones: [[0, 1, 0]],
    facts: [
      '2 double-bond regions and 1 lone pair → 3 regions of electron density (trigonal planar arrangement).',
      'The lone pair repels more strongly than the double bonds, reducing 120° slightly to ~119°.',
      'Asymmetrical V-shape → polar molecule (unlike linear CO₂).',
    ],
  },
  {
    id: 'nh4', formula: 'NH4^+', name: 'Ammonium ion (dative)', central: 'N', bp: 4, lp: 0,
    shape: 'Tetrahedral', angle: '109.5°', angleDeg: 109.5, polar: false,
    polarWhy: 'All four N–H bonds are identical in length and strength once formed, arranged symmetrically at 109.5° (charged ion, zero net dipole).',
    bonds: TET.map((dir, i) => ({ dir, el: 'H', order: 1, dative: i === 0 })),
    lones: [],
    facts: [
      'Formed when NH₃ donates its lone pair to H⁺ via a dative (coordinate) covalent bond (both shared electrons come from N).',
      'Once formed, all four N–H bonds are identical; the lone-pair compression disappears, widening the angle from 107° (NH₃) to 109.5° (NH₄⁺).',
      '4 bonding pairs, 0 lone pairs around N → tetrahedral (109.5°).',
    ],
  },
  {
    id: 'c2h4', formula: 'C2H4', name: 'Ethene (σ + π bond)', central: 'C', bp: 3, lp: 0,
    shape: 'Trigonal planar (each C)', angle: '120°', angleDeg: 120, ethene: true, polar: false,
    polarWhy: 'C–H bonds are almost non-polar (ΔEN = 0.35) and cancel symmetrically in a flat planar molecule.',
    bonds: TP.map((dir, i) => ({ dir, el: i === 0 ? 'C' : 'H', order: i === 0 ? 2 : 1 })),
    lones: [],
    facts: [
      'Each carbon has 3 bonding regions (two C–H single bonds and one C=C double bond) and 0 lone pairs → trigonal planar (120°).',
      'The C=C double bond consists of 1 σ (sigma) bond (head-on orbital overlap along the axis) + 1 π (pi) bond (sideways p-orbital overlap above and below the plane).',
      'Sideways π-overlap locks the molecule planar and prevents free rotation around the C=C bond.',
    ],
  },
  {
    id: 'pcl5', formula: 'PCl5', name: 'Phosphorus(V) chloride', central: 'P', bp: 5, lp: 0,
    shape: 'Trigonal bipyramidal', angle: '90° and 120°', angleDeg: 90,
    arcPair: [0, 2], secondArc: { pair: [2, 3], label: '120°' }, polar: false,
    polarWhy: 'The two axial P–Cl dipoles cancel vertically, and the three equatorial P–Cl dipoles cancel at 120° in the horizontal plane.',
    bonds: [...TBP_AX, ...TBP_EQ].map((dir) => ({ dir, el: 'Cl', order: 1 })),
    lones: [],
    facts: [
      '5 bonding pairs, 0 lone pairs around phosphorus (10 outer electrons — expanded octet).',
      '3 equatorial bonds at 120° to each other; 2 axial bonds at 90° to the equatorial plane.',
      'Fully symmetrical → non-polar molecule (in the gas phase).',
    ],
  },
  {
    id: 'sf6', formula: 'SF6', name: 'Sulfur hexafluoride', central: 'S', bp: 6, lp: 0,
    shape: 'Octahedral', angle: '90°', angleDeg: 90, arcPair: [0, 2], polar: false,
    polarWhy: 'Six strongly polar S–F bonds (ΔEN = 1.40) sit in three opposite pairs along x, y and z and cancel completely.',
    bonds: OCT.map((dir) => ({ dir, el: 'F', order: 1 })),
    lones: [],
    facts: [
      '6 bonding pairs, 0 lone pairs around sulfur (12 outer electrons).',
      'All six bonds are equivalent, with 90° between adjacent bonds and 180° between opposite bonds.',
      'Highly symmetrical → non-polar gas despite very polar S–F bonds.',
    ],
  },
  {
    id: 'xef4', formula: 'XeF4', name: 'Xenon tetrafluoride', central: 'Xe', bp: 4, lp: 2,
    shape: 'Square planar', angle: '90°', angleDeg: 90, arcPair: [0, 2], polar: false, beyond: true,
    polarWhy: 'The 2 lone pairs sit opposite each other (180°) to minimise LP–LP repulsion, leaving 4 Xe–F bonds in a flat square that cancel.',
    bonds: [OCT[0], OCT[1], OCT[4], OCT[5]].map((dir) => ({ dir, el: 'F', order: 1 })),
    lones: [OCT[2], OCT[3]],
    facts: [
      '4 bonding pairs and 2 lone pairs (6 electron pairs → octahedral arrangement).',
      'Lone pairs occupy opposite positions (180° apart) to minimise LP–LP repulsion.',
      'The four fluorines lie in a square plane at 90° → non-polar.',
    ],
  },
];

/** Build a generic VSEPR geometry for any valid (bp, lp) with 2 <= bp + lp <= 6 and bp >= 1. */
export function buildVsepr(bp: number, lp: number): {
  shape: string; angle: string; angleDeg: number; arcPair?: [number, number]; secondArc?: { pair: [number, number]; label: string };
  bonds: BondSpec[]; lones: Vec3[]; polar: boolean; beyond?: boolean; note: string;
} {
  const tot = bp + lp;
  const make = (
    dirs: Vec3[],
    lones: Vec3[],
    shape: string,
    angle: string,
    angleDeg: number,
    polar: boolean,
    note: string,
    beyond = false,
    arcPair?: [number, number],
    secondArc?: { pair: [number, number]; label: string },
  ) => ({
    shape, angle, angleDeg, polar, beyond, note, arcPair, secondArc,
    bonds: dirs.map((dir) => ({ dir, el: 'X', order: 1 as const })),
    lones,
  });

  if (tot === 2) {
    return make([[-1, 0, 0], [1, 0, 0]].slice(0, bp) as Vec3[], lp ? [[1, 0, 0]] : [], 'Linear', '180°', 180, lp > 0,
      '2 regions of electron density point 180° apart.');
  }
  if (tot === 3) {
    if (lp === 0) return make(TP, [], 'Trigonal planar', '120°', 120, false, '3 bonding pairs repel equally in one plane at 120°.');
    const half = ((118 / 2) * Math.PI) / 180;
    return make(
      [norm([Math.sin(half), -Math.cos(half), 0]), norm([-Math.sin(half), -Math.cos(half), 0])],
      [[0, 1, 0]], 'V-shaped (non-linear)', '~118°', 118, true,
      '1 lone pair compresses the 120° trigonal planar angle slightly.');
  }
  if (tot === 4) {
    if (lp === 0) return make(TET, [], 'Tetrahedral', '109.5°', 109.5, false, '4 equal bonding pairs point to the corners of a regular tetrahedron.');
    if (lp === 1) {
      const g = trigPyramidal(107);
      return make(g.bonds, g.lones, 'Trigonal pyramidal', '107°', 107, true, '1 lone pair repels more strongly than bonding pairs, reducing 109.5° to 107°.');
    }
    const g = bentTet(104.5);
    return make(g.bonds, g.lones, 'V-shaped (non-linear)', '104.5°', 104.5, true, '2 lone pairs compress the bond angle twice: 109.5° → 107° → 104.5°.');
  }
  if (tot === 5) {
    if (lp === 0) {
      return make([...TBP_AX, ...TBP_EQ], [], 'Trigonal bipyramidal', '90° and 120°', 90, false,
        '3 equatorial bonds at 120° and 2 axial bonds at 90°.', false, [0, 2], { pair: [2, 3], label: '120°' });
    }
    if (lp === 1) {
      return make([...TBP_AX, TBP_EQ[1], TBP_EQ[2]], [TBP_EQ[0]], 'Seesaw', '<90° and <120°', 88, true,
        'The lone pair takes an equatorial position (only two 90° neighbours instead of three), compressing both axial (<90°) and equatorial (<120°) angles.',
        true, [0, 2], { pair: [2, 3], label: '<120°' });
    }
    if (lp === 2) {
      return make([...TBP_AX, TBP_EQ[0]], [TBP_EQ[1], TBP_EQ[2]], 'T-shaped', '<90°', 88, true,
        'Both lone pairs occupy equatorial positions to minimise 90° repulsions, pushing axial bonds below 90°.', true, [0, 2]);
    }
    return make(TBP_AX, TBP_EQ, 'Linear', '180°', 180, false, 'All 3 lone pairs sit around the equator at 120°, leaving 2 axial bonds at 180°.', true);
  }
  // tot === 6
  if (lp === 0) return make(OCT, [], 'Octahedral', '90°', 90, false, '6 equal bonding pairs sit along ±x, ±y, ±z at 90°.', false, [0, 2]);
  if (lp === 1) {
    return make([OCT[0], OCT[1], OCT[2], OCT[4], OCT[5]], [OCT[3]], 'Square pyramidal', '<90°', 89, true,
      '1 lone pair sits at one apex and pushes the four equatorial bonds slightly away (<90°).', true, [0, 2]);
  }
  if (lp === 2) {
    return make([OCT[0], OCT[1], OCT[4], OCT[5]], [OCT[2], OCT[3]], 'Square planar', '90°', 90, false,
      '2 lone pairs sit opposite each other (180° apart), leaving 4 bonds in a flat square at 90°.', true, [0, 2]);
  }
  return make([OCT[0], OCT[1], OCT[4]], [OCT[2], OCT[3], OCT[5]], 'T-shaped', '<90°', 89, true,
    '3 lone pairs sit in a T-plane around the central atom, leaving 3 bonding pairs in a T-shape (<90°).', true, [0, 2]);
}

/** Compute net dipole vector from central atom and bonds using Pauling electronegativity differences. */
export function netDipole(central: string, bonds: BondSpec[]): { vec: Vec3; mag: number; deltaEN: number } {
  const enC = EN[central] ?? 2.2;
  let vx = 0, vy = 0, vz = 0;
  let maxDelta = 0;
  for (const b of bonds) {
    const enB = EN[b.el] ?? 3.2;
    const d = enB - enC; // positive points from central -> outer (towards δ-)
    maxDelta = Math.max(maxDelta, Math.abs(d));
    vx += b.dir[0] * d;
    vy += b.dir[1] * d;
    vz += b.dir[2] * d;
  }
  const mag = Math.hypot(vx, vy, vz);
  return { vec: [vx, vy, vz], mag: mag < 1e-3 ? 0 : mag, deltaEN: maxDelta };
}
