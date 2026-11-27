/* Practice: procedurally generated Edexcel IAL S1–S3 exam-style questions with mark-scheme working.
   Uses the exact same statistical routines from ./math.ts so answers match printed Pearson Issue 2 tables. */

import {
  phi, dp4, fmt, invPhi, binomCdfSafe, poissonCdfSafe,
  discreteCriticalRegion, normalPdf, regressionStats, boxPlotStats,
  venn2Stats, tree2Stats, NORMAL_POINTS,
} from './math';

export type Topic = 'normal' | 'discrete' | 'approx' | 'tests' | 'corr' | 'data' | 'prob_s3';

export const TOPICS: [Topic | 'all', string][] = [
  ['all', 'Mixed (S1–S3)'],
  ['normal', 'Normal distribution'],
  ['discrete', 'Binomial & Poisson'],
  ['approx', 'S2 approximations'],
  ['tests', 'Hypothesis testing'],
  ['corr', 'PMCC, regression & Spearman'],
  ['data', 'Quartiles, outliers & coding'],
  ['prob_s3', 'Probability, CLT & χ²'],
];

export const TOPIC_NAME = Object.fromEntries(TOPICS) as Record<Topic | 'all', string>;

export const SPEC: Record<Topic | 'all', string> = {
  all: 'S1–S3',
  normal: 'S1.6',
  discrete: 'S2.1',
  approx: 'S2.1/2.3',
  tests: 'S2.4/3.3',
  corr: 'S1.4/3.5',
  data: 'S1.2',
  prob_s3: 'S1.3/S3',
};

export const TOPIC_SPEC_LINKS: Record<Topic, { id: string; label: string }[]> = {
  normal: [{ id: 'S1.6.1', label: 'Normal distribution' }],
  discrete: [{ id: 'S2.1.1', label: 'Binomial & Poisson' }, { id: 'S2.1.2', label: 'Mean & variance' }],
  approx: [{ id: 'S2.1.3', label: 'B → Po approx' }, { id: 'S2.3.2', label: 'Normal approx' }],
  tests: [{ id: 'S2.4.4', label: 'Critical region' }, { id: 'S2.4.6', label: 'Binomial & Poisson tests' }, { id: 'S3.3.5', label: 'Normal Z-test' }],
  corr: [{ id: 'S1.4.1', label: 'Scatter & line' }, { id: 'S1.4.3', label: 'PMCC' }, { id: 'S3.5.1', label: 'Spearman rₛ' }],
  data: [{ id: 'S1.2.1', label: 'Box plots' }, { id: 'S1.2.4', label: 'Skewness & outliers' }],
  prob_s3: [{ id: 'S1.3.2', label: 'Conditional prob' }, { id: 'S3.3.4', label: 'CI limits' }, { id: 'S3.4.1', label: 'χ² GoF' }],
};

export type Figure =
  | { kind: 'normal'; mu: number; sigma: number; lo: number; hi: number; label: string }
  | { kind: 'bars'; dist: 'binomial' | 'poisson'; n?: number; p?: number; lambda?: number; lo: number; hi: number }
  | { kind: 'venn'; onlyA: number; both: number; onlyB: number; neither: number }
  | { kind: 'box'; sorted: number[]; q1: number; q2: number; q3: number; lowFence: number; highFence: number }
  | { kind: 'table'; head: string[]; rows: (string | number)[][] };

export interface Question {
  topic: Topic;
  prompt: string;
  options: string[];
  answer: string;
  working: string[];
  why: string;
  figure?: Figure;
}

const rInt = (lo: number, hi: number) => lo + Math.floor(Math.random() * (hi - lo + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniqueOptions(answer: string, distractors: string[]): string[] {
  const out = [answer];
  for (const d of distractors) {
    if (d && !out.includes(d)) out.push(d);
    if (out.length === 4) break;
  }
  let guard = 1;
  while (out.length < 4 && guard < 25) {
    const num = Number(answer);
    const cand = Number.isFinite(num)
      ? (answer.includes('.') ? dp4(Math.max(0.0001, Math.min(0.9999, num + (guard % 2 === 0 ? 1 : -1) * 0.031 * guard))) : String(num + guard))
      : `${answer} (${guard})`;
    if (!out.includes(cand)) out.push(cand);
    guard++;
  }
  return shuffle(out);
}

export { normalPdf };

function genNormal(): Question {
  const variant = Math.random();
  const mu = pick([20, 40, 50, 100, 160]);
  const sigma = pick([4, 5, 6, 8, 10]);

  if (variant < 0.45) {
    const zSteps = [-1.5, -1.2, -0.8, 0.7, 1.1, 1.4, 1.8];
    const zTarget = pick(zSteps);
    const x = +(mu + zTarget * sigma).toFixed(1);
    const upper = Math.random() < 0.5;
    const pLe = phi(zTarget);
    const pGe = 1 - pLe;
    const ans = dp4(upper ? pGe : pLe);
    const wrongFlip = dp4(upper ? pLe : pGe);
    const wrongNeg = dp4(phi(-Math.abs(zTarget) - 0.3));
    const wrongMean = dp4(0.5);
    return {
      topic: 'normal',
      prompt: `Given X ~ N(${mu}, ${sigma}²), find ${upper ? `P(X > ${x})` : `P(X < ${x})`} to 4 decimal places.`,
      options: uniqueOptions(ans, [wrongFlip, wrongNeg, wrongMean]),
      answer: ans,
      figure: {
        kind: 'normal',
        mu,
        sigma,
        lo: upper ? x : -Infinity,
        hi: upper ? Infinity : x,
        label: upper ? `P(X > ${x})` : `P(X < ${x})`,
      },
      working: [
        `Standardise: Z = (${x} − ${mu}) / ${sigma} = ${zTarget.toFixed(2)}`,
        upper
          ? `P(X > ${x}) = 1 − Φ(${zTarget.toFixed(2)}) = 1 − ${dp4(pLe)} = ${ans}`
          : `P(X < ${x}) = Φ(${zTarget.toFixed(2)}) = ${ans}`,
      ],
      why: 'Always check whether the question asks for a left tail Φ(z) or a right tail 1 − Φ(z). Sketching the curve prevents sign errors.',
    };
  }

  if (variant < 0.75) {
    const lo = +(mu - sigma * pick([0.5, 1.0, 1.2])).toFixed(1);
    const hi = +(mu + sigma * pick([0.8, 1.5, 2.0])).toFixed(1);
    const z1 = (lo - mu) / sigma;
    const z2 = (hi - mu) / sigma;
    const p1 = phi(z1);
    const p2 = phi(z2);
    const ans = dp4(p2 - p1);
    return {
      topic: 'normal',
      prompt: `For X ~ N(${mu}, ${sigma}²), find P(${lo} < X < ${hi}) to 4 decimal places.`,
      options: uniqueOptions(ans, [dp4(p2 + p1 - 1), dp4(1 - (p2 - p1)), dp4(p2)]),
      answer: ans,
      figure: { kind: 'normal', mu, sigma, lo, hi, label: `P(${lo} < X < ${hi})` },
      working: [
        `Z₁ = (${lo} − ${mu})/${sigma} = ${z1.toFixed(2)},  Z₂ = (${hi} − ${mu})/${sigma} = ${z2.toFixed(2)}`,
        `Φ(${z2.toFixed(2)}) − Φ(${z1.toFixed(2)}) = ${dp4(p2)} − ${dp4(p1)} = ${ans}`,
      ],
      why: 'Between two bounds, compute Φ(z₂) − Φ(z₁), remembering Φ(−a) = 1 − Φ(a).',
    };
  }

  // Inverse normal percentage point
  const [pStr, zStr] = pick(NORMAL_POINTS.slice(5, 10));
  const tailP = Number(pStr);
  const z = Number(zStr);
  const aVal = +(mu + z * sigma).toFixed(2);
  const ans = aVal.toFixed(2);
  const wrongLeft = +(mu - z * sigma).toFixed(2);
  const wrongHalf = +(mu + invPhi(1 - tailP / 2) * sigma).toFixed(2);
  const wrongOne = +(mu + sigma).toFixed(2);
  return {
    topic: 'normal',
    prompt: `X ~ N(${mu}, ${sigma}²). Find the value a (to 2 d.p.) such that P(X > a) = ${pStr}.`,
    options: uniqueOptions(ans, [wrongLeft.toFixed(2), wrongHalf.toFixed(2), wrongOne.toFixed(2)]),
    answer: ans,
    figure: { kind: 'normal', mu, sigma, lo: aVal, hi: Infinity, label: `P(X > ${ans}) = ${pStr}` },
    working: [
      `From the Normal percentage points table, P(Z > z) = ${pStr} gives z = ${zStr}`,
      `Solve (a − ${mu}) / ${sigma} = ${zStr} → a = ${mu} + ${zStr} × ${sigma} = ${ans}`,
    ],
    why: 'Pearson provides exact percentage points (e.g. 1.6449 for 5%, 1.9600 for 2.5%) for inverse normal problems.',
  };
}

function genDiscrete(): Question {
  const isBin = Math.random() < 0.55;
  if (isBin) {
    const n = pick([10, 12, 15, 20]);
    const p = pick([0.15, 0.25, 0.3, 0.4]);
    const k = rInt(2, Math.max(3, Math.round(n * p) + 2));
    const upper = Math.random() < 0.55;
    if (upper) {
      const prev = binomCdfSafe(n, p, k - 1);
      const exact = 1 - prev;
      const ans = dp4(exact);
      return {
        topic: 'discrete',
        prompt: `X ~ B(${n}, ${p}). Find P(X ≥ ${k}) to 4 decimal places.`,
        options: uniqueOptions(ans, [dp4(1 - binomCdfSafe(n, p, k)), dp4(prev), dp4(binomCdfSafe(n, p, k))]),
        answer: ans,
        figure: { kind: 'bars', dist: 'binomial', n, p, lo: k, hi: n },
        working: [
          `P(X ≥ ${k}) = 1 − P(X ≤ ${k - 1})`,
          `= 1 − ${dp4(prev)} = ${ans}`,
        ],
        why: `For discrete random variables, P(X ≥ ${k}) excludes ${k - 1} and below, so subtract P(X ≤ ${k - 1}), NOT P(X ≤ ${k}).`,
      };
    }
    const lo = Math.max(1, k - 2);
    const hi = Math.min(n - 1, k + 1);
    const prob = binomCdfSafe(n, p, hi) - binomCdfSafe(n, p, lo - 1);
    const ans = dp4(prob);
    return {
      topic: 'discrete',
      prompt: `X ~ B(${n}, ${p}). Find P(${lo} ≤ X ≤ ${hi}) to 4 decimal places.`,
      options: uniqueOptions(ans, [
        dp4(binomCdfSafe(n, p, hi) - binomCdfSafe(n, p, lo)),
        dp4(binomCdfSafe(n, p, hi - 1) - binomCdfSafe(n, p, lo - 1)),
        dp4(binomCdfSafe(n, p, hi)),
      ]),
      answer: ans,
      figure: { kind: 'bars', dist: 'binomial', n, p, lo, hi },
      working: [
        `P(${lo} ≤ X ≤ ${hi}) = P(X ≤ ${hi}) − P(X ≤ ${lo - 1})`,
        `= ${dp4(binomCdfSafe(n, p, hi))} − ${dp4(binomCdfSafe(n, p, lo - 1))} = ${ans}`,
      ],
      why: `To keep X = ${lo} included in [${lo}, ${hi}], subtract P(X ≤ ${lo - 1}).`,
    };
  }

  const lam = pick([2.5, 4, 5.5, 7, 8]);
  const k = rInt(Math.max(2, Math.floor(lam) - 1), Math.ceil(lam) + 3);
  const prev = poissonCdfSafe(lam, k - 1);
  const exact = 1 - prev;
  const ans = dp4(exact);
  return {
    topic: 'discrete',
    prompt: `Events occur at a constant mean rate of λ = ${lam} per hour, modelled by X ~ Po(${lam}). Find P(X ≥ ${k}).`,
    options: uniqueOptions(ans, [dp4(1 - poissonCdfSafe(lam, k)), dp4(prev), dp4(poissonCdfSafe(lam, k) - prev)]),
    answer: ans,
    figure: { kind: 'bars', dist: 'poisson', lambda: lam, lo: k, hi: 25 },
    working: [
      `P(X ≥ ${k}) = 1 − P(X ≤ ${k - 1})`,
      `= 1 − ${dp4(prev)} = ${ans}`,
    ],
    why: `Poisson CDF tables list P(X ≤ x); convert P(X ≥ ${k}) to 1 − P(X ≤ ${k - 1}).`,
  };
}

function genApprox(): Question {
  const mode = pick(['bn_le', 'bn_ge', 'po_le', 'b_po'] as const);
  if (mode === 'b_po') {
    const n = pick([60, 80, 100]);
    const p = pick([0.02, 0.03, 0.04, 0.05]);
    const lam = +(n * p).toFixed(2);
    const k = rInt(2, 5);
    const ans = dp4(poissonCdfSafe(lam, k));
    return {
      topic: 'approx',
      prompt: `X ~ B(${n}, ${p}). Using a suitable Poisson approximation, estimate P(X ≤ ${k}) to 4 d.p.`,
      options: uniqueOptions(ans, [
        dp4(1 - poissonCdfSafe(lam, k)),
        dp4(poissonCdfSafe(lam, k - 1)),
        dp4(phi((k + 0.5 - lam) / Math.sqrt(lam))),
      ]),
      answer: ans,
      figure: { kind: 'bars', dist: 'poisson', lambda: lam, lo: 0, hi: k },
      working: [
        `Since n = ${n} is large and p = ${p} is small, X ≈ Po(np) = Po(${lam}).`,
        `Both distributions are discrete so no continuity correction: P(X ≤ ${k}) ≈ ${ans}.`,
      ],
      why: 'No ±0.5 continuity correction is used when approximating a Binomial distribution with a Poisson distribution.',
    };
  }

  if (mode === 'po_le') {
    const lam = pick([16, 20, 25]);
    const sd = Math.sqrt(lam);
    const k = lam + pick([2, 3, 4]);
    const withCC = phi((k + 0.5 - lam) / sd);
    const wrongMinus = phi((k - 0.5 - lam) / sd);
    const wrongNoCC = phi((k - lam) / sd);
    const ans = dp4(withCC);
    return {
      topic: 'approx',
      prompt: `X ~ Po(${lam}). Using a Normal approximation with continuity correction, find P(X ≤ ${k}) to 4 d.p.`,
      options: uniqueOptions(ans, [dp4(wrongMinus), dp4(wrongNoCC), dp4(1 - withCC)]),
      answer: ans,
      figure: { kind: 'normal', mu: lam, sigma: sd, lo: -Infinity, hi: k + 0.5, label: `Y < ${k + 0.5}` },
      working: [
        `λ = ${lam} > 10 → Y ~ N(${lam}, ${lam})`,
        `Continuity correction: P(X ≤ ${k}) ≈ P(Y < ${k + 0.5})`,
        `Z = (${k + 0.5} − ${lam}) / √${lam} = ${fmt((k + 0.5 - lam) / sd, 4)} → Φ(Z) = ${ans}`,
      ],
      why: `To include discrete value ${k} in P(X ≤ ${k}), extend the upper bound to ${k + 0.5}.`,
    };
  }

  const n = pick([40, 50, 60]);
  const p = pick([0.4, 0.5]);
  const mu = n * p;
  const variance = n * p * (1 - p);
  const sd = Math.sqrt(variance);
  const isGe = mode === 'bn_ge';
  const k = Math.round(mu) + pick([2, 3]);
  const ccVal = isGe ? k - 0.5 : k + 0.5;
  const probCC = isGe ? 1 - phi((ccVal - mu) / sd) : phi((ccVal - mu) / sd);
  const wrongOppCC = isGe ? 1 - phi((k + 0.5 - mu) / sd) : phi((k - 0.5 - mu) / sd);
  const wrongNoCC = isGe ? 1 - phi((k - mu) / sd) : phi((k - mu) / sd);
  const ans = dp4(probCC);
  return {
    topic: 'approx',
    prompt: `X ~ B(${n}, ${p}). Using a Normal approximation with continuity correction, estimate ${isGe ? `P(X ≥ ${k})` : `P(X ≤ ${k})`} to 4 d.p.`,
    options: uniqueOptions(ans, [dp4(wrongOppCC), dp4(wrongNoCC), dp4(1 - probCC)]),
    answer: ans,
    figure: {
      kind: 'normal',
      mu,
      sigma: sd,
      lo: isGe ? ccVal : -Infinity,
      hi: isGe ? Infinity : ccVal,
      label: isGe ? `Y > ${ccVal}` : `Y < ${ccVal}`,
    },
    working: [
      `Y ~ N(np = ${mu}, npq = ${variance}),  σ = √${variance} = ${fmt(sd, 3)}`,
      isGe ? `P(X ≥ ${k}) ≈ P(Y > ${k - 0.5})` : `P(X ≤ ${k}) ≈ P(Y < ${k + 0.5})`,
      `Standardise using ${ccVal}: answer = ${ans}`,
    ],
    why: isGe
      ? `For P(X ≥ ${k}), start at ${k - 0.5} so the bar for ${k} is fully included.`
      : `For P(X ≤ ${k}), finish at ${k + 0.5} so the bar for ${k} is fully included.`,
  };
}

function genTests(): Question {
  const n = pick([15, 20, 25]);
  const p0 = pick([0.2, 0.25, 0.3, 0.4]);
  const tail = pick(['upper', 'lower', 'two'] as const);
  const alpha = pick([0.05, 0.10] as const);
  const res = discreteCriticalRegion('binomial', { n, p: p0 }, tail, alpha);

  if (Math.random() < 0.5 && tail !== 'two') {
    const critVal = tail === 'upper' ? res.upper! : res.lower!;
    const ans = tail === 'upper' ? `X ≥ ${critVal}` : `X ≤ ${critVal}`;
    const d1 = tail === 'upper' ? `X ≥ ${Math.max(1, critVal - 1)}` : `X ≤ ${critVal + 1}`;
    const d2 = tail === 'upper' ? `X ≥ ${critVal + 1}` : `X ≤ ${Math.max(0, critVal - 1)}`;
    const d3 = tail === 'upper' ? `X ≤ ${critVal}` : `X ≥ ${critVal}`;
    return {
      topic: 'tests',
      prompt: `A test uses X ~ B(${n}, ${p0}) with H₀: p = ${p0}, H₁: p ${tail === 'upper' ? '>' : '<'} ${p0} at the ${alpha * 100}% level. Find the critical region.`,
      options: uniqueOptions(ans, [d1, d2, d3]),
      answer: ans,
      figure: {
        kind: 'bars',
        dist: 'binomial',
        n,
        p: p0,
        lo: tail === 'upper' ? critVal : 0,
        hi: tail === 'upper' ? n : critVal,
      },
      working: [
        tail === 'upper'
          ? `Seek smallest c with P(X ≥ c) ≤ ${alpha}: P(X ≥ ${critVal}) = ${dp4(res.upperProb)}`
          : `Seek largest c with P(X ≤ c) ≤ ${alpha}: P(X ≤ ${critVal}) = ${dp4(res.lowerProb)}`,
        res.nextUpper ? `Check adjacent value: P(X ≥ ${res.nextUpper.c}) = ${dp4(res.nextUpper.prob)} > ${alpha}` : `Check adjacent value: P(X ≤ ${res.nextLower!.c}) = ${dp4(res.nextLower!.prob)} > ${alpha}`,
        `Therefore critical region is ${ans}.`,
      ],
      why: 'In Edexcel S2, always show both the boundary value inside α AND the adjacent value that exceeds α.',
    };
  }

  const ans = dp4(res.actualAlpha);
  const wrongTarget = dp4(alpha);
  const wrongNext = dp4(Math.min(0.99, (res.nextUpper?.prob ?? res.nextLower?.prob ?? 0.08) + (tail === 'two' ? res.lowerProb : 0)));
  const wrongHalf = dp4(res.actualAlpha / 2);
  return {
    topic: 'tests',
    prompt: `For X ~ B(${n}, ${p0}), H₁: p ${tail === 'two' ? '≠' : tail === 'upper' ? '>' : '<'} ${p0} at the ${alpha * 100}% level, the critical region is ${res.regionText}. What is the actual significance level of this test?`,
    options: uniqueOptions(ans, [wrongTarget, wrongNext, wrongHalf]),
    answer: ans,
    figure: {
      kind: 'table',
      head: ['Tail', 'Critical region', 'Exact tail probability'],
      rows: [
        ...(res.lower !== null ? [['Lower', `X ≤ ${res.lower}`, dp4(res.lowerProb)]] : []),
        ...(res.upper !== null ? [['Upper', `X ≥ ${res.upper}`, dp4(res.upperProb)]] : []),
        ['Total', res.regionText, ans],
      ],
    },
    working: [
      `Actual significance level = P(X ∈ CR | H₀)`,
      tail === 'two'
        ? `= P(X ≤ ${res.lower}) + P(X ≥ ${res.upper}) = ${dp4(res.lowerProb)} + ${dp4(res.upperProb)} = ${ans}`
        : `= ${ans}`,
    ],
    why: 'Actual significance level is the exact probability of rejecting H₀ when H₀ is true; for a two-tailed test, sum both tails.',
  };
}

function genCorr(): Question {
  const variant = Math.random();
  if (variant < 0.4) {
    const sxx = pick([40, 64, 80, 100]);
    const syy = pick([90, 144, 160, 225]);
    const sxy = Math.round(Math.sqrt(sxx * syy) * pick([-0.85, -0.65, 0.72, 0.9]));
    const r = sxy / Math.sqrt(sxx * syy);
    const ans = r.toFixed(4);
    const wrongB = (sxy / sxx).toFixed(4);
    const wrongNoSqrt = (sxy / (sxx * syy)).toFixed(4);
    const wrongSign = (-r).toFixed(4);
    return {
      topic: 'corr',
      prompt: `Given S_xx = ${sxx}, S_yy = ${syy}, and S_xy = ${sxy}, calculate the product moment correlation coefficient r (to 4 d.p.).`,
      options: uniqueOptions(ans, [wrongB, wrongNoSqrt, wrongSign]),
      answer: ans,
      figure: {
        kind: 'table',
        head: ['Statistic', 'Value'],
        rows: [['S_xx', sxx], ['S_yy', syy], ['S_xy', sxy]],
      },
      working: [
        `r = S_xy / √(S_xx · S_yy)`,
        `r = ${sxy} / √(${sxx} × ${syy}) = ${sxy} / ${fmt(Math.sqrt(sxx * syy), 3)} = ${ans}`,
      ],
      why: 'S_xy / S_xx gives the regression slope b, whereas r divides by √(S_xx S_yy) so |r| ≤ 1.',
    };
  }

  if (variant < 0.7) {
    const r0 = pick([0.812, -0.745, 0.684]);
    const flip = Math.random() < 0.5;
    const ans = (flip ? -r0 : r0).toFixed(3);
    return {
      topic: 'corr',
      prompt: `Two variables x and y have PMCC r = ${r0}. Variables are coded by u = (x − 10)/5 and v = ${flip ? '(20 − y)/2' : '(y − 20)/2'}. What is the PMCC between u and v?`,
      options: uniqueOptions(ans, [(-Number(ans)).toFixed(3), (r0 / 2).toFixed(3), (r0 / 10).toFixed(3)]),
      answer: ans,
      working: [
        `Linear coding multiplies x by 1/5 (positive) and y by ${flip ? '−1/2 (negative)' : '+1/2 (positive)'}.`,
        `The magnitude |r| is invariant under linear coding; opposite signs flip the sign of r, giving ${ans}.`,
      ],
      why: 'Adding or multiplying by positive constants leaves r completely unchanged; multiplying ONE variable by a negative constant flips the sign of r.',
    };
  }

  // Spearman's rank
  const n = pick([6, 7, 8]);
  const xs = Array.from({ length: n }, (_, i) => i + 1);
  const ys = shuffle(xs);
  const st = regressionStats(xs.map((x, i) => ({ x, y: ys[i] })));
  const ans = st.rs.toFixed(4);
  const wrongNoSix = (1 - st.sumD2 / (n * (n * n - 1))).toFixed(4);
  const wrongPlus = (1 + (6 * st.sumD2) / (n * (n * n - 1))).toFixed(4);
  const wrongSign = (-st.rs).toFixed(4);
  return {
    topic: 'corr',
    prompt: `For n = ${n} paired observations with no tied ranks and Σd² = ${st.sumD2}, calculate Spearman’s rank correlation coefficient rₛ.`,
    options: uniqueOptions(ans, [wrongNoSix, wrongPlus, wrongSign]),
    answer: ans,
    figure: {
      kind: 'table',
      head: ['Rank x', 'Rank y', 'd', 'd²'],
      rows: xs.map((x, i) => [x, ys[i], x - ys[i], (x - ys[i]) ** 2]),
    },
    working: [
      `rₛ = 1 − 6Σd² / (n(n² − 1))`,
      `rₛ = 1 − (6 × ${st.sumD2}) / (${n} × ${n * n - 1}) = ${ans}`,
    ],
    why: 'Remember the factor 6 in 1 − 6Σd² / (n(n² − 1)).',
  };
}

function genData(): Question {
  const variant = Math.random();
  if (variant < 0.6) {
    const base = [14, 17, 19, 20, 22, 24, 25, 27, 29, 31];
    const extra = Math.random() < 0.5 ? 52 : 2;
    const nums = [...base, extra].sort((a, b) => a - b);
    const st = boxPlotStats(nums, 'iqr', 1.5);
    const askUpper = extra > 30;
    const fence = askUpper ? st.highFence : st.lowFence;
    const ans = fmt(fence, 2);
    return {
      topic: 'data',
      prompt: `For the ordered dataset ${nums.join(', ')}, an outlier is defined beyond Q₁ − 1.5×IQR or Q₃ + 1.5×IQR. Find the ${askUpper ? 'upper' : 'lower'} outlier fence.`,
      options: uniqueOptions(ans, [
        fmt(askUpper ? st.q3 + st.iqr : st.q1 - st.iqr, 2),
        fmt(askUpper ? st.lowFence : st.highFence, 2),
        fmt(st.iqr, 2),
      ]),
      answer: ans,
      figure: {
        kind: 'box',
        sorted: st.sorted,
        q1: st.q1,
        q2: st.q2,
        q3: st.q3,
        lowFence: st.lowFence,
        highFence: st.highFence,
      },
      working: [
        st.q1Detail,
        st.q3Detail,
        `IQR = Q₃ − Q₁ = ${st.q3} − ${st.q1} = ${st.iqr}`,
        askUpper
          ? `Upper fence = Q₃ + 1.5×IQR = ${st.q3} + ${1.5 * st.iqr} = ${ans}`
          : `Lower fence = Q₁ − 1.5×IQR = ${st.q1} − ${1.5 * st.iqr} = ${ans}`,
      ],
      why: 'With n = 11, n/4 = 2.75 → 3rd value for Q₁, and 3n/4 = 8.25 → 9th value for Q₃.',
    };
  }

  // Linear coding for mean & sd
  const meanX = pick([42, 65, 80]);
  const sdX = pick([6, 12, 15]);
  const a = pick([20, 30, 50]);
  const b = pick([2, 3, 5]);
  const meanY = (meanX - a) / b;
  const sdY = sdX / b;
  const ans = `ȳ = ${meanY.toFixed(1)}, σ_y = ${sdY.toFixed(1)}`;
  return {
    topic: 'data',
    prompt: `Data x has mean x̄ = ${meanX} and s.d. σₓ = ${sdX}. Using the coding y = (x − ${a}) / ${b}, find ȳ and σ_y.`,
    options: uniqueOptions(ans, [
      `ȳ = ${meanY.toFixed(1)}, σ_y = ${(sdY - a / b).toFixed(1)}`,
      `ȳ = ${(meanX / b).toFixed(1)}, σ_y = ${sdY.toFixed(1)}`,
      `ȳ = ${meanY.toFixed(1)}, σ_y = ${sdX.toFixed(1)}`,
    ]),
    answer: ans,
    working: [
      `Location shifts and scales: ȳ = (${meanX} − ${a}) / ${b} = ${meanY.toFixed(1)}`,
      `Standard deviation ignores shift −${a} and divides only by |${b}|: σ_y = ${sdX} / ${b} = ${sdY.toFixed(1)}`,
    ],
    why: 'Adding or subtracting a constant shifts the mean but never changes standard deviation or IQR.',
  };
}

function genProbS3(): Question {
  const variant = Math.random();
  if (variant < 0.36) {
    // Venn conditional probability
    const onlyA = pick([0.2, 0.25, 0.3]);
    const both = pick([0.1, 0.15, 0.2]);
    const onlyB = pick([0.25, 0.3, 0.35]);
    const v = venn2Stats(onlyA, both, onlyB);
    const ans = dp4(v.pAgivenB);
    return {
      topic: 'prob_s3',
      prompt: `Given P(A only) = ${onlyA}, P(A ∩ B) = ${both}, and P(B only) = ${onlyB}, find P(A | B) to 4 d.p.`,
      options: uniqueOptions(ans, [dp4(v.pBgivenA), dp4(v.both), dp4(v.pUnion)]),
      answer: ans,
      figure: { kind: 'venn', onlyA, both, onlyB, neither: v.neither },
      working: [
        `P(B) = P(A ∩ B) + P(B only) = ${both} + ${onlyB} = ${v.pB.toFixed(2)}`,
        `P(A | B) = P(A ∩ B) / P(B) = ${both} / ${v.pB.toFixed(2)} = ${ans}`,
      ],
      why: 'Conditional probability restricts the sample space to B, dividing P(A ∩ B) by P(B).',
    };
  }

  if (variant < 0.68) {
    // Tree / Bayes
    const pA = pick([0.2, 0.3, 0.4]);
    const pBA = pick([0.8, 0.9]);
    const pBnA = pick([0.1, 0.2]);
    const tr = tree2Stats(pA, pBA, pBnA);
    const ans = dp4(tr.pAgivenB);
    return {
      topic: 'prob_s3',
      prompt: `In a factory, machine A produces ${pA * 100}% of items with ${pBA * 100}% passing inspection, while machine B produces the rest with ${pBnA * 100}% passing. Given an item passes inspection, find the probability it came from machine A (to 4 d.p.).`,
      options: uniqueOptions(ans, [dp4(tr.pAB), dp4(tr.pB), dp4(pBA)]),
      answer: ans,
      working: [
        `P(Pass) = (${pA} × ${pBA}) + (${(1 - pA).toFixed(1)} × ${pBnA}) = ${dp4(tr.pB)}`,
        `P(A | Pass) = P(A ∩ Pass) / P(Pass) = ${dp4(tr.pAB)} / ${dp4(tr.pB)} = ${ans}`,
      ],
      why: 'Bayes’ theorem divides the single branch A ∩ Pass by the total probability of Pass across all branches.',
    };
  }

  if (variant < 0.84) {
    // χ² GoF pooling & df
    const rawClasses = pick([6, 7]);
    const pooledClasses = rawClasses - pick([1, 2]);
    const est = pick([0, 1] as const);
    const df = pooledClasses - 1 - est;
    const ans = String(df);
    return {
      topic: 'prob_s3',
      prompt: `A χ² goodness-of-fit test fits a ${est === 1 ? 'Poisson distribution (with λ estimated from the sample)' : 'given discrete model (no estimated parameters)'} across ${rawClasses} classes. After pooling classes with expected frequency < 5, ${pooledClasses} classes remain. State the degrees of freedom ν.`,
      options: uniqueOptions(ans, [String(df + 1), String(rawClasses - 1 - est), String(Math.max(1, df - 1))]),
      answer: ans,
      working: [
        `Always count classes AFTER pooling classes with Eᵢ < 5: k = ${pooledClasses}`,
        `ν = k − 1 − m = ${pooledClasses} − 1 − ${est} = ${ans}`,
      ],
      why: 'Subtract 1 for the constraint ΣOᵢ = ΣEᵢ, plus 1 for each parameter estimated from the sample data.',
    };
  }

  // CLT standard error
  const sigma = pick([6, 8, 12, 15]);
  const n = pick([16, 25, 36, 100]);
  const se = sigma / Math.sqrt(n);
  const ans = se.toFixed(2);
  return {
    topic: 'prob_s3',
    prompt: `A population has mean μ and standard deviation σ = ${sigma}. Samples of size n = ${n} are taken. Find the standard error of the sample mean X̄.`,
    options: uniqueOptions(ans, [(sigma / n).toFixed(2), (sigma * sigma / n).toFixed(2), sigma.toFixed(2)]),
    answer: ans,
    working: [
      `Var(X̄) = σ² / n → Standard error = σ / √n`,
      `SE = ${sigma} / √${n} = ${sigma} / ${Math.sqrt(n)} = ${ans}`,
    ],
    why: 'Divide population standard deviation by √n (not n, and do not forget the square root!).',
  };
}

const GEN: Record<Topic, () => Question> = {
  normal: genNormal,
  discrete: genDiscrete,
  approx: genApprox,
  tests: genTests,
  corr: genCorr,
  data: genData,
  prob_s3: genProbS3,
};

const ALL_TOPICS = Object.keys(GEN) as Topic[];

export function newQuestion(topic: Topic | 'all'): Question {
  const chosen = topic === 'all' ? pick(ALL_TOPICS) : topic;
  return GEN[chosen]();
}
