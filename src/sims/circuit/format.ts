/* Numbers with units, the way a student would write them: 3 significant figures and an SI prefix.
   si(0.0253, 'A') → '25.3 mA' · si(2200, 'Ω') → '2.20 kΩ' · si(6, 'V') → '6.00 V'. */

const PRE: [number, string][] = [[1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n']];

export function sig(x: number, sf = 3): string {
  if (x === 0 || !isFinite(x)) return String(x === 0 ? 0 : x);
  const r = Number(x.toPrecision(sf)); // round first: 0.99996 → 1.00, not 1.000
  const d = Math.max(0, sf - 1 - Math.floor(Math.log10(Math.abs(r)) + 1e-9));
  return r.toFixed(Math.min(d, 6));
}

export function si(x: number, unit: string, sf = 3): string {
  if (!isFinite(x)) return '∞ ' + unit;
  const a = Math.abs(x);
  if (a < 1e-9) return (sf > 1 ? (0).toFixed(sf - 1) : '0') + ' ' + unit;
  for (const [f, p] of PRE) {
    if (a >= f * 0.9995) {
      // round first so 999.96 mA becomes 1.00 A, not 1000 mA
      const v = Number(sig(x / f, sf));
      if (Math.abs(v) >= 1000 && f < 1e6) continue;
      return sig(x / f, sf) + ' ' + p + unit;
    }
  }
  return sig(x / 1e-9, sf) + ' n' + unit;
}

/** A short label value with no trailing zeros: num(6) → '6', num(0.25) → '0.25', num(1/3) → '0.333'. */
export const num = (x: number, sf = 3) => String(Number(x.toPrecision(sf)));

/** A resistance for a component label: 10 Ω, 2.2 kΩ, 470 Ω, 0.5 Ω. */
export function ohms(R: number): string {
  if (!isFinite(R)) return '∞ Ω';
  if (R >= 999500) return num(R / 1e6) + ' MΩ';
  if (R >= 999.5) return num(R / 1e3) + ' kΩ';
  return num(R) + ' Ω';
}

/** A meter display: 3 significant figures, amps below 0.1 A shown in mA (below 0.1 mA in µA), like a real multimeter's auto-range. */
export function meter(x: number, unit: 'A' | 'V'): string {
  const a = Math.abs(x) < 1e-6 ? 0 : Math.abs(x);
  if (a === 0) return '0.00 ' + unit;
  if (unit === 'A' && a < 1e-4) return sig(a * 1e6) + ' µA';
  if (unit === 'A' && a < 0.1) return sig(a * 1000) + ' mA';
  return sig(a) + ' ' + unit;
}
