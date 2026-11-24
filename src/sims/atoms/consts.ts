/* Atoms & Bonding Lab: shared formatting helpers and CPK-inspired atom colours for 3D scenes. */

export function plain(v: number, sf = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) return v.toExponential(sf - 1);
  return Number(v.toPrecision(sf)).toString();
}

export function fixed(v: number, dp = 1): string {
  return Number.isFinite(v) ? v.toFixed(dp) : '—';
}

/** CPK-inspired colours (hex numbers for Three.js) tuned to read crisply against the #03040a 3D stage. */
export const ATOM_HEX: Record<string, number> = {
  H: 0xf1f5f9,
  Be: 0x86efac,
  B: 0xf9a8d4,
  C: 0x64748b,
  N: 0x60a5fa,
  O: 0xf87171,
  F: 0xa3e635,
  Na: 0xc084fc,
  P: 0xfb923c,
  S: 0xfacc15,
  Cl: 0x4ade80,
  Cu: 0xe88b5a,
  Br: 0xb94a3e,
  I: 0xa855f7,
  Xe: 0x38bdf8,
  X: 0x7dd3fc,
  A: 0x94a3b8,
};

/** Visual radii in 3D world units (proportional, not literal pm, so bonds stay legible). */
export const ATOM_R: Record<string, number> = {
  H: 0.34,
  Be: 0.48,
  B: 0.48,
  C: 0.52,
  N: 0.50,
  O: 0.48,
  F: 0.44,
  Na: 0.44,
  P: 0.58,
  S: 0.56,
  Cl: 0.54,
  Cu: 0.56,
  Br: 0.58,
  I: 0.62,
  Xe: 0.64,
  X: 0.46,
  A: 0.56,
};

/** Pauling electronegativities for elements used in WCH11. */
export const EN: Record<string, number> = {
  H: 2.20, Li: 0.98, Be: 1.57, B: 2.04, C: 2.55, N: 3.04, O: 3.44, F: 3.98,
  Na: 0.93, Mg: 1.31, Al: 1.61, Si: 1.90, P: 2.19, S: 2.58, Cl: 3.16,
  K: 0.82, Ca: 1.00, Br: 2.96, I: 2.66, Xe: 2.60,
};
