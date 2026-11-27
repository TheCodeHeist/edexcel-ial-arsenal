/* Core statistical calculations for Stats Lab (Edexcel IAL WST01–WST03).
   Pure TypeScript with zero DOM dependencies. Reuses Φ(z), Binomial/Poisson CDFs, dp4, NORMAL_POINTS,
   CHI2, and CORR directly from src/lib/stats.ts and src/data/mathsbooklet.ts. */

import { phi, binomCdf, poissonCdf, dp4, NORMAL_POINTS } from '../../lib/stats';
import { CHI_P, CHI2, CORR } from '../../data/mathsbooklet';

export { phi, dp4, NORMAL_POINTS, CHI_P, CHI2, CORR };

export type DistKind = 'normal' | 'binomial' | 'poisson' | 'uniform';
export type QueryKind = 'le' | 'ge' | 'between' | 'eq' | 'inv';
export type ApproxKind = 'none' | 'poisson' | 'normal';
export type TailKind = 'lower' | 'upper' | 'two';

/* ---------- Basic formatting & parsing ---------- */

export function fmt(v: number, dp = 4): string {
  if (!Number.isFinite(v)) return '—';
  const rounded = Number(v.toFixed(dp));
  return Object.is(rounded, -0) ? (0).toFixed(dp) : rounded.toFixed(dp);
}

export function fmtTrim(v: number, maxDp = 4): string {
  if (!Number.isFinite(v)) return '—';
  const rounded = Number(v.toFixed(maxDp));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

export function parseNumList(raw: string): number[] {
  return raw
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isFinite(n));
}

/* ---------- Gamma & Standard Normal inverse ---------- */

const LANCZOS_G = 7;
const LANCZOS_P = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function logGamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  }
  const zm1 = z - 1;
  let x = LANCZOS_P[0];
  for (let i = 1; i < LANCZOS_P.length; i++) {
    x += LANCZOS_P[i] / (zm1 + i);
  }
  const t = zm1 + LANCZOS_G + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (zm1 + 0.5) * Math.log(t) - t + Math.log(x);
}

export function normalPdf(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) return 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

export function normalCdf(x: number, mu = 0, sigma = 1): number {
  if (sigma <= 0) return x >= mu ? 1 : 0;
  return phi((x - mu) / sigma);
}

/** Inverse standard normal CDF Φ⁻¹(p) using Acklam's rational approximation + 1 Newton refinement. */
export function invPhi(prob: number): number {
  const p = Math.min(1 - 1e-12, Math.max(1e-12, prob));
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;
  let z: number;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    z = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  } else if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    z = ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  } else {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    z = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
         ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }

  // One Newton step using Marsaglia's Φ(z) ensures exact match with src/lib/stats.ts
  const pdf = normalPdf(z, 0, 1);
  if (pdf > 1e-30) {
    z -= (phi(z) - p) / pdf;
  }
  return z;
}

export function normalPercentPointMatch(upperTailP: number): { p: string; z: string } | null {
  for (const [pStr, zStr] of NORMAL_POINTS) {
    if (Math.abs(Number(pStr) - upperTailP) < 1e-6) {
      return { p: pStr, z: zStr };
    }
  }
  return null;
}

/* ---------- Binomial & Poisson (underflow-safe) ---------- */

export function binomPmf(n: number, p: number, k: number): number {
  const N = Math.round(n);
  const K = Math.round(k);
  if (N < 0 || K < 0 || K > N) return 0;
  if (p <= 0) return K === 0 ? 1 : 0;
  if (p >= 1) return K === N ? 1 : 0;
  return Math.exp(
    logGamma(N + 1) - logGamma(K + 1) - logGamma(N - K + 1) + K * Math.log(p) + (N - K) * Math.log(1 - p),
  );
}

export function binomCdfSafe(n: number, p: number, x: number): number {
  const N = Math.round(n);
  const k = Math.floor(x + 1e-12);
  if (k < 0) return 0;
  if (k >= N) return 1;
  if (p <= 0) return 1;
  if (p >= 1) return 0;
  if (N <= 100 && Math.pow(1 - p, N) > 1e-200) {
    return binomCdf(N, p, k);
  }
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += binomPmf(N, p, i);
  }
  return Math.min(1, Math.max(0, sum));
}

export function poissonPmf(lambda: number, k: number): number {
  const K = Math.round(k);
  if (K < 0) return 0;
  if (lambda <= 0) return K === 0 ? 1 : 0;
  return Math.exp(-lambda + K * Math.log(lambda) - logGamma(K + 1));
}

export function poissonCdfSafe(lambda: number, x: number): number {
  const k = Math.floor(x + 1e-12);
  if (k < 0) return 0;
  if (lambda <= 0) return 1;
  if (lambda <= 60) {
    return poissonCdf(lambda, k);
  }
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += poissonPmf(lambda, i);
  }
  return Math.min(1, Math.max(0, sum));
}

/* ---------- Distributions & S2 Approximations ---------- */

export interface ApproxReport {
  kind: Exclude<ApproxKind, 'none'>;
  title: string;
  suitable: boolean;
  conditionNote: string;
  probWithCC: number;
  errWithCC: number;
  probNoCC?: number;
  errNoCC?: number;
  ccExpression: string;
  zWorking?: string;
}

export function evalApprox(
  dist: 'binomial' | 'poisson',
  params: { n?: number; p?: number; lambda?: number },
  query: Exclude<QueryKind, 'inv'>,
  a: number,
  b: number,
  approx: ApproxKind,
  exactProb: number,
): ApproxReport | null {
  if (approx === 'none') return null;

  if (dist === 'binomial' && approx === 'poisson') {
    const n = Math.max(1, Math.round(params.n ?? 20));
    const p = Math.min(1, Math.max(0, params.p ?? 0.05));
    const lam = n * p;
    const suitable = (n >= 50 && p <= 0.1) || (n >= 20 && lam < 10 && p <= 0.15);
    const conditionNote = suitable
      ? `n = ${n} is large and p = ${fmtTrim(p, 3)} is small (λ = np = ${fmtTrim(lam, 3)}), so B(${n}, ${fmtTrim(p, 3)}) ≈ Po(${fmtTrim(lam, 3)}).`
      : `Caution: B → Po requires n large (≥ 50) and p small (≤ 0.1). Here n = ${n}, p = ${fmtTrim(p, 3)}, np = ${fmtTrim(lam, 3)}.`;

    const k1 = Math.round(a);
    const k2 = Math.round(Math.max(a, b));
    let prob = 0;
    let expr = '';
    if (query === 'le') {
      prob = poissonCdfSafe(lam, k1);
      expr = `Y ~ Po(${fmtTrim(lam, 3)}): P(Y ≤ ${k1}) (no continuity correction needed: both discrete)`;
    } else if (query === 'ge') {
      prob = 1 - poissonCdfSafe(lam, k1 - 1);
      expr = `Y ~ Po(${fmtTrim(lam, 3)}): P(Y ≥ ${k1}) = 1 − P(Y ≤ ${k1 - 1})`;
    } else if (query === 'between') {
      prob = poissonCdfSafe(lam, k2) - poissonCdfSafe(lam, k1 - 1);
      expr = `Y ~ Po(${fmtTrim(lam, 3)}): P(${k1} ≤ Y ≤ ${k2}) = P(Y ≤ ${k2}) − P(Y ≤ ${k1 - 1})`;
    } else {
      prob = poissonPmf(lam, k1);
      expr = `Y ~ Po(${fmtTrim(lam, 3)}): P(Y = ${k1})`;
    }

    return {
      kind: 'poisson',
      title: `Poisson approx Po(${fmtTrim(lam, 3)})`,
      suitable,
      conditionNote,
      probWithCC: prob,
      errWithCC: Math.abs(prob - exactProb),
      ccExpression: expr,
    };
  }

  if (approx === 'normal') {
    const mu = dist === 'binomial'
      ? Math.round(params.n ?? 20) * (params.p ?? 0.5)
      : (params.lambda ?? 15);
    const variance = dist === 'binomial'
      ? Math.round(params.n ?? 20) * (params.p ?? 0.5) * (1 - (params.p ?? 0.5))
      : (params.lambda ?? 15);
    const sd = Math.sqrt(Math.max(1e-9, variance));

    let suitable = false;
    let conditionNote = '';
    if (dist === 'binomial') {
      const n = Math.round(params.n ?? 20);
      const p = params.p ?? 0.5;
      suitable = n * p > 5 && n * (1 - p) > 5;
      conditionNote = suitable
        ? `np = ${fmtTrim(n * p, 2)} > 5 and n(1 − p) = ${fmtTrim(n * (1 - p), 2)} > 5, so N(${fmtTrim(mu, 2)}, ${fmtTrim(variance, 2)}) fits well.`
        : `Caution: Normal approx to B(n, p) works best when np > 5 and n(1 − p) > 5 (here np = ${fmtTrim(n * p, 2)}, n(1−p) = ${fmtTrim(n * (1 - p), 2)}).`;
    } else {
      const lam = params.lambda ?? 15;
      suitable = lam > 10;
      conditionNote = suitable
        ? `λ = ${fmtTrim(lam, 2)} > 10, so N(${fmtTrim(lam, 2)}, ${fmtTrim(lam, 2)}) is valid with continuity correction.`
        : `Caution: Normal approx to Po(λ) requires λ > 10 (here λ = ${fmtTrim(lam, 2)}).`;
    }

    const k1 = Math.round(a);
    const k2 = Math.round(Math.max(a, b));
    let probCC = 0;
    let probNoCC = 0;
    let ccExpression = '';
    let zWorking = '';

    if (query === 'le') {
      const cc = k1 + 0.5;
      const z = (cc - mu) / sd;
      probCC = phi(z);
      probNoCC = phi((k1 - mu) / sd);
      ccExpression = `P(X ≤ ${k1}) ≈ P(Y < ${cc}) [continuity correction +0.5]`;
      zWorking = `Z = (${cc} − ${fmtTrim(mu, 2)}) / √${fmtTrim(variance, 2)} = ${fmt(z, 4)} → Φ(${fmt(z, 2)}) = ${dp4(probCC)}`;
    } else if (query === 'ge') {
      const cc = k1 - 0.5;
      const z = (cc - mu) / sd;
      probCC = 1 - phi(z);
      probNoCC = 1 - phi((k1 - mu) / sd);
      ccExpression = `P(X ≥ ${k1}) ≈ P(Y > ${cc}) [continuity correction −0.5]`;
      zWorking = `Z = (${cc} − ${fmtTrim(mu, 2)}) / √${fmtTrim(variance, 2)} = ${fmt(z, 4)} → 1 − Φ(${fmt(z, 2)}) = ${dp4(probCC)}`;
    } else if (query === 'between') {
      const lo = k1 - 0.5;
      const hi = k2 + 0.5;
      const z1 = (lo - mu) / sd;
      const z2 = (hi - mu) / sd;
      probCC = phi(z2) - phi(z1);
      probNoCC = phi((k2 - mu) / sd) - phi((k1 - mu) / sd);
      ccExpression = `P(${k1} ≤ X ≤ ${k2}) ≈ P(${lo} < Y < ${hi}) [±0.5 at both ends]`;
      zWorking = `Z₁ = ${fmt(z1, 4)}, Z₂ = ${fmt(z2, 4)} → Φ(${fmt(z2, 2)}) − Φ(${fmt(z1, 2)}) = ${dp4(probCC)}`;
    } else {
      const lo = k1 - 0.5;
      const hi = k1 + 0.5;
      const z1 = (lo - mu) / sd;
      const z2 = (hi - mu) / sd;
      probCC = phi(z2) - phi(z1);
      probNoCC = 0;
      ccExpression = `P(X = ${k1}) ≈ P(${lo} < Y < ${hi}) [interval of width 1]`;
      zWorking = `Z₁ = ${fmt(z1, 4)}, Z₂ = ${fmt(z2, 4)} → Φ(${fmt(z2, 2)}) − Φ(${fmt(z1, 2)}) = ${dp4(probCC)}`;
    }

    return {
      kind: 'normal',
      title: `Normal approx N(${fmtTrim(mu, 2)}, ${fmtTrim(variance, 2)})`,
      suitable,
      conditionNote,
      probWithCC: probCC,
      errWithCC: Math.abs(probCC - exactProb),
      probNoCC,
      errNoCC: Math.abs(probNoCC - exactProb),
      ccExpression,
      zWorking,
    };
  }

  return null;
}

/* ---------- Hypothesis Tests (S2 Binomial/Poisson & S3 Normal Mean / χ²) ---------- */

export interface DiscreteCriticalRegionResult {
  lower: number | null;
  upper: number | null;
  lowerProb: number;
  upperProb: number;
  actualAlpha: number;
  nextLower?: { c: number; prob: number };
  nextUpper?: { c: number; prob: number };
  regionText: string;
}

export function discreteCriticalRegion(
  kind: 'binomial' | 'poisson',
  params: { n?: number; p?: number; lambda?: number },
  tail: TailKind,
  alpha: number,
): DiscreteCriticalRegionResult {
  const n = Math.max(1, Math.round(params.n ?? 20));
  const p = Math.min(1, Math.max(0, params.p ?? 0.25));
  const lam = Math.max(0.1, params.lambda ?? 5);

  const cdf = (k: number) => (kind === 'binomial' ? binomCdfSafe(n, p, k) : poissonCdfSafe(lam, k));
  const maxX = kind === 'binomial' ? n : Math.max(40, Math.ceil(lam + 10 * Math.sqrt(lam) + 20));
  const target = tail === 'two' ? alpha / 2 : alpha;

  let lower: number | null = null;
  let lowerProb = 0;
  let nextLower: { c: number; prob: number } | undefined;

  if (tail === 'lower' || tail === 'two') {
    let bestC: number | null = null;
    for (let k = 0; k <= maxX; k++) {
      const pk = cdf(k);
      if (pk <= target + 1e-12) {
        bestC = k;
        lowerProb = pk;
      } else {
        nextLower = { c: k, prob: pk };
        break;
      }
    }
    lower = bestC;
  }

  let upper: number | null = null;
  let upperProb = 0;
  let nextUpper: { c: number; prob: number } | undefined;

  if (tail === 'upper' || tail === 'two') {
    let bestC: number | null = null;
    for (let k = maxX; k >= 0; k--) {
      const ge = k === 0 ? 1 : 1 - cdf(k - 1);
      if (ge <= target + 1e-12) {
        bestC = k;
        upperProb = ge;
      } else {
        nextUpper = { c: k, prob: ge };
        break;
      }
    }
    upper = bestC;
  }

  const parts: string[] = [];
  if (lower !== null) parts.push(`X ≤ ${lower}`);
  else if (tail !== 'upper') parts.push('none (lower)');
  if (upper !== null) parts.push(`X ≥ ${upper}`);
  else if (tail !== 'lower') parts.push('none (upper)');

  return {
    lower,
    upper,
    lowerProb,
    upperProb,
    actualAlpha: lowerProb + upperProb,
    nextLower,
    nextUpper,
    regionText: parts.join(' or '),
  };
}

export function discreteHypothesisTest(
  kind: 'binomial' | 'poisson',
  params: { n?: number; p?: number; lambda?: number },
  obs: number,
  tail: TailKind,
  alpha: number,
) {
  const cr = discreteCriticalRegion(kind, params, tail, alpha);
  const cdf = (k: number) =>
    kind === 'binomial'
      ? binomCdfSafe(params.n ?? 20, params.p ?? 0.25, k)
      : poissonCdfSafe(params.lambda ?? 5, k);

  const x = Math.round(obs);
  const pLe = cdf(x);
  const pGe = x <= 0 ? 1 : 1 - cdf(x - 1);
  const tailProb = tail === 'lower' ? pLe : tail === 'upper' ? pGe : Math.min(pLe, pGe);
  const threshold = tail === 'two' ? alpha / 2 : alpha;

  const inCR =
    (cr.lower !== null && x <= cr.lower) ||
    (cr.upper !== null && x >= cr.upper);

  return {
    cr,
    x,
    pLe,
    pGe,
    tailProb,
    threshold,
    reject: inCR,
    pValue: tail === 'two' ? Math.min(1, 2 * tailProb) : tailProb,
  };
}

export function normalMeanTest(
  mu0: number,
  sigma: number,
  n: number,
  xbar: number,
  tail: TailKind,
  alpha: number,
) {
  const se = sigma / Math.sqrt(Math.max(1, n));
  const z = (xbar - mu0) / se;
  const tailAlpha = tail === 'two' ? alpha / 2 : alpha;
  const zCrit = invPhi(1 - tailAlpha);

  let reject = false;
  let pValue = 1;
  if (tail === 'lower') {
    reject = z <= -zCrit;
    pValue = phi(z);
  } else if (tail === 'upper') {
    reject = z >= zCrit;
    pValue = 1 - phi(z);
  } else {
    reject = Math.abs(z) >= zCrit;
    pValue = 2 * (1 - phi(Math.abs(z)));
  }

  return {
    se,
    z,
    zCrit,
    tailAlpha,
    critLow: tail === 'upper' ? null : mu0 - zCrit * se,
    critHigh: tail === 'lower' ? null : mu0 + zCrit * se,
    pValue,
    reject,
  };
}

/* ---------- Chi-Squared (S3) ---------- */

export function chi2Pdf(x: number, df: number): number {
  if (x <= 0 || df <= 0) return 0;
  const k2 = df / 2;
  return Math.exp((k2 - 1) * Math.log(x) - x / 2 - k2 * Math.LN2 - logGamma(k2));
}

/** Upper tail P(χ²_df ≥ x) = Q(df/2, x/2) via series + Lentz continued fraction. */
export function chi2UpperTail(x: number, df: number): number {
  if (x <= 0) return 1;
  if (df <= 0) return 0;
  const a = df / 2;
  const z = x / 2;
  const lg = logGamma(a);

  if (z < a + 1) {
    let ap = a;
    let sum = 1 / a;
    let del = sum;
    for (let n = 1; n <= 300; n++) {
      ap += 1;
      del *= z / ap;
      sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-13) break;
    }
    const lowerP = sum * Math.exp(-z + a * Math.log(z) - lg);
    return Math.max(0, Math.min(1, 1 - lowerP));
  }

  // Modified Lentz continued fraction for Q(a, z)
  const FPMIN = 1e-300;
  let b = z + 1 - a;
  let c = 1 / FPMIN;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-13) break;
  }
  const q = Math.exp(-z + a * Math.log(z) - lg) * h;
  return Math.max(0, Math.min(1, q));
}

export function chi2Crit(df: number, alpha: number): { value: number; fromBooklet: boolean } {
  const col = CHI_P.findIndex((p) => Math.abs(Number(p) - alpha) < 1e-6);
  if (df >= 1 && df <= 30 && col >= 0) {
    return { value: Number(CHI2[df - 1][col]), fromBooklet: true };
  }
  let lo = 0;
  let hi = Math.max(20, df + 12 * Math.sqrt(2 * df));
  while (chi2UpperTail(hi, df) > alpha && hi < 5000) hi *= 2;
  for (let i = 0; i < 64; i++) {
    const mid = 0.5 * (lo + hi);
    if (chi2UpperTail(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return { value: 0.5 * (lo + hi), fromBooklet: false };
}

export interface GofCell {
  label: string;
  obs: number;
  exp: number;
}

export interface GofPooledRow extends GofCell {
  contrib: number;
  mergedFrom: number;
}

export function buildGofModelCells(
  model: 'uniform' | 'poisson' | 'binomial',
  labels: string[],
  obs: number[],
  param?: number,
): { cells: GofCell[]; estParams: number; modelParam: number; desc: string } {
  const N = obs.reduce((s, v) => s + v, 0);
  const k = obs.length;
  if (model === 'uniform') {
    const E = N / Math.max(1, k);
    return {
      cells: obs.map((o, i) => ({ label: labels[i] ?? String(i), obs: o, exp: E })),
      estParams: 0,
      modelParam: E,
      desc: `Uniform: Eᵢ = ${fmtTrim(N, 0)} / ${k} = ${fmt(E, 2)}`,
    };
  }
  if (model === 'binomial') {
    const m = Math.max(1, k - 1);
    const totalSuccess = obs.reduce((s, o, i) => s + i * o, 0);
    const est = param === undefined;
    const pHat = est ? (N > 0 ? totalSuccess / (N * m) : 0.5) : Math.min(0.999, Math.max(0.001, param));
    return {
      cells: obs.map((o, i) => ({
        label: labels[i] ?? String(i),
        obs: o,
        exp: N * binomPmf(m, pHat, i),
      })),
      estParams: est ? 1 : 0,
      modelParam: pHat,
      desc: `Binomial B(${m}, ${fmt(pHat, 4)})` + (est ? ' (p estimated from sample mean)' : ''),
    };
  }

  // Poisson: last class treated as ≥ lastIdx so expected frequencies sum to N
  const totalCount = obs.reduce((s, o, i) => s + i * o, 0);
  const est = param === undefined;
  const lamHat = est ? Math.max(0.05, N > 0 ? totalCount / N : 1) : Math.max(0.05, param);
  let sumPrev = 0;
  const cells = obs.map((o, i) => {
    if (i < k - 1) {
      const p = poissonPmf(lamHat, i);
      sumPrev += p;
      return { label: labels[i] ?? String(i), obs: o, exp: N * p };
    }
    return { label: labels[i] ?? `≥ ${i}`, obs: o, exp: Math.max(0, N * (1 - sumPrev)) };
  });
  return {
    cells,
    estParams: est ? 1 : 0,
    modelParam: lamHat,
    desc: `Poisson Po(${fmt(lamHat, 3)})` + (est ? ' (λ estimated from sample mean)' : ''),
  };
}

function mergeLabels(a: string, b: string): string {
  const mA = a.match(/^≥\s*(\d+)$/);
  const mB = b.match(/^≥\s*(\d+)$/);
  if (mB) {
    const first = a.match(/^(\d+)/)?.[1] ?? a;
    return `≥ ${first}`;
  }
  if (mA) return a;
  const left = a.split('–')[0];
  const right = b.split('–').at(-1);
  if (/^\d+$/.test(left) && /^\d+$/.test(right ?? '')) return `${left}–${right}`;
  return `${a}, ${b}`;
}

export function chi2GoodnessOfFit(
  rawCells: GofCell[],
  estimatedParams: number,
  alpha: number,
) {
  const rows: GofPooledRow[] = rawCells.map((c) => ({
    label: c.label,
    obs: Math.max(0, c.obs),
    exp: Math.max(0, c.exp),
    contrib: 0,
    mergedFrom: 1,
  }));

  // Pool any class with E < 5 with an adjacent class (outer edges inward first)
  while (rows.length > 1) {
    let idx = -1;
    if (rows[0].exp < 5) idx = 0;
    else if (rows[rows.length - 1].exp < 5) idx = rows.length - 1;
    else idx = rows.findIndex((r) => r.exp < 5);

    if (idx === -1) break;

    let partner: number;
    if (idx === 0) partner = 1;
    else if (idx === rows.length - 1) partner = rows.length - 2;
    else partner = rows[idx - 1].exp <= rows[idx + 1].exp ? idx - 1 : idx + 1;

    const lo = Math.min(idx, partner);
    const hi = Math.max(idx, partner);
    rows.splice(lo, 2, {
      label: mergeLabels(rows[lo].label, rows[hi].label),
      obs: rows[lo].obs + rows[hi].obs,
      exp: rows[lo].exp + rows[hi].exp,
      contrib: 0,
      mergedFrom: rows[lo].mergedFrom + rows[hi].mergedFrom,
    });
  }

  let stat = 0;
  for (const r of rows) {
    r.contrib = r.exp > 0 ? ((r.obs - r.exp) ** 2) / r.exp : 0;
    stat += r.contrib;
  }

  const classesBefore = rawCells.length;
  const classesAfter = rows.length;
  const df = classesAfter - 1 - estimatedParams;
  const valid = df >= 1 && rows.every((r) => r.exp > 0);
  const critInfo = valid ? chi2Crit(df, alpha) : { value: 0, fromBooklet: false };
  const pValue = valid ? chi2UpperTail(stat, df) : 1;

  return {
    rows,
    classesBefore,
    classesAfter,
    pooledCount: classesBefore - classesAfter,
    df,
    stat,
    crit: critInfo.value,
    fromBooklet: critInfo.fromBooklet,
    pValue,
    valid,
    reject: valid && stat > critInfo.value,
  };
}

export function chi2Contingency(matrix: number[][], alpha: number) {
  const r = matrix.length;
  const c = matrix[0]?.length ?? 0;
  const rowTotals = matrix.map((row) => row.reduce((s, v) => s + Math.max(0, v), 0));
  const colTotals = Array.from({ length: c }, (_, j) =>
    matrix.reduce((s, row) => s + Math.max(0, row[j] ?? 0), 0),
  );
  const grandTotal = rowTotals.reduce((s, v) => s + v, 0);

  const expected: number[][] = Array.from({ length: r }, (_, i) =>
    Array.from({ length: c }, (_, j) => (grandTotal > 0 ? (rowTotals[i] * colTotals[j]) / grandTotal : 0)),
  );

  let stat = 0;
  let yatesStat = 0;
  let lowExpectedCount = 0;
  const contrib: number[][] = Array.from({ length: r }, (_, i) =>
    Array.from({ length: c }, (_, j) => {
      const o = Math.max(0, matrix[i][j] ?? 0);
      const e = expected[i][j];
      if (e > 0 && e < 5) lowExpectedCount++;
      const cVal = e > 0 ? ((o - e) ** 2) / e : 0;
      stat += cVal;
      if (r === 2 && c === 2 && e > 0) {
        yatesStat += (Math.max(0, Math.abs(o - e) - 0.5) ** 2) / e;
      }
      return cVal;
    }),
  );

  const df = (r - 1) * (c - 1);
  const valid = df >= 1 && grandTotal > 0 && expected.every((row) => row.every((e) => e > 0));
  const critInfo = valid ? chi2Crit(df, alpha) : { value: 0, fromBooklet: false };
  const pValue = valid ? chi2UpperTail(stat, df) : 1;

  return {
    r,
    c,
    rowTotals,
    colTotals,
    grandTotal,
    expected,
    contrib,
    stat,
    yatesStat: r === 2 && c === 2 ? yatesStat : null,
    lowExpectedCount,
    df,
    crit: critInfo.value,
    fromBooklet: critInfo.fromBooklet,
    pValue,
    valid,
    reject: valid && stat > critInfo.value,
  };
}

/* ---------- Correlation, Regression, Spearman & Coding (S1 / S3) ---------- */

export interface ScatterPoint {
  x: number;
  y: number;
}

/** Descending/ascending rank with mean tie handling (1..n). */
export function rankValues(vals: number[]): number[] {
  const indexed = vals.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks = new Array<number>(vals.length);
  let k = 0;
  while (k < indexed.length) {
    let end = k + 1;
    while (end < indexed.length && Math.abs(indexed[end].v - indexed[k].v) < 1e-12) end++;
    const avgRank = (k + 1 + end) / 2;
    for (let j = k; j < end; j++) ranks[indexed[j].i] = avgRank;
    k = end;
  }
  return ranks;
}

function pearsonOf(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const denom = Math.sqrt(sxx * syy);
  return denom > 1e-12 ? sxy / denom : 0;
}

export function regressionStats(points: ScatterPoint[]) {
  const n = points.length;
  if (n === 0) {
    return {
      n: 0, sumX: 0, sumY: 0, sumX2: 0, sumY2: 0, sumXY: 0,
      meanX: 0, meanY: 0, Sxx: 0, Syy: 0, Sxy: 0,
      r: 0, b: 0, a: 0, residuals: [] as number[], rss: 0,
      minX: 0, maxX: 0, minY: 0, maxY: 0,
      rx: [] as number[], ry: [] as number[], d: [] as number[], d2: [] as number[],
      sumD2: 0, rs: 0, rsExact: 0, hasTies: false,
    };
  }

  let sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0, sumXY = 0;
  let minX = points[0].x, maxX = points[0].x, minY = points[0].y, maxY = points[0].y;
  for (const p of points) {
    sumX += p.x;
    sumY += p.y;
    sumX2 += p.x * p.x;
    sumY2 += p.y * p.y;
    sumXY += p.x * p.y;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const meanX = sumX / n;
  const meanY = sumY / n;
  const Sxx = sumX2 - (sumX * sumX) / n;
  const Syy = sumY2 - (sumY * sumY) / n;
  const Sxy = sumXY - (sumX * sumY) / n;
  const b = Sxx > 1e-12 ? Sxy / Sxx : 0;
  const a = meanY - b * meanX;
  const denom = Math.sqrt(Math.max(0, Sxx * Syy));
  const r = denom > 1e-12 ? Math.max(-1, Math.min(1, Sxy / denom)) : 0;

  const residuals = points.map((p) => p.y - (a + b * p.x));
  const rss = residuals.reduce((s, e) => s + e * e, 0);

  const rx = rankValues(points.map((p) => p.x));
  const ry = rankValues(points.map((p) => p.y));
  const hasTies = rx.some((v) => !Number.isInteger(v)) || ry.some((v) => !Number.isInteger(v));
  const d = rx.map((v, i) => v - ry[i]);
  const d2 = d.map((v) => v * v);
  const sumD2 = d2.reduce((s, v) => s + v, 0);
  const rs = n >= 2 ? Math.max(-1, Math.min(1, 1 - (6 * sumD2) / (n * (n * n - 1)))) : 0;
  const rsExact = pearsonOf(rx, ry);

  return {
    n, sumX, sumY, sumX2, sumY2, sumXY,
    meanX, meanY, Sxx, Syy, Sxy,
    r, b, a, residuals, rss,
    minX, maxX, minY, maxY,
    rx, ry, d, d2, sumD2, rs, rsExact, hasTies,
  };
}

export function corrCritical(
  n: number,
  alpha: number,
  tail: 'one' | 'two',
  kind: 'pmcc' | 'spearman',
): { value: number | null; oneTailAlpha: number; note: string } {
  const oneTail = tail === 'two' ? alpha / 2 : alpha;
  const row = CORR.find((c) => c.n === n);
  if (!row) {
    return {
      value: null,
      oneTailAlpha: oneTail,
      note: `n = ${n} is not in the Edexcel booklet table (tabulated for n = 4–30, 40, 50, …, 100).`,
    };
  }

  if (kind === 'pmcc') {
    const levels = [0.1, 0.05, 0.025, 0.01, 0.005];
    const col = levels.findIndex((lv) => Math.abs(lv - oneTail) < 1e-6);
    if (col < 0) {
      return {
        value: null,
        oneTailAlpha: oneTail,
        note: `One-tail α = ${oneTail} is not tabulated in the PMCC table (use 10%, 5%, 2.5%, 1%, 0.5%).`,
      };
    }
    const v = Number(row.pmcc[col]);
    return {
      value: v,
      oneTailAlpha: oneTail,
      note: `From Edexcel PMCC table (n = ${n}, one-tail p = ${levels[col]}): critical |r| = ${v.toFixed(4)}.`,
    };
  }

  const levels = [0.05, 0.025, 0.01];
  const col = levels.findIndex((lv) => Math.abs(lv - oneTail) < 1e-6);
  if (col < 0) {
    return {
      value: null,
      oneTailAlpha: oneTail,
      note: `One-tail α = ${oneTail} is not tabulated in the Spearman table (use 5%, 2.5%, or 1% one-tailed).`,
    };
  }
  const raw = row.spearman[col];
  if (!raw || raw === '–') {
    return {
      value: null,
      oneTailAlpha: oneTail,
      note: `No critical value exists at n = ${n}, one-tail α = ${levels[col]} (minimum achievable tail probability is ${(1 / (n === 4 ? 24 : 120)).toFixed(4)}).`,
    };
  }
  const v = Number(raw);
  return {
    value: v,
    oneTailAlpha: oneTail,
    note: `From Edexcel Spearman table (n = ${n}, one-tail p = ${levels[col]}): critical |rₛ| = ${v.toFixed(4)}.`,
  };
}

export function codedRegressionStats(
  points: ScatterPoint[],
  cx: number,
  dx: number,
  cy: number,
  dy: number,
) {
  const safeDx = dx === 0 ? 1 : dx;
  const safeDy = dy === 0 ? 1 : dy;
  const coded = points.map((p) => ({
    x: (p.x - cx) / safeDx,
    y: (p.y - cy) / safeDy,
  }));
  return { coded, stats: regressionStats(coded) };
}

/* ---------- Box Plots, Quartiles, Outliers & Skewness (S1) ---------- */

/** Edexcel S1 discrete list quartile rule: compute n·f; if integer take mean of pos and pos+1; else round up to next index. */
export function edexcelQuartile(
  sorted: number[],
  frac: 0.25 | 0.5 | 0.75,
  label: string,
): { value: number; detail: string } {
  const n = sorted.length;
  if (n === 0) return { value: 0, detail: 'empty' };
  const pos = n * frac;
  const fracLabel = frac === 0.25 ? 'n/4' : frac === 0.5 ? 'n/2' : '3n/4';
  if (Math.abs(pos - Math.round(pos)) < 1e-9) {
    const i = Math.round(pos);
    const v1 = sorted[Math.max(0, i - 1)];
    const v2 = sorted[Math.min(n - 1, i)];
    const val = (v1 + v2) / 2;
    return {
      value: val,
      detail: `${label}: ${fracLabel} = ${i} (int) → mean of ${i}th & ${i + 1}th = ${fmtTrim(val, 3)}`,
    };
  }
  const k = Math.ceil(pos);
  const val = sorted[Math.min(n - 1, Math.max(0, k - 1))];
  return {
    value: val,
    detail: `${label}: ${fracLabel} = ${fmtTrim(pos, 2)} → ${k}th value = ${fmtTrim(val, 3)}`,
  };
}

export function boxPlotStats(
  values: number[],
  rule: 'iqr' | 'sd' = 'iqr',
  k = 1.5,
) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const min = sorted[0] ?? 0;
  const max = sorted[n - 1] ?? 0;
  const sum = sorted.reduce((s, v) => s + v, 0);
  const mean = n > 0 ? sum / n : 0;
  const sumSqDiff = sorted.reduce((s, v) => s + (v - mean) ** 2, 0);
  const popVar = n > 0 ? sumSqDiff / n : 0;
  const popSd = Math.sqrt(popVar);
  const sampleVar = n > 1 ? sumSqDiff / (n - 1) : 0;
  const sampleSd = Math.sqrt(sampleVar);

  const q1Info = edexcelQuartile(sorted, 0.25, 'Q₁');
  const q2Info = edexcelQuartile(sorted, 0.5, 'Q₂');
  const q3Info = edexcelQuartile(sorted, 0.75, 'Q₃');
  const q1 = q1Info.value;
  const q2 = q2Info.value;
  const q3 = q3Info.value;
  const iqr = q3 - q1;

  const lowFence = rule === 'iqr' ? q1 - k * iqr : mean - 2 * popSd;
  const highFence = rule === 'iqr' ? q3 + k * iqr : mean + 2 * popSd;

  const outliers = sorted.filter((v) => v < lowFence - 1e-12 || v > highFence + 1e-12);
  const nonOutliers = sorted.filter((v) => v >= lowFence - 1e-12 && v <= highFence + 1e-12);
  const whiskerLow = nonOutliers[0] ?? q1;
  const whiskerHigh = nonOutliers[nonOutliers.length - 1] ?? q3;

  const qSkew = (q3 - q2) - (q2 - q1);
  const pearsonSkew = popSd > 1e-9 ? (3 * (mean - q2)) / popSd : 0;
  let skewLabel: 'Positive skew' | 'Negative skew' | 'Symmetric' = 'Symmetric';
  if (Math.abs(qSkew) > 1e-6) {
    skewLabel = qSkew > 0 ? 'Positive skew' : 'Negative skew';
  } else if (Math.abs(pearsonSkew) > 0.05) {
    skewLabel = pearsonSkew > 0 ? 'Positive skew' : 'Negative skew';
  }

  return {
    sorted,
    n,
    min,
    max,
    range: max - min,
    q1,
    q2,
    q3,
    q1Detail: q1Info.detail,
    q2Detail: q2Info.detail,
    q3Detail: q3Info.detail,
    iqr,
    mean,
    popVar,
    popSd,
    sampleVar,
    sampleSd,
    lowFence,
    highFence,
    outliers,
    nonOutliers,
    whiskerLow,
    whiskerHigh,
    qSkew,
    pearsonSkew,
    skewLabel,
  };
}

/* ---------- Probability: Venn & Tree Diagrams (S1) ---------- */

export function venn2Stats(onlyA: number, both: number, onlyB: number) {
  const neither = +(1 - onlyA - both - onlyB).toFixed(6);
  const valid =
    onlyA >= -1e-6 &&
    both >= -1e-6 &&
    onlyB >= -1e-6 &&
    neither >= -1e-6 &&
    onlyA + both + onlyB <= 1 + 1e-6;
  const pA = onlyA + both;
  const pB = onlyB + both;
  const pUnion = pA + onlyB;
  const pAgivenB = pB > 1e-9 ? both / pB : 0;
  const pBgivenA = pA > 1e-9 ? both / pA : 0;
  const pNotB = 1 - pB;
  const pNotAgivenNotB = pNotB > 1e-9 ? Math.max(0, neither) / pNotB : 0;
  const indepProduct = pA * pB;
  const indepDiff = both - indepProduct;
  const isIndependent = Math.abs(indepDiff) < 5e-4;
  const isMutuallyExclusive = Math.abs(both) < 1e-6;

  return {
    onlyA,
    both,
    onlyB,
    neither: Math.max(0, neither),
    valid,
    pA,
    pB,
    pUnion,
    pAgivenB,
    pBgivenA,
    pNotAgivenNotB,
    indepProduct,
    indepDiff,
    isIndependent,
    isMutuallyExclusive,
  };
}

export function tree2Stats(pA: number, pBgivenA: number, pBgivenNotA: number) {
  const pNotA = 1 - pA;
  const pNotBgivenA = 1 - pBgivenA;
  const pNotBgivenNotA = 1 - pBgivenNotA;

  const pAB = pA * pBgivenA;
  const pAnB = pA * pNotBgivenA;
  const pnAB = pNotA * pBgivenNotA;
  const pnAnB = pNotA * pNotBgivenNotA;

  const pB = pAB + pnAB;
  const pNotB = pAnB + pnAnB;

  const pAgivenB = pB > 1e-9 ? pAB / pB : 0;
  const pNotAgivenB = pB > 1e-9 ? pnAB / pB : 0;
  const pAgivenNotB = pNotB > 1e-9 ? pAnB / pNotB : 0;
  const isIndependent = Math.abs(pBgivenA - pBgivenNotA) < 5e-4;

  return {
    pA,
    pNotA,
    pBgivenA,
    pNotBgivenA,
    pBgivenNotA,
    pNotBgivenNotA,
    pAB,
    pAnB,
    pnAB,
    pnAnB,
    pB,
    pNotB,
    pAgivenB,
    pNotAgivenB,
    pAgivenNotB,
    isIndependent,
  };
}

/* ---------- Central Limit Theorem & Sampling Distributions (S3) ---------- */

export type CltPopId = 'skew' | 'uniform' | 'bimodal' | 'die' | 'u_shaped';

export interface CltPopulation {
  id: CltPopId;
  label: string;
  formula: string;
  mu: number;
  sigma: number;
  domain: [number, number];
  discrete?: boolean;
  pdf: (x: number) => number;
  sampleOne: () => number;
}

function randNormal(): number {
  const u1 = Math.max(1e-12, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export const CLT_POPS: Record<CltPopId, CltPopulation> = {
  skew: {
    id: 'skew',
    label: 'Right-skewed Exp(0.5)',
    formula: 'X ~ Exp(λ = 0.5),  μ = 2,  σ = 2',
    mu: 2,
    sigma: 2,
    domain: [0, 10],
    pdf: (x) => (x < 0 ? 0 : 0.5 * Math.exp(-0.5 * x)),
    sampleOne: () => -2 * Math.log(Math.max(1e-12, 1 - Math.random())),
  },
  uniform: {
    id: 'uniform',
    label: 'Uniform U(0, 10)',
    formula: 'X ~ U(0, 10),  μ = 5,  σ = 10/√12 ≈ 2.8868',
    mu: 5,
    sigma: 10 / Math.sqrt(12),
    domain: [0, 10],
    pdf: (x) => (x >= 0 && x <= 10 ? 0.1 : 0),
    sampleOne: () => 10 * Math.random(),
  },
  bimodal: {
    id: 'bimodal',
    label: 'Bimodal mixture',
    formula: '½ N(2, 0.7²) + ½ N(8, 0.7²),  μ = 5,  σ ≈ 3.0806',
    mu: 5,
    sigma: Math.sqrt(0.7 * 0.7 + 9),
    domain: [0, 10],
    pdf: (x) => 0.5 * normalPdf(x, 2, 0.7) + 0.5 * normalPdf(x, 8, 0.7),
    sampleOne: () => (Math.random() < 0.5 ? 2 : 8) + 0.7 * randNormal(),
  },
  die: {
    id: 'die',
    label: 'Fair die {1..6}',
    formula: 'Discrete Uniform on {1..6},  μ = 3.5,  σ = √(35/12) ≈ 1.7078',
    mu: 3.5,
    sigma: Math.sqrt(35 / 12),
    domain: [0.5, 6.5],
    discrete: true,
    pdf: (x) => {
      const r = Math.round(x);
      return r >= 1 && r <= 6 && Math.abs(x - r) < 0.3 ? 1 / 6 : 0;
    },
    sampleOne: () => 1 + Math.floor(Math.random() * 6),
  },
  u_shaped: {
    id: 'u_shaped',
    label: 'U-shaped (arcsine)',
    formula: '5 + 5 cos(πU),  μ = 5,  σ = 5/√2 ≈ 3.5355',
    mu: 5,
    sigma: 5 / Math.sqrt(2),
    domain: [0, 10],
    pdf: (x) => {
      const r = x - 5;
      const under = 25 - r * r;
      return under > 0.05 ? 1 / (Math.PI * Math.sqrt(under)) : 0;
    },
    sampleOne: () => 5 + 5 * Math.cos(Math.PI * Math.random()),
  },
};

export function drawCltSample(popId: CltPopId, n: number) {
  const pop = CLT_POPS[popId];
  const values: number[] = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const x = pop.sampleOne();
    values.push(x);
    sum += x;
  }
  const mean = sum / n;
  const ss = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return {
    values,
    mean,
    biasedVar: ss / n,
    unbiasedVar: n > 1 ? ss / (n - 1) : 0,
  };
}
