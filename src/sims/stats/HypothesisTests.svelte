<script lang="ts" module>
  import type { TailKind } from './math';

  export interface TestPrefs {
    mode: 'binomial' | 'poisson' | 'normal' | 'chi2';
    tail: TailKind;
    alpha: 0.10 | 0.05 | 0.025 | 0.01;
    bn: number;
    bp0: number;
    bobs: number;
    plam: number;
    pobs: number;
    mu0: number;
    sigma: number;
    zn: number;
    xbar: number;
    chiMode: 'gof' | 'cont';
    gofModel: 'uniform' | 'poisson' | 'binomial' | 'custom';
    gofLabels: string[];
    gofObs: number[];
    gofExp: number[];
    gofParamFixed: boolean;
    gofParamVal: number;
    contRowLabels: string[];
    contColLabels: string[];
    contMatrix: number[][];
    chiAlpha: 0.10 | 0.05 | 0.025 | 0.01 | 0.005;
  }

  export const TEST_PREFS: TestPrefs = {
    mode: 'binomial',
    tail: 'upper',
    alpha: 0.05,
    bn: 20,
    bp0: 0.25,
    bobs: 9,
    plam: 4.5,
    pobs: 9,
    mu0: 500,
    sigma: 12,
    zn: 25,
    xbar: 494.5,
    chiMode: 'gof',
    gofModel: 'poisson',
    gofLabels: ['0', '1', '2', '3', '4', '≥ 5'],
    gofObs: [22, 31, 24, 14, 6, 3],
    gofExp: [20, 20, 20, 15, 15, 10],
    gofParamFixed: false,
    gofParamVal: 1.5,
    contRowLabels: ['Science', 'Arts'],
    contColLabels: ['Pass', 'Merit', 'Distinction'],
    contMatrix: [[18, 22, 10], [27, 16, 7]],
    chiAlpha: 0.05,
  };
</script>

<script lang="ts">
  import Seg from '../../components/ui/Seg.svelte';
  import TopicLinks from './TopicLinks.svelte';
  import {
    dp4, fmt, fmtTrim, parseNumList, normalPdf,
    binomPmf, poissonPmf, discreteHypothesisTest, normalMeanTest,
    chi2Pdf, buildGofModelCells, chi2GoodnessOfFit, chi2Contingency,
  } from './math';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: TestPrefs;
    hidden?: boolean;
    stats?: [string, string | number][];
  } = $props();

  const MODE_OPTS = [
    ['binomial', 'Binomial', 'Bin'],
    ['poisson', 'Poisson', 'Po'],
    ['normal', 'Normal Z', 'Z'],
    ['chi2', 'χ² Test', 'χ²'],
  ] as const;

  const TAIL_OPTS = [
    ['lower', 'Lower (<)'],
    ['two', 'Two-tailed (≠)'],
    ['upper', 'Upper (>)'],
  ] as const;

  const ALPHA_OPTS = [
    ['0.10', '10%'],
    ['0.05', '5%'],
    ['0.025', '2.5%'],
    ['0.01', '1%'],
  ] as const;

  const CHI_ALPHA_OPTS = [
    ['0.10', '10%'],
    ['0.05', '5%'],
    ['0.025', '2.5%'],
    ['0.01', '1%'],
    ['0.005', '0.5%'],
  ] as const;

  let alphaStr = $state('0.05');
  let chiAlphaStr = $state('0.05');
  $effect(() => { alphaStr = String(prefs.alpha); });
  $effect(() => { chiAlphaStr = String(prefs.chiAlpha); });

  const PRESETS = [
    { id: 'coin', label: 'Binomial upper (n=20, p=0.25)', apply: () => { Object.assign(prefs, { mode: 'binomial', tail: 'upper', alpha: 0.05, bn: 20, bp0: 0.25, bobs: 9 }); } },
    { id: 'two_b', label: 'Binomial 2-tail (n=25, p=0.4)', apply: () => { Object.assign(prefs, { mode: 'binomial', tail: 'two', alpha: 0.05, bn: 25, bp0: 0.4, bobs: 4 }); } },
    { id: 'po_call', label: 'Poisson Po(4.5) obs=9', apply: () => { Object.assign(prefs, { mode: 'poisson', tail: 'upper', alpha: 0.05, plam: 4.5, pobs: 9 }); } },
    { id: 'z_fill', label: 'Bottle fill Z-test', apply: () => { Object.assign(prefs, { mode: 'normal', tail: 'lower', alpha: 0.05, mu0: 500, sigma: 12, zn: 25, xbar: 494.5 }); } },
    { id: 'gof_die', label: 'χ² Fair die', apply: () => { Object.assign(prefs, { mode: 'chi2', chiMode: 'gof', gofModel: 'uniform', gofLabels: ['1', '2', '3', '4', '5', '6'], gofObs: [14, 18, 12, 20, 15, 21], gofParamFixed: true, chiAlpha: 0.05 }); } },
    { id: 'gof_po', label: 'χ² Poisson (<5 pooling)', apply: () => { Object.assign(prefs, { mode: 'chi2', chiMode: 'gof', gofModel: 'poisson', gofLabels: ['0', '1', '2', '3', '4', '≥ 5'], gofObs: [22, 31, 24, 14, 6, 3], gofParamFixed: false, chiAlpha: 0.05 }); } },
    { id: 'cont_2x3', label: 'χ² 2×3 Contingency', apply: () => { Object.assign(prefs, { mode: 'chi2', chiMode: 'cont', contRowLabels: ['Science', 'Arts'], contColLabels: ['Pass', 'Merit', 'Distinction'], contMatrix: [[18, 22, 10], [27, 16, 7]], chiAlpha: 0.05 }); } },
  ];

  // Computed test result for Binomial / Poisson / Normal
  const discRes = $derived.by(() => {
    if (prefs.mode !== 'binomial' && prefs.mode !== 'poisson') return null;
    const isBin = prefs.mode === 'binomial';
    return discreteHypothesisTest(
      prefs.mode,
      isBin ? { n: Math.max(1, Math.round(prefs.bn)), p: Math.min(0.99, Math.max(0.01, prefs.bp0)) } : { lambda: Math.max(0.2, prefs.plam) },
      isBin ? prefs.bobs : prefs.pobs,
      prefs.tail,
      prefs.alpha,
    );
  });

  const normRes = $derived.by(() => {
    if (prefs.mode !== 'normal') return null;
    return normalMeanTest(
      prefs.mu0,
      Math.max(0.05, prefs.sigma),
      Math.max(1, Math.round(prefs.zn)),
      prefs.xbar,
      prefs.tail,
      prefs.alpha,
    );
  });

  // χ² GoF or Contingency computation
  const gofBuilt = $derived.by(() => {
    if (prefs.gofModel === 'custom') {
      return {
        cells: prefs.gofObs.map((o, i) => ({ label: prefs.gofLabels[i] ?? String(i + 1), obs: o, exp: prefs.gofExp[i] ?? 10 })),
        estParams: 0,
        modelParam: 0,
        desc: 'Custom expected frequencies',
      };
    }
    return buildGofModelCells(
      prefs.gofModel,
      prefs.gofLabels,
      prefs.gofObs,
      prefs.gofParamFixed ? prefs.gofParamVal : undefined,
    );
  });

  const gofRes = $derived.by(() => {
    if (prefs.mode !== 'chi2' || prefs.chiMode !== 'gof') return null;
    return chi2GoodnessOfFit(gofBuilt.cells, gofBuilt.estParams, prefs.chiAlpha);
  });

  const contRes = $derived.by(() => {
    if (prefs.mode !== 'chi2' || prefs.chiMode !== 'cont') return null;
    return chi2Contingency(prefs.contMatrix, prefs.chiAlpha);
  });

  const chiSummary = $derived.by(() => {
    if (prefs.mode !== 'chi2') return null;
    return prefs.chiMode === 'gof' ? gofRes : contRes;
  });

  // Custom editable GoF strings synced smoothly
  let gofObsRaw = $state('');
  let gofExpRaw = $state('');
  $effect(() => { gofObsRaw = prefs.gofObs.join(', '); });
  $effect(() => { gofExpRaw = prefs.gofExp.join(', '); });

  function applyGofObs() {
    const nums = parseNumList(gofObsRaw).map((v) => Math.max(0, Math.round(v)));
    if (nums.length < 3) return;
    prefs.gofObs = nums;
    prefs.gofLabels = nums.map((_, i) =>
      prefs.gofModel === 'poisson' && i === nums.length - 1 ? `≥ ${i}` : prefs.gofModel === 'uniform' ? String(i + 1) : String(i),
    );
    if (prefs.gofExp.length !== nums.length) {
      const avg = nums.reduce((s, v) => s + v, 0) / nums.length;
      prefs.gofExp = nums.map(() => +avg.toFixed(1));
    }
  }

  function applyGofExp() {
    const nums = parseNumList(gofExpRaw).filter((v) => v > 0);
    if (nums.length >= 3) prefs.gofExp = nums;
  }

  function setContDims(r: number, c: number) {
    const rows = Array.from({ length: r }, (_, i) => prefs.contRowLabels[i] ?? `Row ${i + 1}`);
    const cols = Array.from({ length: c }, (_, j) => prefs.contColLabels[j] ?? `Col ${j + 1}`);
    const mat = Array.from({ length: r }, (_, i) =>
      Array.from({ length: c }, (_, j) => prefs.contMatrix[i]?.[j] ?? 12),
    );
    prefs.contRowLabels = rows;
    prefs.contColLabels = cols;
    prefs.contMatrix = mat;
  }

  function updateContCell(r: number, c: number, val: string) {
    const num = Math.max(0, Math.round(Number(val) || 0));
    const next = prefs.contMatrix.map((row) => [...row]);
    next[r][c] = num;
    prefs.contMatrix = next;
  }

  // Hypothesis descriptions & mark-scheme wording
  const report = $derived.by(() => {
    if (prefs.mode === 'binomial' || prefs.mode === 'poisson') {
      const r = discRes!;
      const isBin = prefs.mode === 'binomial';
      const paramSym = isBin ? 'p' : 'λ';
      const nullVal = isBin ? fmtTrim(prefs.bp0, 3) : fmtTrim(prefs.plam, 2);
      const h1Sign = prefs.tail === 'lower' ? '<' : prefs.tail === 'upper' ? '>' : '≠';
      const distLabel = isBin ? `X ~ B(${Math.round(prefs.bn)}, ${nullVal})` : `X ~ Po(${nullVal})`;
      const obsCheck = prefs.tail === 'lower'
        ? `P(X ≤ ${r.x}) = ${dp4(r.pLe)}`
        : prefs.tail === 'upper'
        ? `P(X ≥ ${r.x}) = ${dp4(r.pGe)}`
        : `P(tail) = ${dp4(r.tailProb)} (vs ${dp4(r.threshold)})`;
      const verdictText = r.reject
        ? `Observed x = ${r.x} lies in the critical region (${r.cr.regionText}). There is sufficient evidence at the ${prefs.alpha * 100}% level to reject H₀ and conclude that ${paramSym} ${h1Sign} ${nullVal}.`
        : `Observed x = ${r.x} does not lie in the critical region (${r.cr.regionText}). There is insufficient evidence at the ${prefs.alpha * 100}% level to reject H₀.`;
      return {
        title: `${isBin ? 'Binomial' : 'Poisson'} hypothesis test`,
        h0: `H₀: ${paramSym} = ${nullVal}`,
        h1: `H₁: ${paramSym} ${h1Sign} ${nullVal}`,
        dist: `Under H₀, ${distLabel}`,
        crLine: `Critical region: ${r.cr.regionText} · Actual significance = ${(r.cr.actualAlpha * 100).toFixed(2)}% (${dp4(r.cr.actualAlpha)})`,
        boundaryCheck: [
          r.cr.nextLower ? `Lower check: P(X ≤ ${r.cr.nextLower.c}) = ${dp4(r.cr.nextLower.prob)} > ${dp4(prefs.tail === 'two' ? prefs.alpha / 2 : prefs.alpha)}` : '',
          r.cr.nextUpper ? `Upper check: P(X ≥ ${r.cr.nextUpper.c}) = ${dp4(r.cr.nextUpper.prob)} > ${dp4(prefs.tail === 'two' ? prefs.alpha / 2 : prefs.alpha)}` : '',
        ].filter(Boolean).join(' · '),
        statLine: `${obsCheck} · p-value = ${dp4(r.pValue)}`,
        reject: r.reject,
        verdictText,
      };
    }

    if (prefs.mode === 'normal') {
      const r = normRes!;
      const h1Sign = prefs.tail === 'lower' ? '<' : prefs.tail === 'upper' ? '>' : '≠';
      const critDesc = prefs.tail === 'lower'
        ? `Z ≤ −${fmt(r.zCrit, 4)} (x̄ ≤ ${fmt(r.critLow!, 2)})`
        : prefs.tail === 'upper'
        ? `Z ≥ ${fmt(r.zCrit, 4)} (x̄ ≥ ${fmt(r.critHigh!, 2)})`
        : `|Z| ≥ ${fmt(r.zCrit, 4)} (x̄ ≤ ${fmt(r.critLow!, 2)} or x̄ ≥ ${fmt(r.critHigh!, 2)})`;
      return {
        title: 'Normal mean Z-test (known σ²)',
        h0: `H₀: μ = ${fmtTrim(prefs.mu0, 2)}`,
        h1: `H₁: μ ${h1Sign} ${fmtTrim(prefs.mu0, 2)}`,
        dist: `Under H₀, X̄ ~ N(${fmtTrim(prefs.mu0, 2)}, ${fmtTrim(prefs.sigma, 2)}²/${Math.round(prefs.zn)}) · SE = ${fmt(r.se, 4)}`,
        crLine: `Critical region: ${critDesc}`,
        boundaryCheck: '',
        statLine: `z = (${fmtTrim(prefs.xbar, 2)} − ${fmtTrim(prefs.mu0, 2)}) / ${fmt(r.se, 4)} = ${fmt(r.z, 4)} · p-value = ${dp4(r.pValue)}`,
        reject: r.reject,
        verdictText: r.reject
          ? `Test statistic z = ${fmt(r.z, 4)} lies in the critical region. Sufficient evidence at ${prefs.alpha * 100}% level to reject H₀.`
          : `Test statistic z = ${fmt(r.z, 4)} does not fall in the critical region. Insufficient evidence at ${prefs.alpha * 100}% level to reject H₀.`,
      };
    }

    const cr = chiSummary!;
    const isGof = prefs.chiMode === 'gof';
    const critSrc = cr.fromBooklet ? ' (Edexcel booklet)' : '';
    return {
      title: isGof ? 'χ² Goodness-of-Fit test' : 'χ² Contingency test',
      h0: isGof ? `H₀: ${gofBuilt.desc} is a suitable model` : 'H₀: The two categorical variables are independent',
      h1: isGof ? `H₁: ${gofBuilt.desc} is NOT a suitable model` : 'H₁: There is an association between the two variables',
      dist: isGof
        ? `ν = ${gofRes!.classesAfter} − 1 − ${gofBuilt.estParams} = ${cr.df}${gofRes!.pooledCount ? ` (${gofRes!.pooledCount} class${gofRes!.pooledCount > 1 ? 'es' : ''} pooled for Eᵢ < 5)` : ''}`
        : `ν = (${contRes!.r} − 1)(${contRes!.c} − 1) = ${cr.df}`,
      crLine: cr.valid ? `Critical value χ²_${cr.df}(${(prefs.chiAlpha * 100).toFixed(1)}%) = ${fmt(cr.crit, 3)}${critSrc}` : 'Need ν ≥ 1 (add more classes or fewer parameters)',
      boundaryCheck: '',
      statLine: cr.valid ? `X² = Σ(O − E)²/E = ${fmt(cr.stat, 3)} · p-value = ${dp4(cr.pValue)}` : 'Invalid degrees of freedom (ν < 1)',
      reject: cr.reject,
      verdictText: !cr.valid
        ? 'Too few classes left after pooling so degrees of freedom ν < 1.'
        : cr.reject
        ? `X² = ${fmt(cr.stat, 3)} > ${fmt(cr.crit, 3)}. Reject H₀ at ${(prefs.chiAlpha * 100).toFixed(1)}%: ${isGof ? 'the model does not fit the data.' : 'variables are associated (not independent).'}`
        : `X² = ${fmt(cr.stat, 3)} ≤ ${fmt(cr.crit, 3)}. Do not reject H₀ at ${(prefs.chiAlpha * 100).toFixed(1)}%: ${isGof ? 'no evidence against the model.' : 'no evidence of an association.'}`,
    };
  });

  $effect(() => {
    if (prefs.mode === 'binomial' || prefs.mode === 'poisson') {
      const r = discRes!;
      stats = [
        ['CR', r.cr.regionText],
        ['Actual α', `${(r.cr.actualAlpha * 100).toFixed(2)}%`],
        ['p-value', dp4(r.pValue)],
        ['Verdict', r.reject ? 'Reject H₀' : 'Keep H₀'],
      ];
    } else if (prefs.mode === 'normal') {
      const r = normRes!;
      stats = [
        ['z', fmt(r.z, 3)],
        ['z_crit', `±${fmt(r.zCrit, 3)}`],
        ['p-value', dp4(r.pValue)],
        ['Verdict', r.reject ? 'Reject H₀' : 'Keep H₀'],
      ];
    } else {
      const cr = chiSummary!;
      stats = [
        ['ν (df)', cr.df],
        ['X²', fmt(cr.stat, 3)],
        ['χ²_crit', cr.valid ? fmt(cr.crit, 3) : '—'],
        ['Verdict', cr.valid ? (cr.reject ? 'Reject H₀' : 'Keep H₀') : 'Invalid'],
      ];
    }
  });

  /* ---------- Stage SVG Geometry ---------- */
  const W = 680;
  const H = 290;
  const PAD = { l: 46, r: 22, t: 24, b: 42 };
  const PW = W - PAD.l - PAD.r;
  const PH = H - PAD.t - PAD.b;

  const discPlot = $derived.by(() => {
    if (prefs.mode !== 'binomial' && prefs.mode !== 'poisson') return null;
    const r = discRes!;
    const isBin = prefs.mode === 'binomial';
    const mean = isBin ? prefs.bn * prefs.bp0 : prefs.plam;
    const sd = Math.sqrt(isBin ? prefs.bn * prefs.bp0 * (1 - prefs.bp0) : prefs.plam);
    const kMin = isBin && prefs.bn <= 30 ? 0 : Math.max(0, Math.floor(Math.min(r.x - 1, mean - 4 * sd)));
    const kMax = isBin ? (prefs.bn <= 30 ? prefs.bn : Math.min(prefs.bn, Math.ceil(Math.max(r.x + 1, mean + 4 * sd)))) : Math.max(12, Math.ceil(Math.max(r.x + 2, mean + 4.2 * sd)));
    const bars: { k: number; p: number; inCR: boolean }[] = [];
    let maxP = 0.02;
    for (let k = kMin; k <= kMax; k++) {
      const pk = isBin ? binomPmf(prefs.bn, prefs.bp0, k) : poissonPmf(prefs.plam, k);
      if (pk > maxP) maxP = pk;
      const inCR = (r.cr.lower !== null && k <= r.cr.lower) || (r.cr.upper !== null && k >= r.cr.upper);
      bars.push({ k, p: pk, inCR });
    }
    const xmin = kMin - 0.6;
    const xmax = kMax + 0.6;
    const sx = (x: number) => PAD.l + ((x - xmin) / Math.max(1, xmax - xmin)) * PW;
    const sy = (y: number) => PAD.t + PH - (y / (maxP * 1.15)) * PH;
    const bw = Math.max(5, Math.min(34, (PW / Math.max(3, bars.length)) * 0.72));
    return { bars, kMin, kMax, sx, sy, bw };
  });

  const normPlot = $derived.by(() => {
    if (prefs.mode !== 'normal') return null;
    const r = normRes!;
    const se = r.se;
    const zMin = Math.min(-3.8, r.z - 0.6);
    const zMax = Math.max(3.8, r.z + 0.6);
    const xmin = prefs.mu0 + zMin * se;
    const xmax = prefs.mu0 + zMax * se;
    const sx = (x: number) => PAD.l + ((x - xmin) / (xmax - xmin)) * PW;
    const maxY = normalPdf(prefs.mu0, prefs.mu0, se) * 1.15;
    const sy = (y: number) => PAD.t + PH - (y / maxY) * PH;
    const pts: string[] = [];
    for (let i = 0; i <= 140; i++) {
      const x = xmin + ((xmax - xmin) * i) / 140;
      pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(normalPdf(x, prefs.mu0, se)).toFixed(1)}`);
    }
    const shade = (a: number, b: number) => {
      if (b <= a) return '';
      const sp: string[] = [`M${sx(a).toFixed(1)},${sy(0).toFixed(1)}`];
      for (let i = 0; i <= 60; i++) {
        const x = a + ((b - a) * i) / 60;
        sp.push(`L${sx(x).toFixed(1)},${sy(normalPdf(x, prefs.mu0, se)).toFixed(1)}`);
      }
      sp.push(`L${sx(b).toFixed(1)},${sy(0).toFixed(1)} Z`);
      return sp.join(' ');
    };
    const leftTail = r.critLow !== null ? shade(xmin, r.critLow) : '';
    const rightTail = r.critHigh !== null ? shade(r.critHigh, xmax) : '';
    return { sx, sy, curve: pts.join(' '), leftTail, rightTail, xmin, xmax };
  });

  const chiPlot = $derived.by(() => {
    if (prefs.mode !== 'chi2') return null;
    const cr = chiSummary!;
    const df = Math.max(1, cr.df);
    const xmax = Math.max(12, cr.crit * 1.45, cr.stat * 1.18, df + 4 * Math.sqrt(2 * df));
    const sx = (x: number) => PAD.l + (x / xmax) * PW;
    let maxY = 0.05;
    const xStart = df === 1 ? 0.08 : 0.02;
    for (let i = 1; i <= 100; i++) {
      const x = xStart + ((xmax - xStart) * i) / 100;
      maxY = Math.max(maxY, chi2Pdf(x, df));
    }
    const capY = df <= 2 ? Math.min(0.65, maxY) : maxY * 1.12;
    const sy = (y: number) => PAD.t + PH - (Math.min(y, capY) / capY) * PH;
    const pts: string[] = [];
    for (let i = 0; i <= 140; i++) {
      const x = xStart + ((xmax - xStart) * i) / 140;
      pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(chi2Pdf(x, df)).toFixed(1)}`);
    }
    let tailPath = '';
    if (cr.valid && cr.crit < xmax) {
      const tp: string[] = [`M${sx(cr.crit).toFixed(1)},${sy(0).toFixed(1)}`];
      for (let i = 0; i <= 70; i++) {
        const x = cr.crit + ((xmax - cr.crit) * i) / 70;
        tp.push(`L${sx(x).toFixed(1)},${sy(chi2Pdf(x, df)).toFixed(1)}`);
      }
      tp.push(`L${sx(xmax).toFixed(1)},${sy(0).toFixed(1)} Z`);
      tailPath = tp.join(' ');
    }
    return { df, xmax, sx, sy, curve: pts.join(' '), tailPath };
  });
</script>

<main class="layout st-two" hidden={off}>
  <section class="panel stage" aria-label="Hypothesis test visualiser">
    <div class="stage-head">
      <div class="label-chip">
        {report.title}
        <small>{prefs.mode === 'chi2' ? 'S3' : prefs.mode === 'normal' ? 'S3' : 'S2'}</small>
      </div>
      <div class="stage-tools">
        <Seg label="Test type" options={MODE_OPTS} bind:value={prefs.mode} />
      </div>
    </div>

    <div class="st-presets">
      <small>Presets</small>
      {#each PRESETS as pr (pr.id)}
        <button type="button" class="chip" onclick={pr.apply}>{pr.label}</button>
      {/each}
    </div>

    <div class="st-board">
      <svg class="st-svg" viewBox="0 0 {W} {H}" role="img" aria-label="Hypothesis test critical region">
        {#each [0.25, 0.5, 0.75, 1] as f (f)}
          {@const gy = PAD.t + PH * (1 - f)}
          <line class="grid" x1={PAD.l} y1={gy} x2={W - PAD.r} y2={gy} />
        {/each}

        {#if discPlot && discRes}
          {#each discPlot.bars as bar (bar.k)}
            {@const bx = discPlot.sx(bar.k) - discPlot.bw / 2}
            {@const by = discPlot.sy(bar.p)}
            <rect
              class="bar clickable"
              class:crit={bar.inCR}
              x={bx}
              y={by}
              width={discPlot.bw}
              height={Math.max(1, H - PAD.b - by)}
              rx="2"
              role="button"
              tabindex="0"
              aria-label={`Set observed X = ${bar.k}`}
              onclick={() => { if (prefs.mode === 'binomial') prefs.bobs = bar.k; else prefs.pobs = bar.k; }}
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  if (prefs.mode === 'binomial') prefs.bobs = bar.k; else prefs.pobs = bar.k;
                }
              }}
            >
              <title>X = {bar.k}: P = {dp4(bar.p)}</title>
            </rect>
          {/each}
          {@const ox = discPlot.sx(discRes.x)}
          <line class="obs-line" x1={ox} y1={PAD.t} x2={ox} y2={H - PAD.b} />
          <circle cx={ox} cy={PAD.t + 6} r="5" fill={discRes.reject ? 'var(--redox)' : 'var(--good)'} />
          <text class="tick-t" x={ox} y={PAD.t - 6} text-anchor="middle">obs x = {discRes.x}</text>

          {@const step = discPlot.bars.length > 22 ? 2 : 1}
          {#each discPlot.bars as bar, idx (bar.k)}
            {#if idx % step === 0}
              <text class="tick-t" x={discPlot.sx(bar.k)} y={H - PAD.b + 17} text-anchor="middle">{bar.k}</text>
            {/if}
          {/each}
        {:else if normPlot && normRes}
          {#if normPlot.leftTail}<path class="area crit" d={normPlot.leftTail} />{/if}
          {#if normPlot.rightTail}<path class="area crit" d={normPlot.rightTail} />{/if}
          <path class="curve" d={normPlot.curve} />
          <line class="mean-line" x1={normPlot.sx(prefs.mu0)} y1={PAD.t} x2={normPlot.sx(prefs.mu0)} y2={H - PAD.b} />
          <line class="obs-line" x1={normPlot.sx(prefs.xbar)} y1={PAD.t + 8} x2={normPlot.sx(prefs.xbar)} y2={H - PAD.b} />
          <circle cx={normPlot.sx(prefs.xbar)} cy={PAD.t + 8} r="5" fill={normRes.reject ? 'var(--redox)' : 'var(--good)'} />
          <text class="tick-t" x={normPlot.sx(prefs.xbar)} y={PAD.t - 4} text-anchor="middle">x̄ = {fmtTrim(prefs.xbar, 2)} (z = {fmt(normRes.z, 2)})</text>
          {#each [-3, -2, -1, 0, 1, 2, 3] as zk (zk)}
            {@const xv = prefs.mu0 + zk * normRes.se}
            <text class="tick-t" x={normPlot.sx(xv)} y={H - PAD.b + 16} text-anchor="middle">{fmtTrim(xv, 1)}</text>
            <text class="tick-t" x={normPlot.sx(xv)} y={H - PAD.b + 30} text-anchor="middle">z={zk}</text>
          {/each}
        {:else if chiPlot && chiSummary}
          {#if chiPlot.tailPath}<path class="area crit" d={chiPlot.tailPath} />{/if}
          <path class="curve" d={chiPlot.curve} />
          {#if chiSummary.valid && chiSummary.crit <= chiPlot.xmax}
            <line class="handle-line" x1={chiPlot.sx(chiSummary.crit)} y1={PAD.t + 12} x2={chiPlot.sx(chiSummary.crit)} y2={H - PAD.b} stroke="var(--redox)" />
            <text class="tick-t" x={chiPlot.sx(chiSummary.crit)} y={PAD.t + 4} text-anchor="middle">χ²_crit = {fmt(chiSummary.crit, 2)}</text>
          {/if}
          {@const cx = chiPlot.sx(Math.min(chiPlot.xmax, chiSummary.stat))}
          <line class="obs-line" x1={cx} y1={PAD.t + 22} x2={cx} y2={H - PAD.b} />
          <circle cx={cx} cy={PAD.t + 22} r="5" fill={chiSummary.reject ? 'var(--redox)' : 'var(--good)'} />
          <text class="tick-t" x={cx} y={PAD.t + 14} text-anchor="middle">X² = {fmt(chiSummary.stat, 2)}</text>
          {#each [0, 0.25, 0.5, 0.75, 1] as f (f)}
            {@const xv = chiPlot.xmax * f}
            <text class="tick-t" x={chiPlot.sx(xv)} y={H - PAD.b + 17} text-anchor="middle">{fmtTrim(xv, 1)}</text>
          {/each}
        {/if}

        <line class="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
        <line class="axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
      </svg>

      <div class="st-key">
        <span><i class="k crit"></i> Critical region (reject H₀)</span>
        <span><i class="k"></i> Observed statistic pin</span>
      </div>
    </div>

    <!-- Exam-style 4-step mark scheme card -->
    <div class="st-card" style="margin-top:12px">
      <h3>Edexcel Mark-Scheme Working</h3>
      <ul class="st-work">
        <li><b>1. Hyps</b><span>{report.h0} · {report.h1}</span></li>
        <li><b>2. Model</b><span>{report.dist}</span></li>
        <li>
          <b>3. Region</b>
          <span>
            {report.crLine}
            {#if report.boundaryCheck}<br /><small class="muted">{report.boundaryCheck}</small>{/if}
          </span>
        </li>
        <li><b>4. Test</b><span>{report.statLine}</span></li>
      </ul>
      <div class="st-verdict {report.reject ? 'reject' : 'keep'}">
        <span class="st-pill {report.reject ? 'bad' : 'ok'}">{report.reject ? 'Reject H₀' : 'Do not reject H₀'}</span>
        <span>{report.verdictText}</span>
      </div>
    </div>

    <!-- χ² Pooled GoF or Contingency Table -->
    {#if prefs.mode === 'chi2' && prefs.chiMode === 'gof' && gofRes}
      <div class="st-card" style="margin-top:12px">
        <h3>Goodness-of-Fit Table (auto-pooling Eᵢ &lt; 5)</h3>
        <div class="mx-wrap">
          <table class="mx">
            <thead>
              <tr><th>Class</th><th>Observed O</th><th>Expected E</th><th>(O − E)² / E</th></tr>
            </thead>
            <tbody>
              {#each gofRes.rows as row, idx (idx)}
                <tr class:pooled={row.mergedFrom > 1}>
                  <th>{row.label}{row.mergedFrom > 1 ? ' (pooled)' : ''}</th>
                  <td>{fmtTrim(row.obs, 1)}</td>
                  <td class:lowexp={row.exp < 5}>{fmt(row.exp, 2)}</td>
                  <td>{fmt(row.contrib, 3)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {:else if prefs.mode === 'chi2' && prefs.chiMode === 'cont' && contRes}
      <div class="st-card" style="margin-top:12px">
        <h3>Observed &amp; Expected Matrix (Eᵢⱼ = Rᵢ Cⱼ / N)</h3>
        <div class="mx-wrap">
          <table class="mx">
            <thead>
              <tr>
                <th></th>
                {#each prefs.contColLabels as col (col)}<th>{col}</th>{/each}
                <th>Row total</th>
              </tr>
            </thead>
            <tbody>
              {#each prefs.contMatrix as row, rIdx (rIdx)}
                <tr>
                  <th>{prefs.contRowLabels[rIdx]}</th>
                  {#each row as cell, cIdx (cIdx)}
                    {@const e = contRes.expected[rIdx][cIdx]}
                    <td class:lowexp={e < 5}>
                      <input
                        class="inp xs"
                        type="number"
                        min="0"
                        value={cell}
                        oninput={(ev) => updateContCell(rIdx, cIdx, (ev.currentTarget as HTMLInputElement).value)}
                      />
                      <div class="muted" style="font-size:10.5px;margin-top:2px">E = {fmt(e, 2)}</div>
                    </td>
                  {/each}
                  <th>{contRes.rowTotals[rIdx]}</th>
                </tr>
              {/each}
              <tr>
                <th>Col total</th>
                {#each contRes.colTotals as ct, cIdx (cIdx)}<th>{ct}</th>{/each}
                <th>N = {contRes.grandTotal}</th>
              </tr>
            </tbody>
          </table>
        </div>
        {#if contRes.lowExpectedCount > 0}
          <p class="why" style="margin-top:8px;color:var(--redox)">
            Warning: {contRes.lowExpectedCount} cell(s) have E &lt; 5; pool adjacent rows/columns before applying χ².
          </p>
        {/if}
        {#if contRes.yatesStat !== null}
          <p class="why" style="margin-top:6px">
            2×2 table with ν = 1: Yates-corrected X² = {fmt(contRes.yatesStat, 3)}.
          </p>
        {/if}
      </div>
    {/if}
  </section>

  <!-- Right controls panel -->
  <aside class="panel side" aria-label="Test parameters">
    <div class="ph"><h2>Test Setup</h2></div>
    <div class="ctls">
      {#if prefs.mode !== 'chi2'}
        <div class="ctl">
          <span class="ctl-l">Alternative H₁</span>
          <Seg label="Tail" options={TAIL_OPTS} bind:value={prefs.tail} />
        </div>
        <div class="ctl">
          <span class="ctl-l">Significance level α</span>
          <Seg label="Alpha" options={ALPHA_OPTS} bind:value={alphaStr} onchange={(v) => (prefs.alpha = Number(v) as TestPrefs['alpha'])} />
        </div>
      {/if}

      {#if prefs.mode === 'binomial'}
        <div class="row2">
          <label class="ctl">
            <span class="ctl-l">Sample n <b>{Math.round(prefs.bn)}</b></span>
            <input class="inp" type="number" min="4" max="80" step="1" bind:value={prefs.bn} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Null p₀ <b>{fmtTrim(prefs.bp0, 3)}</b></span>
            <input class="inp" type="number" min="0.02" max="0.98" step="0.01" bind:value={prefs.bp0} />
          </label>
        </div>
        <label class="ctl">
          <span class="ctl-l">Observed x <b>{Math.round(prefs.bobs)}</b></span>
          <input class="inp" type="number" min="0" max={Math.round(prefs.bn)} step="1" bind:value={prefs.bobs} />
          <input class="slider" type="range" min="0" max={Math.round(prefs.bn)} step="1" bind:value={prefs.bobs} />
        </label>

      {:else if prefs.mode === 'poisson'}
        <label class="ctl">
          <span class="ctl-l">Null mean λ₀ <b>{fmtTrim(prefs.plam, 2)}</b></span>
          <input class="inp" type="number" min="0.5" max="40" step="0.5" bind:value={prefs.plam} />
          <input class="slider" type="range" min="0.5" max="25" step="0.5" bind:value={prefs.plam} />
        </label>
        <label class="ctl">
          <span class="ctl-l">Observed x <b>{Math.round(prefs.pobs)}</b></span>
          <input class="inp" type="number" min="0" max="60" step="1" bind:value={prefs.pobs} />
          <input class="slider" type="range" min="0" max={Math.max(20, Math.ceil(prefs.plam + 4 * Math.sqrt(prefs.plam)))} step="1" bind:value={prefs.pobs} />
        </label>

      {:else if prefs.mode === 'normal'}
        <div class="row2">
          <label class="ctl"><span class="ctl-l">Null μ₀</span><input class="inp" type="number" step="0.5" bind:value={prefs.mu0} /></label>
          <label class="ctl"><span class="ctl-l">Pop SD σ</span><input class="inp" type="number" min="0.1" step="0.5" bind:value={prefs.sigma} /></label>
        </div>
        <div class="row2">
          <label class="ctl"><span class="ctl-l">Sample n</span><input class="inp" type="number" min="1" step="1" bind:value={prefs.zn} /></label>
          <label class="ctl"><span class="ctl-l">Sample x̄</span><input class="inp" type="number" step="0.25" bind:value={prefs.xbar} /></label>
        </div>

      {:else}
        <div class="ctl">
          <span class="ctl-l">χ² Test kind</span>
          <Seg label="Chi-squared kind" options={[['gof', 'Goodness of fit'], ['cont', 'Contingency']] as const} bind:value={prefs.chiMode} />
        </div>
        <div class="ctl">
          <span class="ctl-l">Significance α</span>
          <Seg label="Chi alpha" options={CHI_ALPHA_OPTS} bind:value={chiAlphaStr} onchange={(v) => (prefs.chiAlpha = Number(v) as TestPrefs['chiAlpha'])} />
        </div>

        {#if prefs.chiMode === 'gof'}
          <div class="ctl">
            <span class="ctl-l">Null model</span>
            <Seg label="GoF model" options={[['uniform', 'Uniform'], ['poisson', 'Poisson'], ['binomial', 'Binomial'], ['custom', 'Custom']] as const} bind:value={prefs.gofModel} />
          </div>
          <label class="ctl">
            <span class="ctl-l">Observed counts (comma separated)</span>
            <div style="display:flex;gap:6px">
              <input class="inp" type="text" bind:value={gofObsRaw} />
              <button type="button" class="btn sm" onclick={applyGofObs}>Apply</button>
            </div>
          </label>
          {#if prefs.gofModel === 'poisson' || prefs.gofModel === 'binomial'}
            <label class="sb-quiz" style="margin-left:0">
              <input type="checkbox" checked={!prefs.gofParamFixed} onchange={(e) => (prefs.gofParamFixed = !(e.currentTarget as HTMLInputElement).checked)} />
              Estimate parameter from sample mean (m = 1, reduces ν by 1)
            </label>
            {#if prefs.gofParamFixed}
              <label class="ctl">
                <span class="ctl-l">Fixed {prefs.gofModel === 'poisson' ? 'λ' : 'p'}</span>
                <input class="inp" type="number" step="0.05" min="0.01" bind:value={prefs.gofParamVal} />
              </label>
            {/if}
          {:else if prefs.gofModel === 'custom'}
            <label class="ctl">
              <span class="ctl-l">Expected counts</span>
              <div style="display:flex;gap:6px">
                <input class="inp" type="text" bind:value={gofExpRaw} />
                <button type="button" class="btn sm" onclick={applyGofExp}>Apply</button>
              </div>
            </label>
          {/if}
        {:else}
          <div class="ctl">
            <span class="ctl-l">Table size</span>
            <div class="st-presets" style="margin:0">
              <button type="button" class="chip" onclick={() => setContDims(2, 2)}>2 × 2</button>
              <button type="button" class="chip" onclick={() => setContDims(2, 3)}>2 × 3</button>
              <button type="button" class="chip" onclick={() => setContDims(3, 3)}>3 × 3</button>
            </div>
          </div>
        {/if}
      {/if}

      <p class="why">
        {#if prefs.mode === 'chi2'}
          In Edexcel S3, combine adjacent classes whenever Eᵢ &lt; 5 before computing X² = Σ(O − E)²/E and degrees of freedom ν = k_pooled − 1 − m.
        {:else if prefs.mode === 'normal'}
          For a sample of size n, X̄ ~ N(μ₀, σ²/n), giving standard error SE = σ/√n.
        {:else}
          For a discrete test, each tail of the critical region is chosen so its probability is at most α (or α/2 for two-tailed).
        {/if}
      </p>
    </div>

    <TopicLinks items={[
      { id: 'S2.4.4', label: 'Critical region' },
      { id: 'S2.4.5', label: '1 & 2-tailed' },
      { id: 'S2.4.6', label: 'Binomial & Poisson' },
      { id: 'S3.3.5', label: 'Normal mean Z' },
      { id: 'S3.4.1', label: 'χ² GoF' },
      { id: 'S3.4.2', label: 'Degrees of freedom' },
    ]} />
  </aside>
</main>
