<script lang="ts" module>
  export interface BoxPrefs {
    labelA: string;
    labelB: string;
    dataA: number[];
    dataB: number[];
    compare: boolean;
    rule: 'iqr' | 'sd';
    k: 1.5 | 1;
    codeA: number;
    codeB: number;
  }

  export const BOX_PREFS: BoxPrefs = {
    labelA: 'Class A',
    labelB: 'Class B',
    dataA: [18, 22, 24, 25, 27, 28, 30, 31, 33, 36, 48],
    dataB: [15, 19, 21, 22, 23, 25, 26, 27, 29, 30, 32],
    compare: true,
    rule: 'iqr',
    k: 1.5,
    codeA: 25,
    codeB: 5,
  };
</script>

<script lang="ts">
  import Seg from '../../components/ui/Seg.svelte';
  import TopicLinks from './TopicLinks.svelte';
  import { fmt, fmtTrim, parseNumList, boxPlotStats } from './math';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: BoxPrefs;
    hidden?: boolean;
    stats?: [string, string | number][];
  } = $props();

  const PRESETS = [
    {
      id: 'ab', label: 'Classes A vs B',
      a: [18, 22, 24, 25, 27, 28, 30, 31, 33, 36, 48],
      b: [15, 19, 21, 22, 23, 25, 26, 27, 29, 30, 32],
      cmp: true,
    },
    {
      id: 'pos', label: 'Right-skewed + outlier',
      a: [12, 13, 14, 15, 16, 17, 19, 22, 25, 29, 44],
      b: [14, 18, 20, 21, 22, 23, 24, 25, 27, 28, 30],
      cmp: false,
    },
    {
      id: 'neg', label: 'Negative skew',
      a: [8, 22, 29, 33, 36, 38, 39, 41, 42, 43, 44],
      b: [20, 22, 24, 25, 27, 28, 30, 31, 33, 35, 36],
      cmp: false,
    },
    {
      id: 'both_out', label: 'Two-end outliers',
      a: [4, 21, 23, 24, 25, 26, 26, 27, 28, 30, 46],
      b: [19, 21, 22, 24, 25, 26, 27, 28, 29, 31, 32],
      cmp: true,
    },
  ];

  let rawA = $state('');
  let rawB = $state('');
  let errA = $state('');
  let errB = $state('');
  $effect(() => { rawA = prefs.dataA.join(', '); });
  $effect(() => { rawB = prefs.dataB.join(', '); });

  function applyA() {
    const nums = parseNumList(rawA);
    if (nums.length < 4) { errA = 'Enter at least 4 numbers.'; return; }
    errA = '';
    prefs.dataA = nums;
  }
  function applyB() {
    const nums = parseNumList(rawB);
    if (nums.length < 4) { errB = 'Enter at least 4 numbers.'; return; }
    errB = '';
    prefs.dataB = nums;
  }

  let kStr = $state('1.5');
  $effect(() => { kStr = String(prefs.k); });

  const sA = $derived.by(() => boxPlotStats(prefs.dataA, prefs.rule, prefs.k));
  const sB = $derived.by(() => boxPlotStats(prefs.dataB, prefs.rule, prefs.k));
  const plotGroups = $derived(
    prefs.compare
      ? [{ name: prefs.labelA, st: sA, cy: 76, color: 'var(--accent)' }, { name: prefs.labelB, st: sB, cy: 172, color: 'var(--cond)' }]
      : [{ name: prefs.labelA, st: sA, cy: 90, color: 'var(--accent)' }],
  );

  const codedMean = $derived((sA.mean - prefs.codeA) / (prefs.codeB || 1));
  const codedSd = $derived(sA.popSd / Math.abs(prefs.codeB || 1));

  $effect(() => {
    stats = [
      ['Median Q₂', fmtTrim(sA.q2, 2)],
      ['IQR', fmtTrim(sA.iqr, 2)],
      ['Outliers', sA.outliers.length],
      ['Skew', sA.skewLabel.replace(' skew', '')],
    ];
  });

  /* ---------- SVG Box & Dot Plot ---------- */
  const W = 680;
  const H = $derived(prefs.compare ? 275 : 195);
  const PAD = { l: 78, r: 28, t: 22, b: 42 };
  const PW = W - PAD.l - PAD.r;

  const domain = $derived.by<[number, number]>(() => {
    const all = prefs.compare ? [...sA.sorted, ...sB.sorted] : sA.sorted;
    const lo = Math.min(...all, sA.lowFence, prefs.compare ? sB.lowFence : Infinity);
    const hi = Math.max(...all, sA.highFence, prefs.compare ? sB.highFence : -Infinity);
    const pad = Math.max(1, (hi - lo) * 0.08);
    return [lo - pad, hi + pad];
  });

  const sx = (x: number) => PAD.l + ((x - domain[0]) / Math.max(1e-9, domain[1] - domain[0])) * PW;

  const ticks = $derived.by(() => {
    const [lo, hi] = domain;
    const raw = (hi - lo) / 8;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw))));
    const step = [1, 2, 2.5, 5, 10].find((f) => f * mag >= raw)! * mag;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(3));
    return out;
  });

  const isOutlierVal = (val: number, st: ReturnType<typeof boxPlotStats>) =>
    val < st.lowFence - 1e-12 || val > st.highFence + 1e-12;
</script>

<main class="layout st-two" hidden={off}>
  <section class="panel stage" aria-label="Box plots and outliers">
    <div class="stage-head">
      <div class="label-chip">
        Box Plots &amp; Outliers
        <small>S1 · WST01</small>
      </div>
      <div class="stage-tools">
        <button type="button" class="btn sm" aria-pressed={prefs.compare} onclick={() => (prefs.compare = !prefs.compare)}>
          {prefs.compare ? 'Comparing 2 groups' : 'Compare 2 groups'}
        </button>
      </div>
    </div>

    <div class="st-presets">
      <small>Presets</small>
      {#each PRESETS as pr (pr.id)}
        <button
          type="button"
          class="chip"
          onclick={() => { prefs.dataA = [...pr.a]; prefs.dataB = [...pr.b]; prefs.compare = pr.cmp; }}
        >{pr.label}</button>
      {/each}
    </div>

    <div class="st-board">
      <svg class="st-svg" viewBox="0 0 {W} {H}" role="img" aria-label="Box plot comparison">
        {#each ticks as t (t)}
          <line class="grid" x1={sx(t)} y1={PAD.t} x2={sx(t)} y2={H - PAD.b} />
          <text class="tick-t" x={sx(t)} y={H - PAD.b + 17} text-anchor="middle">{fmtTrim(t, 1)}</text>
        {/each}

        {#each plotGroups as g (g.name)}
          {@const st = g.st}
          <text class="ax-lab" x={PAD.l - 10} y={g.cy + 4} text-anchor="end">{g.name}</text>

          <!-- Dashed outlier fences -->
          <line x1={sx(st.lowFence)} y1={g.cy - 28} x2={sx(st.lowFence)} y2={g.cy + 28} stroke="var(--redox)" stroke-opacity=".55" stroke-width="1.3" stroke-dasharray="3 3" />
          <line x1={sx(st.highFence)} y1={g.cy - 28} x2={sx(st.highFence)} y2={g.cy + 28} stroke="var(--redox)" stroke-opacity=".55" stroke-width="1.3" stroke-dasharray="3 3" />

          <!-- Dot strip above box -->
          {#each st.sorted as v, idx (idx)}
            {#if isOutlierVal(v, st)}
              {@const ox = sx(v)}
              {@const oy = g.cy - 34}
              <g>
                <line x1={ox - 4} y1={oy - 4} x2={ox + 4} y2={oy + 4} stroke="var(--redox)" stroke-width="2" />
                <line x1={ox - 4} y1={oy + 4} x2={ox + 4} y2={oy - 4} stroke="var(--redox)" stroke-width="2" />
                <title>Outlier: {v}</title>
              </g>
            {:else}
              <circle cx={sx(v)} cy={g.cy - 34} r="3.4" fill={g.color} fill-opacity=".75">
                <title>{v}</title>
              </circle>
            {/if}
          {/each}

          <!-- Whiskers -->
          <line x1={sx(st.whiskerLow)} y1={g.cy} x2={sx(st.q1)} y2={g.cy} stroke="var(--ink)" stroke-width="2" />
          <line x1={sx(st.q3)} y1={g.cy} x2={sx(st.whiskerHigh)} y2={g.cy} stroke="var(--ink)" stroke-width="2" />
          <line x1={sx(st.whiskerLow)} y1={g.cy - 11} x2={sx(st.whiskerLow)} y2={g.cy + 11} stroke="var(--ink)" stroke-width="2" />
          <line x1={sx(st.whiskerHigh)} y1={g.cy - 11} x2={sx(st.whiskerHigh)} y2={g.cy + 11} stroke="var(--ink)" stroke-width="2" />

          <!-- IQR box -->
          <rect
            x={sx(st.q1)}
            y={g.cy - 18}
            width={Math.max(2, sx(st.q3) - sx(st.q1))}
            height="36"
            rx="4"
            fill="color-mix(in srgb, var(--accent) 26%, var(--surf))"
            stroke={g.color}
            stroke-width="2.2"
          />

          <!-- Median & Mean -->
          <line x1={sx(st.q2)} y1={g.cy - 18} x2={sx(st.q2)} y2={g.cy + 18} stroke="var(--ink)" stroke-width="2.8" />
          <polygon
            points={`${sx(st.mean)},${g.cy - 5} ${sx(st.mean) + 5},${g.cy} ${sx(st.mean)},${g.cy + 5} ${sx(st.mean) - 5},${g.cy}`}
            fill="var(--amph)"
            stroke="var(--ink)"
            stroke-width="1"
          >
            <title>Mean x̄ = {fmt(st.mean, 2)}</title>
          </polygon>

          <!-- Outliers on box axis -->
          {#each st.outliers as ov, oi (oi)}
            <g>
              <line x1={sx(ov) - 4.5} y1={g.cy - 4.5} x2={sx(ov) + 4.5} y2={g.cy + 4.5} stroke="var(--redox)" stroke-width="2.4" />
              <line x1={sx(ov) - 4.5} y1={g.cy + 4.5} x2={sx(ov) + 4.5} y2={g.cy - 4.5} stroke="var(--redox)" stroke-width="2.4" />
            </g>
          {/each}
        {/each}

        <line class="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
        <text class="ax-lab" x={W / 2} y={H - 6} text-anchor="middle">Value (dashed lines show outlier fences; ◇ marks mean x̄; × marks outliers)</text>
      </svg>

      <div class="st-key">
        <span><i class="k on"></i> Box Q₁ to Q₃ (IQR)</span>
        <span><i class="k crit"></i> Outliers &amp; fences</span>
        <span><i class="k approx"></i> Mean ◇</span>
      </div>
    </div>

    <div class="st-card" style="margin-top:12px">
      <h3>Summary Measures ({prefs.labelA})</h3>
      <dl class="reads">
        <div><dt>Q₁ · Q₂ (Med) · Q₃</dt><dd>{fmtTrim(sA.q1, 2)} · {fmtTrim(sA.q2, 2)} · {fmtTrim(sA.q3, 2)}</dd></div>
        <div><dt>IQR &amp; Range</dt><dd>{fmtTrim(sA.iqr, 2)} · {fmtTrim(sA.range, 2)}</dd></div>
        <div><dt>Fences</dt><dd>[{fmt(sA.lowFence, 2)}, {fmt(sA.highFence, 2)}]</dd></div>
        <div><dt>Outliers</dt><dd style="color:{sA.outliers.length ? 'var(--redox)' : 'var(--good)'}">{sA.outliers.length ? sA.outliers.join(', ') : 'None'}</dd></div>
        <div><dt>Mean x̄ &amp; SD σ</dt><dd>{fmt(sA.mean, 2)} · σ = {fmt(sA.popSd, 2)} (s = {fmt(sA.sampleSd, 2)})</dd></div>
        <div><dt>Skewness</dt><dd>{sA.skewLabel} ({fmt(sA.pearsonSkew, 2)})</dd></div>
      </dl>
      <div class="eq" style="margin-top:8px">
        {sA.q1Detail}<br />{sA.q2Detail}<br />{sA.q3Detail}
      </div>

      {#if prefs.compare}
        <div class="st-verdict keep" style="margin-top:10px">
          <span class="st-pill ok">Compare A &amp; B</span>
          <span>
            {sA.q2 === sB.q2
              ? `Same median (${fmtTrim(sA.q2, 2)}). `
              : `${sA.q2 > sB.q2 ? prefs.labelA : prefs.labelB} has a higher median (${fmtTrim(sA.q2, 2)} vs ${fmtTrim(sB.q2, 2)}). `}
            {sA.iqr === sB.iqr
              ? `Equal IQR (${fmtTrim(sA.iqr, 2)}). `
              : `${sA.iqr > sB.iqr ? prefs.labelA : prefs.labelB} is more spread out (IQR ${fmtTrim(sA.iqr, 2)} vs ${fmtTrim(sB.iqr, 2)}). `}
            {prefs.labelA} has {sA.skewLabel.toLowerCase()} ({sA.outliers.length} outlier{sA.outliers.length === 1 ? '' : 's'}); {prefs.labelB} has {sB.skewLabel.toLowerCase()} ({sB.outliers.length} outlier{sB.outliers.length === 1 ? '' : 's'}).
          </span>
        </div>
      {/if}
    </div>
  </section>

  <aside class="panel side" aria-label="Dataset & coding controls">
    <div class="ph"><h2>Datasets &amp; Coding</h2></div>
    <div class="ctls">
      <div class="ctl">
        <span class="ctl-l">Outlier rule</span>
        <Seg label="Outlier rule" options={[['iqr', 'Q₁−k·IQR / Q₃+k·IQR'], ['sd', 'x̄ ± 2σ']] as const} bind:value={prefs.rule} />
      </div>
      {#if prefs.rule === 'iqr'}
        <div class="ctl">
          <span class="ctl-l">Multiplier k</span>
          <Seg label="Fence k" options={[['1.5', 'k = 1.5 (standard)'], ['1', 'k = 1.0']] as const} bind:value={kStr} onchange={(v) => (prefs.k = Number(v) as 1 | 1.5)} />
        </div>
      {/if}

      <label class="ctl">
        <span class="ctl-l">{prefs.labelA} values (n = {sA.n})</span>
        <textarea class="inp" bind:value={rawA} rows="2"></textarea>
        <div style="display:flex;gap:8px;align-items:center">
          <button type="button" class="btn sm" onclick={applyA}>Update {prefs.labelA}</button>
          {#if errA}<span class="muted" style="color:var(--redox)">{errA}</span>{/if}
        </div>
      </label>

      {#if prefs.compare}
        <label class="ctl">
          <span class="ctl-l">{prefs.labelB} values (n = {sB.n})</span>
          <textarea class="inp" bind:value={rawB} rows="2"></textarea>
          <div style="display:flex;gap:8px;align-items:center">
            <button type="button" class="btn sm" onclick={applyB}>Update {prefs.labelB}</button>
            {#if errB}<span class="muted" style="color:var(--redox)">{errB}</span>{/if}
          </div>
        </label>
      {/if}

      <div class="st-card" style="margin:4px 0 0">
        <h3>Linear Coding: y = (x − a) / b</h3>
        <div class="row2" style="margin-bottom:8px">
          <label class="ctl"><span class="ctl-l">Shift a</span><input class="inp" type="number" step="1" bind:value={prefs.codeA} /></label>
          <label class="ctl"><span class="ctl-l">Scale b</span><input class="inp" type="number" step="1" bind:value={prefs.codeB} /></label>
        </div>
        <dl class="reads">
          <div><dt>ȳ = (x̄ − a)/b</dt><dd>{fmt(codedMean, 3)}</dd></div>
          <div><dt>σ_y = σ_x / |b|</dt><dd>{fmt(codedSd, 3)}</dd></div>
        </dl>
      </div>

      <p class="why">
        Edexcel discrete quartiles compute pos = n/4, n/2, 3n/4: whole numbers average pos &amp; pos+1; fractions round up. Subtracting a shifts x̄, Q₁, Q₂, Q₃ by −a, while dividing by b scales both location and spread (IQR, σ).
      </p>
    </div>

    <TopicLinks items={[
      { id: 'S1.2.1', label: 'Box plots' },
      { id: 'S1.2.2', label: 'Mean & median' },
      { id: 'S1.2.3', label: 'Variance & SD' },
      { id: 'S1.2.4', label: 'Skewness & outliers' },
    ]} />
  </aside>
</main>
