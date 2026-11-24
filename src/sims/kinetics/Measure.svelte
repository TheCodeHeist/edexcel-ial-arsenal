<script lang="ts" module>
  import type { RxId, Method, Size } from './measure';
  export interface MeasurePrefs {
    rx: RxId; method: Method;
    conc: number; temp: number; size: Size; cat: number; mg: number; vThio: number; i2: number; prop: number; acid: number;
    speed: number; plotBy: 'conc' | 'temp';
  }
  export const MEASURE: MeasurePrefs = {
    rx: 'marble', method: 'syringe', conc: 0.4, temp: 25, size: 'small', cat: 0.2, mg: 0.08, vThio: 50, i2: 0.004, prop: 1.0, acid: 0.5,
    speed: 5, plotBy: 'conc',
  };
</script>

<script lang="ts">
  /* Measuring rates (spec 9.3, 11.3, 11.4ii and the Topic 9A practicals). Five reactions on a 3D bench, each followed
     by a method that suits it: a gas syringe, mass loss on a balance, the disappearing cross or a colorimeter. The
     graph grows as the reaction runs; a ruler laid along the curve gives the rate at any moment as a gradient (the
     initial rate at t = 0), checked against the true value. The cross gives rate ∝ 1/t, with a results table. */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Plot from '../circuit/Plot.svelte';
  import type { BLook } from './measure3d';
  import { RX, METHOD_NAME, simulate, readAt, thioConc, THIO0, S_CROSS, EPS, MASS0, TECHS, TECH_Q, type Setup, type Tech } from './measure';
  import { sci, plain } from './consts';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';
  import { untrack } from 'svelte';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: MeasurePrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const rxi = $derived(RX.find((r) => r.id === prefs.rx) ?? RX[0]);
  $effect.pre(() => { if (!rxi.methods.includes(prefs.method)) prefs.method = rxi.methods[0]; });
  const setup = $derived<Setup>({ rx: prefs.rx, method: rxi.methods.includes(prefs.method) ? prefs.method : rxi.methods[0], conc: prefs.conc, temp: prefs.temp, size: prefs.size, cat: prefs.cat, mg: prefs.mg, vThio: prefs.vThio, i2: prefs.i2, prop: prefs.prop, acid: prefs.acid });
  const run = $derived(simulate(setup));
  const isCross = $derived(setup.method === 'cross');

  /* ---------- the clock ---------- */
  let t = $state(0);
  let running = $state(false);
  let skey = '';
  $effect(() => { const k = JSON.stringify(setup); if (k !== skey) { skey = k; t = 0; running = false; tan = null; recorded = false; } });
  $effect(() => { if (off) running = false; });
  $effect(() => {
    if (!running) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const g = frameReady(now, last);
      if (g !== 'go') { if (g === 'hidden') last = now; raf = requestAnimationFrame(step); return; }
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      const nt = Math.min(run.tEnd, t + dt * prefs.speed);
      t = nt;
      if (nt >= run.tEnd) { running = false; return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
  function go() { if (t >= run.tEnd) t = 0; running = !running; }
  function reset() { running = false; t = 0; tan = null; recorded = false; }
  function finish() { running = false; t = run.tEnd; }

  /* ---------- the readings ---------- */
  const reading = $derived(readAt(run, t));
  const fmtY = (v: number) => (run.res >= 1 ? v.toFixed(0) : run.res >= 0.01 ? v.toFixed(2) : v.toFixed(3));
  const pts = $derived.by(() => {
    const out: { x: number; y: number }[] = [];
    for (let s = 0; s <= t + 1e-9; s += run.every) out.push({ x: s, y: readAt(run, s) });
    return out;
  });
  const massShown = $derived(setup.method === 'mass' ? (MASS0[setup.rx] - reading).toFixed(2) : '');
  const rate0 = $derived(run.dy(0));
  const rateNow = $derived(run.dy(t));

  /* ---------- the thiosulfate results table (rate = 1/t) ---------- */
  interface Row { v: number; c: number; T: number; t: number }
  let rows = $state<Row[]>([]);
  let recorded = false;
  $effect(() => {
    // read every dependency first: an early return would otherwise leave the effect blind to t and run
    const now = t, ct = run.crossT, cross = isCross, v = prefs.vThio, T = prefs.temp;
    if (!cross || recorded || ct === null || now < ct) return;
    recorded = true;
    const tt = Math.max(1, Math.round(ct));
    rows = [...untrack(() => rows).filter((r) => !(r.v === v && r.T === T)), { v, c: thioConc(v), T, t: tt }]
      .sort((a, b) => a.T - b.T || a.v - b.v);
  });
  const rowsPlot = $derived(prefs.plotBy === 'conc' ? rows.filter((r) => r.T === prefs.temp) : rows.filter((r) => r.v === prefs.vThio));
  const plotPts = $derived(rowsPlot.map((r) => ({ x: prefs.plotBy === 'conc' ? r.c : r.T, y: 1000 / r.t })));
  const fitLine = $derived.by(() => {
    if (prefs.plotBy !== 'conc' || plotPts.length < 2) return null;
    const m = plotPts.reduce((s, p) => s + p.x * p.y, 0) / plotPts.reduce((s, p) => s + p.x * p.x, 0);   // through the origin
    return { m, c: 0 };
  });
  const yTop = $derived(Math.max(10, ...plotPts.map((p) => p.y * 1.15)));

  /* ---------- the graph and the tangent ruler ---------- */
  const W = 520, H = 300, ML = 58, MR = 16, MT = 16, MB = 40;
  const sx = (x: number) => ML + (x / run.tEnd) * (W - ML - MR);
  const sy = (y: number) => H - MB - (y / run.yMax) * (H - MT - MB);
  function ticks(a: number, b: number) {
    if (!(b > a)) return [];
    const raw = (b - a) / 6, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = ([1, 2, 2.5, 5, 10].find((k) => k * p >= raw) ?? 10) * p;
    const out: number[] = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-6 && out.length < 30; v += st) out.push(Number(v.toPrecision(6)));
    return out;
  }
  const curve = $derived.by(() => {
    const N = 240, out: string[] = [];
    for (let i = 0; i <= N; i++) { const x = (run.tEnd * i) / N; if (x > t + 1e-9) break; out.push(`${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(Math.min(run.yMax, run.y(x))).toFixed(1)}`); }
    if (t > 0) out.push(`L${sx(t).toFixed(1)} ${sy(Math.min(run.yMax, run.y(t))).toFixed(1)}`);
    return out.join('');
  });
  let tan = $state<{ x: number; g: number } | null>(null);
  let truth = $state(false);
  function placeTangent(x: number) { tan = { x, g: run.dy(x) * (0.55 + Math.random() * 0.25) }; truth = false; }
  const tanTrue = $derived(tan ? run.dy(tan.x) : 0);
  const tanY = $derived(tan ? run.y(tan.x) : 0);
  /** the ruler: clipped to the plot */
  const ruler = $derived.by(() => {
    if (!tan) return null;
    const span = run.tEnd * 0.32;
    const yAt = (x: number) => tanY + tan!.g * (x - tan!.x);
    const clipX = (x: number) => {
      const y = yAt(x);
      if (tan!.g !== 0 && y > run.yMax) return tan!.x + (run.yMax - tanY) / tan!.g;
      if (tan!.g !== 0 && y < 0) return tan!.x - tanY / tan!.g;
      return x;
    };
    const x1 = Math.max(-run.tEnd * 0.05, clipX(tan.x - span)), x2 = Math.min(run.tEnd, clipX(tan.x + span));
    const hx = tan.x + (x2 - tan.x) * 0.8;
    return { x1, x2, y1: yAt(x1), y2: yAt(x2), hx, hy: yAt(hx) };
  });
  // the triangle for Δy/Δx, drawn on the ruler
  const tri = $derived.by(() => {
    if (!ruler || !tan) return null;
    const a = Math.max(ruler.x1, 0), b = ruler.x2;
    if (b - a < run.tEnd * 0.05) return null;
    const ya = tanY + tan.g * (a - tan.x), yb = tanY + tan.g * (b - tan.x);
    return { a, b, ya, yb, dx: b - a, dy: yb - ya };
  });
  let svg = $state<SVGSVGElement>();
  let drag: 'pt' | 'rot' | null = null;
  function toData(e: PointerEvent) {
    const m = svg?.getScreenCTM(); if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: ((p.x - ML) / (W - ML - MR)) * run.tEnd, y: ((H - MB - p.y) / (H - MT - MB)) * run.yMax };
  }
  function down(kind: 'pt' | 'rot', e: PointerEvent) { drag = kind; (e.currentTarget as Element).setPointerCapture(e.pointerId); e.preventDefault(); truth = false; }
  function move(e: PointerEvent) {
    if (!drag || !tan) return;
    const d = toData(e); if (!d) return;
    if (drag === 'pt') tan = { x: Math.max(0, Math.min(t, d.x)), g: tan.g };
    else if (Math.abs(d.x - tan.x) > run.tEnd * 0.02) tan = { x: tan.x, g: (d.y - tanY) / (d.x - tan.x) };
  }
  function up() { drag = null; }
  function nudge(f: number) { if (tan) tan = { x: tan.x, g: tan.g * f }; }
  function showTrue() { if (tan) { tan = { x: tan.x, g: tanTrue }; truth = true; } }
  const err = $derived(tan && tanTrue !== 0 ? ((tan.g - tanTrue) / Math.abs(tanTrue)) * 100 : 0);
  const uRate = $derived(run.yUnit ? `${run.yUnit} s⁻¹` : 's⁻¹');

  /* ---------- choosing a technique ---------- */
  let qi = $state(0);
  let chose = $state<Tech | null>(null);
  const tq = $derived(TECH_Q[qi % TECH_Q.length]);
  function nextQ() { qi = (qi + 1) % TECH_Q.length; chose = null; }

  /* ---------- the 3D look ---------- */
  const ext = $derived(run.extent(t));
  const look = $derived<BLook>({
    rx: setup.rx, method: setup.method, size: prefs.size, cat: prefs.cat, ext,
    rate: rate0 !== 0 ? Math.max(0, Math.min(1, rateNow / rate0)) : 0,
    V: setup.method === 'syringe' ? Math.max(0, run.y(t)) : 0, mass: massShown,
    cloud: isCross ? run.y(t) : 0, A: setup.method === 'colour' ? run.y(t) : 0,
    i2: setup.method === 'colour' ? 1 - ext : 0, temp: prefs.temp, playing: running && !RM,
  });
  $effect(() => {
    stats = [['Reaction', rxi.short], ['t', `${Math.floor(t)} s`], [isCross ? 'Cross' : run.yLabel.split(' (')[0], isCross ? (run.crossT !== null && t >= run.crossT ? `gone at ${Math.round(run.crossT)} s` : 'visible') : `${fmtY(reading)}${run.yUnit ? ' ' + run.yUnit : ''}`]];
  });
  const SPEEDS = [1, 5, 20, 60];
</script>

<main class="layout kn-measure" hidden={off}>
  <section class="panel stage" aria-label="The bench">
    <div class="stage-head">
      <div class="label-chip"><small>{METHOD_NAME[setup.method]}</small><span>{rxi.name}</span></div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./measure3d').then((m) => m.BenchScene)} {look} label="3D view of the apparatus. Drag to turn it.">
          <div class="hud tl"><b>t = {Math.floor(t)} s</b>
            {#if isCross}<span>{run.crossT === null ? 'too dilute: the cross never goes' : t >= run.crossT ? `cross gone at ${Math.round(run.crossT)} s` : 'the cross can still be seen'}</span>
            {:else}<span>{run.yLabel}: {fmtY(reading)} {run.yUnit}</span>{/if}
          </div>
          <div class="hud tr"><span>{prefs.temp} °C</span><span>{Math.round(ext * 100)}% reacted</span></div>
          <div class="hud bl">{setup.method === 'cross' ? 'Seen from above, as you would look down through the flask.' : setup.method === 'colour' ? 'The beam after the cuvette is dimmer by a factor of 10^A.' : 'Bubbles come off the solid at a rate that follows the rate of reaction.'}</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={go}>{running ? 'Pause' : t >= run.tEnd ? 'Run again' : t > 0 ? 'Carry on' : 'Start'}</button>
      <button class="btn" type="button" onclick={reset} disabled={t === 0}>Reset</button>
      <button class="btn" type="button" onclick={finish} disabled={t >= run.tEnd}>Skip to end</button>
      <div class="ctl spd"><span class="ctl-l">Clock</span>
        <div class="picker flat" role="group" aria-label="Clock speed">
          {#each SPEEDS as s (s)}<button type="button" class="fchip" aria-pressed={prefs.speed === s} onclick={() => (prefs.speed = s)}>×{s}</button>{/each}
        </div>
      </div>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Reaction">
      <div class="ph"><h2>Reaction</h2></div>
      <div class="ctls">
        <div class="picker flat col" role="group" aria-label="Reaction">
          {#each RX as r (r.id)}<button type="button" class="fchip" aria-pressed={prefs.rx === r.id} onclick={() => (prefs.rx = r.id)}>{r.short}</button>{/each}
        </div>
        <p class="eqn">{rxi.eq}</p>
        {#if rxi.methods.length > 1}
          <Seg label="Method" options={rxi.methods.map((m) => [m, METHOD_NAME[m], m === 'syringe' ? 'Syringe' : 'Mass'] as const)} bind:value={prefs.method} />
        {/if}
        {#if prefs.rx === 'marble'}
          <label class="ctl"><span class="ctl-l">20 cm³ of HCl, concentration <b>{plain(prefs.conc, 2)} mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.1" max="0.4" step="0.05" bind:value={prefs.conc} /></label>
          <div class="ctl"><span class="ctl-l">Marble (in excess)</span>
            <Seg label="Chip size" options={[['large', 'Large chips', 'Large'], ['small', 'Small chips', 'Small'], ['powder', 'Powder', 'Powder']]} bind:value={prefs.size} />
          </div>
        {:else if prefs.rx === 'h2o2'}
          <label class="ctl"><span class="ctl-l">20 cm³ of H₂O₂, concentration <b>{plain(prefs.conc, 2)} mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.1" max="0.4" step="0.05" bind:value={prefs.conc} /></label>
          <label class="ctl"><span class="ctl-l">MnO₂ catalyst <b>{plain(prefs.cat, 2)} g</b></span>
            <input class="slider" type="range" min="0.1" max="0.5" step="0.05" bind:value={prefs.cat} /></label>
        {:else if prefs.rx === 'mg'}
          <label class="ctl"><span class="ctl-l">Magnesium ribbon <b>{plain(prefs.mg, 2)} g</b> = {sci(prefs.mg / 24.3)} mol</span>
            <input class="slider" type="range" min="0.02" max="0.1" step="0.01" bind:value={prefs.mg} /></label>
          <label class="ctl"><span class="ctl-l">50 cm³ of HCl (in excess) <b>{plain(prefs.conc, 2)} mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.5" max="2" step="0.25" bind:value={prefs.conc} /></label>
        {:else if prefs.rx === 'thio'}
          <label class="ctl"><span class="ctl-l">Thiosulfate {THIO0} mol dm⁻³ <b>{prefs.vThio} cm³</b> + water <b>{50 - prefs.vThio} cm³</b></span>
            <input class="slider" type="range" min="10" max="50" step="5" bind:value={prefs.vThio} /></label>
          <p class="why sm">Then 5 cm³ of 2.0 mol dm⁻³ HCl, and start the clock. The total volume is always 55 cm³, so the depth of liquid over the cross is the same every time, and [S₂O₃²⁻] = {sci(thioConc(prefs.vThio))} mol dm⁻³.</p>
        {:else}
          <label class="ctl"><span class="ctl-l">[I₂] at the start <b>{plain(prefs.i2 * 1000, 2)} × 10⁻³ mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.002" max="0.005" step="0.0005" bind:value={prefs.i2} /></label>
          <label class="ctl"><span class="ctl-l">[propanone] <b>{plain(prefs.prop, 2)} mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.5" max="2" step="0.25" bind:value={prefs.prop} /></label>
          <label class="ctl"><span class="ctl-l">[H⁺] (the catalyst) <b>{plain(prefs.acid, 2)} mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.25" max="1" step="0.25" bind:value={prefs.acid} /></label>
        {/if}
        <label class="ctl"><span class="ctl-l">Temperature (water bath) <b>{prefs.temp} °C</b></span>
          <input class="slider" type="range" min="15" max="55" step="5" bind:value={prefs.temp} /></label>
      </div>
    </section>
    <section class="panel" aria-label="Readings">
      <div class="ph"><h2>Readings</h2></div>
      <dl class="reads pad nocase">
        {#if isCross}
          <div><dt>Time for the cross to go</dt><dd>{run.crossT === null ? 'never' : t >= run.crossT ? `${Math.round(run.crossT)} s` : '…'}</dd></div>
          <div><dt>Rate ∝ 1/t</dt><dd>{run.crossT !== null && t >= run.crossT ? `${sci(1 / Math.round(run.crossT))} s⁻¹` : '…'}</dd></div>
        {:else}
          <div><dt>{run.yLabel}</dt><dd>{fmtY(reading)} {run.yUnit}</dd></div>
          {#if setup.method === 'mass'}<div><dt>Balance reads</dt><dd>{massShown} g</dd></div>{/if}
          <div><dt>Rate now (true)</dt><dd>{sci(Math.abs(rateNow), 3)} {uRate}</dd></div>
          <div><dt>Initial rate (true)</dt><dd>{sci(Math.abs(rate0), 3)} {uRate}</dd></div>
        {/if}
        <div class="wide"><dt>Note</dt><dd class="txt">{run.note}</dd></div>
      </dl>
    </section>
  </aside>

  {#if !isCross}
    <section class="panel full" aria-label="Graph and tangent">
      <div class="ph"><h2>{run.yLabel} against time: the rate is the gradient</h2></div>
      <div class="cols2">
        <div class="plotbox">
          <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
          <svg class="mplot" bind:this={svg} viewBox="0 0 {W} {H}" role="img" aria-label="{run.yLabel} against time" onpointermove={move} onpointerup={up} onpointercancel={up}>
            {#each ticks(0, run.tEnd) as x (x)}<line class="gl" x1={sx(x)} x2={sx(x)} y1={MT} y2={H - MB} /><text class="tk" x={sx(x)} y={H - MB + 15} text-anchor="middle">{x}</text>{/each}
            {#each ticks(0, run.yMax) as y (y)}<line class="gl" x1={ML} x2={W - MR} y1={sy(y)} y2={sy(y)} /><text class="tk" x={ML - 7} y={sy(y)} text-anchor="end">{y}</text>{/each}
            <line class="ax" x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} /><line class="ax" x1={ML} x2={ML} y1={MT} y2={H - MB} />
            <text class="al" x={W - MR} y={H - 6} text-anchor="end">time / s</text>
            <text class="al" x="12" y={MT + 2} transform="rotate(-90 12 {MT + 2})" text-anchor="end">{run.yLabel}{run.yUnit ? ` / ${run.yUnit}` : ''}</text>
            <path class="cv" d={curve} />
            {#each pts as p, i (i)}<path class="pt" d="M{sx(p.x) - 4} {sy(Math.min(run.yMax, p.y)) - 4}l8 8m0 -8l-8 8" />{/each}
            {#if tan && ruler}
              {#if tri}
                <path class="tri" d="M{sx(tri.a)} {sy(tri.ya)} L{sx(tri.b)} {sy(tri.ya)} L{sx(tri.b)} {sy(tri.yb)}" />
                <text class="tt" x={(sx(tri.a) + sx(tri.b)) / 2} y={sy(tri.ya) + (tri.dy > 0 ? -6 : 14)} text-anchor="middle">Δt = {plain(tri.dx, 3)} s</text>
                <text class="tt" x={sx(tri.b) + 5} y={(sy(tri.ya) + sy(tri.yb)) / 2}>Δy = {plain(tri.dy, 3)}</text>
              {/if}
              <line class="ruler" class:truth x1={sx(ruler.x1)} y1={sy(ruler.y1)} x2={sx(ruler.x2)} y2={sy(ruler.y2)} />
              <circle class="h pt0" cx={sx(tan.x)} cy={sy(tanY)} r="8" role="slider" tabindex="0" aria-label="Where the tangent touches" aria-valuenow={tan.x}
                onpointerdown={(e) => down('pt', e)} onkeydown={(e) => { if (e.key === 'ArrowRight' && tan) tan = { x: Math.min(t, tan.x + run.tEnd / 100), g: tan.g }; if (e.key === 'ArrowLeft' && tan) tan = { x: Math.max(0, tan.x - run.tEnd / 100), g: tan.g }; }} />
              <circle class="h rot" cx={sx(ruler.hx)} cy={sy(ruler.hy)} r="9" role="slider" tabindex="0" aria-label="Turn the ruler" aria-valuenow={tan.g}
                onpointerdown={(e) => down('rot', e)} onkeydown={(e) => { if (e.key === 'ArrowUp') nudge(1.04); if (e.key === 'ArrowDown') nudge(1 / 1.04); }} />
            {/if}
            {#if t === 0}<text class="msg" x={(ML + W - MR) / 2} y={H / 2} text-anchor="middle">Press Start: the readings appear here.</text>{/if}
          </svg>
        </div>
        <div>
          <div class="ctls row tight">
            <button class="btn primary" type="button" onclick={() => placeTangent(0)} disabled={t === 0}>Tangent at t = 0</button>
            <button class="btn" type="button" onclick={() => placeTangent(Math.min(t, run.tEnd) * 0.45)} disabled={t === 0}>Tangent at a time t</button>
            <button class="btn" type="button" onclick={showTrue} disabled={!tan}>Show the true tangent</button>
          </div>
          {#if tan}
            <dl class="reads pad0 nocase">
              <div><dt>Touches the curve at</dt><dd>t = {plain(tan.x, 3)} s</dd></div>
              <div><dt>Your gradient</dt><dd>{sci(tan.g, 3)} {uRate}</dd></div>
              <div><dt>True gradient</dt><dd>{sci(tanTrue, 3)} {uRate}</dd></div>
              <div><dt>Your error</dt><dd class:good={Math.abs(err) < 5}>{err > 0 ? '+' : ''}{plain(err, 2)}%</dd></div>
            </dl>
            <div class="work flat">
              {#if tri}<div class="eq">gradient = Δy ÷ Δt = {plain(tri.dy, 3)} ÷ {plain(tri.dx, 3)} = {sci(tri.dy / tri.dx, 3)} {uRate}</div>{/if}
              <div class="eq">rate = {sci(Math.abs(tan.g), 3)} {uRate} {run.toMol(1).how} = {sci(Math.abs(run.toMol(tan.g).v), 3)} {run.toMol(1).unit}</div>
              {#if setup.method === 'colour'}<div class="eq">The gradient is negative: iodine is being used up. Rate = {sci(Math.abs(tan.g / EPS), 3)} mol dm⁻³ s⁻¹.</div>{/if}
            </div>
            <p class="why">Drag the round handle along the curve, and the hollow handle near the end to turn the ruler until it just touches the curve without cutting it. Use a long ruler and a big triangle: the bigger Δy and Δt, the smaller their percentage uncertainty.</p>
          {:else}
            <p class="why">Run the reaction, then lay a ruler along the curve. At t = 0 its gradient is the <b>initial rate</b>; anywhere else it is the rate at that time. The curve gets less steep as the reactant is used up, so the rate falls{setup.rx === 'iodine' ? ' (except here: zero order in iodine)' : ''}.</p>
          {/if}
        </div>
      </div>
    </section>
  {:else}
    <section class="panel full" aria-label="Results">
      <div class="ph"><h2>Rate = 1/time: the results</h2></div>
      <div class="cols2">
        <div>
          <table class="rtab">
            <thead><tr><th>thio / cm³</th><th>water / cm³</th><th>[S₂O₃²⁻] / mol dm⁻³</th><th>T / °C</th><th>t / s</th><th>1/t / 10⁻³ s⁻¹</th></tr></thead>
            <tbody>
              {#each rows as r (r.v + '|' + r.T)}
                <tr><td>{r.v}</td><td>{50 - r.v}</td><td>{sci(r.c, 3)}</td><td>{r.T}</td><td>{r.t}</td><td>{plain(1000 / r.t, 3)}</td></tr>
              {:else}
                <tr><td colspan="6" class="empty">Run the reaction: each time the cross disappears, the time goes in here. Change the volume of thiosulfate (or the temperature) and run it again.</td></tr>
              {/each}
            </tbody>
          </table>
          <div class="ctls row tight">
            <button class="btn" type="button" onclick={() => (rows = [])} disabled={!rows.length}>Clear the table</button>
          </div>
          <p class="why">The same amount of sulfur hides the cross every time ({S_CROSS} mol dm⁻³ of S here), so each run measures the time to make a fixed amount of product: rate = amount ÷ time ∝ 1/t. It is an <b>average</b> rate over the run, close to the initial rate because little of the thiosulfate is used.</p>
        </div>
        <div class="plotbox">
          <Seg label="Plot against" options={[['conc', 'Against concentration', 'Concentration'], ['temp', 'Against temperature', 'Temperature']]} bind:value={prefs.plotBy} />
          <Plot xr={prefs.plotBy === 'conc' ? [0, 0.15] : [10, 60]} yr={[0, yTop]} xLabel={prefs.plotBy === 'conc' ? '[S₂O₃²⁻] / mol dm⁻³' : 'temperature / °C'} yLabel="1/t / 10⁻³ s⁻¹"
            points={plotPts} line={fitLine} h={260} label="One over time against concentration or temperature" />
          <p class="why">{prefs.plotBy === 'conc' ? `Runs at ${prefs.temp} °C. A straight line through the origin: rate ∝ [S₂O₃²⁻], first order with respect to thiosulfate.` : `Runs with ${prefs.vThio} cm³ of thiosulfate. The rate roughly doubles for every 10 °C rise: far more molecules have at least the activation energy.`}</p>
        </div>
      </div>
    </section>
  {/if}

  <section class="panel full" aria-label="Choosing a technique">
    <div class="ph"><h2>Choosing a technique (11.3)</h2></div>
    <div class="cols2">
      <div class="techs">
        {#each TECHS as tc (tc.id)}
          <div class="tech"><b>{tc.name}</b><p>{tc.how}</p><p><i>Use when:</i> {tc.when}</p><p class="snag"><i>But:</i> {tc.snag}</p></div>
        {/each}
      </div>
      <div class="tq">
        <p class="gh">Which technique for this reaction?</p>
        <p class="eqn big">{tq.rx}</p>
        <div class="picker flat" role="group" aria-label="Technique">
          {#each TECHS as tc (tc.id)}
            <button type="button" class="fchip" class:right={chose !== null && tq.best.includes(tc.id)} class:wrong={chose === tc.id && !tq.best.includes(tc.id)} aria-pressed={chose === tc.id} onclick={() => (chose = tc.id)}>{tc.name.split(' (')[0]}</button>
          {/each}
        </div>
        {#if chose}
          <p class="verdict" class:ok={tq.best.includes(chose)}>{tq.best.includes(chose) ? 'Good choice.' : 'Not the best here.'}</p>
          <p class="why">{tq.why}</p>
        {/if}
        <button class="btn" type="button" onclick={nextQ}>Another reaction</button>
      </div>
    </div>
  </section>

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      <h3>Following a reaction <small>spec 9.3, 11.3, 11.4</small></h3>
      <div class="cols2 bare">
        <div>
          <p><b>Continuous monitoring</b> follows one reaction mixture from start to finish, reading the volume, mass, colour, pH or conductivity at regular intervals (or with a data logger), to give a concentration–time or volume–time graph. The rate at any moment is the gradient of a tangent drawn to the curve at that time; the initial rate is the gradient of the tangent at t = 0.</p>
          <p><b>Rate = 1/time.</b> If each run stops at the same point (the cross just disappears, or the colour just changes), every run makes the same amount of product, so the average rate is proportional to 1/t.</p>
          <p><b>Fair tests.</b> Change one thing; keep the others the same: the volumes, the mass and size of solid, the temperature (use a water bath), and for the cross the same depth of liquid and the same observer.</p>
        </div>
        <div class="facts"><b>Key facts</b><ul>
          <li>Rate of reaction = change in concentration (or amount) ÷ time; units usually mol dm⁻³ s⁻¹.</li>
          <li>Gas volume: one mole of gas is 24.0 dm³ at room temperature and pressure.</li>
          <li>Draw tangents with a long ruler, touching the curve at one point; make the triangle large.</li>
          <li>A curve that gets less steep: the rate falls as reactants are used up. A straight line: the rate is constant (zero order in the species measured).</li>
          <li>Practicals from 9A: H₂O₂ decomposition, marble chips with acid, thiosulfate with acid; the colorimetric iodine–propanone run is from 11.13.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
