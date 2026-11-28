/* Acid–Base Lab: constants & formatting helpers (Edexcel IAL WCH14). */

export const KW_298 = 1.00e-14; // mol² dm⁻⁶ at 298 K (25 °C)

export function sci(v: number, sf = 3): string {
  if (!Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  const a = Math.abs(v);
  if (a >= 1e-2 && a < 1e4) return Number(v.toPrecision(sf)).toString();
  const exp = Math.floor(Math.log10(a));
  const man = v / 10 ** exp;
  const sup = String(exp).replace('-', '−').split('').map((c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(c)] ?? c).join('');
  return `${man.toPrecision(sf)} × 10${sup}`;
}

/** Approximate Kw(T) in mol² dm⁻⁶ for T in °C (0..100 °C), matching Data Booklet values (1.00×10⁻¹⁴ at 25 °C, 5.48×10⁻¹⁴ at 50 °C, 5.13×10⁻¹³ at 100 °C). */
export function kwAtTemp(tempC: number): number {
  const T = tempC + 273.15;
  // van 't Hoff fit with ΔH ≈ +55.8 kJ mol⁻¹ anchored at 298.15 K
  return 1.0e-14 * Math.exp((55800 / 8.314) * (1 / 298.15 - 1 / T));
}
