/* Atoms & Bonding Lab: Electron configuration, orbitals, Cr/Cu exceptions & ionisation removal (Spec 2.9–2.14). */

export interface Subshell {
  id: string;
  n: number;
  l: 0 | 1 | 2;
  boxes: number;   // 1 for s, 3 for p, 5 for d
  cap: number;
}

/** Filling order up to Kr (Z = 36). */
export const SUBSHELLS: Subshell[] = [
  { id: '1s', n: 1, l: 0, boxes: 1, cap: 2 },
  { id: '2s', n: 2, l: 0, boxes: 1, cap: 2 },
  { id: '2p', n: 2, l: 1, boxes: 3, cap: 6 },
  { id: '3s', n: 3, l: 0, boxes: 1, cap: 2 },
  { id: '3p', n: 3, l: 1, boxes: 3, cap: 6 },
  { id: '4s', n: 4, l: 0, boxes: 1, cap: 2 },
  { id: '3d', n: 3, l: 2, boxes: 5, cap: 10 },
  { id: '4p', n: 4, l: 1, boxes: 3, cap: 6 },
];

export interface ElementInfo {
  z: number;
  sym: string;
  name: string;
  block: 's' | 'p' | 'd';
  period: number;
  group: number;
  exception?: string;
}

export const ELEMENTS: ElementInfo[] = [
  { z: 1, sym: 'H', name: 'Hydrogen', block: 's', period: 1, group: 1 },
  { z: 2, sym: 'He', name: 'Helium', block: 's', period: 1, group: 18 },
  { z: 3, sym: 'Li', name: 'Lithium', block: 's', period: 2, group: 1 },
  { z: 4, sym: 'Be', name: 'Beryllium', block: 's', period: 2, group: 2 },
  { z: 5, sym: 'B', name: 'Boron', block: 'p', period: 2, group: 13 },
  { z: 6, sym: 'C', name: 'Carbon', block: 'p', period: 2, group: 14 },
  { z: 7, sym: 'N', name: 'Nitrogen', block: 'p', period: 2, group: 15 },
  { z: 8, sym: 'O', name: 'Oxygen', block: 'p', period: 2, group: 16 },
  { z: 9, sym: 'F', name: 'Fluorine', block: 'p', period: 2, group: 17 },
  { z: 10, sym: 'Ne', name: 'Neon', block: 'p', period: 2, group: 18 },
  { z: 11, sym: 'Na', name: 'Sodium', block: 's', period: 3, group: 1 },
  { z: 12, sym: 'Mg', name: 'Magnesium', block: 's', period: 3, group: 2 },
  { z: 13, sym: 'Al', name: 'Aluminium', block: 'p', period: 3, group: 13 },
  { z: 14, sym: 'Si', name: 'Silicon', block: 'p', period: 3, group: 14 },
  { z: 15, sym: 'P', name: 'Phosphorus', block: 'p', period: 3, group: 15 },
  { z: 16, sym: 'S', name: 'Sulfur', block: 'p', period: 3, group: 16 },
  { z: 17, sym: 'Cl', name: 'Chlorine', block: 'p', period: 3, group: 17 },
  { z: 18, sym: 'Ar', name: 'Argon', block: 'p', period: 3, group: 18 },
  { z: 19, sym: 'K', name: 'Potassium', block: 's', period: 4, group: 1 },
  { z: 20, sym: 'Ca', name: 'Calcium', block: 's', period: 4, group: 2 },
  { z: 21, sym: 'Sc', name: 'Scandium', block: 'd', period: 4, group: 3 },
  { z: 22, sym: 'Ti', name: 'Titanium', block: 'd', period: 4, group: 4 },
  { z: 23, sym: 'V', name: 'Vanadium', block: 'd', period: 4, group: 5 },
  { z: 24, sym: 'Cr', name: 'Chromium', block: 'd', period: 4, group: 6,
    exception: 'Chromium is [Ar] 3d⁵ 4s¹ rather than 3d⁴ 4s²: a half-filled 3d sub-shell with one electron in 4s lowers electron–electron repulsion.' },
  { z: 25, sym: 'Mn', name: 'Manganese', block: 'd', period: 4, group: 7 },
  { z: 26, sym: 'Fe', name: 'Iron', block: 'd', period: 4, group: 8 },
  { z: 27, sym: 'Co', name: 'Cobalt', block: 'd', period: 4, group: 9 },
  { z: 28, sym: 'Ni', name: 'Nickel', block: 'd', period: 4, group: 10 },
  { z: 29, sym: 'Cu', name: 'Copper', block: 'd', period: 4, group: 11,
    exception: 'Copper is [Ar] 3d¹⁰ 4s¹ rather than 3d⁹ 4s²: a completely filled 3d¹⁰ sub-shell is more stable than 3d⁹ 4s².' },
  { z: 30, sym: 'Zn', name: 'Zinc', block: 'd', period: 4, group: 12 },
  { z: 31, sym: 'Ga', name: 'Gallium', block: 'p', period: 4, group: 13 },
  { z: 32, sym: 'Ge', name: 'Germanium', block: 'p', period: 4, group: 14 },
  { z: 33, sym: 'As', name: 'Arsenic', block: 'p', period: 4, group: 15 },
  { z: 34, sym: 'Se', name: 'Selenium', block: 'p', period: 4, group: 16 },
  { z: 35, sym: 'Br', name: 'Bromine', block: 'p', period: 4, group: 17 },
  { z: 36, sym: 'Kr', name: 'Krypton', block: 'p', period: 4, group: 18 },
];

const SUP = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
export function sup(n: number): string {
  return String(n).split('').map((c) => SUP[+c] ?? c).join('');
}

/** Return occupancy per subshell for element Z with ionic charge q (e.g. +2 removes 2 electrons, 4s before 3d!). */
export function fillConfig(z: number, charge = 0): Record<string, number> {
  const occ: Record<string, number> = {};
  for (const s of SUBSHELLS) occ[s.id] = 0;

  // Fill neutral atom first
  let rem = z;
  for (const s of SUBSHELLS) {
    const take = Math.min(rem, s.cap);
    occ[s.id] = take;
    rem -= take;
    if (rem <= 0) break;
  }
  // Cr and Cu ground-state exceptions
  if (z === 24) { occ['4s'] = 1; occ['3d'] = 5; }
  if (z === 29) { occ['4s'] = 1; occ['3d'] = 10; }

  if (charge > 0) {
    // Remove electrons from highest principal quantum number n first (4p -> 4s -> 3d -> 3p -> 3s -> 2p -> 2s -> 1s)
    const removalOrder = ['4p', '4s', '3d', '3p', '3s', '2p', '2s', '1s'];
    let toRemove = Math.min(charge, z);
    for (const id of removalOrder) {
      const cut = Math.min(occ[id], toRemove);
      occ[id] -= cut;
      toRemove -= cut;
      if (toRemove <= 0) break;
    }
  } else if (charge < 0) {
    // Add electrons in standard Aufbau order
    let toAdd = -charge;
    for (const s of SUBSHELLS) {
      const space = s.cap - occ[s.id];
      const add = Math.min(space, toAdd);
      occ[s.id] += add;
      toAdd -= add;
      if (toAdd <= 0) break;
    }
  }
  return occ;
}

/** Standard shell-ordered string (1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ 4s²). */
const PRINT_ORDER = ['1s', '2s', '2p', '3s', '3p', '3d', '4s', '4p'];

export function formatConfig(occ: Record<string, number>, shorthand = false): string {
  const eCount = Object.values(occ).reduce((a, b) => a + b, 0);
  if (eCount === 0) return '(no electrons)';
  let prefix = '';
  let skip = new Set<string>();
  if (shorthand) {
    if (occ['1s'] === 2 && occ['2s'] === 2 && occ['2p'] === 6 && occ['3s'] === 2 && occ['3p'] === 6 && eCount > 18) {
      prefix = '[Ar] ';
      skip = new Set(['1s', '2s', '2p', '3s', '3p']);
    } else if (occ['1s'] === 2 && occ['2s'] === 2 && occ['2p'] === 6 && eCount > 10) {
      prefix = '[Ne] ';
      skip = new Set(['1s', '2s', '2p']);
    } else if (occ['1s'] === 2 && eCount > 2) {
      prefix = '[He] ';
      skip = new Set(['1s']);
    }
  }
  const parts = PRINT_ORDER.filter((id) => occ[id] > 0 && !skip.has(id)).map((id) => `${id}${sup(occ[id])}`);
  return (prefix + parts.join(' ')).trim();
}

/** Fill boxes for a subshell following Hund's rule: 0 = empty, 1 = ↑, 2 = ↑↓. */
export function boxStates(boxes: number, electrons: number): (0 | 1 | 2)[] {
  const arr: (0 | 1 | 2)[] = Array(boxes).fill(0);
  for (let i = 0; i < Math.min(electrons, boxes); i++) arr[i] = 1;
  for (let i = 0; i < Math.max(0, electrons - boxes); i++) arr[i] = 2;
  return arr;
}

export type OrbitalKind = '1s' | '2s' | '2px' | '2py' | '2pz' | '3dz2' | '3dxy' | '3dx2y2';

export interface OrbitalDef {
  id: OrbitalKind;
  name: string;
  subshell: 's' | 'p' | 'd';
  shape: string;
  capacity: number;
  beyond?: boolean;
  note: string;
}

export const ORBITAL_DEFS: OrbitalDef[] = [
  { id: '1s', name: '1s orbital', subshell: 's', shape: 'Spherical', capacity: 2,
    note: 'Spherically symmetrical around the nucleus. Holds up to 2 electrons with opposite spins.' },
  { id: '2s', name: '2s orbital', subshell: 's', shape: 'Spherical (larger)', capacity: 2,
    note: 'Larger sphere than 1s, with one spherical radial node where electron probability drops to zero.' },
  { id: '2px', name: '2pₓ orbital', subshell: 'p', shape: 'Dumb-bell along x', capacity: 2,
    note: 'Two opposite-phase lobes along the x-axis with a nodal plane through the nucleus. One of three degenerate 2p orbitals.' },
  { id: '2py', name: '2pᵧ orbital', subshell: 'p', shape: 'Dumb-bell along y', capacity: 2,
    note: 'Identical energy and shape to 2pₓ and 2p_z, oriented at 90° along the y-axis.' },
  { id: '2pz', name: '2p_z orbital', subshell: 'p', shape: 'Dumb-bell along z', capacity: 2,
    note: 'Oriented along the z-axis. Together 2pₓ, 2pᵧ and 2p_z hold up to 6 electrons.' },
  { id: '3dxy', name: '3dₓᵧ orbital', subshell: 'd', shape: 'Cloverleaf (4 lobes)', capacity: 2, beyond: true,
    note: 'Four lobes lying between the x and y axes. The 3d sub-shell has 5 orbitals holding up to 10 electrons.' },
  { id: '3dx2y2', name: '3dₓ²₋ᵧ² orbital', subshell: 'd', shape: 'Cloverleaf on axes', capacity: 2, beyond: true,
    note: 'Four lobes pointing directly along the x and y axes.' },
  { id: '3dz2', name: '3d_z² orbital', subshell: 'd', shape: 'Dumb-bell + torus', capacity: 2, beyond: true,
    note: 'Two lobes along the z-axis with a ring (torus) of electron density around the xy-plane.' },
];
