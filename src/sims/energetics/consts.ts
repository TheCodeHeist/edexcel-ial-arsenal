/* Energetics Lab: shared constants and number formatting. */

export const C_WATER = 4.18; // J g⁻¹ K⁻¹ (Edexcel IAL Data Booklet)
export const R_GAS = 8.31;   // J mol⁻¹ K⁻¹

export function signed(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return '—';
  const s = Math.abs(v) < 0.05 && dp <= 1 ? '0.0' : Math.abs(v).toFixed(dp);
  return (v >= 0 ? '+' : '−') + s;
}

export function fixed(v: number, dp = 1): string {
  return Number.isFinite(v) ? v.toFixed(dp) : '—';
}
