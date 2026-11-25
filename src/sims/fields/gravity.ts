/* Fields Lab: Gravitational fields, potential well, orbits (WPH15, Topic 12) & Gravity vs Electric comparison (WPH14/WPH15). */

import { G_CONST } from './consts';

export interface BodyPreset {
  id: string;
  name: string;
  mass: number;      // kg
  radius: number;    // m
  hex: number;
  geoRadius?: number; // geostationary orbital radius (m) if applicable
}

export const BODIES: BodyPreset[] = [
  { id: 'earth', name: 'Earth', mass: 5.97e24, radius: 6.37e6, hex: 0x3b82f6, geoRadius: 4.22e7 },
  { id: 'moon', name: 'Moon', mass: 7.35e22, radius: 1.74e6, hex: 0x94a3b8 },
  { id: 'mars', name: 'Mars', mass: 6.42e23, radius: 3.39e6, hex: 0xe8795a },
  { id: 'jupiter', name: 'Jupiter', mass: 1.90e27, radius: 6.99e7, hex: 0xfbbf24 },
];

export function orbitMetrics(body: BodyPreset, rRatio: number) {
  const r = body.radius * rRatio;
  const g = (G_CONST * body.mass) / (r * r);
  const vg = -(G_CONST * body.mass) / r; // J kg⁻¹ (always negative!)
  const vOrb = Math.sqrt((G_CONST * body.mass) / r);
  const vEsc = Math.sqrt((2 * G_CONST * body.mass) / r);
  const T = (2 * Math.PI * r) / vOrb; // seconds
  return { r, g, vg, vOrb, vEsc, T };
}

export const COMPARE_ROWS: [string, string, string][] = [
  ['Property acted on', 'Mass m (kg)', 'Charge Q (C)'],
  ['Direction of force', 'Always ATTRACTIVE', 'Attractive (opposite) or repulsive (like)'],
  ['Field strength (radial)', 'g = GM / r² (N kg⁻¹)', 'E = kQ / r² (N C⁻¹)'],
  ['Potential (radial)', 'Vg = −GM / r (always negative)', 'VE = kQ / r (+ or −)'],
  ['Zero of potential', 'At infinity (r → ∞)', 'At infinity (r → ∞)'],
  ['Relative strength (p–p)', 'Tiny (~10⁻³⁶ × electric)', 'Dominates at atomic scale'],
];
