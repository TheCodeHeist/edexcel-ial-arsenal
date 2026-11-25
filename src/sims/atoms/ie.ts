/* Atoms & Bonding Lab: First and successive ionisation energies (Spec 2.6–2.8, 2.15–2.18).
   Values in kJ mol⁻¹ from the Edexcel IAL Data Booklet. */

export interface FirstIE {
  z: number;
  sym: string;
  name: string;
  period: number;
  group: number;
  ie1: number;              // kJ mol⁻¹
  radiusPm: number | null;  // single-bond covalent radius (pm); null for noble gases
  config: string;
  note: string;
  dip?: boolean;
}

export const FIRST_IE: FirstIE[] = [
  { z: 1, sym: 'H', name: 'Hydrogen', period: 1, group: 1, ie1: 1312, radiusPm: 37, config: '1s¹',
    note: 'Single proton, no inner shielding shell.' },
  { z: 2, sym: 'He', name: 'Helium', period: 1, group: 18, ie1: 2372, radiusPm: null, config: '1s²',
    note: 'Highest 1st IE of all elements: nuclear charge doubles to +2 with no extra shielding.' },
  { z: 3, sym: 'Li', name: 'Lithium', period: 2, group: 1, ie1: 520, radiusPm: 134, config: '1s² 2s¹',
    note: 'Sharp drop from He: outer electron enters the n = 2 shell, further from the nucleus and shielded by 1s².' },
  { z: 4, sym: 'Be', name: 'Beryllium', period: 2, group: 2, ie1: 900, radiusPm: 90, config: '1s² 2s²',
    note: 'Higher nuclear charge (+4), same shielding (1s²), smaller atomic radius → stronger attraction.' },
  { z: 5, sym: 'B', name: 'Boron', period: 2, group: 13, ie1: 801, radiusPm: 82, config: '1s² 2s² 2p¹', dip: true,
    note: 'Dip Be → B: outer electron is removed from a higher-energy 2p sub-shell, slightly further from the nucleus and shielded by the 2s² electrons.' },
  { z: 6, sym: 'C', name: 'Carbon', period: 2, group: 14, ie1: 1086, radiusPm: 77, config: '1s² 2s² 2p²',
    note: 'Increasing nuclear charge (+6) with similar shielding pulls the 2p electrons closer.' },
  { z: 7, sym: 'N', name: 'Nitrogen', period: 2, group: 15, ie1: 1402, radiusPm: 75, config: '1s² 2s² 2p³',
    note: 'Three unpaired electrons occupy the three 2p orbitals singly (no spin-pair repulsion yet).' },
  { z: 8, sym: 'O', name: 'Oxygen', period: 2, group: 16, ie1: 1314, radiusPm: 73, config: '1s² 2s² 2p⁴', dip: true,
    note: 'Dip N → O: two electrons now share one 2p orbital. Spin-pair repulsion between the paired electrons makes one easier to remove.' },
  { z: 9, sym: 'F', name: 'Fluorine', period: 2, group: 17, ie1: 1681, radiusPm: 71, config: '1s² 2s² 2p⁵',
    note: 'Nuclear charge (+9) outweighs spin-pair repulsion; radius is tiny.' },
  { z: 10, sym: 'Ne', name: 'Neon', period: 2, group: 18, ie1: 2081, radiusPm: null, config: '1s² 2s² 2p⁶',
    note: 'Full n = 2 shell, highest nuclear charge in Period 2 with the same 1s² inner shielding.' },
  { z: 11, sym: 'Na', name: 'Sodium', period: 3, group: 1, ie1: 496, radiusPm: 154, config: '[Ne] 3s¹',
    note: 'Sharp drop from Ne: outer electron enters the n = 3 shell, further from the nucleus and shielded by 1s² 2s² 2p⁶.' },
  { z: 12, sym: 'Mg', name: 'Magnesium', period: 3, group: 2, ie1: 738, radiusPm: 130, config: '[Ne] 3s²',
    note: 'Nuclear charge increases (+12) with the same inner shielding; radius shrinks.' },
  { z: 13, sym: 'Al', name: 'Aluminium', period: 3, group: 13, ie1: 578, radiusPm: 118, config: '[Ne] 3s² 3p¹', dip: true,
    note: 'Dip Mg → Al: outer electron is in the higher-energy 3p sub-shell, further out and slightly shielded by 3s².' },
  { z: 14, sym: 'Si', name: 'Silicon', period: 3, group: 14, ie1: 789, radiusPm: 111, config: '[Ne] 3s² 3p²',
    note: 'Greater nuclear charge (+14), same shielding, smaller radius.' },
  { z: 15, sym: 'P', name: 'Phosphorus', period: 3, group: 15, ie1: 1012, radiusPm: 106, config: '[Ne] 3s² 3p³',
    note: 'Half-filled 3p sub-shell: one electron in each 3p orbital, no spin-pair repulsion.' },
  { z: 16, sym: 'S', name: 'Sulfur', period: 3, group: 16, ie1: 1000, radiusPm: 102, config: '[Ne] 3s² 3p⁴', dip: true,
    note: 'Dip P → S: spin-pair repulsion between the two electrons sharing a 3p orbital lowers the energy needed to remove one.' },
  { z: 17, sym: 'Cl', name: 'Chlorine', period: 3, group: 17, ie1: 1251, radiusPm: 99, config: '[Ne] 3s² 3p⁵',
    note: 'Higher nuclear charge (+17) with similar shielding pulls electrons in tightly.' },
  { z: 18, sym: 'Ar', name: 'Argon', period: 3, group: 18, ie1: 1521, radiusPm: null, config: '[Ne] 3s² 3p⁶',
    note: 'Highest 1st IE in Period 3: full 3p sub-shell and largest nuclear charge in the period.' },
  { z: 19, sym: 'K', name: 'Potassium', period: 4, group: 1, ie1: 419, radiusPm: 196, config: '[Ar] 4s¹',
    note: 'New n = 4 shell: extra shielding and larger distance from the nucleus outweigh the extra proton.' },
  { z: 20, sym: 'Ca', name: 'Calcium', period: 4, group: 2, ie1: 590, radiusPm: 174, config: '[Ar] 4s²',
    note: 'Higher nuclear charge than K with the same [Ar] inner shielding.' },
];

export interface SuccessiveEntry {
  sym: string;
  name: string;
  group: number; // 1–7 or 0 (for Group 0/18)
  shells: number[]; // electrons per shell from outer inward
  values: number[]; // kJ mol⁻¹
}

export const SUCCESSIVE_IE: SuccessiveEntry[] = [
  { sym: 'Na', name: 'Sodium', group: 1, shells: [1, 8, 2],
    values: [496, 4562, 6910, 9543, 13354, 16613, 20117, 25496, 28932, 141362, 159075] },
  { sym: 'Mg', name: 'Magnesium', group: 2, shells: [2, 8, 2],
    values: [738, 1451, 7733, 10543, 13630, 18020, 21711, 25661, 31653, 35458] },
  { sym: 'Al', name: 'Aluminium', group: 3, shells: [3, 8, 2],
    values: [578, 1817, 2745, 11577, 14842, 18379, 23326, 27465, 31853, 38473] },
  { sym: 'Si', name: 'Silicon', group: 4, shells: [4, 8, 2],
    values: [789, 1577, 3232, 4356, 16091, 19805, 23780, 29287, 33878, 38726] },
  { sym: 'P', name: 'Phosphorus', group: 5, shells: [5, 8, 2],
    values: [1012, 1907, 2914, 4964, 6274, 21267, 25431, 29872, 35905, 40950] },
  { sym: 'S', name: 'Sulfur', group: 6, shells: [6, 8, 2],
    values: [1000, 2252, 3357, 4556, 7004, 8496, 27107, 31719, 36621, 43177] },
  { sym: 'Cl', name: 'Chlorine', group: 7, shells: [7, 8, 2],
    values: [1251, 2298, 3822, 5159, 6542, 9362, 11018, 33604, 38600, 43961] },
  { sym: 'C', name: 'Carbon', group: 4, shells: [4, 2],
    values: [1086, 2353, 4621, 6223, 37831, 47277] },
  { sym: 'O', name: 'Oxygen', group: 6, shells: [6, 2],
    values: [1314, 3388, 5300, 7469, 10990, 13327, 71330, 84078] },
];

/** Find the index (1-based) of the first big shell jump: between IE_k and IE_{k+1}. */
export function firstJump(vals: number[]): { after: number; ratio: number } {
  let best = 1;
  let bestR = 0;
  for (let i = 0; i < vals.length - 1; i++) {
    const r = vals[i + 1] / vals[i];
    if (r > bestR) { bestR = r; best = i + 1; }
  }
  return { after: best, ratio: bestR };
}
