<script lang="ts" module>
  import type { ApproxKind, DistKind, QueryKind } from './math';

  export interface DistPrefs {
    dist: DistKind;
    mu: number;
    sigma: number;
    x1: number;
    x2: number;
    invP: number;
    invTail: 'left' | 'right' | 'center';
    n: number;
    p: number;
    k1: number;
    k2: number;
    lambda: number;
    pk1: number;
    pk2: number;
    ua: number;
    ub: number;
    ux1: number;
    ux2: number;
    query: QueryKind;
    approx: ApproxKind;
  }

  export const DIST_PREFS: DistPrefs = {
    dist: 'normal',
    mu: 50,
    sigma: 8,
    x1: 42,
    x2: 58,
    invP: 0.05,
    invTail: 'right',
    n: 20,
    p: 0.35,
    k1: 6,
    k2: 11,
    lambda: 6,
    pk1: 4,
    pk2: 9,
    ua: 2,
    ub: 10,
    ux1: 3.5,
    ux2: 7.5,
    query: 'le',
    approx: 'none',
  };
</script>

<script lang="ts">
  import Seg from '../../components/ui/Seg.svelte';
  import TopicLinks from './TopicLinks.svelte';
  import {
    phi, dp4, fmt, fmtTrim, normalPdf, invPhi, normalPercentPointMatch,
    binomPmf, binomCdfSafe, poissonPmf, poissonCdfSafe, evalApprox,
    type ApproxReport,
  } from './math';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: DistPrefs;
    hidden?: boolean;
    stats?: [string, string | number][];
  } = $props();

  const DIST_OPTS = [
    ['normal', 'Normal', 'N'],
    ['binomial', 'Binomial', 'B'],
    ['poisson', 'Poisson', 'Po'],
    ['uniform', 'Uniform', 'U'],
  ] as const;

  const PRESETS = [
    { id: 'z', label: 'Z ~ N(0, 1)', apply: () => { Object.assign(prefs, { dist: 'normal', mu: 0, sigma: 1, query: 'le', x1: 1.65, x2: 1.96, approx: 'none' }); } },
    { id: 's1n', label: 'N(50, 8²)', apply: () => { Object.assign(prefs, { dist: 'normal', mu: 50, sigma: 8, query: 'between', x1: 42, x2: 60, approx: 'none' }); } },
    { id: 'b_po', label: 'B(60, 0.05) → Po', apply: () => { Object.assign(prefs, { dist: 'binomial', n: 60, p: 0.05, query: 'le', k1: 4, approx: 'poisson' }); } },
    { id: 'b_n', label: 'B(40, 0.45) → N', apply: () => { Object.assign(prefs, { dist: 'binomial', n: 40, p: 0.45, query: 'ge', k1: 20, approx: 'normal' }); } },
    { id: 'po_n', label: 'Po(15) → N', apply: () => { Object.assign(prefs, { dist: 'poisson', lambda: 15, query: 'le', pk1: 18, approx: 'normal' }); } },
    { id: 'uni', label: 'U(2, 10)', apply: () => { Object.assign(prefs, { dist: 'uniform', ua: 2, ub: 10, query: 'between', ux1: 3.5, ux2: 7.5, approx: 'none' }); } },
  ];

  // Ensure invalid query/approx combinations auto-correct smoothly when switching distributions
  $effect(() => {
    if (prefs.dist === 'normal' || prefs.dist === 'uniform') {
      if (prefs.approx !== 'none') prefs.approx = 'none';
      if (prefs.query === 'eq') prefs.query = 'le';
      if (prefs.dist === 'uniform' && prefs.query === 'inv') prefs.query = 'between';
    } else {
      if (prefs.query === 'inv') prefs.query = 'le';
      if (prefs.dist === 'poisson' && prefs.approx === 'poisson') prefs.approx = 'none';
    }
  });

  const queryOpts = $derived.by(() => {
    if (prefs.dist === 'normal') {
      return [
        ['le', 'P(X ≤ a)'],
        ['ge', 'P(X ≥ a)'],
        ['between', 'P(a ≤ X ≤ b)'],
        ['inv', 'Inverse'],
      ] as const;
    }
    if (prefs.dist === 'uniform') {
      return [
        ['le', 'P(X ≤ a)'],
        ['ge', 'P(X ≥ a)'],
        ['between', 'P(a ≤ X ≤ b)'],
      ] as const;
    }
    return [
      ['le', 'P(X ≤ a)'],
      ['ge', 'P(X ≥ a)'],
      ['between', 'P(a ≤ X ≤ b)'],
      ['eq', 'P(X = a)'],
    ] as const;
  });

  // Mean, variance, sd
  const summary = $derived.by(() => {
    if (prefs.dist === 'normal') {
      const sd = Math.max(0.05, prefs.sigma);
      return { mean: prefs.mu, variance: sd * sd, sd, notation: `N(${fmtTrim(prefs.mu, 2)}, ${fmtTrim(sd, 2)}²)` };
    }
    if (prefs.dist === 'binomial') {
      const n = Math.max(1, Math.round(prefs.n));
      const p = Math.min(1, Math.max(0, prefs.p));
      const v = n * p * (1 - p);
      return { mean: n * p, variance: v, sd: Math.sqrt(v), notation: `B(${n}, ${fmtTrim(p, 3)})` };
    }
    if (prefs.dist === 'poisson') {
      const lam = Math.max(0.1, prefs.lambda);
      return { mean: lam, variance: lam, sd: Math.sqrt(lam), notation: `Po(${fmtTrim(lam, 2)})` };
    }
    const a = Math.min(prefs.ua, prefs.ub - 0.5);
    const b = Math.max(a + 0.5, prefs.ub);
    const v = ((b - a) ** 2) / 12;
    return { mean: 0.5 * (a + b), variance: v, sd: Math.sqrt(v), notation: `U(${fmtTrim(a, 2)}, ${fmtTrim(b, 2)})` };
  });

  // Main probability + working calculation
  const calc = $derived.by(() => {
    if (prefs.dist === 'normal') {
      const mu = prefs.mu;
      const sd = Math.max(0.05, prefs.sigma);
      if (prefs.query === 'inv') {
        const target = Math.min(0.9999, Math.max(0.0001, prefs.invP));
        let lo = mu, hi = mu, z1 = 0, z2 = 0, expr = '', zLine = '';
        if (prefs.invTail === 'left') {
          z1 = invPhi(target);
          lo = -Infinity;
          hi = mu + z1 * sd;
          expr = `P(X ≤ ${fmt(hi, 3)}) = ${fmtTrim(target, 4)}`;
          zLine = `Φ(z) = ${fmtTrim(target, 4)} → z = ${fmt(z1, 4)} → x = μ + zσ = ${fmt(hi, 4)}`;
        } else if (prefs.invTail === 'right') {
          z1 = invPhi(1 - target);
          lo = mu + z1 * sd;
          hi = Infinity;
          const tbl = normalPercentPointMatch(target);
          expr = `P(X ≥ ${fmt(lo, 3)}) = ${fmtTrim(target, 4)}`;
          zLine = `P(Z > z) = ${fmtTrim(target, 4)} → z = ${fmt(z1, 4)}${tbl ? ` (booklet: ${tbl.z})` : ''} → x = ${fmt(lo, 4)}`;
        } else {
          z2 = invPhi(0.5 + target / 2);
          z1 = -z2;
          lo = mu + z1 * sd;
          hi = mu + z2 * sd;
          expr = `P(${fmt(lo, 3)} ≤ X ≤ ${fmt(hi, 3)}) = ${fmtTrim(target, 4)}`;
          zLine = `P(|Z| ≤ ${fmt(z2, 4)}) = ${fmtTrim(target, 4)} → x = ${fmtTrim(mu, 2)} ± ${fmt(z2 * sd, 4)}`;
        }
        return { prob: target, lo, hi, expr, lines: [zLine], invZ: z1 };
      }

      const xLo = Math.min(prefs.x1, prefs.x2);
      const xHi = Math.max(prefs.x1, prefs.x2);
      if (prefs.query === 'le') {
        const z = (prefs.x1 - mu) / sd;
        const p = phi(z);
        return {
          prob: p, lo: -Infinity, hi: prefs.x1,
          expr: `P(X ≤ ${fmtTrim(prefs.x1, 3)})`,
          lines: [`Z = (${fmtTrim(prefs.x1, 3)} − ${fmtTrim(mu, 2)}) / ${fmtTrim(sd, 2)} = ${fmt(z, 4)}`, `Φ(${fmt(z, 2)}) = ${dp4(p)}`],
        };
      }
      if (prefs.query === 'ge') {
        const z = (prefs.x1 - mu) / sd;
        const p = 1 - phi(z);
        return {
          prob: p, lo: prefs.x1, hi: Infinity,
          expr: `P(X ≥ ${fmtTrim(prefs.x1, 3)})`,
          lines: [`Z = (${fmtTrim(prefs.x1, 3)} − ${fmtTrim(mu, 2)}) / ${fmtTrim(sd, 2)} = ${fmt(z, 4)}`, `1 − Φ(${fmt(z, 2)}) = 1 − ${dp4(phi(z))} = ${dp4(p)}`],
        };
      }
      const z1 = (xLo - mu) / sd;
      const z2 = (xHi - mu) / sd;
      const p = phi(z2) - phi(z1);
      return {
        prob: p, lo: xLo, hi: xHi,
        expr: `P(${fmtTrim(xLo, 3)} ≤ X ≤ ${fmtTrim(xHi, 3)})`,
        lines: [
          `Z₁ = ${fmt(z1, 4)}, Z₂ = ${fmt(z2, 4)}`,
          `Φ(${fmt(z2, 2)}) − Φ(${fmt(z1, 2)}) = ${dp4(phi(z2))} − ${dp4(phi(z1))} = ${dp4(p)}`,
        ],
      };
    }

    if (prefs.dist === 'uniform') {
      const a = Math.min(prefs.ua, prefs.ub - 0.5);
      const b = Math.max(a + 0.5, prefs.ub);
      const w = b - a;
      const u1 = Math.max(a, Math.min(b, prefs.ux1));
      const uLo = Math.max(a, Math.min(b, Math.min(prefs.ux1, prefs.ux2)));
      const uHi = Math.max(a, Math.min(b, Math.max(prefs.ux1, prefs.ux2)));
      if (prefs.query === 'le') {
        const p = (u1 - a) / w;
        return {
          prob: p, lo: a, hi: u1,
          expr: `P(X ≤ ${fmtTrim(prefs.ux1, 2)})`,
          lines: [`f(x) = 1 / (${fmtTrim(b, 2)} − ${fmtTrim(a, 2)}) = 1 / ${fmtTrim(w, 2)}`, `P = (${fmtTrim(u1, 2)} − ${fmtTrim(a, 2)}) / ${fmtTrim(w, 2)} = ${dp4(p)}`],
        };
      }
      if (prefs.query === 'ge') {
        const p = (b - u1) / w;
        return {
          prob: p, lo: u1, hi: b,
          expr: `P(X ≥ ${fmtTrim(prefs.ux1, 2)})`,
          lines: [`f(x) = 1 / ${fmtTrim(w, 2)}`, `P = (${fmtTrim(b, 2)} − ${fmtTrim(u1, 2)}) / ${fmtTrim(w, 2)} = ${dp4(p)}`],
        };
      }
      const p = (uHi - uLo) / w;
      return {
        prob: p, lo: uLo, hi: uHi,
        expr: `P(${fmtTrim(uLo, 2)} ≤ X ≤ ${fmtTrim(uHi, 2)})`,
        lines: [`Width = ${fmtTrim(uHi, 2)} − ${fmtTrim(uLo, 2)} = ${fmtTrim(uHi - uLo, 2)}`, `P = ${fmtTrim(uHi - uLo, 2)} / ${fmtTrim(w, 2)} = ${dp4(p)}`],
      };
    }

    // Binomial or Poisson
    const isBinom = prefs.dist === 'binomial';
    const n = Math.max(1, Math.round(prefs.n));
    const p = Math.min(1, Math.max(0, prefs.p));
    const lam = Math.max(0.1, prefs.lambda);
    const kRaw1 = isBinom ? Math.round(prefs.k1) : Math.round(prefs.pk1);
    const kRaw2 = isBinom ? Math.round(prefs.k2) : Math.round(prefs.pk2);
    const k1 = isBinom ? Math.max(0, Math.min(n, kRaw1)) : Math.max(0, kRaw1);
    const k2 = isBinom ? Math.max(k1, Math.min(n, kRaw2)) : Math.max(k1, kRaw2);
    const kLo = Math.min(kRaw1, kRaw2);
    const kHi = Math.max(kRaw1, kRaw2);
    const cdf = (k: number) => (isBinom ? binomCdfSafe(n, p, k) : poissonCdfSafe(lam, k));
    const pmf = (k: number) => (isBinom ? binomPmf(n, p, k) : poissonPmf(lam, k));

    if (prefs.query === 'le') {
      const prob = cdf(k1);
      return {
        prob, lo: 0, hi: k1,
        expr: `P(X ≤ ${k1})`,
        lines: [`From CDF table / sum₀^${k1} P(X = k) = ${dp4(prob)}`],
      };
    }
    if (prefs.query === 'ge') {
      const prev = k1 > 0 ? cdf(k1 - 1) : 0;
      const prob = 1 - prev;
      return {
        prob, lo: k1, hi: Infinity,
        expr: `P(X ≥ ${k1})`,
        lines: [k1 > 0 ? `P(X ≥ ${k1}) = 1 − P(X ≤ ${k1 - 1}) = 1 − ${dp4(prev)} = ${dp4(prob)}` : `P(X ≥ 0) = 1.0000`],
      };
    }
    if (prefs.query === 'between') {
      const cLo = Math.max(0, isBinom ? Math.min(n, kLo) : kLo);
      const cHi = isBinom ? Math.max(cLo, Math.min(n, kHi)) : Math.max(cLo, kHi);
      const prev = cLo > 0 ? cdf(cLo - 1) : 0;
      const top = cdf(cHi);
      const prob = Math.max(0, top - prev);
      return {
        prob, lo: cLo, hi: cHi,
        expr: `P(${cLo} ≤ X ≤ ${cHi})`,
        lines: [cLo > 0 ? `P(X ≤ ${cHi}) − P(X ≤ ${cLo - 1}) = ${dp4(top)} − ${dp4(prev)} = ${dp4(prob)}` : `P(X ≤ ${cHi}) = ${dp4(prob)}`],
      };
    }
    // exact = k1
    const prob = pmf(k1);
    const le = cdf(k1);
    const lePrev = k1 > 0 ? cdf(k1 - 1) : 0;
    return {
      prob, lo: k1, hi: k1,
      expr: `P(X = ${k1})`,
      lines: [
        isBinom
          ? `(${n} C ${k1}) · ${fmtTrim(p, 3)}^${k1} · ${fmtTrim(1 - p, 3)}^${n - k1} = ${dp4(prob)}`
          : `e^(−${fmtTrim(lam, 2)}) · ${fmtTrim(lam, 2)}^${k1} / ${k1}! = ${dp4(prob)}`,
        `Or via CDF: P(X ≤ ${k1}) − P(X ≤ ${k1 - 1}) = ${dp4(le)} − ${dp4(lePrev)}`,
      ],
    };
  });

  const approxReport = $derived.by<ApproxReport | null>(() => {
    if ((prefs.dist !== 'binomial' && prefs.dist !== 'poisson') || prefs.approx === 'none' || prefs.query === 'inv') {
      return null;
    }
    const a = prefs.dist === 'binomial' ? prefs.k1 : prefs.pk1;
    const b = prefs.dist === 'binomial' ? prefs.k2 : prefs.pk2;
    const lo = prefs.query === 'between' ? Math.min(a, b) : a;
    const hi = prefs.query === 'between' ? Math.max(a, b) : a;
    return evalApprox(
      prefs.dist,
      { n: prefs.n, p: prefs.p, lambda: prefs.lambda },
      prefs.query,
      lo,
      hi,
      prefs.approx,
      calc.prob,
    );
  });

  // Update StatusLine stats
  $effect(() => {
    stats = [
      ['Model', summary.notation],
      [calc.expr, dp4(calc.prob)],
      ['μ = E(X)', fmt(summary.mean, 3)],
      ['σ', fmt(summary.sd, 3)],
    ];
  });

  /* ---------- SVG Plot Geometry ---------- */
  const W = 680;
  const H = 315;
  const PAD = { l: 46, r: 24, t: 22, b: 42 };
  const PW = W - PAD.l - PAD.r;
  const PH = H - PAD.t - PAD.b;

  const plotDomain = $derived.by<[number, number]>(() => {
    if (prefs.dist === 'normal') {
      const sd = Math.max(0.05, prefs.sigma);
      return [prefs.mu - 3.8 * sd, prefs.mu + 3.8 * sd];
    }
    if (prefs.dist === 'uniform') {
      const a = Math.min(prefs.ua, prefs.ub - 0.5);
      const b = Math.max(a + 0.5, prefs.ub);
      const pad = Math.max(1, (b - a) * 0.25);
      return [a - pad, b + pad];
    }
    if (prefs.dist === 'binomial') {
      const n = Math.max(1, Math.round(prefs.n));
      if (n <= 32) return [-0.6, n + 0.6];
      const lo = Math.max(0, Math.floor(summary.mean - 4.2 * summary.sd));
      const hi = Math.min(n, Math.ceil(summary.mean + 4.2 * summary.sd));
      return [lo - 0.6, hi + 0.6];
    }
    const lo = Math.max(0, Math.floor(summary.mean - 4.2 * summary.sd));
    const hi = Math.max(12, Math.ceil(summary.mean + 4.4 * summary.sd));
    return [lo - 0.6, hi + 0.6];
  });

  const sx = (x: number) => {
    const [xmin, xmax] = plotDomain;
    return PAD.l + ((x - xmin) / Math.max(1e-9, xmax - xmin)) * PW;
  };
  const invSx = (px: number) => {
    const [xmin, xmax] = plotDomain;
    return xmin + ((px - PAD.l) / PW) * (xmax - xmin);
  };

  const discreteBars = $derived.by(() => {
    if (prefs.dist !== 'binomial' && prefs.dist !== 'poisson') return [];
    const [xmin, xmax] = plotDomain;
    const kMin = Math.max(0, Math.ceil(xmin - 0.1));
    const kMax = Math.floor(xmax + 0.1);
    const items: { k: number; p: number; approxP: number; inSet: boolean }[] = [];
    for (let k = kMin; k <= kMax; k++) {
      const pVal = prefs.dist === 'binomial' ? binomPmf(prefs.n, prefs.p, k) : poissonPmf(prefs.lambda, k);
      const approxP = prefs.dist === 'binomial' && prefs.approx === 'poisson'
        ? poissonPmf(prefs.n * prefs.p, k)
        : 0;
      const inSet = k >= calc.lo && k <= calc.hi;
      items.push({ k, p: pVal, approxP, inSet });
    }
    return items;
  });

  const maxY = $derived.by(() => {
    if (prefs.dist === 'normal') {
      return Math.max(1e-6, normalPdf(prefs.mu, prefs.mu, Math.max(0.05, prefs.sigma)) * 1.12);
    }
    if (prefs.dist === 'uniform') {
      const a = Math.min(prefs.ua, prefs.ub - 0.5);
      const b = Math.max(a + 0.5, prefs.ub);
      return (1 / (b - a)) * 1.25;
    }
    let m = 0.02;
    for (const bar of discreteBars) m = Math.max(m, bar.p, bar.approxP);
    if (prefs.approx === 'normal') {
      m = Math.max(m, normalPdf(summary.mean, summary.mean, Math.max(0.2, summary.sd)));
    }
    return m * 1.14;
  });

  const sy = (y: number) => PAD.t + PH - (y / Math.max(1e-9, maxY)) * PH;

  // Continuous curve paths
  const curvePath = $derived.by(() => {
    const [xmin, xmax] = plotDomain;
    if (prefs.dist === 'normal') {
      const sd = Math.max(0.05, prefs.sigma);
      const pts: string[] = [];
      for (let i = 0; i <= 140; i++) {
        const x = xmin + ((xmax - xmin) * i) / 140;
        pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(normalPdf(x, prefs.mu, sd)).toFixed(1)}`);
      }
      return pts.join(' ');
    }
    if (prefs.dist === 'uniform') {
      const a = Math.min(prefs.ua, prefs.ub - 0.5);
      const b = Math.max(a + 0.5, prefs.ub);
      const h = 1 / (b - a);
      return `M${sx(xmin).toFixed(1)},${sy(0).toFixed(1)} L${sx(a).toFixed(1)},${sy(0).toFixed(1)} L${sx(a).toFixed(1)},${sy(h).toFixed(1)} L${sx(b).toFixed(1)},${sy(h).toFixed(1)} L${sx(b).toFixed(1)},${sy(0).toFixed(1)} L${sx(xmax).toFixed(1)},${sy(0).toFixed(1)}`;
    }
    return '';
  });

  const shadedAreaPath = $derived.by(() => {
    const [xmin, xmax] = plotDomain;
    if (prefs.dist === 'normal') {
      const sd = Math.max(0.05, prefs.sigma);
      const a = Math.max(xmin, calc.lo);
      const b = Math.min(xmax, calc.hi);
      if (b <= a) return '';
      const pts: string[] = [`M${sx(a).toFixed(1)},${sy(0).toFixed(1)}`];
      for (let i = 0; i <= 90; i++) {
        const x = a + ((b - a) * i) / 90;
        pts.push(`L${sx(x).toFixed(1)},${sy(normalPdf(x, prefs.mu, sd)).toFixed(1)}`);
      }
      pts.push(`L${sx(b).toFixed(1)},${sy(0).toFixed(1)} Z`);
      return pts.join(' ');
    }
    if (prefs.dist === 'uniform') {
      const ua = Math.min(prefs.ua, prefs.ub - 0.5);
      const ub = Math.max(ua + 0.5, prefs.ub);
      const h = 1 / (ub - ua);
      const a = Math.max(ua, calc.lo);
      const b = Math.min(ub, calc.hi);
      if (b <= a) return '';
      return `M${sx(a).toFixed(1)},${sy(0).toFixed(1)} L${sx(a).toFixed(1)},${sy(h).toFixed(1)} L${sx(b).toFixed(1)},${sy(h).toFixed(1)} L${sx(b).toFixed(1)},${sy(0).toFixed(1)} Z`;
    }
    return '';
  });

  const approxCurvePath = $derived.by(() => {
    if ((prefs.dist !== 'binomial' && prefs.dist !== 'poisson') || prefs.approx !== 'normal') return '';
    const [xmin, xmax] = plotDomain;
    const sd = Math.max(0.1, summary.sd);
    const pts: string[] = [];
    for (let i = 0; i <= 140; i++) {
      const x = xmin + ((xmax - xmin) * i) / 140;
      pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(normalPdf(x, summary.mean, sd)).toFixed(1)}`);
    }
    return pts.join(' ');
  });

  // Continuity correction shaded normal area (translucent --amph)
  const approxShadedPath = $derived.by(() => {
    if ((prefs.dist !== 'binomial' && prefs.dist !== 'poisson') || prefs.approx !== 'normal' || prefs.query === 'inv') return '';
    const [xmin, xmax] = plotDomain;
    const sd = Math.max(0.1, summary.sd);
    const kLo = calc.lo;
    const kHi = calc.hi;
    const lo = prefs.query === 'le' ? xmin : kLo - 0.5;
    const hi = prefs.query === 'ge' ? xmax : kHi + 0.5;
    const a = Math.max(xmin, lo);
    const b = Math.min(xmax, hi);
    if (b <= a) return '';
    const pts: string[] = [`M${sx(a).toFixed(1)},${sy(0).toFixed(1)}`];
    for (let i = 0; i <= 80; i++) {
      const x = a + ((b - a) * i) / 80;
      pts.push(`L${sx(x).toFixed(1)},${sy(normalPdf(x, summary.mean, sd)).toFixed(1)}`);
    }
    pts.push(`L${sx(b).toFixed(1)},${sy(0).toFixed(1)} Z`);
    return pts.join(' ');
  });

  const xTicks = $derived.by(() => {
    const [xmin, xmax] = plotDomain;
    if (prefs.dist === 'binomial' || prefs.dist === 'poisson') {
      const kMin = Math.max(0, Math.ceil(xmin));
      const kMax = Math.floor(xmax);
      const count = kMax - kMin + 1;
      const step = count > 26 ? Math.ceil(count / 12) : count > 14 ? 2 : 1;
      const out: number[] = [];
      for (let k = kMin; k <= kMax; k++) {
        if ((k - kMin) % step === 0) out.push(k);
      }
      return out;
    }
    const span = xmax - xmin;
    const rawStep = span / 7;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const nice = [1, 2, 2.5, 5, 10].find((f) => f * mag >= rawStep)! * mag;
    const start = Math.ceil(xmin / nice) * nice;
    const out: number[] = [];
    for (let v = start; v <= xmax + 1e-9; v += nice) out.push(+v.toFixed(4));
    return out;
  });

  /* ---------- Interactive SVG Boundary Dragging / Bar Clicking ---------- */
  let svgEl = $state<SVGSVGElement>();
  let draggingHandle = $state<'lo' | 'hi' | null>(null);

  function svgX(e: PointerEvent): number {
    if (!svgEl) return 0;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return 0;
    const local = pt.matrixTransform(ctm.inverse());
    return invSx(local.x);
  }

  function startDrag(which: 'lo' | 'hi', e: PointerEvent) {
    if (prefs.query === 'inv' || (prefs.dist !== 'normal' && prefs.dist !== 'uniform')) return;
    draggingHandle = which;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function moveDrag(e: PointerEvent) {
    if (!draggingHandle) return;
    const [xmin, xmax] = plotDomain;
    const x = Math.max(xmin, Math.min(xmax, +svgX(e).toFixed(2)));
    if (prefs.dist === 'normal') {
      if (prefs.query === 'between') {
        if (draggingHandle === 'lo') prefs.x1 = Math.min(x, prefs.x2);
        else prefs.x2 = Math.max(x, prefs.x1);
      } else {
        prefs.x1 = x;
      }
    } else if (prefs.dist === 'uniform') {
      const ua = Math.min(prefs.ua, prefs.ub - 0.5);
      const ub = Math.max(ua + 0.5, prefs.ub);
      const clamped = Math.max(ua, Math.min(ub, x));
      if (prefs.query === 'between') {
        if (draggingHandle === 'lo') prefs.ux1 = Math.min(clamped, prefs.ux2);
        else prefs.ux2 = Math.max(clamped, prefs.ux1);
      } else {
        prefs.ux1 = clamped;
      }
    }
  }

  function endDrag() {
    draggingHandle = null;
  }

  function clickBar(k: number) {
    if (prefs.dist === 'binomial') {
      if (prefs.query === 'between') {
        const d1 = Math.abs(k - prefs.k1);
        const d2 = Math.abs(k - prefs.k2);
        if (d1 <= d2) prefs.k1 = Math.min(k, prefs.k2);
        else prefs.k2 = Math.max(k, prefs.k1);
      } else {
        prefs.k1 = k;
      }
    } else if (prefs.dist === 'poisson') {
      if (prefs.query === 'between') {
        const d1 = Math.abs(k - prefs.pk1);
        const d2 = Math.abs(k - prefs.pk2);
        if (d1 <= d2) prefs.pk1 = Math.min(k, prefs.pk2);
        else prefs.pk2 = Math.max(k, prefs.pk1);
      } else {
        prefs.pk1 = k;
      }
    }
  }
</script>

<main class="layout st-two" hidden={off}>
  <section class="panel stage" aria-label="Distribution visualiser">
    <div class="stage-head">
      <div class="label-chip">
        {summary.notation}
        <small>{prefs.dist === 'normal' || prefs.dist === 'uniform' ? 'Continuous' : 'Discrete'}</small>
      </div>
      <div class="stage-tools">
        <Seg label="Distribution" options={DIST_OPTS} bind:value={prefs.dist} />
      </div>
    </div>

    <div class="st-presets">
      <small>Presets</small>
      {#each PRESETS as pr (pr.id)}
        <button type="button" class="chip" onclick={pr.apply}>{pr.label}</button>
      {/each}
    </div>

    <div class="st-board">
      <svg
        bind:this={svgEl}
        class="st-svg"
        viewBox="0 0 {W} {H}"
        onpointermove={moveDrag}
        onpointerup={endDrag}
        onpointercancel={endDrag}
        role="img"
        aria-label="Probability distribution plot"
      >
        <!-- baseline grid -->
        {#each [0.25, 0.5, 0.75, 1] as f (f)}
          {@const gy = PAD.t + PH * (1 - f)}
          <line class="grid" x1={PAD.l} y1={gy} x2={W - PAD.r} y2={gy} />
        {/each}

        <!-- Continuous curves & shaded areas -->
        {#if prefs.dist === 'normal' || prefs.dist === 'uniform'}
          {#if shadedAreaPath}
            <path class="area" d={shadedAreaPath} />
          {/if}
          <path class="curve" d={curvePath} />

          <!-- Mean line -->
          <line class="mean-line" x1={sx(summary.mean)} y1={PAD.t} x2={sx(summary.mean)} y2={H - PAD.b} />
          <text class="tick-t" x={sx(summary.mean)} y={PAD.t - 6} text-anchor="middle">μ = {fmtTrim(summary.mean, 2)}</text>

          <!-- Interactive boundary handles -->
          {#if Number.isFinite(calc.lo) && calc.lo > plotDomain[0] - 0.1 && (prefs.dist === 'normal' || calc.lo > Math.min(prefs.ua, prefs.ub - 0.5))}
            {@const hx = sx(calc.lo)}
            <g class="handle" role="slider" aria-label="Lower boundary" aria-valuenow={calc.lo} tabindex="-1" onpointerdown={(e) => startDrag('lo', e)}>
              <line class="handle-line" x1={hx} y1={PAD.t + 4} x2={hx} y2={H - PAD.b} />
              <line x1={hx} y1={PAD.t + 4} x2={hx} y2={H - PAD.b} stroke="transparent" stroke-width="14" />
              <circle cx={hx} cy={PAD.t + 10} r="6" fill="var(--accent)" stroke="var(--surf)" stroke-width="2" />
            </g>
          {/if}
          {#if Number.isFinite(calc.hi) && calc.hi < plotDomain[1] + 0.1 && (prefs.dist === 'normal' || calc.hi < Math.max(prefs.ua, prefs.ub))}
            {@const hx = sx(calc.hi)}
            <g class="handle" role="slider" aria-label="Upper boundary" aria-valuenow={calc.hi} tabindex="-1" onpointerdown={(e) => startDrag('hi', e)}>
              <line class="handle-line" x1={hx} y1={PAD.t + 4} x2={hx} y2={H - PAD.b} />
              <line x1={hx} y1={PAD.t + 4} x2={hx} y2={H - PAD.b} stroke="transparent" stroke-width="14" />
              <circle cx={hx} cy={PAD.t + 10} r="6" fill="var(--accent)" stroke="var(--surf)" stroke-width="2" />
            </g>
          {/if}
        {:else}
          <!-- Normal approximation shaded tail (under discrete bars so bars remain crisp) -->
          {#if approxShadedPath}
            <path d={approxShadedPath} fill="color-mix(in srgb, var(--amph) 22%, transparent)" stroke="none" />
          {/if}

          <!-- Discrete Binomial / Poisson bars -->
          {@const bw = Math.max(4, Math.min(34, (PW / Math.max(3, discreteBars.length)) * 0.72))}
          {#each discreteBars as bar (bar.k)}
            {@const bx = sx(bar.k) - bw / 2}
            {@const by = sy(bar.p)}
            {@const bh = Math.max(1, H - PAD.b - by)}
            <rect
              class="bar clickable"
              class:on={bar.inSet}
              x={bx}
              y={by}
              width={bw}
              height={bh}
              rx="2"
              role="button"
              tabindex="0"
              aria-label={`Select X = ${bar.k}`}
              onclick={() => clickBar(bar.k)}
              onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); clickBar(bar.k); } }}
            >
              <title>X = {bar.k}: P = {dp4(bar.p)}</title>
            </rect>
            {#if prefs.approx === 'poisson' && prefs.dist === 'binomial'}
              {@const ay = sy(bar.approxP)}
              <rect
                class="bar approx"
                x={bx + 2}
                y={ay}
                width={Math.max(2, bw - 4)}
                height={Math.max(1, H - PAD.b - ay)}
                rx="2"
                pointer-events="none"
              />
            {/if}
          {/each}

          {#if approxCurvePath}
            <path class="curve approx" d={approxCurvePath} pointer-events="none" />
          {/if}

          <line class="mean-line" x1={sx(summary.mean)} y1={PAD.t} x2={sx(summary.mean)} y2={H - PAD.b} />
          <text class="tick-t" x={sx(summary.mean)} y={PAD.t - 6} text-anchor="middle">μ = {fmtTrim(summary.mean, 2)}</text>
        {/if}

        <!-- Axes -->
        <line class="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
        <line class="axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
        {#each xTicks as t (t)}
          <line class="axis" x1={sx(t)} y1={H - PAD.b} x2={sx(t)} y2={H - PAD.b + 5} />
          <text class="tick-t" x={sx(t)} y={H - PAD.b + 18} text-anchor="middle">{fmtTrim(t, 2)}</text>
        {/each}
        <text class="ax-lab" x={W / 2} y={H - 4} text-anchor="middle">
          {prefs.dist === 'normal' || prefs.dist === 'uniform' ? 'x  (drag vertical handles to adjust)' : 'k  (click any bar to set boundary)'}
        </text>
      </svg>

      <div class="st-key">
        <span><i class="k on"></i> Shaded probability ({calc.expr} = {dp4(calc.prob)})</span>
        <span><i class="k approx"></i> Mean μ{prefs.approx !== 'none' ? ` & ${prefs.approx === 'poisson' ? 'Poisson' : 'Normal'} approx` : ''}</span>
      </div>
    </div>

    <div class="st-card" style="margin-top:12px">
      <h3>Working &amp; Key Values</h3>
      <dl class="reads" style="margin-bottom:8px">
        <div><dt>{calc.expr}</dt><dd>{dp4(calc.prob)}</dd></div>
        <div><dt>E(X) &amp; Var(X)</dt><dd>μ = {fmt(summary.mean, 2)} · σ² = {fmt(summary.variance, 2)}</dd></div>
      </dl>
      {#each calc.lines as line, i (i)}
        <div class="eq" style={i > 0 ? 'margin-top:6px' : ''}>{line}</div>
      {/each}

      {#if approxReport}
        <div class="st-verdict {approxReport.suitable ? 'keep' : 'warn'}" style="margin-top:10px">
          <span class="st-pill {approxReport.suitable ? 'ok' : 'warn'}">{approxReport.suitable ? 'Valid approx' : 'Check rule'}</span>
          <span>{approxReport.conditionNote}</span>
        </div>
        <div class="eq" style="margin-top:8px">{approxReport.ccExpression}</div>
        {#if approxReport.zWorking}
          <div class="eq" style="margin-top:6px">{approxReport.zWorking}</div>
        {/if}
        <div class="mx-wrap">
          <table class="mx">
            <thead>
              <tr><th>Method</th><th>Probability</th><th>|Error| vs exact</th></tr>
            </thead>
            <tbody>
              <tr><th>Exact ({summary.notation})</th><td>{dp4(calc.prob)}</td><td>—</td></tr>
              <tr>
                <th>{approxReport.title}{approxReport.kind === 'normal' ? ' (with CC)' : ''}</th>
                <td>{dp4(approxReport.probWithCC)}</td>
                <td>{dp4(approxReport.errWithCC)}</td>
              </tr>
              {#if approxReport.probNoCC !== undefined}
                <tr>
                  <th>Normal without CC (wrong!)</th>
                  <td class="lowexp">{dp4(approxReport.probNoCC)}</td>
                  <td class="lowexp">{dp4(approxReport.errNoCC ?? 0)}</td>
                </tr>
              {/if}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </section>

  <aside class="panel side" aria-label="Distribution controls">
    <div class="ph"><h2>Parameters &amp; Query</h2></div>
    <div class="ctls">
      <div class="ctl">
        <span class="ctl-l">Query mode</span>
        <Seg label="Probability query" options={queryOpts} bind:value={prefs.query} />
      </div>

      {#if prefs.dist === 'normal'}
        <div class="row2">
          <label class="ctl">
            <span class="ctl-l">Mean μ <b>{fmtTrim(prefs.mu, 2)}</b></span>
            <input class="inp" type="number" step="0.5" bind:value={prefs.mu} />
          </label>
          <label class="ctl">
            <span class="ctl-l">SD σ <b>{fmtTrim(prefs.sigma, 2)}</b></span>
            <input class="inp" type="number" min="0.1" step="0.5" bind:value={prefs.sigma} />
          </label>
        </div>

        {#if prefs.query === 'inv'}
          <div class="ctl">
            <span class="ctl-l">Target tail</span>
            <Seg label="Inverse tail" options={[['left', 'P(X ≤ x)'], ['right', 'P(X ≥ x)'], ['center', 'Central']] as const} bind:value={prefs.invTail} />
          </div>
          <label class="ctl">
            <span class="ctl-l">Target probability p <b>{fmtTrim(prefs.invP, 4)}</b></span>
            <input class="inp" type="number" min="0.0005" max="0.9995" step="0.005" bind:value={prefs.invP} />
          </label>
          <div class="st-presets" style="margin:0">
            <small>Booklet p</small>
            {#each [0.1, 0.05, 0.025, 0.01, 0.005] as pv (pv)}
              <button type="button" class="chip" onclick={() => (prefs.invP = pv)}>{pv}</button>
            {/each}
          </div>
        {:else if prefs.query === 'between'}
          <div class="row2">
            <label class="ctl">
              <span class="ctl-l">Lower a</span>
              <input class="inp" type="number" step="0.5" bind:value={prefs.x1} />
            </label>
            <label class="ctl">
              <span class="ctl-l">Upper b</span>
              <input class="inp" type="number" step="0.5" bind:value={prefs.x2} />
            </label>
          </div>
        {:else}
          <label class="ctl">
            <span class="ctl-l">Boundary a <b>{fmtTrim(prefs.x1, 2)}</b></span>
            <input class="inp" type="number" step="0.5" bind:value={prefs.x1} />
            <input class="slider" type="range" min={prefs.mu - 3.5 * Math.max(0.5, prefs.sigma)} max={prefs.mu + 3.5 * Math.max(0.5, prefs.sigma)} step="0.1" bind:value={prefs.x1} />
          </label>
        {/if}

      {:else if prefs.dist === 'binomial'}
        <div class="row2">
          <label class="ctl">
            <span class="ctl-l">Trials n <b>{Math.round(prefs.n)}</b></span>
            <input class="inp" type="number" min="1" max="200" step="1" bind:value={prefs.n} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Prob p <b>{fmtTrim(prefs.p, 3)}</b></span>
            <input class="inp" type="number" min="0.01" max="0.99" step="0.01" bind:value={prefs.p} />
          </label>
        </div>
        <label class="ctl">
          <span class="ctl-l">Adjust p <b>{fmtTrim(prefs.p, 2)}</b></span>
          <input class="slider" type="range" min="0.02" max="0.98" step="0.01" bind:value={prefs.p} />
        </label>
        {#if prefs.query === 'between'}
          <div class="row2">
            <label class="ctl"><span class="ctl-l">Lower a</span><input class="inp" type="number" min="0" max={Math.round(prefs.n)} step="1" bind:value={prefs.k1} /></label>
            <label class="ctl"><span class="ctl-l">Upper b</span><input class="inp" type="number" min="0" max={Math.round(prefs.n)} step="1" bind:value={prefs.k2} /></label>
          </div>
        {:else}
          <label class="ctl">
            <span class="ctl-l">Value a <b>{Math.round(prefs.k1)}</b></span>
            <input class="inp" type="number" min="0" max={Math.round(prefs.n)} step="1" bind:value={prefs.k1} />
          </label>
        {/if}
        <div class="ctl">
          <span class="ctl-l">S2 Approximation overlay</span>
          <Seg label="Binomial approximation" options={[['none', 'Off'], ['poisson', 'Poisson'], ['normal', 'Normal (±0.5)']] as const} bind:value={prefs.approx} />
        </div>

      {:else if prefs.dist === 'poisson'}
        <label class="ctl">
          <span class="ctl-l">Rate λ <b>{fmtTrim(prefs.lambda, 2)}</b></span>
          <input class="inp" type="number" min="0.2" max="100" step="0.5" bind:value={prefs.lambda} />
          <input class="slider" type="range" min="0.5" max="40" step="0.5" bind:value={prefs.lambda} />
        </label>
        {#if prefs.query === 'between'}
          <div class="row2">
            <label class="ctl"><span class="ctl-l">Lower a</span><input class="inp" type="number" min="0" step="1" bind:value={prefs.pk1} /></label>
            <label class="ctl"><span class="ctl-l">Upper b</span><input class="inp" type="number" min="0" step="1" bind:value={prefs.pk2} /></label>
          </div>
        {:else}
          <label class="ctl">
            <span class="ctl-l">Count a <b>{Math.round(prefs.pk1)}</b></span>
            <input class="inp" type="number" min="0" step="1" bind:value={prefs.pk1} />
          </label>
        {/if}
        <div class="ctl">
          <span class="ctl-l">S2 Approximation overlay</span>
          <Seg label="Poisson approximation" options={[['none', 'Off'], ['normal', 'Normal (±0.5)']] as const} bind:value={prefs.approx} />
        </div>

      {:else}
        <div class="row2">
          <label class="ctl"><span class="ctl-l">Min α</span><input class="inp" type="number" step="0.5" bind:value={prefs.ua} /></label>
          <label class="ctl"><span class="ctl-l">Max β</span><input class="inp" type="number" step="0.5" bind:value={prefs.ub} /></label>
        </div>
        {#if prefs.query === 'between'}
          <div class="row2">
            <label class="ctl"><span class="ctl-l">Lower a</span><input class="inp" type="number" step="0.5" bind:value={prefs.ux1} /></label>
            <label class="ctl"><span class="ctl-l">Upper b</span><input class="inp" type="number" step="0.5" bind:value={prefs.ux2} /></label>
          </div>
        {:else}
          <label class="ctl"><span class="ctl-l">Boundary a</span><input class="inp" type="number" step="0.5" bind:value={prefs.ux1} /></label>
        {/if}
      {/if}

      <p class="why">
        {#if prefs.dist === 'normal'}
          Standardise using Z = (X − μ)/σ, then look up Φ(z) to 4 decimal places in Pearson’s table.
        {:else if prefs.dist === 'binomial'}
          Discrete B(n, p) has mean np and variance np(1 − p). Compare exact values with S2 Poisson and Normal (±0.5 CC) approximations.
        {:else if prefs.dist === 'poisson'}
          Discrete Po(λ) has E(X) = Var(X) = λ. When λ &gt; 10, N(λ, λ) with continuity correction gives close estimates.
        {:else}
          Continuous Uniform U(α, β) has constant density 1/(β − α), mean ½(α + β) and variance (β − α)²/12.
        {/if}
      </p>
    </div>

    <TopicLinks items={[
      { id: 'S1.6.1', label: 'Normal' },
      { id: 'S2.1.1', label: 'Binomial & Poisson' },
      { id: 'S2.1.3', label: 'B → Po approx' },
      { id: 'S2.3.1', label: 'Uniform' },
      { id: 'S2.3.2', label: 'Normal approx' },
    ]} />
  </aside>
</main>
