/* Waves Lab · Standing waves: the physics behind the string (Core Practical 5), the speed-of-sound bench (Core
   Practical 4) and the air column.

   The string is solved exactly, not faked with a resonance curve. A vibration generator moves one end of the string
   (x = 0) up and down with a small amplitude a₀; the other end (over the pulley, x = l) cannot move. The steady state
   of the wave equation with a little damping is

       y(x, t) = Re[ C · sin(k(l − x)) · e^{iωt} ],   C = a₀ / sin(kl),   k = (ω/v)(1 − iη)

   which is two travelling waves of equal size (one heading for the pulley, one reflected back) adding up. When
   sin(kl) ≈ 0, i.e. l = nλ/2, C is huge: resonance. The damping η keeps it finite and sets how sharp each resonance
   is. Every number the tab shows comes from this one formula, so the envelope, the nodes, the travelling parts and the
   response curve always agree. */

import { G } from './consts';

export const ETA = 0.012;     // damping: each resonance is about 2ηn·f₁ wide (Q ≈ 1/(2ηn) per harmonic… broad enough to tune by hand)
export const A0 = 0.4e-3;     // the vibration generator's amplitude / m

export interface Wire { id: string; name: string; mu: number; note: string }
/** Strings and wires for the bench (μ in kg m⁻¹, from density × cross-section). */
export const WIRES: Wire[] = [
  { id: 'cotton', name: 'Cotton thread', mu: 0.35e-3, note: 'light and floppy: low tension gives clear loops' },
  { id: 'nylon', name: 'Nylon line, 0.5 mm', mu: 0.226e-3, note: 'ρ = 1150 kg m⁻³, A = 1.96 × 10⁻⁷ m²' },
  { id: 'steel25', name: 'Steel wire, 0.25 mm', mu: 0.385e-3, note: 'ρ = 7850 kg m⁻³, A = 4.91 × 10⁻⁸ m²' },
  { id: 'copper', name: 'Copper wire, 0.30 mm', mu: 0.633e-3, note: 'ρ = 8960 kg m⁻³, A = 7.07 × 10⁻⁸ m²' },
  { id: 'steel50', name: 'Steel wire, 0.50 mm', mu: 1.54e-3, note: 'ρ = 7850 kg m⁻³, A = 1.96 × 10⁻⁷ m²' },
  { id: 'cord', name: 'Thick string', mu: 2.4e-3, note: 'heavy: slow waves, low frequencies' },
  { id: 'custom', name: 'Custom μ', mu: 1e-3, note: 'set μ yourself' },
];

export const tension = (m: number) => m * G;
export const waveSpeed = (T: number, mu: number) => Math.sqrt(T / mu);
export const f1Of = (v: number, l: number) => v / (2 * l);

/* ---------- complex helpers (just enough for sin of a complex number) ---------- */
type Cx = [number, number];
const mul = (a: Cx, b: Cx): Cx => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
const div = (a: Cx, b: Cx): Cx => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
/** sin(a + ib) */
const csin = (a: number, b: number): Cx => [Math.sin(a) * Math.cosh(b), Math.cos(a) * Math.sinh(b)];
/** e^{i(a + ib)} = e^{−b}(cos a + i sin a) */
const cexp = (a: number, b: number): Cx => { const r = Math.exp(-b); return [r * Math.cos(a), r * Math.sin(a)]; };

/** The string's steady state, ready to sample: complex amplitude at x, and its two travelling parts. */
export function stringState(f: number, v: number, l: number, eta = ETA, a0 = A0) {
  const kr = (2 * Math.PI * f) / v, ki = -kr * eta;      // k = kr + i·ki
  const s = csin(kr * l, ki * l);
  const C = div([a0, 0], Math.hypot(s[0], s[1]) < 1e-12 ? [1e-12, 0] : s);
  /** complex amplitude of y at x (m from the generator) */
  const at = (x: number): Cx => mul(C, csin(kr * (l - x), ki * (l - x)));
  /** the travelling wave heading for the pulley (+x) and the one reflected from it (−x) */
  const parts = (x: number): [Cx, Cx] => {
    const u = l - x;
    const inc = mul(C, div(cexp(kr * u, ki * u), [0, 2]));
    const ref = mul(C, div(cexp(-kr * u, -ki * u), [0, -2]));
    return [inc, ref];
  };
  return { C, at, parts };
}
/** Displacement (m) from a complex amplitude at phase φ = ωt. */
export const re = (z: Cx, ph: number) => z[0] * Math.cos(ph) - z[1] * Math.sin(ph);
export const mag = (z: Cx) => Math.hypot(z[0], z[1]);

/** Largest amplitude anywhere on the string (m): at an antinode once the string is longer than λ/4. */
export function peakAmp(f: number, v: number, l: number, eta = ETA, a0 = A0) {
  const kr = (2 * Math.PI * f) / v, b = kr * eta * l, a = kr * l;
  const s2 = Math.sin(a) ** 2 + Math.sinh(b) ** 2;
  const top = a >= Math.PI / 2 ? Math.cosh(b) ** 2 : s2;
  return a0 * Math.sqrt(top / Math.max(s2, 1e-24));
}

/** Which harmonic f is closest to, and whether the string is resonating (within half the peak). */
export function nearest(f: number, f1: number, eta = ETA) {
  const n = Math.max(1, Math.round(f / f1));
  const off = f - n * f1;
  const half = eta * n * f1;              // half-width at half-power, near enough
  return { n, off, on: Math.abs(off) < 1.15 * half, half };
}

/* ---------- Core Practical 5: readings and a straight-line fit ---------- */
export interface Reading { l: number; m: number; mu: number; f: number; n: number }
export type XAxis = 'invl' | 'sqrtT' | 'invsqrtmu';
export const XAXES: [XAxis, string, string][] = [['invl', 'f₁ against 1/l', '1/l'], ['sqrtT', 'f₁ against √T', '√T'], ['invsqrtmu', 'f₁ against 1/√μ', '1/√μ']];
export const xOf = (r: Reading, ax: XAxis) => (ax === 'invl' ? 1 / r.l : ax === 'sqrtT' ? Math.sqrt(tension(r.m)) : 1 / Math.sqrt(r.mu));
export const X_LABEL: Record<XAxis, string> = { invl: '1/l / m⁻¹', sqrtT: '√T / N^½', invsqrtmu: '1/√μ / (kg m⁻¹)^−½' };

/** Least squares y = mx + c. */
export function fit(pts: [number, number][]) {
  const n = pts.length;
  if (n < 2) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; sxx += x * x; sxy += x * y; }
  const d = n * sxx - sx * sx;
  if (Math.abs(d) < 1e-30) return null;
  const m = (n * sxy - sx * sy) / d, c = (sy - m * sx) / n;
  return { m, c };
}
/** Relative spread of a list (max − min)/mean: are the "controlled" variables really fixed? */
export const spread = (xs: number[]) => { const mx = Math.max(...xs), mn = Math.min(...xs), mean = xs.reduce((a, b) => a + b, 0) / xs.length; return (mx - mn) / mean; };

/* ---------- Core Practical 4: sound ---------- */
/** Speed of sound in dry air at θ °C (m s⁻¹). The spec only needs "about 330–340 m s⁻¹"; the temperature effect is extra. */
export const soundSpeed = (theta: number) => 331.3 * Math.sqrt(1 + theta / 273.15);
/** Phase lag of the microphone (degrees, 0–360) at distance d. */
export const lagDeg = (d: number, lambda: number) => (((d / lambda) * 360) % 360 + 360) % 360;

/* ---------- the air column (exam questions use it, the spec doesn't name it) ---------- */
export type TubeEnd = 'closed' | 'open';
/** Resonant frequencies of a tube of length L: closed at one end (odd harmonics of v/4L) or open at both (v/2L). */
export const tubeF = (end: TubeEnd, n: number, v: number, L: number) => (end === 'closed' ? ((2 * n - 1) * v) / (4 * L) : (n * v) / (2 * L));
/** Driven air column, open at x = 0 (by the speaker); damped exactly like the string. Displacement amplitude at x. */
export function tubeState(end: TubeEnd, f: number, v: number, L: number, eta = 0.02) {
  const kr = (2 * Math.PI * f) / v, ki = -kr * eta;
  // closed far end: s ∝ sin k(L − x) (node at L), driven at the open end, where s is largest: s(0) ∝ 1/cos kL
  // open far end: s ∝ cos kx (antinodes at both ends), resonance when sin kL = 0
  const ccos = (a: number, b: number): Cx => [Math.cos(a) * Math.cosh(b), -Math.sin(a) * Math.sinh(b)];
  const den = end === 'closed' ? ccos(kr * L, ki * L) : csin(kr * L, ki * L);
  const C = div([1, 0], Math.hypot(den[0], den[1]) < 1e-12 ? [1e-12, 0] : den);
  const at = (x: number): Cx => mul(C, end === 'closed' ? csin(kr * (L - x), ki * (L - x)) : ccos(kr * x, ki * x));
  const peak = mag(C) * Math.cosh(ki * L);
  return { at, peak };
}

/** Round tick values for an axis from lo to hi (about n of them). */
export function niceTicks(lo: number, hi: number, n = 5) {
  const span = hi - lo || 1, raw = span / n, p = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * p).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-6; v += step) out.push(Number(v.toPrecision(10)));
  return out;
}
