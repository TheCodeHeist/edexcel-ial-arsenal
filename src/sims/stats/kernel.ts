/* Kernel live tools & plain-text state formatters for Stats Lab (Edexcel IAL S1–S3, WST01–WST03). */

import { provideKernelTools } from '../../lib/kernel/live';
import {
  dp4, fmt, fmtTrim, phi, invPhi, binomCdfSafe, binomPmf, poissonCdfSafe, poissonPmf,
  evalApprox, discreteHypothesisTest, normalMeanTest, buildGofModelCells,
  chi2GoodnessOfFit, chi2Contingency, regressionStats, corrCritical,
  boxPlotStats, venn2Stats, tree2Stats, parseNumList, CLT_POPS,
  type ApproxKind, type DistKind, type QueryKind, type TailKind, type CltPopId,
} from './math';
import type { DistPrefs } from './Distributions.svelte';
import type { TestPrefs } from './HypothesisTests.svelte';
import type { CorrPrefs } from './Correlation.svelte';
import type { BoxPrefs } from './BoxPlots.svelte';
import type { ProbPrefs, Venn2Query } from './Probability.svelte';
import type { CltPrefs } from './CltSampler.svelte';
import { TOPICS, type Topic } from './practice';

export type StatsMode = 'dist' | 'tests' | 'corr' | 'data' | 'prob' | 'clt' | 'practice';

export function matchStatsMode(s: string): StatsMode {
  const q = s.trim().toLowerCase().replace(/^#/, '');
  const map: Record<string, StatsMode> = {
    dist: 'dist', distribution: 'dist', distributions: 'dist', normal: 'dist', binomial: 'dist', poisson: 'dist', approx: 'dist',
    tests: 'tests', test: 'tests', hypothesis: 'tests', chi2: 'tests', chi: 'tests', gof: 'tests', contingency: 'tests',
    corr: 'corr', correlation: 'corr', regression: 'corr', pmcc: 'corr', spearman: 'corr', scatter: 'corr',
    data: 'data', box: 'data', boxplot: 'data', outliers: 'data', quartiles: 'data', coding: 'data',
    prob: 'prob', probability: 'prob', venn: 'prob', tree: 'prob', bayes: 'prob',
    clt: 'clt', sampling: 'clt', confidence: 'clt', ci: 'clt',
    practice: 'practice', quiz: 'practice',
  };
  if (map[q]) return map[q];
  throw new Error(`Unknown Stats Lab tab "${s}". Use: dist, tests, corr, data, prob, clt, or practice.`);
}

export function formatDist(p: DistPrefs): string {
  if (p.dist === 'normal') {
    const sd = Math.max(0.05, p.sigma);
    if (p.query === 'inv') {
      const target = Math.min(0.9999, Math.max(0.0001, p.invP));
      const z = p.invTail === 'left' ? invPhi(target) : p.invTail === 'right' ? invPhi(1 - target) : invPhi(0.5 + target / 2);
      const x = p.mu + z * sd;
      return `Normal N(${p.mu}, ${sd}²), inverse (${p.invTail} p=${target}): z=${fmt(z, 4)}, x=${fmt(x, 4)}.`;
    }
    const prob = p.query === 'le'
      ? phi((p.x1 - p.mu) / sd)
      : p.query === 'ge'
      ? 1 - phi((p.x1 - p.mu) / sd)
      : phi((Math.max(p.x1, p.x2) - p.mu) / sd) - phi((Math.min(p.x1, p.x2) - p.mu) / sd);
    return `Normal N(${p.mu}, ${sd}²), query=${p.query}, probability = ${dp4(prob)}.`;
  }

  if (p.dist === 'uniform') {
    const a = Math.min(p.ua, p.ub - 0.5);
    const b = Math.max(a + 0.5, p.ub);
    const prob = p.query === 'le'
      ? Math.min(1, Math.max(0, (p.ux1 - a) / (b - a)))
      : p.query === 'ge'
      ? Math.min(1, Math.max(0, (b - p.ux1) / (b - a)))
      : Math.min(1, Math.max(0, (Math.min(b, Math.max(p.ux1, p.ux2)) - Math.max(a, Math.min(p.ux1, p.ux2))) / (b - a)));
    return `Uniform U(${a}, ${b}), query=${p.query}, P = ${dp4(prob)}.`;
  }

  const isBin = p.dist === 'binomial';
  const k1 = Math.round(isBin ? p.k1 : p.pk1);
  const k2 = Math.round(isBin ? p.k2 : p.pk2);
  const cdf = (k: number) => (isBin ? binomCdfSafe(p.n, p.p, k) : poissonCdfSafe(p.lambda, k));
  const pmf = (k: number) => (isBin ? binomPmf(p.n, p.p, k) : poissonPmf(p.lambda, k));
  const exact = p.query === 'le'
    ? cdf(k1)
    : p.query === 'ge'
    ? 1 - cdf(k1 - 1)
    : p.query === 'between'
    ? cdf(Math.max(k1, k2)) - cdf(Math.min(k1, k2) - 1)
    : pmf(k1);
  let out = `${isBin ? `B(${p.n}, ${p.p})` : `Po(${p.lambda})`}, query=${p.query}(${k1}${p.query === 'between' ? `..${k2}` : ''}), exact P = ${dp4(exact)}.`;
  if (p.approx !== 'none' && p.query !== 'inv') {
    const rep = evalApprox(p.dist, { n: p.n, p: p.p, lambda: p.lambda }, p.query, Math.min(k1, k2), Math.max(k1, k2), p.approx, exact);
    if (rep) out += ` ${rep.title}: approx P = ${dp4(rep.probWithCC)} (${rep.ccExpression}).`;
  }
  return out;
}

export function formatTest(p: TestPrefs): string {
  if (p.mode === 'binomial' || p.mode === 'poisson') {
    const r = discreteHypothesisTest(
      p.mode,
      p.mode === 'binomial' ? { n: p.bn, p: p.bp0 } : { lambda: p.plam },
      p.mode === 'binomial' ? p.bobs : p.pobs,
      p.tail,
      p.alpha,
    );
    return `${p.mode === 'binomial' ? `B(${p.bn}, ${p.bp0})` : `Po(${p.plam})`} ${p.tail}-tail test at ${p.alpha * 100}%: CR = ${r.cr.regionText}, actual α = ${(r.cr.actualAlpha * 100).toFixed(2)}%, obs x = ${r.x}, p-value = ${dp4(r.pValue)} → ${r.reject ? 'REJECT H₀' : 'DO NOT REJECT H₀'}.`;
  }
  if (p.mode === 'normal') {
    const r = normalMeanTest(p.mu0, p.sigma, p.zn, p.xbar, p.tail, p.alpha);
    return `Normal Z-test μ₀=${p.mu0}, σ=${p.sigma}, n=${p.zn}, x̄=${p.xbar} (${p.tail}, α=${p.alpha}): z = ${fmt(r.z, 4)} (z_crit=±${fmt(r.zCrit, 4)}), p = ${dp4(r.pValue)} → ${r.reject ? 'REJECT H₀' : 'DO NOT REJECT H₀'}.`;
  }
  if (p.chiMode === 'gof') {
    const built = p.gofModel === 'custom'
      ? { cells: p.gofObs.map((o, i) => ({ label: p.gofLabels[i] ?? String(i + 1), obs: o, exp: p.gofExp[i] ?? 10 })), estParams: 0, desc: 'Custom' }
      : buildGofModelCells(p.gofModel, p.gofLabels, p.gofObs, p.gofParamFixed ? p.gofParamVal : undefined);
    const res = chi2GoodnessOfFit(built.cells, built.estParams, p.chiAlpha);
    return `χ² GoF (${built.desc}), pooled ${res.classesBefore}→${res.classesAfter} classes, ν=${res.df}: X²=${fmt(res.stat, 3)}, χ²_crit=${fmt(res.crit, 3)}, p=${dp4(res.pValue)} → ${res.reject ? 'REJECT H₀' : 'KEEP H₀'}.`;
  }
  const c = chi2Contingency(p.contMatrix, p.chiAlpha);
  return `χ² Contingency ${c.r}×${c.c} (N=${c.grandTotal}, ν=${c.df}): X²=${fmt(c.stat, 3)}, χ²_crit=${fmt(c.crit, 3)}, p=${dp4(c.pValue)} → ${c.reject ? 'REJECT H₀' : 'KEEP H₀'}.`;
}

export function formatCorr(p: CorrPrefs): string {
  const r = regressionStats(p.points);
  const c = corrCritical(r.n, p.testAlpha, p.testTail, p.testKind);
  return `Scatter n=${r.n}: x̄=${fmt(r.meanX, 2)}, ȳ=${fmt(r.meanY, 2)}, S_xx=${fmt(r.Sxx, 2)}, S_yy=${fmt(r.Syy, 2)}, S_xy=${fmt(r.Sxy, 2)}, PMCC r=${fmt(r.r, 4)}, Spearman rₛ=${fmt(r.rs, 4)}, regression y = ${fmt(r.a, 3)} + ${fmt(r.b, 3)}x. ${c.note}`;
}

export function formatBox(p: BoxPrefs): string {
  const a = boxPlotStats(p.dataA, p.rule, p.k);
  let out = `${p.labelA} (n=${a.n}): Q₁=${fmtTrim(a.q1, 2)}, Med=${fmtTrim(a.q2, 2)}, Q₃=${fmtTrim(a.q3, 2)}, IQR=${fmtTrim(a.iqr, 2)}, fences=[${fmt(a.lowFence, 2)}, ${fmt(a.highFence, 2)}], outliers=[${a.outliers.join(', ') || 'none'}], x̄=${fmt(a.mean, 2)}, σ=${fmt(a.popSd, 2)}, ${a.skewLabel}.`;
  if (p.compare) {
    const b = boxPlotStats(p.dataB, p.rule, p.k);
    out += `\n${p.labelB} (n=${b.n}): Q₁=${fmtTrim(b.q1, 2)}, Med=${fmtTrim(b.q2, 2)}, Q₃=${fmtTrim(b.q3, 2)}, IQR=${fmtTrim(b.iqr, 2)}, outliers=[${b.outliers.join(', ') || 'none'}], ${b.skewLabel}.`;
  }
  return out;
}

export function formatProb(p: ProbPrefs): string {
  if (p.view === 'venn2') {
    const v = venn2Stats(p.onlyA, p.both, p.onlyB);
    return `2-Set Venn: onlyA=${v.onlyA}, both=${v.both}, onlyB=${v.onlyB}, neither=${v.neither}. P(A)=${fmt(v.pA, 4)}, P(B)=${fmt(v.pB, 4)}, P(A∪B)=${fmt(v.pUnion, 4)}, P(A|B)=${fmt(v.pAgivenB, 4)}, P(B|A)=${fmt(v.pBgivenA, 4)}. Independent=${v.isIndependent}, MutExcl=${v.isMutuallyExclusive}.`;
  }
  if (p.view === 'venn3') {
    const sum = p.v3.a + p.v3.b + p.v3.c + p.v3.ab + p.v3.ac + p.v3.bc + p.v3.abc;
    return `3-Set Venn: P(A∪B∪C) = ${fmt(sum, 4)}, outside = ${fmt(Math.max(0, 1 - sum), 4)}.`;
  }
  const t = tree2Stats(p.pA, p.pBgivenA, p.pBgivenNotA);
  return `Tree (${p.labelA} / ${p.labelB}): P(A)=${t.pA}, P(B|A)=${t.pBgivenA}, P(B|A')=${t.pBgivenNotA}. P(B)=${fmt(t.pB, 4)}, Bayes P(A|B)=${fmt(t.pAgivenB, 4)}.`;
}

export function formatClt(p: CltPrefs, summary: { count: number; mean: number; sd: number }): string {
  const pop = CLT_POPS[p.pop];
  const se = pop.sigma / Math.sqrt(p.n);
  return `CLT (${pop.label}, μ=${fmt(pop.mu, 3)}, σ=${fmt(pop.sigma, 3)}), n=${p.n}, K=${summary.count} samples: empirical Mean(X̄)=${fmt(summary.mean, 3)}, SD(X̄)=${fmt(summary.sd, 3)} vs theoretical σ/√n=${fmt(se, 3)}, ${p.conf}% CI.`;
}

export interface StatsKernelHost {
  getState: () => string;
  openTab: (m: StatsMode, topic?: Topic | 'all') => Promise<void>;
  dist: DistPrefs;
  test: TestPrefs;
  corr: CorrPrefs;
  box: BoxPrefs;
  prob: ProbPrefs;
  clt: CltPrefs;
  drawClt: (count: number, reset?: boolean) => Promise<void>;
}

const KERNEL_ABOUT =
  'Stats Lab (Edexcel IAL Mathematics S1–S3: WST01, WST02, WST03) is open: Distributions & S2 continuity-corrected approximations, Hypothesis Tests (Binomial/Poisson critical regions, Normal mean Z, χ² goodness-of-fit & contingency), Draggable Correlation & Regression (PMCC, Spearman r_s, coding), Box Plots & Outliers, Venn & Bayes Probability Trees, CLT Sampler & Confidence Intervals, and Practice. Use stats_ tools to load the student’s numbers or run calculations on screen.';

export function provideStatsTools(host: StatsKernelHost): () => void {
  return provideKernelTools('stats', KERNEL_ABOUT, [
    {
      name: 'stats_state',
      description: 'Read what is currently shown in Stats Lab across the active tab and its calculated results.',
      parameters: { type: 'object', properties: {} },
      run: () => host.getState() + '\nTabs: dist, tests, corr, data, prob, clt, practice.',
    },
    {
      name: 'stats_mode',
      description: 'Switch Stats Lab to any tab (dist, tests, corr, data, prob, clt, practice).',
      parameters: {
        type: 'object',
        properties: {
          tab: { type: 'string', description: 'dist, tests, corr, data, prob, clt, or practice.' },
          topic: { type: 'string', description: 'Optional practice topic filter: all, normal, discrete, approx, tests, corr, data, prob_s3.' },
        },
        required: ['tab'],
      },
      run: async (a) => {
        const m = matchStatsMode(String(a.tab ?? ''));
        let tp: Topic | 'all' | undefined;
        if (m === 'practice' && a.topic !== undefined) {
          const valid = TOPICS.map((x) => x[0]) as string[];
          const raw = String(a.topic).toLowerCase();
          if (!valid.includes(raw)) throw new Error(`topic must be one of: ${valid.join(', ')}.`);
          tp = raw as Topic | 'all';
        }
        await host.openTab(m, tp);
        return host.getState();
      },
    },
    {
      name: 'stats_distribution',
      description: 'Set Normal, Binomial, Poisson, or Uniform parameters, shaded query (le, ge, between, eq, inv), and S2 continuity-corrected approximation overlay.',
      parameters: {
        type: 'object',
        properties: {
          dist: { type: 'string', enum: ['normal', 'binomial', 'poisson', 'uniform'] },
          query: { type: 'string', enum: ['le', 'ge', 'between', 'eq', 'inv'] },
          mu: { type: 'number' },
          sigma: { type: 'number' },
          n: { type: 'integer' },
          p: { type: 'number' },
          lambda: { type: 'number' },
          ua: { type: 'number' },
          ub: { type: 'number' },
          x1: { type: 'number', description: 'Primary value/lower boundary a.' },
          x2: { type: 'number', description: 'Upper boundary b (for between).' },
          invP: { type: 'number', description: 'Target probability (when query="inv").' },
          approx: { type: 'string', enum: ['none', 'poisson', 'normal'] },
        },
        required: ['dist'],
      },
      run: async (a) => {
        const d = String(a.dist) as DistKind;
        if (!['normal', 'binomial', 'poisson', 'uniform'].includes(d)) throw new Error('Invalid distribution.');
        host.dist.dist = d;
        if (a.query !== undefined) host.dist.query = String(a.query) as QueryKind;
        if (d === 'normal') {
          if (a.mu !== undefined) host.dist.mu = Number(a.mu);
          if (a.sigma !== undefined) host.dist.sigma = Math.max(0.05, Number(a.sigma));
          if (a.x1 !== undefined) host.dist.x1 = Number(a.x1);
          if (a.x2 !== undefined) host.dist.x2 = Number(a.x2);
          if (a.invP !== undefined) host.dist.invP = Number(a.invP);
        } else if (d === 'binomial') {
          if (a.n !== undefined) host.dist.n = Math.max(1, Math.round(Number(a.n)));
          if (a.p !== undefined) host.dist.p = Math.min(0.999, Math.max(0.001, Number(a.p)));
          if (a.x1 !== undefined) host.dist.k1 = Math.round(Number(a.x1));
          if (a.x2 !== undefined) host.dist.k2 = Math.round(Number(a.x2));
        } else if (d === 'poisson') {
          if (a.lambda !== undefined) host.dist.lambda = Math.max(0.1, Number(a.lambda));
          if (a.x1 !== undefined) host.dist.pk1 = Math.round(Number(a.x1));
          if (a.x2 !== undefined) host.dist.pk2 = Math.round(Number(a.x2));
        } else {
          if (a.ua !== undefined) host.dist.ua = Number(a.ua);
          if (a.ub !== undefined) host.dist.ub = Number(a.ub);
          if (a.x1 !== undefined) host.dist.ux1 = Number(a.x1);
          if (a.x2 !== undefined) host.dist.ux2 = Number(a.x2);
        }
        if (a.approx !== undefined) host.dist.approx = String(a.approx) as ApproxKind;
        await host.openTab('dist');
        return formatDist(host.dist);
      },
    },
    {
      name: 'stats_hypothesis_test',
      description: 'Run a Binomial, Poisson, Normal mean (Z), or χ² (Goodness-of-Fit / Contingency) hypothesis test on screen with critical region & actual significance.',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['binomial', 'poisson', 'normal', 'chi2'] },
          tail: { type: 'string', enum: ['lower', 'upper', 'two'] },
          alpha: { type: 'number', description: 'Significance level, e.g. 0.05, 0.01.' },
          n: { type: 'integer' },
          p0: { type: 'number' },
          lambda0: { type: 'number' },
          mu0: { type: 'number' },
          sigma: { type: 'number' },
          obs: { type: 'number', description: 'Observed count x or sample mean x̄.' },
          chiMode: { type: 'string', enum: ['gof', 'cont'] },
          gofModel: { type: 'string', enum: ['uniform', 'poisson', 'binomial', 'custom'] },
          gofObs: { type: 'array', items: { type: 'number' } },
          gofExp: { type: 'array', items: { type: 'number' } },
          contMatrix: { type: 'array', items: { type: 'array', items: { type: 'number' } } },
        },
        required: ['mode'],
      },
      run: async (a) => {
        const m = String(a.mode) as TestPrefs['mode'];
        if (!['binomial', 'poisson', 'normal', 'chi2'].includes(m)) throw new Error('Invalid test mode.');
        host.test.mode = m;
        if (a.tail !== undefined) host.test.tail = String(a.tail) as TailKind;
        if (a.alpha !== undefined) {
          const av = Number(a.alpha);
          if (m === 'chi2') host.test.chiAlpha = av as TestPrefs['chiAlpha'];
          else host.test.alpha = av as TestPrefs['alpha'];
        }
        if (m === 'binomial') {
          if (a.n !== undefined) host.test.bn = Math.max(1, Math.round(Number(a.n)));
          if (a.p0 !== undefined) host.test.bp0 = Number(a.p0);
          if (a.obs !== undefined) host.test.bobs = Math.round(Number(a.obs));
        } else if (m === 'poisson') {
          if (a.lambda0 !== undefined) host.test.plam = Number(a.lambda0);
          if (a.obs !== undefined) host.test.pobs = Math.round(Number(a.obs));
        } else if (m === 'normal') {
          if (a.mu0 !== undefined) host.test.mu0 = Number(a.mu0);
          if (a.sigma !== undefined) host.test.sigma = Number(a.sigma);
          if (a.n !== undefined) host.test.zn = Math.max(1, Math.round(Number(a.n)));
          if (a.obs !== undefined) host.test.xbar = Number(a.obs);
        } else {
          if (a.chiMode !== undefined) host.test.chiMode = String(a.chiMode) as 'gof' | 'cont';
          if (a.gofModel !== undefined) host.test.gofModel = String(a.gofModel) as TestPrefs['gofModel'];
          if (Array.isArray(a.gofObs)) {
            host.test.gofObs = a.gofObs.map(Number);
            host.test.gofLabels = host.test.gofObs.map((_, i) => String(i));
          }
          if (Array.isArray(a.gofExp)) host.test.gofExp = a.gofExp.map(Number);
          if (Array.isArray(a.contMatrix)) {
            host.test.contMatrix = a.contMatrix.map((row) => (Array.isArray(row) ? row.map(Number) : [0]));
            host.test.contRowLabels = host.test.contMatrix.map((_, i) => `Row ${i + 1}`);
            host.test.contColLabels = (host.test.contMatrix[0] ?? []).map((_, j) => `Col ${j + 1}`);
          }
        }
        await host.openTab('tests');
        return formatTest(host.test);
      },
    },
    {
      name: 'stats_correlation',
      description: 'Plot paired (x, y) data, compute S_xx, S_yy, S_xy, PMCC r, Spearman r_s, regression line y = a + bx, and test significance.',
      parameters: {
        type: 'object',
        properties: {
          points: { type: 'array', items: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' } } } },
          predictX: { type: 'number' },
          showResiduals: { type: 'boolean' },
        },
        required: ['points'],
      },
      run: async (a) => {
        if (!Array.isArray(a.points) || a.points.length < 3) throw new Error('Need at least 3 {x, y} points.');
        host.corr.points = a.points.map((pt) => ({ x: Number((pt as { x: unknown }).x), y: Number((pt as { y: unknown }).y) }));
        if (a.predictX !== undefined) host.corr.predictX = Number(a.predictX);
        if (a.showResiduals !== undefined) host.corr.showResiduals = Boolean(a.showResiduals);
        await host.openTab('corr');
        return formatCorr(host.corr);
      },
    },
    {
      name: 'stats_boxplot',
      description: 'Plot 1 or 2 datasets as Edexcel box plots with quartiles, IQR, outlier fences and skewness.',
      parameters: {
        type: 'object',
        properties: {
          dataA: { description: 'Array of numbers or comma/space string.' },
          dataB: { description: 'Optional second group.' },
          labelA: { type: 'string' },
          labelB: { type: 'string' },
          rule: { type: 'string', enum: ['iqr', 'sd'] },
        },
        required: ['dataA'],
      },
      run: async (a) => {
        const listA = Array.isArray(a.dataA) ? a.dataA.map(Number) : parseNumList(String(a.dataA));
        if (listA.length < 4) throw new Error('Need at least 4 numbers in dataA.');
        host.box.dataA = listA;
        if (a.labelA !== undefined) host.box.labelA = String(a.labelA);
        if (a.dataB !== undefined) {
          const listB = Array.isArray(a.dataB) ? a.dataB.map(Number) : parseNumList(String(a.dataB));
          if (listB.length >= 4) {
            host.box.dataB = listB;
            host.box.compare = true;
          }
        } else {
          host.box.compare = false;
        }
        if (a.labelB !== undefined) host.box.labelB = String(a.labelB);
        if (a.rule === 'iqr' || a.rule === 'sd') host.box.rule = a.rule;
        await host.openTab('data');
        return formatBox(host.box);
      },
    },
    {
      name: 'stats_probability',
      description: 'Configure the 2-set Venn diagram or Bayes probability tree on screen.',
      parameters: {
        type: 'object',
        properties: {
          view: { type: 'string', enum: ['venn2', 'tree'] },
          onlyA: { type: 'number' },
          both: { type: 'number' },
          onlyB: { type: 'number' },
          highlight: { type: 'string' },
          pA: { type: 'number' },
          pBgivenA: { type: 'number' },
          pBgivenNotA: { type: 'number' },
        },
        required: ['view'],
      },
      run: async (a) => {
        if (a.view === 'venn2') {
          host.prob.view = 'venn2';
          if (a.onlyA !== undefined) host.prob.onlyA = Number(a.onlyA);
          if (a.both !== undefined) host.prob.both = Number(a.both);
          if (a.onlyB !== undefined) host.prob.onlyB = Number(a.onlyB);
          if (a.highlight !== undefined) host.prob.highlight = String(a.highlight) as Venn2Query;
        } else {
          host.prob.view = 'tree';
          if (a.pA !== undefined) host.prob.pA = Number(a.pA);
          if (a.pBgivenA !== undefined) host.prob.pBgivenA = Number(a.pBgivenA);
          if (a.pBgivenNotA !== undefined) host.prob.pBgivenNotA = Number(a.pBgivenNotA);
        }
        await host.openTab('prob');
        return formatProb(host.prob);
      },
    },
    {
      name: 'stats_clt',
      description: 'Select a population distribution and sample size n, then draw random samples in the Central Limit Theorem simulator.',
      parameters: {
        type: 'object',
        properties: {
          pop: { type: 'string', enum: ['skew', 'uniform', 'bimodal', 'die', 'u_shaped'] },
          n: { type: 'integer' },
          samples: { type: 'integer', description: 'Number of samples to draw (default 200).' },
          conf: { type: 'integer', enum: [90, 95, 99] },
        },
      },
      run: async (a) => {
        if (a.pop !== undefined) host.clt.pop = String(a.pop) as CltPopId;
        if (a.n !== undefined) host.clt.n = Math.max(2, Math.min(100, Math.round(Number(a.n))));
        if (a.conf === 90 || a.conf === 95 || a.conf === 99) host.clt.conf = a.conf;
        await host.openTab('clt');
        await host.drawClt(Math.max(10, Math.min(1000, Number(a.samples ?? 200))), true);
        return host.getState();
      },
    },
  ]);
}
