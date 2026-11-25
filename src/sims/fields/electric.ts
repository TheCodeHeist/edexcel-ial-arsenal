/* Fields Lab: Electric fields — radial Coulomb fields, dipoles, neutral points & uniform parallel plates (WPH14). */

import { K_E } from './consts';

export type ElectricPresetId = 'pos' | 'neg' | 'dipole' | 'like' | 'unequal' | 'plates';

export interface PointCharge {
  x: number;  // world units (1 unit = 0.10 m)
  y: number;
  qMicro: number; // μC
}

export interface ElectricPreset {
  id: ElectricPresetId;
  name: string;
  mode: 'radial' | 'plates';
  charges: PointCharge[];
  note: string;
  facts: string[];
}

export const ELECTRIC_PRESETS: ElectricPreset[] = [
  {
    id: 'pos', name: 'Single +Q', mode: 'radial',
    charges: [{ x: 0, y: 0, qMicro: 2 }],
    note: 'Radial field lines point radially OUTWARD from a positive charge; equipotentials are concentric spheres (perpendicular to field lines).',
    facts: [
      'Electric field strength E = F / Q = kQ / r² (inverse-square law: doubling r quarters E).',
      'Electric potential V = kQ / r is POSITIVE around a positive charge (work must be done to bring a + test charge from infinity).',
      'Field strength E = −dV/dr: closer equipotential spacing means a stronger field.',
    ],
  },
  {
    id: 'neg', name: 'Single −Q', mode: 'radial',
    charges: [{ x: 0, y: 0, qMicro: -2 }],
    note: 'Radial field lines point INWARD toward a negative charge (direction a small positive test charge would move).',
    facts: [
      'Electric potential V = kQ / r is NEGATIVE around a negative charge.',
      'Field lines never cross and always meet equipotential surfaces at 90°.',
    ],
  },
  {
    id: 'dipole', name: 'Dipole (+Q, −Q)', mode: 'radial',
    charges: [{ x: -1.6, y: 0, qMicro: 2 }, { x: 1.6, y: 0, qMicro: -2 }],
    note: 'Field lines leave +Q and terminate on −Q. Midway between equal opposite charges, V = 0 but E is NOT zero!',
    facts: [
      'Potential is a SCALAR (adds algebraically → V = 0 on the perpendicular bisector).',
      'Field strength is a VECTOR (both charges push a + test charge to the right at the midpoint → E ≠ 0).',
    ],
  },
  {
    id: 'like', name: 'Like charges (+Q, +Q)', mode: 'radial',
    charges: [{ x: -1.6, y: 0, qMicro: 2 }, { x: 1.6, y: 0, qMicro: 2 }],
    note: 'Field lines repel each other, creating a NEUTRAL POINT at the exact midpoint where E = 0, while V > 0!',
    facts: [
      'At the midpoint, the two equal electric field vectors point in opposite directions and cancel (E = 0).',
      'Potential V = kQ/r + kQ/r is POSITIVE and non-zero at the neutral point.',
    ],
  },
  {
    id: 'unequal', name: 'Unequal (+2Q, −Q)', mode: 'radial',
    charges: [{ x: -1.6, y: 0, qMicro: 4 }, { x: 1.6, y: 0, qMicro: -2 }],
    note: 'Twice as many field lines leave +2Q as terminate on −Q; the excess lines extend out to infinity.',
    facts: [
      'The number of field lines leaving or entering a charge is proportional to |Q|.',
      'Closer to +2Q the field is much stronger and equipotentials are more tightly packed.',
    ],
  },
  {
    id: 'plates', name: 'Parallel plates (E = V/d)', mode: 'plates',
    charges: [],
    note: 'Between parallel plates, field lines are straight, parallel and equally spaced: E = V/d is constant everywhere (ignoring edge fringing).',
    facts: [
      'Uniform field: E = V / d (units: V m⁻¹ = N C⁻¹).',
      'Equipotentials are parallel planes equally spaced between the plates.',
      'A charged particle entering perpendicular to E experiences constant vertical acceleration a = EQ/m → parabolic path (just like a projectile in gravity!).',
    ],
  },
];

export const chargeRadius = (qMicro: number) => 0.28 + Math.min(0.14, Math.abs(qMicro) * 0.03);

/** Evaluate E (N C⁻¹) and V (V) at world point (px, py) for radial charges (1 world unit = 0.10 m). */
export function evalRadial(charges: PointCharge[], px: number, py: number): { ex: number; ey: number; eMag: number; v: number; insideCharge: boolean } {
  let ex = 0, ey = 0, v = 0, insideCharge = false;
  for (const c of charges) {
    const dxW = px - c.x;
    const dyW = py - c.y;
    if (Math.hypot(dxW, dyW) < chargeRadius(c.qMicro) + 0.04) insideCharge = true;
    const dx = dxW * 0.1;
    const dy = dyW * 0.1;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(Math.max(r2, 1e-4));
    const q = c.qMicro * 1e-6;
    const e = (K_E * q) / Math.max(r2, 1e-4);
    ex += e * (dx / r);
    ey += e * (dy / r);
    v += (K_E * q) / r;
  }
  return { ex, ey, eMag: Math.hypot(ex, ey), v, insideCharge };
}
