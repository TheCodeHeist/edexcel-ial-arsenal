<script lang="ts" module>
  import type { CltPopId } from './math';

  export interface CltPrefs {
    pop: CltPopId;
    n: number;
    conf: 90 | 95 | 99;
    showCI: boolean;
  }

  export const CLT_PREFS: CltPrefs = {
    pop: 'skew',
    n: 20,
    conf: 95,
    showCI: true,
  };
</script>

<script lang="ts">
  import Seg from '../../components/ui/Seg.svelte';
  import TopicLinks from './TopicLinks.svelte';
  import {
    fmt, fmtTrim, normalPdf, invPhi, CLT_POPS, drawCltSample,
  } from './math';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: CltPrefs;
    hidden?: boolean;
    stats?: [string, string | number][];
  } = $props();

  interface CltCI {
    mean: number;
    lo: number;
    hi: number;
    hit: boolean;
  }

  let means = $state<number[]>([]);
  let biasedVars = $state<number[]>([]);
  let unbiasedVars = $state<number[]>([]);
  let lastSample = $state<number[]>([]);
  let ciRecent = $state<CltCI[]>([]);
  let ciHits = $state(0);
  let ciTotal = $state(0);

  const POP_OPTS = [
    ['skew', 'Exp (skewed)', 'Exp'],
    ['uniform', 'Uniform', 'U'],
    ['bimodal', 'Bimodal', 'Bimod'],
    ['die', 'Fair die', 'Die'],
    ['u_shaped', 'U-shaped', 'Arc'],
  ] as const;

  const SAMPLE_SIZES = [2, 5, 10, 20, 30, 50] as const;

  const popInfo = $derived(CLT_POPS[prefs.pop]);
  const se = $derived(popInfo.sigma / Math.sqrt(Math.max(1, prefs.n)));
  const zCrit = $derived(invPhi(0.5 + prefs.conf / 200));

  export function resetAndSeed(initial = 100) {
    means = [];
    biasedVars = [];
    unbiasedVars = [];
    lastSample = [];
    ciRecent = [];
    ciHits = 0;
    ciTotal = 0;
    if (initial > 0) drawMany(initial);
  }

  export function drawMany(count: number) {
    const newMeans: number[] = [];
    const newB: number[] = [];
    const newU: number[] = [];
    const newCIs: CltCI[] = [];
    let latest: number[] = lastSample;
    const hw = zCrit * se;
    const mu = popInfo.mu;

    for (let i = 0; i < count; i++) {
      const s = drawCltSample(prefs.pop, prefs.n);
      newMeans.push(s.mean);
      newB.push(s.biasedVar);
      newU.push(s.unbiasedVar);
      latest = s.values;
      const lo = s.mean - hw;
      const hi = s.mean + hw;
      const hit = mu >= lo && mu <= hi;
      if (hit) ciHits++;
      ciTotal++;
      if (i >= count - 20) newCIs.push({ mean: s.mean, lo, hi, hit });
    }

    lastSample = latest;
    means = [...means, ...newMeans].slice(-5000);
    biasedVars = [...biasedVars, ...newB].slice(-5000);
    unbiasedVars = [...unbiasedVars, ...newU].slice(-5000);
    ciRecent = [...ciRecent, ...newCIs].slice(-20);
  }

  // Auto-reseed whenever pop or n changes
  let lastKey = '';
  $effect(() => {
    const key = `${prefs.pop}:${prefs.n}`;
    if (key !== lastKey) {
      lastKey = key;
      resetAndSeed(120);
    }
  });

  // Update CI hit history if confidence level flips
  let lastConf: 90 | 95 | 99 | 0 = 0;
  $effect(() => {
    if (lastConf === 0) { lastConf = prefs.conf; return; }
    if (prefs.conf !== lastConf) {
      lastConf = prefs.conf;
      const hw = zCrit * se;
      const mu = popInfo.mu;
      let h = 0;
      for (const m of means) {
        if (mu >= m - hw && mu <= m + hw) h++;
      }
      ciHits = h;
      ciTotal = means.length;
      ciRecent = means.slice(-20).map((m) => ({ mean: m, lo: m - hw, hi: m + hw, hit: mu >= m - hw && mu <= m + hw }));
    }
  });

  const empStats = $derived.by(() => {
    const k = means.length;
    if (k === 0) return { mean: popInfo.mu, sd: se, meanBiased: 0, meanUnbiased: 0 };
    const m = means.reduce((s, v) => s + v, 0) / k;
    const sd = Math.sqrt(means.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, k));
    const mb = biasedVars.reduce((s, v) => s + v, 0) / k;
    const mu = unbiasedVars.reduce((s, v) => s + v, 0) / k;
    return { mean: m, sd, meanBiased: mb, meanUnbiased: mu };
  });

  $effect(() => {
    stats = [
      ['Samples', means.length],
      ['n', prefs.n],
      ['Mean(X̄)', fmt(empStats.mean, 3)],
      ['SD(X̄) vs σ/√n', `${fmt(empStats.sd, 3)} / ${fmt(se, 3)}`],
    ];
  });

  /* ---------- Plot Geometry ---------- */
  const W = 680;
  const H_POP = 135;
  const H_CLT = 220;
  const PAD = { l: 44, r: 24, t: 18, b: 32 };
  const PW = W - PAD.l - PAD.r;

  const popCurve = $derived.by(() => {
    const [xmin, xmax] = popInfo.domain;
    const sx = (x: number) => PAD.l + ((x - xmin) / (xmax - xmin)) * PW;
    if (popInfo.discrete) {
      const maxP = 0.25;
      const sy = (y: number) => 16 + (H_POP - 44) * (1 - y / maxP);
      return { sx, sy, path: '', bars: [1, 2, 3, 4, 5, 6] };
    }
    let maxY = 0.1;
    for (let i = 0; i <= 100; i++) {
      const x = xmin + ((xmax - xmin) * i) / 100;
      maxY = Math.max(maxY, Math.min(0.6, popInfo.pdf(x)));
    }
    const sy = (y: number) => 16 + (H_POP - 44) * (1 - Math.min(y, maxY * 1.1) / (maxY * 1.1));
    const pts: string[] = [];
    for (let i = 0; i <= 120; i++) {
      const x = xmin + ((xmax - xmin) * i) / 120;
      pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(popInfo.pdf(x)).toFixed(1)}`);
    }
    return { sx, sy, path: pts.join(' '), bars: [] as number[] };
  });

  const cltPlot = $derived.by(() => {
    const [dMin, dMax] = popInfo.domain;
    const sx = (x: number) => PAD.l + ((x - dMin) / (dMax - dMin)) * PW;
    const bins = 36;
    const bw = (dMax - dMin) / bins;
    const counts = new Array<number>(bins).fill(0);
    for (const m of means) {
      const idx = Math.max(0, Math.min(bins - 1, Math.floor((m - dMin) / bw)));
      counts[idx]++;
    }
    const total = Math.max(1, means.length);
    const densities = counts.map((c) => c / (total * bw));
    const cltPeak = normalPdf(popInfo.mu, popInfo.mu, se);
    const maxY = Math.max(cltPeak * 1.15, ...densities, 0.05);
    const sy = (y: number) => PAD.t + (H_CLT - PAD.t - PAD.b) * (1 - y / maxY);

    const pts: string[] = [];
    for (let i = 0; i <= 140; i++) {
      const x = dMin + ((dMax - dMin) * i) / 140;
      pts.push(`${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(normalPdf(x, popInfo.mu, se)).toFixed(1)}`);
    }
    return { dMin, dMax, bw, counts, densities, sx, sy, curve: pts.join(' ') };
  });

  let confStr = $state('95');
  $effect(() => { confStr = String(prefs.conf); });
</script>

<main class="layout st-two" hidden={off}>
  <section class="panel stage" aria-label="Central limit theorem sampler">
    <div class="stage-head">
      <div class="label-chip">
        Sampling &amp; Central Limit Theorem
        <small>S3 · WST03</small>
      </div>
      <div class="stage-tools">
        <Seg label="Population shape" options={POP_OPTS} bind:value={prefs.pop} />
      </div>
    </div>

    <div class="st-presets">
      <small>Draw samples</small>
      <button type="button" class="btn sm primary" onclick={() => drawMany(1)}>+1 sample</button>
      <button type="button" class="btn sm" onclick={() => drawMany(50)}>+50</button>
      <button type="button" class="btn sm" onclick={() => drawMany(500)}>+500</button>
      <button type="button" class="btn sm" onclick={() => resetAndSeed(0)}>Clear</button>
    </div>

    <div class="st-board">
      <!-- 1. Parent Population -->
      <svg class="st-svg" viewBox="0 0 {W} {H_POP}" role="img" aria-label="Parent population and latest sample">
        <text class="ax-lab" x={PAD.l} y="13">Parent population: {popInfo.formula}</text>
        {#if popInfo.discrete}
          {#each popCurve.bars as k (k)}
            {@const bx = popCurve.sx(k) - 18}
            <rect class="bar" x={bx} y={popCurve.sy(1 / 6)} width="36" height={H_POP - 28 - popCurve.sy(1 / 6)} rx="3" />
            <text class="tick-t" x={popCurve.sx(k)} y={H_POP - 12} text-anchor="middle">{k}</text>
          {/each}
        {:else}
          <path class="curve" d={popCurve.path} />
          {#each [0, 2, 4, 6, 8, 10] as tk (tk)}
            <text class="tick-t" x={popCurve.sx(tk)} y={H_POP - 12} text-anchor="middle">{tk}</text>
          {/each}
        {/if}

        <!-- Latest single sample dots -->
        {#each lastSample.slice(0, 50) as xv, idx (idx)}
          {@const cx = popCurve.sx(Math.min(popInfo.domain[1], Math.max(popInfo.domain[0], xv)))}
          <circle cx={cx} cy={H_POP - 34 - (idx % 3) * 5} r="2.8" fill="var(--accent)" fill-opacity=".8" />
        {/each}
        <line class="mean-line" x1={popCurve.sx(popInfo.mu)} y1="18" x2={popCurve.sx(popInfo.mu)} y2={H_POP - 28} />
        <line class="axis" x1={PAD.l} y1={H_POP - 28} x2={W - PAD.r} y2={H_POP - 28} />
      </svg>

      <!-- 2. Sampling Distribution of X̄ -->
      <svg class="st-svg" viewBox="0 0 {W} {H_CLT}" style="margin-top:8px" role="img" aria-label="Distribution of sample means X-bar">
        <text class="ax-lab" x={PAD.l} y="14">Distribution of sample means X̄ (K = {means.length}, n = {prefs.n}) vs CLT curve N({fmtTrim(popInfo.mu, 2)}, {fmt(se * se, 3)})</text>
        {#each cltPlot.densities as dens, i (i)}
          {@const x0 = cltPlot.dMin + i * cltPlot.bw}
          {@const bx = cltPlot.sx(x0)}
          {@const bx1 = cltPlot.sx(x0 + cltPlot.bw)}
          {@const by = cltPlot.sy(dens)}
          <rect
            class="bar on"
            x={bx + 0.5}
            y={by}
            width={Math.max(1, bx1 - bx - 1)}
            height={Math.max(0, H_CLT - PAD.b - by)}
          />
        {/each}

        <path class="curve approx" d={cltPlot.curve} />
        <line class="mean-line" x1={cltPlot.sx(popInfo.mu)} y1={PAD.t} x2={cltPlot.sx(popInfo.mu)} y2={H_CLT - PAD.b} />

        {#each [0, 0.2, 0.4, 0.6, 0.8, 1] as f (f)}
          {@const xv = cltPlot.dMin + f * (cltPlot.dMax - cltPlot.dMin)}
          <text class="tick-t" x={cltPlot.sx(xv)} y={H_CLT - PAD.b + 16} text-anchor="middle">{fmtTrim(xv, 1)}</text>
        {/each}
        <line class="axis" x1={PAD.l} y1={H_CLT - PAD.b} x2={W - PAD.r} y2={H_CLT - PAD.b} />
        <line class="axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H_CLT - PAD.b} />
      </svg>

      <!-- 3. Confidence Interval Strip -->
      {#if prefs.showCI && ciRecent.length > 0}
        <svg class="st-svg" viewBox="0 0 {W} 140" style="margin-top:8px" role="img" aria-label="Confidence intervals coverage">
          <text class="ax-lab" x={PAD.l} y="14">Last {ciRecent.length} {prefs.conf}% confidence intervals (x̄ ± z·σ/√n) · {ciTotal > 0 ? ((ciHits / ciTotal) * 100).toFixed(1) : '—'}% capture μ = {fmtTrim(popInfo.mu, 2)}</text>
          <line class="mean-line" x1={cltPlot.sx(popInfo.mu)} y1="22" x2={cltPlot.sx(popInfo.mu)} y2="132" />
          {#each ciRecent as ci, idx (idx)}
            {@const ry = 26 + idx * 5.2}
            {@const col = ci.hit ? 'var(--good)' : 'var(--redox)'}
            <line x1={cltPlot.sx(Math.max(cltPlot.dMin, ci.lo))} y1={ry} x2={cltPlot.sx(Math.min(cltPlot.dMax, ci.hi))} y2={ry} stroke={col} stroke-width="2" />
            <circle cx={cltPlot.sx(Math.max(cltPlot.dMin, Math.min(cltPlot.dMax, ci.mean)))} cy={ry} r="2.2" fill={col} />
          {/each}
        </svg>
      {/if}

      <div class="st-key">
        <span><i class="k on"></i> Observed X̄ histogram</span>
        <span><i class="k approx"></i> CLT Normal N(μ, σ²/n)</span>
        {#if prefs.showCI}
          <span><i class="k good"></i> CI captures μ</span>
          <span><i class="k crit"></i> CI misses μ</span>
        {/if}
      </div>
    </div>

    <div class="st-card" style="margin-top:12px">
      <h3>Unbiased Estimators &amp; Central Limit Theorem</h3>
      <dl class="reads">
        <div><dt>True μ vs Mean(X̄)</dt><dd>{fmt(popInfo.mu, 3)} vs {fmt(empStats.mean, 3)}</dd></div>
        <div><dt>True σ/√n vs SD(X̄)</dt><dd>{fmt(se, 3)} vs {fmt(empStats.sd, 3)}</dd></div>
        <div><dt>Mean S² (div by n−1)</dt><dd>{fmt(empStats.meanUnbiased, 3)} (true σ² = {fmt(popInfo.sigma ** 2, 3)})</dd></div>
        <div><dt>Mean biased (div by n)</dt><dd style="color:var(--redox)">{fmt(empStats.meanBiased, 3)} (underestimates!)</dd></div>
      </dl>
    </div>
  </section>

  <aside class="panel side" aria-label="CLT & CI controls">
    <div class="ph"><h2>Sampling Controls</h2></div>
    <div class="ctls">
      <div class="ctl">
        <span class="ctl-l">Sample size n <b>{prefs.n}</b></span>
        <div class="st-presets" style="margin:0">
          {#each SAMPLE_SIZES as sz (sz)}
            <button type="button" class="chip" aria-pressed={prefs.n === sz} onclick={() => (prefs.n = sz)}>n = {sz}</button>
          {/each}
        </div>
      </div>

      <div class="ctl">
        <span class="ctl-l">Confidence level</span>
        <Seg label="Confidence level" options={[['90', '90%'], ['95', '95%'], ['99', '99%']] as const} bind:value={confStr} onchange={(v) => (prefs.conf = Number(v) as 90 | 95 | 99)} />
      </div>

      <label class="sb-quiz" style="margin-left:0">
        <input type="checkbox" bind:checked={prefs.showCI} />
        Show live confidence-interval strip
      </label>

      <dl class="reads">
        <div><dt>z_crit ({prefs.conf}%)</dt><dd>{fmt(zCrit, 4)}</dd></div>
        <div><dt>Half-width z·σ/√n</dt><dd>{fmt(zCrit * se, 3)}</dd></div>
        <div><dt>Capture rate</dt><dd>{ciHits}/{ciTotal} ({ciTotal ? ((ciHits / ciTotal) * 100).toFixed(1) : '—'}%)</dd></div>
        <div><dt>Standard Error</dt><dd>{fmt(se, 4)}</dd></div>
      </dl>

      <p class="why">
        By the Central Limit Theorem, even for skewed or bimodal parent populations, X̄ is approximately N(μ, σ²/n) for large n (typically n ≥ 30). Notice how dividing S² by (n − 1) rather than n avoids underestimating σ².
      </p>
    </div>

    <TopicLinks items={[
      { id: 'S3.3.1', label: 'SE & unbiased S²' },
      { id: 'S3.3.2', label: 'Dist of X̄' },
      { id: 'S3.3.3', label: 'CI concept' },
      { id: 'S3.3.4', label: 'CI limits' },
      { id: 'S3.3.6', label: 'CLT' },
    ]} />
  </aside>
</main>
