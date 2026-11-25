/* Energetics Lab: shared constants and number formatting. */

export const C_WATER = 4.18; // J g⁻¹ K⁻¹ (Edexcel IAL Data Booklet)
export const R_GAS = 8.31;   // J mol⁻¹ K⁻¹

export function signed(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return '—';
  const r = Number(v.toFixed(dp));
  if (r === 0) return (0).toFixed(dp);
  return (r > 0 ? '+' : '−') + Math.abs(r).toFixed(dp);
}

export function fixed(v: number, dp = 1): string {
  return Number.isFinite(v) ? v.toFixed(dp) : '—';
}
