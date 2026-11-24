/* Fields Lab: Charged particles in magnetic & crossed E/B fields (r = mv/BQ, v = E/B; WPH14). */

import { E_CHG, M_ALPHA, M_E, M_P } from './consts';

export type ParticleId = 'electron' | 'proton' | 'alpha';

export interface ParticleDef {
  id: ParticleId;
  name: string;
  sym: string;
  q: number;     // C (signed)
  m: number;     // kg
  hex: number;
}

export const PARTICLES: Record<ParticleId, ParticleDef> = {
  electron: { id: 'electron', name: 'Electron', sym: 'e⁻', q: -E_CHG, m: M_E, hex: 0x38bdf8 },
  proton: { id: 'proton', name: 'Proton', sym: 'p⁺', q: E_CHG, m: M_P, hex: 0xf87171 },
  alpha: { id: 'alpha', name: 'Alpha particle', sym: 'α (He²⁺)', q: 2 * E_CHG, m: M_ALPHA, hex: 0xfbbf24 },
};

/** Cyclotron radius r = mv / (|q|B) and period T = 2πm / (|q|B). */
export function cyclotron(p: ParticleDef, v: number, B: number): { r: number; T: number; F: number } {
  const absQ = Math.abs(p.q);
  const r = (p.m * v) / (absQ * B);
  const T = (2 * Math.PI * p.m) / (absQ * B);
  const F = absQ * v * B;
  return { r, T, F };
}
