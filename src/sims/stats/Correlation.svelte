<script lang="ts" module>
  import type { ScatterPoint } from './math';

  export interface CorrPrefs {
    points: ScatterPoint[];
    showLine: boolean;
    showResiduals: boolean;
    clickToAdd: boolean;
    predictX: number;
    testKind: 'pmcc' | 'spearman';
    testTail: 'one' | 'two';
    testAlpha: 0.10 | 0.05 | 0.02 | 0.01;
    cx: number;
    dx: number;
    cy: number;
    dy: number;
  }

  export const CORR_PREFS: CorrPrefs = {
    points: [
      { x: 2, y: 5.1 },
      { x: 4, y: 8.8 },
      { x: 5, y: 9.6 },
      { x: 7, y: 12.9 },
      { x: 8, y: 15.2 },
      { x: 10, y: 17.8 },
      { x: 12, y: 21.4 },
      { x: 14, y: 24.5 },
    ],
    showLine: true,
    showResiduals: false,
    clickToAdd: true,
    predictX: 9,
    testKind: 'pmcc',
    testTail: 'two',
    testAlpha: 0.05,
    cx: 2,
    dx: 2,
    cy: 5,
    dy: 5,
  };
</script>

<script lang="ts">
  import Seg from '../../components/ui/Seg.svelte';
  import SubTabs from '../../components/ui/SubTabs.svelte';
  import TopicLinks from './TopicLinks.svelte';
  import {
    dp4, fmt, fmtTrim, regressionStats, corrCritical, codedRegressionStats,
  } from './math';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: CorrPrefs;
    hidden?: boolean;
    stats?: [string, string | number][];
  } = $props();

  type SideView = 'summary' | 'ranks' | 'test' | 'coding';
  let sideView = $state<SideView>('summary');
  let selectedIdx = $state<number | null>(null);
  let dragIdx = $state<number | null>(null);
  let frozenDomain = $state<{ xmin: number; xmax: number; ymin: number; ymax: number } | null>(null);
  let alphaStr = $state('0.05');
  $effect(() => { alphaStr = String(prefs.testAlpha); });

  const PRESETS = [
    {
      id: 'pos', label: 'Positive linear',
      pts: [{ x: 2, y: 5.1 }, { x: 4, y: 8.8 }, { x: 5, y: 9.6 }, { x: 7, y: 12.9 }, { x: 8, y: 15.2 }, { x: 10, y: 17.8 }, { x: 12, y: 21.4 }, { x: 14, y: 24.5 }],
      px: 9,
    },
    {
      id: 'neg', label: 'Strong negative',
      pts: [{ x: 1, y: 28 }, { x: 3, y: 24 }, { x: 4, y: 20 }, { x: 6, y: 17 }, { x: 8, y: 12 }, { x: 9, y: 10 }, { x: 11, y: 6 }, { x: 13, y: 3 }],
      px: 7,
    },
    {
      id: 'mono', label: 'Curved monotonic (rₛ = 1)',
      pts: [{ x: 1, y: 1.2 }, { x: 2, y: 1.9 }, { x: 3, y: 3.1 }, { x: 4, y: 5.2 }, { x: 5, y: 8.5 }, { x: 6, y: 14 }, { x: 7, y: 23 }],
      px: 4.5,
    },
    {
      id: 'out', label: 'Outlier leverage',
      pts: [{ x: 2, y: 4 }, { x: 3, y: 5 }, { x: 4, y: 6.5 }, { x: 5, y: 7 }, { x: 6, y: 8.5 }, { x: 7, y: 10 }, { x: 14, y: 2 }],
      px: 6,
    },
  ];

  const reg = $derived.by(() => regressionStats(prefs.points));
  const critInfo = $derived.by(() => corrCritical(reg.n, prefs.testAlpha, prefs.testTail, prefs.testKind));
  const testObs = $derived(prefs.testKind === 'pmcc' ? Math.abs(reg.r) : Math.abs(reg.rs));
  const testReject = $derived(critInfo.value !== null && testObs > critInfo.value);

  const coded = $derived.by(() => codedRegressionStats(prefs.points, prefs.cx, prefs.dx, prefs.cy, prefs.dy));
  const predY = $derived(reg.a + reg.b * prefs.predictX);
  const isExtrapolation = $derived(prefs.predictX < reg.minX - 1e-9 || prefs.predictX > reg.maxX + 1e-9);

  $effect(() => {
    stats = [
      ['n', reg.n],
      ['PMCC r', fmt(reg.r, 4)],
      ['Spearman rₛ', fmt(reg.rs, 4)],
      ['Line', `y = ${fmt(reg.a, 2)} + ${fmt(reg.b, 2)}x`],
    ];
  });

  /* ---------- Scatter SVG Geometry & Dragging ---------- */
  const W = 640;
  const H = 360;
  const PAD = { l: 52, r: 22, t: 20, b: 40 };
  const PW = W - PAD.l - PAD.r;
  const PH = H - PAD.t - PAD.b;

  const autoDomain = $derived.by(() => {
    const xs = prefs.points.map((p) => p.x);
    const ys = prefs.points.map((p) => p.y);
    const x0 = Math.min(0, ...xs);
    const x1 = Math.max(10, ...xs);
    const y0 = Math.min(0, ...ys);
    const y1 = Math.max(10, ...ys);
    const px = Math.max(1, (x1 - x0) * 0.14);
    const py = Math.max(1, (y1 - y0) * 0.14);
    return { xmin: x0 - px * 0.4, xmax: x1 + px, ymin: y0 - py * 0.4, ymax: y1 + py };
  });

  const dom = $derived(frozenDomain ?? autoDomain);
  const sx = (x: number) => PAD.l + ((x - dom.xmin) / Math.max(1e-9, dom.xmax - dom.xmin)) * PW;
  const sy = (y: number) => PAD.t + PH - ((y - dom.ymin) / Math.max(1e-9, dom.ymax - dom.ymin)) * PH;
  const invSx = (px: number) => dom.xmin + ((px - PAD.l) / PW) * (dom.xmax - dom.xmin);
  const invSy = (py: number) => dom.ymin + ((PAD.t + PH - py) / PH) * (dom.ymax - dom.ymin);

  function ticksFor(lo: number, hi: number): number[] {
    const span = hi - lo;
    const raw = span / 6;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1e-6, raw))));
    const step = [1, 2, 2.5, 5, 10].find((f) => f * mag >= raw)! * mag;
    const out: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(3));
    return out;
  }

  let svgEl = $state<SVGSVGElement>();

  function clientToData(e: PointerEvent): ScatterPoint | null {
    if (!svgEl) return null;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return null;
    const local = pt.matrixTransform(ctm.inverse());
    return {
      x: +Math.max(dom.xmin, Math.min(dom.xmax, invSx(local.x))).toFixed(2),
      y: +Math.max(dom.ymin, Math.min(dom.ymax, invSy(local.y))).toFixed(2),
    };
  }

  function onPointDown(idx: number, e: PointerEvent) {
    e.stopPropagation();
    selectedIdx = idx;
    dragIdx = idx;
    frozenDomain = { ...dom };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  }

  function onPointKey(idx: number, e: KeyboardEvent) {
    const step = 0.5;
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Backspace', 'Delete'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Backspace' || e.key === 'Delete') {
      selectedIdx = idx;
      removeSelected();
      return;
    }
    const next = [...prefs.points];
    const p = { ...next[idx] };
    if (e.key === 'ArrowLeft') p.x = +(p.x - step).toFixed(1);
    if (e.key === 'ArrowRight') p.x = +(p.x + step).toFixed(1);
    if (e.key === 'ArrowUp') p.y = +(p.y + step).toFixed(1);
    if (e.key === 'ArrowDown') p.y = +(p.y - step).toFixed(1);
    next[idx] = p;
    prefs.points = next;
  }

  function onSvgMove(e: PointerEvent) {
    if (dragIdx === null) return;
    const p = clientToData(e);
    if (!p) return;
    const next = [...prefs.points];
    next[dragIdx] = { x: +p.x.toFixed(1), y: +p.y.toFixed(1) };
    prefs.points = next;
  }

  function onSvgUp() {
    dragIdx = null;
    frozenDomain = null;
  }

  function onBgDown(e: PointerEvent) {
    if (!prefs.clickToAdd || !svgEl) return;
    const target = e.target as Element;
    if (target.closest('.pt')) return;
    const pt = svgEl.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgEl.getScreenCTM();
    if (!ctm) return;
    const local = pt.matrixTransform(ctm.inverse());
    if (local.x < PAD.l || local.x > W - PAD.r || local.y < PAD.t || local.y > H - PAD.b) return;
    const nx = +invSx(local.x).toFixed(1);
    const ny = +invSy(local.y).toFixed(1);
    prefs.points = [...prefs.points, { x: nx, y: ny }];
    selectedIdx = prefs.points.length - 1;
  }

  function removeSelected() {
    if (selectedIdx === null || prefs.points.length <= 3) return;
    prefs.points = prefs.points.filter((_, i) => i !== selectedIdx);
    selectedIdx = null;
  }

  function addRandomPoint() {
    const nx = +(reg.minX + Math.random() * Math.max(4, reg.maxX - reg.minX)).toFixed(1);
    const ny = +(reg.a + reg.b * nx + (Math.random() - 0.5) * 4).toFixed(1);
    prefs.points = [...prefs.points, { x: nx, y: ny }];
    selectedIdx = prefs.points.length - 1;
  }
</script>

<main class="layout st-two" hidden={off}>
  <section class="panel stage" aria-label="Scatter and regression plot">
    <div class="stage-head">
      <div class="label-chip">
        Regression &amp; Correlation
        <small>S1 · S3</small>
      </div>
      <div class="stage-tools">
        <button type="button" class="btn sm" aria-pressed={prefs.showLine} onclick={() => (prefs.showLine = !prefs.showLine)}>Regression</button>
        <button type="button" class="btn sm" aria-pressed={prefs.showResiduals} onclick={() => (prefs.showResiduals = !prefs.showResiduals)}>Residuals</button>
        <button type="button" class="btn sm" aria-pressed={prefs.clickToAdd} onclick={() => (prefs.clickToAdd = !prefs.clickToAdd)}>Click adds</button>
        <button type="button" class="btn sm" onclick={addRandomPoint}>+ Point</button>
      </div>
    </div>

    <div class="st-presets">
      <small>Presets</small>
      {#each PRESETS as pr (pr.id)}
        <button type="button" class="chip" onclick={() => { prefs.points = pr.pts.map((p) => ({ ...p })); prefs.predictX = pr.px; selectedIdx = null; }}>{pr.label}</button>
      {/each}
    </div>

    <div class="st-board">
      <svg
        bind:this={svgEl}
        class="st-svg"
        viewBox="0 0 {W} {H}"
        onpointerdown={onBgDown}
        onpointermove={onSvgMove}
        onpointerup={onSvgUp}
        onpointercancel={onSvgUp}
        role="application"
        aria-label="Interactive scatter plot"
      >
        {#each ticksFor(dom.xmin, dom.xmax) as tx (tx)}
          <line class="grid" x1={sx(tx)} y1={PAD.t} x2={sx(tx)} y2={H - PAD.b} />
          <text class="tick-t" x={sx(tx)} y={H - PAD.b + 17} text-anchor="middle">{fmtTrim(tx, 1)}</text>
        {/each}
        {#each ticksFor(dom.ymin, dom.ymax) as ty (ty)}
          <line class="grid" x1={PAD.l} y1={sy(ty)} x2={W - PAD.r} y2={sy(ty)} />
          <text class="tick-t" x={PAD.l - 8} y={sy(ty) + 3} text-anchor="end">{fmtTrim(ty, 1)}</text>
        {/each}

        <!-- Mean (x̄, ȳ) crosshairs -->
        <line class="mean-line" x1={sx(reg.meanX)} y1={PAD.t} x2={sx(reg.meanX)} y2={H - PAD.b} opacity=".55" />
        <line class="mean-line" x1={PAD.l} y1={sy(reg.meanY)} x2={W - PAD.r} y2={sy(reg.meanY)} opacity=".55" />

        <!-- Regression line -->
        {#if prefs.showLine && reg.n >= 2}
          <line
            class="regline"
            x1={sx(dom.xmin)}
            y1={sy(reg.a + reg.b * dom.xmin)}
            x2={sx(dom.xmax)}
            y2={sy(reg.a + reg.b * dom.xmax)}
          />
        {/if}

        <!-- Residuals -->
        {#if prefs.showResiduals}
          {#each prefs.points as pt, idx (idx)}
            <line class="resline" x1={sx(pt.x)} y1={sy(pt.y)} x2={sx(pt.x)} y2={sy(reg.a + reg.b * pt.x)} />
          {/each}
        {/if}

        <!-- Mean point marker -->
        {#if reg.n >= 2}
          <circle cx={sx(reg.meanX)} cy={sy(reg.meanY)} r="6" fill="none" stroke="var(--amph)" stroke-width="2.2" />
        {/if}

        <!-- Draggable points -->
        {#each prefs.points as pt, idx (idx)}
          <circle
            class="pt"
            class:sel={selectedIdx === idx}
            cx={sx(pt.x)}
            cy={sy(pt.y)}
            r={selectedIdx === idx ? 7.5 : 6}
            role="slider"
            tabindex="0"
            aria-label={`Point ${idx + 1} (${pt.x}, ${pt.y})`}
            aria-valuenow={pt.x}
            onpointerdown={(e) => onPointDown(idx, e)}
            onkeydown={(e) => onPointKey(idx, e)}
          >
            <title>({pt.x}, {pt.y}) · e = {fmt(reg.residuals[idx] ?? 0, 2)}</title>
          </circle>
        {/each}

        <line class="axis" x1={PAD.l} y1={H - PAD.b} x2={W - PAD.r} y2={H - PAD.b} />
        <line class="axis" x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={H - PAD.b} />
        <text class="ax-lab" x={W / 2} y={H - 6} text-anchor="middle">Explanatory variable x (drag any point; click empty space to add)</text>
      </svg>

      <div class="st-key">
        <span><i class="k cond"></i> Least-squares y = {fmt(reg.a, 2)} + {fmt(reg.b, 2)}x</span>
        <span><i class="k approx"></i> Mean point (x̄, ȳ) = ({fmt(reg.meanX, 2)}, {fmt(reg.meanY, 2)})</span>
        {#if selectedIdx !== null && prefs.points[selectedIdx]}
          <span>
            Selected #{selectedIdx + 1}: ({prefs.points[selectedIdx].x}, {prefs.points[selectedIdx].y})
            {#if prefs.points.length > 3}
              <button type="button" class="btn sm" style="margin-left:6px" onclick={removeSelected}>Remove</button>
            {/if}
          </span>
        {/if}
      </div>
    </div>

    <div class="st-card" style="margin-top:12px">
      <h3>Summary Statistics (Formula Book Notation)</h3>
      <dl class="reads">
        <div><dt>S_xx = Σx² − (Σx)²/n</dt><dd>{fmt(reg.Sxx, 3)}</dd></div>
        <div><dt>S_yy = Σy² − (Σy)²/n</dt><dd>{fmt(reg.Syy, 3)}</dd></div>
        <div><dt>S_xy = Σxy − ΣxΣy/n</dt><dd>{fmt(reg.Sxy, 3)}</dd></div>
        <div><dt>PMCC r = S_xy / √(S_xx S_yy)</dt><dd>{fmt(reg.r, 4)}</dd></div>
        <div><dt>Gradient b = S_xy / S_xx</dt><dd>{fmt(reg.b, 4)}</dd></div>
        <div><dt>Intercept a = ȳ − bx̄</dt><dd>{fmt(reg.a, 4)}</dd></div>
      </dl>
    </div>
  </section>

  <aside class="panel side" aria-label="Correlation analysis">
    <div class="ph"><h2>Analysis</h2></div>
    <SubTabs label="Analysis tabs" options={[['summary', 'Predict'], ['ranks', 'Spearman'], ['test', 'S3 Test'], ['coding', 'Coding']] as const} bind:value={sideView} />

    <div class="ctls" style="padding-top:12px">
      {#if sideView === 'summary'}
        <div class="eq">y = {fmt(reg.a, 4)} + {fmt(reg.b, 4)}x</div>
        <label class="ctl">
          <span class="ctl-l">Predict y at x = <b>{fmtTrim(prefs.predictX, 2)}</b></span>
          <input class="inp" type="number" step="0.5" bind:value={prefs.predictX} />
        </label>
        <dl class="reads">
          <div><dt>Predicted ŷ</dt><dd>{fmt(predY, 3)}</dd></div>
          <div><dt>Reliability</dt><dd style="color:{isExtrapolation ? 'var(--redox)' : 'var(--good)'}">{isExtrapolation ? 'Extrapolation' : 'Interpolation'}</dd></div>
        </dl>
        <p class="why">
          {isExtrapolation
            ? `x = ${fmtTrim(prefs.predictX, 2)} lies outside [${fmtTrim(reg.minX, 1)}, ${fmtTrim(reg.maxX, 1)}]: extrapolation is unreliable because the linear trend may not hold outside the data range.`
            : `x = ${fmtTrim(prefs.predictX, 2)} lies inside the data range [${fmtTrim(reg.minX, 1)}, ${fmtTrim(reg.maxX, 1)}], so interpolation is appropriate (since |r| = ${fmt(Math.abs(reg.r), 3)}).`}
        </p>

      {:else if sideView === 'ranks'}
        <dl class="reads">
          <div><dt>Spearman rₛ = 1 − 6Σd²/(n(n²−1))</dt><dd>{fmt(reg.rs, 4)}</dd></div>
          <div><dt>Σd²</dt><dd>{fmtTrim(reg.sumD2, 2)}</dd></div>
        </dl>
        {#if reg.hasTies}
          <p class="why">Ties detected: exact PMCC on mid-ranks gives {fmt(reg.rsExact, 4)}.</p>
        {/if}
        <div class="mx-wrap">
          <table class="mx">
            <thead><tr><th>#</th><th>x</th><th>y</th><th>rank x</th><th>rank y</th><th>d²</th></tr></thead>
            <tbody>
              {#each prefs.points as pt, i (i)}
                <tr>
                  <th>{i + 1}</th>
                  <td>{fmtTrim(pt.x, 1)}</td>
                  <td>{fmtTrim(pt.y, 1)}</td>
                  <td>{fmtTrim(reg.rx[i], 1)}</td>
                  <td>{fmtTrim(reg.ry[i], 1)}</td>
                  <td>{fmtTrim(reg.d2[i], 2)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>

      {:else if sideView === 'test'}
        <div class="ctl">
          <span class="ctl-l">Coefficient</span>
          <Seg label="Correlation coefficient" options={[['pmcc', 'PMCC r'], ['spearman', 'Spearman rₛ']] as const} bind:value={prefs.testKind} />
        </div>
        <div class="row2">
          <div class="ctl">
            <span class="ctl-l">Tail</span>
            <Seg label="Tail" options={[['one', '1-tail'], ['two', '2-tail']] as const} bind:value={prefs.testTail} />
          </div>
          <label class="ctl">
            <span class="ctl-l">Total α</span>
            <select class="inp" value={alphaStr} onchange={(e) => (prefs.testAlpha = Number((e.currentTarget as HTMLSelectElement).value) as CorrPrefs['testAlpha'])}>
              <option value="0.10">10% (0.10)</option>
              <option value="0.05">5% (0.05)</option>
              <option value="0.02">2% (0.02)</option>
              <option value="0.01">1% (0.01)</option>
            </select>
          </label>
        </div>
        <ul class="st-work">
          <li><b>H₀ / H₁</b><span>H₀: ρ{prefs.testKind === 'spearman' ? 'ₛ' : ''} = 0 · H₁: ρ{prefs.testKind === 'spearman' ? 'ₛ' : ''} {prefs.testTail === 'two' ? '≠ 0' : '> 0 (or < 0)'}</span></li>
          <li><b>Observed</b><span>|{prefs.testKind === 'pmcc' ? 'r' : 'rₛ'}| = {fmt(testObs, 4)} (n = {reg.n})</span></li>
          <li><b>Table</b><span>{critInfo.note}</span></li>
        </ul>
        {#if critInfo.value !== null}
          <div class="st-verdict {testReject ? 'reject' : 'keep'}">
            <span class="st-pill {testReject ? 'bad' : 'ok'}">{testReject ? 'Significant' : 'Not significant'}</span>
            <span>
              {testReject
                ? `|${prefs.testKind === 'pmcc' ? 'r' : 'rₛ'}| = ${fmt(testObs, 4)} > ${dp4(critInfo.value)}: reject H₀, evidence of correlation at ${prefs.testAlpha * 100}% level.`
                : `|${prefs.testKind === 'pmcc' ? 'r' : 'rₛ'}| = ${fmt(testObs, 4)} ≤ ${dp4(critInfo.value)}: insufficient evidence of correlation.`}
            </span>
          </div>
        {/if}

      {:else}
        <p class="why">Linear coding u = (x − cₓ) / dₓ, v = (y − cᵧ) / dᵧ leaves |r| unchanged!</p>
        <div class="row2">
          <label class="ctl"><span class="ctl-l">cₓ</span><input class="inp" type="number" step="1" bind:value={prefs.cx} /></label>
          <label class="ctl"><span class="ctl-l">dₓ</span><input class="inp" type="number" step="1" bind:value={prefs.dx} /></label>
          <label class="ctl"><span class="ctl-l">cᵧ</span><input class="inp" type="number" step="1" bind:value={prefs.cy} /></label>
          <label class="ctl"><span class="ctl-l">dᵧ</span><input class="inp" type="number" step="1" bind:value={prefs.dy} /></label>
        </div>
        <dl class="reads">
          <div><dt>PMCC r(x, y)</dt><dd>{fmt(reg.r, 4)}</dd></div>
          <div><dt>PMCC r(u, v)</dt><dd>{fmt(coded.stats.r, 4)}</dd></div>
          <div><dt>Coded b_vu</dt><dd>{fmt(coded.stats.b, 4)}</dd></div>
          <div><dt>Coded line</dt><dd>v = {fmt(coded.stats.a, 2)} + {fmt(coded.stats.b, 2)}u</dd></div>
        </dl>
      {/if}
    </div>

    <TopicLinks items={[
      { id: 'S1.4.1', label: 'Scatter & line' },
      { id: 'S1.4.2', label: 'Interpolation' },
      { id: 'S1.4.3', label: 'PMCC & coding' },
      { id: 'S3.5.1', label: 'Spearman rₛ' },
      { id: 'S3.5.2', label: 'Correlation test' },
    ]} />
  </aside>
</main>
