/* Chemistry text formatting (design book §5).
   'Cr2O7^2- -> 2Cr^3+'  →  digits after a symbol or bracket become subscripts, ^2- / ^3+ become superscripts,
   '->' becomes →, '<=>' becomes ⇌.  chem() returns HTML (escaped); plain() returns Unicode text for copying. */

const ESC: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
export const esc = (s: string) => String(s).replace(/[&<>"]/g, (c) => ESC[c]);

export function chem(s: string): string {
  let h = esc(String(s).replace(/<=>/g, '⇌').replace(/->/g, '→'));
  h = h.replace(/([A-Za-z)\]])(\d+)/g, '$1<sub>$2</sub>');
  return h.replace(/\^(\d*[+-])/g, (_, c: string) => '<sup>' + c.replace('-', '−') + '</sup>');
}

const SUP: Record<string, string> = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹', '+': '⁺', '-': '⁻' };
const SUB: Record<string, string> = { 0: '₀', 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉' };

/** Superscript digits, e.g. supN(3) → '³' (for 3d³). */
export const supN = (n: number | string) => String(n).split('').map((c) => SUP[c] ?? c).join('');

export function plain(s: string): string {
  return String(s).replace(/<=>/g, '⇌').replace(/->/g, '→')
    .replace(/\^(\d*[+-])/g, (_, c: string) => c.split('').map((x) => SUP[x]).join(''))
    .replace(/([A-Za-z)\]])(\d+)/g, (_, a: string, d: string) => a + d.split('').map((x) => SUB[x]).join(''));
}

/** Signed oxidation state: 3 → '+3', 0 → '0', -1 → '-1'. */
export const ox = (n: number) => (n > 0 ? '+' : '') + n;
