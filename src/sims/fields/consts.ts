/* Fields Lab: Edexcel IAL Physics data-sheet constants and formatting helpers. */

export const K_E = 8.99e9;      // 1 / (4πε₀), N m² C⁻²
export const EPS0 = 8.85e-12;   // F m⁻¹
export const G_CONST = 6.67e-11; // N m² kg⁻²
export const E_CHG = 1.60e-19;  // C
export const M_E = 9.11e-31;    // kg
export const M_P = 1.67e-27;    // kg
export const M_ALPHA = 6.64e-27; // kg

export function sci(v: number, sf = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (a >= 1e-2 && a < 1e4) return sign + Number(a.toPrecision(sf)).toString();
  let exp = Math.floor(Math.log10(a));
  let man = Number((a / 10 ** exp).toPrecision(sf));
  if (man >= 10) {
    man /= 10;
    exp += 1;
  }
  const sup = String(exp).replace('-', '−').split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? c).join('');
  return `${sign}${man.toPrecision(sf)} × 10${sup}`;
}

export function signed(v: number, dp = 1): string {
  if (!Number.isFinite(v)) return '—';
  const s = Math.abs(v).toFixed(dp);
  return (v >= 0 ? '+' : '−') + s;
}
