/* The distribution functions behind the Maths formula book's statistical tables (normal, binomial, Poisson).
   Pearson prints these to 4 d.p.; computing them gives the same digits (checked against every cell of the
   Issue 2 booklet), so the tables are built here instead of being typed in. */

/** Φ(z), the standard normal c.d.f. Marsaglia's series, accurate to double precision for |z| ≤ 8. */
export function phi(z: number): number {
  if (z < -8) return 0;
  if (z > 8) return 1;
  let s = z, t = z, k = 0;
  const z2 = z * z;
  while (s + t !== s) { t *= z2 / (2 * ++k + 1); s += t; }
  return 0.5 + s * Math.exp(-0.5 * z2 - 0.91893853320467274178);
}

/** P(X ≤ x) for X ~ B(n, p). Fine for n up to a few hundred ((1 − p)ⁿ must not underflow). */
export function binomCdf(n: number, p: number, x: number): number {
  if (x < 0) return 0;
  if (x >= n || p <= 0) return 1;
  if (p >= 1) return 0;
  let term = (1 - p) ** n, sum = term;
  for (let k = 1; k <= x; k++) { term *= ((n - k + 1) / k) * (p / (1 - p)); sum += term; }
  return Math.min(1, sum);
}

/** P(X ≤ x) for X ~ Po(λ). */
export function poissonCdf(lambda: number, x: number): number {
  if (x < 0) return 0;
  let term = Math.exp(-lambda), sum = term;
  for (let k = 1; k <= x; k++) { term *= lambda / k; sum += term; }
  return Math.min(1, sum);
}

/** 4 d.p., as the booklet prints it. The nudge rounds exact halves up (0.65625 → 0.6563), as Pearson does. */
export const dp4 = (v: number) => (Math.round(v * 1e4 + 1e-9) / 1e4).toFixed(4);

/* ---- the booklet's grids ---- */

/** z values in the Φ(z) table: 0.00–2.00 by 0.01, then by 0.02 to 2.50, by 0.05 to 3.40, by 0.1 to 4.00. */
export const NORMAL_Z: number[] = (() => {
  const out: number[] = [];
  const run = (from: number, to: number, step: number) => { for (let i = Math.round(from / step); i * step <= to + 1e-9; i++) out.push(+(i * step).toFixed(2)); };
  run(0, 2, 0.01); run(2.02, 2.5, 0.02); run(2.55, 3.4, 0.05); run(3.5, 4, 0.1);
  return out;
})();

/** The percentage points table: P(Z > z) = p. */
export const NORMAL_POINTS: [string, string][] = [
  ['0.5000', '0.0000'], ['0.4000', '0.2533'], ['0.3000', '0.5244'], ['0.2000', '0.8416'], ['0.1500', '1.0364'], ['0.1000', '1.2816'],
  ['0.0500', '1.6449'], ['0.0250', '1.9600'], ['0.0100', '2.3263'], ['0.0050', '2.5758'], ['0.0010', '3.0902'], ['0.0005', '3.2905'],
];

export const BINOM_N = [5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30, 40, 50];
export const BINOM_P = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5];
export const POISSON_L = [[0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], [5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10]];

/** The last x each block prints. Pearson's cut-offs, not a rule: some blocks carry on through rows of 1.0000. */
const BINOM_LAST: Record<number, number> = { 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9, 12: 11, 15: 14, 20: 18, 25: 22, 30: 25, 40: 32, 50: 38 };
const POISSON_LAST = [19, 22];
/* The booklet rounds the exact half 0.03125 down while rounding 0.65625 up; print what it prints. */
const AS_PRINTED: Record<string, string> = { '5,0,9': '0.0312' };

function block(cell: (col: number, x: number) => number, last: number, key: string): string[][] {
  return Array.from({ length: last + 1 }, (_, x) =>
    Array.from({ length: 10 }, (_, c) => AS_PRINTED[`${key},${x},${c}`] ?? dp4(cell(c, x))));
}

export const binomBlock = (n: number) => block((c, x) => binomCdf(n, BINOM_P[c], x), BINOM_LAST[n], String(n));
export const poissonBlock = (i: number) => block((c, x) => poissonCdf(POISSON_L[i][c], x), POISSON_LAST[i], `p${i}`);
