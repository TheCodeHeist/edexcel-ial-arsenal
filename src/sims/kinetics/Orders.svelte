<script lang="ts" module>
  import type { Ord } from './orders';
  export interface OrdersPrefs { m: Ord; n: Ord; lk: number; A0: number; B0: number; excess: boolean }
  export const ORDERS: OrdersPrefs = { m: 1, n: 1, lk: -1.5, A0: 0.8, B0: 0.6, excess: true };
</script>

<script lang="ts">
  /* Rate equations (spec 11.1, 11.2, 11.4, 11.5). Choose the orders in A and B and the rate constant; the rate surface
     rate = k[A]^m[B]^n is drawn in 3D, a run slides down it, and the two graphs the spec asks you to read come from the
     same run: [A] against time with its successive half-lives marked, and rate against [A]. Below: the fingerprints of
     zero, first and second order, an initial-rates problem to solve, the units of k and the terms of 11.1. */
  import View3D from './View3D.svelte';
  import Plot from '../circuit/Plot.svelte';
  import type { OLook } from './orders3d';
  import { runOrders, rateOf, kUnits, kUnitsWorking, newProblem, UNIT_CHOICES, TERMS, type IRProblem } from './orders';
  import { sci, plain, parseNum } from './consts';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: OrdersPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const SUP = ['⁰', '', '²'];
  const term = (name: string, o: number) => (o === 0 ? '' : `[${name}]${SUP[o]}`);
  const eqn = (a: string, b: string, m: number, n: number) => `rate = k${term(a, m)}${term(b, n)}`;

  const k = $derived(Number((10 ** prefs.lk).toPrecision(2)));
  const set = $derived({ m: prefs.m, n: prefs.n, k, A0: prefs.A0, B0: prefs.B0, excess: prefs.excess });
  const run = $derived(runOrders(set));
  const o = $derived(prefs.m + prefs.n);

  /* ---------- the clock: every run takes about 10 s on screen ---------- */
  let t = $state(0);
  let running = $state(false);
  let skey = '';
  $effect(() => { const kk = JSON.stringify(set); if (kk !== skey) { skey = kk; t = 0; running = false; } });
  $effect(() => { if (off) running = false; });
  $effect(() => {
    if (!running) return;
    let raf = 0, last = performance.now();
    const step = (now: number) => {
      const g = frameReady(now, last);
      if (g !== 'go') { if (g === 'hidden') last = now; raf = requestAnimationFrame(step); return; }
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      t = Math.min(run.tEnd, t + (dt * run.tEnd) / 10);
      if (t >= run.tEnd) { running = false; return; }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  });
  function go() { if (t >= run.tEnd) t = 0; running = !running; }

  const Anow = $derived(run.A(t)), Bnow = $derived(run.B(t)), rnow = $derived(run.rate(t)), r0 = $derived(run.rate(0));
  const path = $derived.by(() => {
    const out: number[] = [], N = 80;
    for (let i = 0; i <= N; i++) { const s = (run.tEnd * i) / N; if (s > t) break; out.push(run.A(s), run.B(s)); }
    return out;
  });
  const look = $derived<OLook>({ m: prefs.m, n: prefs.n, A: Anow, B: Bnow, A0: prefs.A0, B0: prefs.B0, path, playing: running && !RM });

  /* successive half-lives */
  const hl = $derived(run.halves.map((h, i) => h - (i ? run.halves[i - 1] : 0)));
  const pattern = $derived(
    !prefs.excess && prefs.n > 0 ? '[B] falls too, so the half-lives no longer follow a simple pattern: keep B in excess to isolate A.'
      : prefs.m === 0 ? 'Each half-life is half the one before: zero order.'
        : prefs.m === 1 ? 'Every half-life is the same: first order.'
          : 'Each half-life is double the one before: second order.');

  /* ---------- [A]–t graph with the half-life construction ---------- */
  const W = 520, H = 290, ML = 58, MR = 16, MT = 16, MB = 40;
  const yTop = $derived(Math.max(prefs.A0, prefs.excess ? 0 : prefs.B0) * 1.08);
  const sx = (x: number) => ML + (x / run.tEnd) * (W - ML - MR);
  const sy = (y: number) => H - MB - (y / yTop) * (H - MT - MB);
  function ticks(a: number, b: number) {
    if (!(b > a)) return [];
    const raw = (b - a) / 6, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const st = ([1, 2, 2.5, 5, 10].find((q) => q * p >= raw) ?? 10) * p;
    const out: number[] = [];
    for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-6 && out.length < 30; v += st) out.push(Number(v.toPrecision(6)));
    return out;
  }
  const pathOf = (f: (s: number) => number, upto = run.tEnd) => {
    const N = 300, out: string[] = [];
    for (let i = 0; i <= N; i++) { const s = (run.tEnd * i) / N; if (s > upto + 1e-12) break; out.push(`${i ? 'L' : 'M'}${sx(s).toFixed(1)} ${sy(f(s)).toFixed(1)}`); }
    return out.join('');
  };
  const aPath = $derived(pathOf(run.A));
  const bPath = $derived(prefs.excess ? '' : pathOf(run.B));
  const fmtT = (x: number) => (x >= 100 ? x.toFixed(0) : plain(x, 3));

  /* ---------- rate–[A] ---------- */
  const slice = $derived(Array.from({ length: 101 }, (_, i) => { const a = (prefs.A0 * i) / 100; return [a, rateOf(set, a, prefs.B0)] as [number, number]; }));
  const actual = $derived(prefs.excess ? [] : Array.from({ length: 101 }, (_, i) => { const s = (run.tEnd * i) / 100; return [run.A(s), run.rate(s)] as [number, number]; }).reverse());
  const rTop = $derived(Math.max(r0, ...slice.map((p) => p[1])) * 1.1 || 1);

  /* ---------- order fingerprints (thumbnails) ---------- */
  function thumbs(m: Ord) {
    const w = 150, h = 84, p = 10;
    const kk = m === 0 ? 0.5 : m === 1 ? 1.6 : 4;
    const A = (s: number) => (m === 0 ? Math.max(0, 1 - kk * s) : m === 1 ? Math.exp(-kk * s) : 1 / (1 + kk * s));
    const ct: string[] = [], rc: string[] = [];
    for (let i = 0; i <= 60; i++) {
      const u = i / 60, s = u * 1.9;
      ct.push(`${i ? 'L' : 'M'}${(p + u * (w - 2 * p)).toFixed(1)} ${(h - p - A(s) * (h - 2 * p)).toFixed(1)}`);
      const r = m === 0 ? 0.55 : m === 1 ? u : u * u;
      rc.push(`${i ? 'L' : 'M'}${(p + u * (w - 2 * p)).toFixed(1)} ${(h - p - r * (h - 2 * p) * 0.9).toFixed(1)}`);
    }
    return { ct: ct.join(''), rc: rc.join(''), w, h, p };
  }
  const FP: { m: Ord; name: string; hl: string; rc: string }[] = [
    { m: 0, name: 'Zero order', hl: 'A straight line down. Half-lives get shorter: each is half the one before.', rc: 'A horizontal line: the rate does not depend on [A].' },
    { m: 1, name: 'First order', hl: 'A curve with a constant half-life, whatever the starting concentration.', rc: 'A straight line through the origin: rate ∝ [A].' },
    { m: 2, name: 'Second order', hl: 'A steeper curve that levels off more slowly. Each half-life is double the one before.', rc: 'A curve (a parabola) through the origin: rate ∝ [A]².' },
  ];

  /* ---------- the initial-rates problem ---------- */
  let prob = $state<IRProblem>(newProblem());
  let gm = $state<Ord | null>(null), gn = $state<Ord | null>(null);
  let gk = $state(''), gu = $state<string | null>(null), g4 = $state('');
  let checked = $state(false);
  function another() { prob = newProblem(); gm = gn = null; gk = ''; gu = null; g4 = ''; checked = false; }
  const pk = $derived(prob.rows[0].r / (Math.pow(prob.rows[0].a, prob.sys.m) * Math.pow(prob.rows[0].b, prob.sys.n)));
  const close = (s: string, v: number, tol = 0.03) => { const x = parseNum(s); return isFinite(x) && Math.abs(x - v) <= Math.abs(v) * tol; };
  const okM = $derived(gm === prob.sys.m), okN = $derived(gn === prob.sys.n), okK = $derived(close(gk, pk)), okU = $derived(gu === kUnits(prob.sys.m + prob.sys.n)), ok4 = $derived(close(g4, prob.rows[3].r));
  const r12 = $derived(prob.rows[1].r / prob.rows[0].r), r13 = $derived(prob.rows[2].r / prob.rows[0].r);
  const fa = $derived(prob.rows[1].a / prob.rows[0].a), fb = $derived(prob.rows[2].b / prob.rows[0].b);
  const ordWord = (f: number, r: number, ord: number) => ord === 0 ? `the rate does not change (× ${plain(r, 3)}): order 0` : ord === 1 ? `the rate × ${plain(r, 3)}, the same factor: order 1` : `the rate × ${plain(r, 3)} = ${plain(f, 3)}²: order 2`;

  $effect(() => {
    stats = [['Rate equation', eqn('A', 'B', prefs.m, prefs.n)], ['Overall order', o], ['k', `${sci(k)} ${kUnits(o)}`]];
  });

  /** Kernel helpers: animate the rate-surface run and read half-lives / initial-rates problem. */
  export async function playRun(animate = true) {
    if (!animate || RM) { running = false; t = run.tEnd; return; }
    t = 0; running = true;
    const end = performance.now() + 2400;
    while (running && t < run.tEnd && !off && performance.now() < end) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
  export function newInitialRates() { another(); }
  export function getState() {
    return {
      eq: eqn('A', 'B', prefs.m, prefs.n), order: o, k, units: kUnits(o),
      r0, kp: run.kp, t, tEnd: run.tEnd, halves: [...hl], pattern,
      prob: { eq: prob.sys.eq, A: prob.sys.A, B: prob.sys.B, rows: prob.rows },
    };
  }
</script>

<main class="layout kn-orders" hidden={off}>
  <section class="panel stage" aria-label="Rate surface">
    <div class="stage-head">
      <div class="label-chip"><small>The rate surface</small><span>{eqn('A', 'B', prefs.m, prefs.n)}</span></div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./orders3d').then((m) => m.RateSurfaceScene)} {look} label="3D graph of rate against the concentrations of A and B. Drag to turn it.">
          <div class="hud tl"><b>{eqn('A', 'B', prefs.m, prefs.n)}</b><span>overall order {o}; k = {sci(k)} {kUnits(o)}</span></div>
          <div class="hud tr"><span>t = {fmtT(t)} s</span><span>[A] = {plain(Anow, 3)}, [B] = {plain(Bnow, 3)}</span><span>rate = {sci(rnow, 3)} mol dm⁻³ s⁻¹</span></div>
          <div class="hud bl"><span class="sw y"></span> rate–[A] at this [B] &nbsp; <span class="sw p"></span> rate–[B] at this [A]. Height ÷ k, so the far corner is always k.</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={go}>{running ? 'Pause' : t >= run.tEnd ? 'Run again' : t > 0 ? 'Carry on' : 'Run'}</button>
      <label class="ctl scrub"><span class="ctl-l">Time <b>{fmtT(t)} s</b></span>
        <input class="slider" type="range" min="0" max={run.tEnd} step={run.tEnd / 400} bind:value={t} oninput={() => (running = false)} /></label>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Rate equation">
      <div class="ph"><h2>Rate equation</h2></div>
      <div class="ctls">
        <div class="ctl"><span class="ctl-l">Order with respect to A, m <b>{prefs.m}</b></span>
          <div class="picker flat" role="group" aria-label="Order in A">{#each [0, 1, 2] as const as v (v)}<button type="button" class="fchip" aria-pressed={prefs.m === v} onclick={() => (prefs.m = v)}>{v}</button>{/each}</div></div>
        <div class="ctl"><span class="ctl-l">Order with respect to B, n <b>{prefs.n}</b></span>
          <div class="picker flat" role="group" aria-label="Order in B">{#each [0, 1, 2] as const as v (v)}<button type="button" class="fchip" aria-pressed={prefs.n === v} onclick={() => (prefs.n = v)}>{v}</button>{/each}</div></div>
        <label class="ctl"><span class="ctl-l">Rate constant k <b>{sci(k)} {kUnits(o)}</b></span>
          <input class="slider" type="range" min="-3" max="0" step="0.05" bind:value={prefs.lk} /></label>
        <label class="ctl"><span class="ctl-l">[A] at the start <b>{plain(prefs.A0, 2)} mol dm⁻³</b></span>
          <input class="slider" type="range" min="0.1" max="1" step="0.05" bind:value={prefs.A0} /></label>
        <label class="ctl"><span class="ctl-l">[B] at the start <b>{plain(prefs.B0, 2)} mol dm⁻³</b></span>
          <input class="slider" type="range" min="0.1" max="1" step="0.05" bind:value={prefs.B0} /></label>
        <label class="check"><input type="checkbox" bind:checked={prefs.excess} /> B in large excess ([B] stays constant)</label>
      </div>
      <dl class="reads pad nocase">
        <div><dt>Overall order</dt><dd>{prefs.m} + {prefs.n} = {o}</dd></div>
        <div><dt>Units of k</dt><dd>{kUnits(o)}</dd></div>
        <div><dt>Initial rate</dt><dd>{sci(r0, 3)} mol dm⁻³ s⁻¹</dd></div>
        {#if prefs.excess}<div><dt>k′ = k[B]ⁿ</dt><dd>{sci(run.kp, 3)} {kUnits(prefs.m)}</dd></div>{/if}
        <div class="wide"><dt>Initial rate, worked</dt><dd class="txt">{sci(k)} × {plain(prefs.A0, 2)}{SUP[prefs.m]} × {plain(prefs.B0, 2)}{SUP[prefs.n]} = {sci(r0, 3)} mol dm⁻³ s⁻¹</dd></div>
      </dl>
    </section>
  </aside>

  <section class="panel full" aria-label="Graphs">
    <div class="ph"><h2>Reading the order from graphs (11.2, 11.5)</h2></div>
    <div class="cols2">
      <div class="plotbox">
        <p class="gh">[A] against time</p>
        <svg class="oplot" viewBox="0 0 {W} {H}" role="img" aria-label="Concentration of A against time, with the half-lives marked">
          {#each ticks(0, run.tEnd) as x (x)}<line class="gl" x1={sx(x)} x2={sx(x)} y1={MT} y2={H - MB} /><text class="tk" x={sx(x)} y={H - MB + 15} text-anchor="middle">{x}</text>{/each}
          {#each ticks(0, yTop) as y (y)}<line class="gl" x1={ML} x2={W - MR} y1={sy(y)} y2={sy(y)} /><text class="tk" x={ML - 7} y={sy(y)} text-anchor="end">{y}</text>{/each}
          <line class="ax" x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} /><line class="ax" x1={ML} x2={ML} y1={MT} y2={H - MB} />
          <text class="al" x={W - MR} y={H - 6} text-anchor="end">time / s</text>
          <text class="al" x="12" y={MT + 2} transform="rotate(-90 12 {MT + 2})" text-anchor="end">concentration / mol dm⁻³</text>
          {#each run.halves as h, i (i)}
            {@const c = prefs.A0 / 2 ** (i + 1)}
            <path class="hl" d="M{ML} {sy(c)} H{sx(h)} V{H - MB}" />
            <text class="hlt" x={sx(h) + 3} y={H - MB - 6 - i * 13}>{['t₁', 't₂', 't₃'][i]}</text>
            <text class="hlc" x={ML + 4} y={sy(c) - 4}>[A]₀/{2 ** (i + 1)}</text>
          {/each}
          {#if bPath}<path class="cvb" d={bPath} />{/if}
          <path class="cva" d={aPath} />
          <circle class="now" cx={sx(t)} cy={sy(Anow)} r="6" />
        </svg>
        <div class="legend"><span><i class="a"></i>[A]</span>{#if bPath}<span><i class="b"></i>[B]</span>{/if}<span><i class="h"></i>half-life construction</span></div>
        <table class="rtab">
          <thead><tr><th>half-life</th><th>from</th><th>to</th><th>time / s</th></tr></thead>
          <tbody>
            {#each hl as h, i (i)}
              <tr><td>{['1st', '2nd', '3rd'][i]}</td><td>[A]₀{i ? `/${2 ** i}` : ''}</td><td>[A]₀/{2 ** (i + 1)}</td><td>{fmtT(h)}</td></tr>
            {:else}
              <tr><td colspan="4" class="empty">[A] does not halve in this run.</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="why"><b>{pattern}</b> {#if prefs.excess && prefs.m === 1} t½ = ln 2 ÷ k′ = 0.693 ÷ {sci(run.kp, 3)} = {fmtT(Math.LN2 / run.kp)} s.{:else if prefs.excess && prefs.m === 0} t½ = [A]₀ ÷ 2k′, so it is proportional to the concentration at the start of each half-life.{:else if prefs.excess && prefs.m === 2} t½ = 1 ÷ k′[A]₀: it is inversely proportional to the concentration at the start.{/if}</p>
      </div>
      <div class="plotbox">
        <p class="gh">Rate against [A]{prefs.excess ? '' : ` (at [B] = ${plain(prefs.B0, 2)}, and the run itself)`}</p>
        <Plot xr={[0, prefs.A0]} yr={[0, rTop]} xLabel="[A] / mol dm⁻³" yLabel="rate / mol dm⁻³ s⁻¹" h={290}
          series={[{ color: 'var(--ch1)', pts: slice, name: `[B] = ${plain(prefs.B0, 2)}` }, ...(actual.length ? [{ color: 'var(--ch2)', pts: actual, name: 'the run' }] : [])]}
          now={{ x: Anow, y: rnow }} label="Rate against the concentration of A" probe />
        <p class="why">{prefs.m === 0 ? 'Flat: the rate is the same at every [A]. Zero order with respect to A.' : prefs.m === 1 ? 'A straight line through the origin: double [A], double the rate. First order with respect to A.' : 'A curve through the origin: double [A], four times the rate. Second order with respect to A.'} The gradient of each tangent on the [A]–time graph gives one point on this graph.</p>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="Fingerprints">
    <div class="ph"><h2>Fingerprints of zero, first and second order</h2></div>
    <div class="fps">
      {#each FP as f (f.m)}
        {@const th = thumbs(f.m)}
        <div class="fp" class:on={prefs.m === f.m}>
          <b>{f.name}: rate = k{term('A', f.m) || '[A]⁰'}</b>
          <div class="fprow">
            <svg viewBox="0 0 {th.w} {th.h}" role="img" aria-label="{f.name}: concentration against time"><path class="fax" d="M{th.p} {th.p} V{th.h - th.p} H{th.w - th.p}" /><path class="fcv" d={th.ct} /><text x={th.w - th.p} y={th.h - 1} text-anchor="end">t</text><text x="2" y={th.p + 2}>[A]</text></svg>
            <svg viewBox="0 0 {th.w} {th.h}" role="img" aria-label="{f.name}: rate against concentration"><path class="fax" d="M{th.p} {th.p} V{th.h - th.p} H{th.w - th.p}" /><path class="fcv r" d={th.rc} /><text x={th.w - th.p} y={th.h - 1} text-anchor="end">[A]</text><text x="2" y={th.p + 2}>rate</text></svg>
          </div>
          <p>{f.hl}</p><p>{f.rc}</p>
        </div>
      {/each}
    </div>
  </section>

  <section class="panel full" aria-label="Initial rates">
    <div class="ph"><h2>Initial-rates method: find the rate equation (11.4i, 11.5iii)</h2></div>
    <div class="cols2">
      <div>
        <p class="eqn">{prob.sys.eq}</p>
        <table class="rtab">
          <thead><tr><th>experiment</th><th>[{prob.sys.A}] / mol dm⁻³</th><th>[{prob.sys.B}] / mol dm⁻³</th><th>initial rate / mol dm⁻³ s⁻¹</th></tr></thead>
          <tbody>
            {#each prob.rows as r, i (i)}
              <tr><td>{i + 1}</td><td>{plain(r.a, 3)}</td><td>{plain(r.b, 3)}</td><td>{i === 3 ? '?' : sci(r.r, 3)}</td></tr>
            {/each}
          </tbody>
        </table>
        <div class="ctls ir">
          <div class="ctl"><span class="ctl-l">Order with respect to {prob.sys.A}</span>
            <div class="picker flat" role="group" aria-label="Order in {prob.sys.A}">{#each [0, 1, 2] as const as v (v)}<button type="button" class="fchip" class:right={checked && v === prob.sys.m} class:wrong={checked && gm === v && !okM} aria-pressed={gm === v} onclick={() => (gm = v)}>{v}</button>{/each}</div></div>
          <div class="ctl"><span class="ctl-l">Order with respect to {prob.sys.B}</span>
            <div class="picker flat" role="group" aria-label="Order in {prob.sys.B}">{#each [0, 1, 2] as const as v (v)}<button type="button" class="fchip" class:right={checked && v === prob.sys.n} class:wrong={checked && gn === v && !okN} aria-pressed={gn === v} onclick={() => (gn = v)}>{v}</button>{/each}</div></div>
          <label class="ctl"><span class="ctl-l">k (a number) {#if checked}<b class:good={okK} class:bad={!okK}>{okK ? '✓' : '✗'}</b>{/if}</span>
            <input class="field" type="text" inputmode="decimal" placeholder="e.g. 2.5e-3" bind:value={gk} /></label>
          <div class="ctl"><span class="ctl-l">Units of k</span>
            <div class="picker flat" role="group" aria-label="Units of k">{#each UNIT_CHOICES as u (u)}<button type="button" class="fchip" class:right={checked && u === kUnits(prob.sys.m + prob.sys.n)} class:wrong={checked && gu === u && !okU} aria-pressed={gu === u} onclick={() => (gu = u)}>{u}</button>{/each}</div></div>
          <label class="ctl"><span class="ctl-l">Initial rate in experiment 4 {#if checked}<b class:good={ok4} class:bad={!ok4}>{ok4 ? '✓' : '✗'}</b>{/if}</span>
            <input class="field" type="text" inputmode="decimal" placeholder="mol dm⁻³ s⁻¹" bind:value={g4} /></label>
          <div class="btns">
            <button class="btn primary" type="button" onclick={() => (checked = true)}>Check</button>
            <button class="btn" type="button" onclick={another}>Another set of results</button>
          </div>
        </div>
      </div>
      <div>
        {#if checked}
          <p class="verdict" class:ok={okM && okN && okK && okU && ok4}>{[okM, okN, okK, okU, ok4].filter(Boolean).length} of 5 right.</p>
          <div class="work flat">
            <div class="eq">Experiments 1 and 2: [{prob.sys.B}] is the same, [{prob.sys.A}] × {plain(fa, 3)}; {ordWord(fa, r12, prob.sys.m)} with respect to {prob.sys.A}.</div>
            <div class="eq">Experiments 1 and 3: [{prob.sys.A}] is the same, [{prob.sys.B}] × {plain(fb, 3)}; {ordWord(fb, r13, prob.sys.n)} with respect to {prob.sys.B}.</div>
            <div class="eq">{eqn(prob.sys.A, prob.sys.B, prob.sys.m, prob.sys.n)}; overall order {prob.sys.m + prob.sys.n}.</div>
            <div class="eq">k = rate ÷ ({term(prob.sys.A, prob.sys.m) || '1'}{term(prob.sys.B, prob.sys.n)}) = {sci(prob.rows[0].r, 3)} ÷ ({plain(prob.rows[0].a, 3)}{SUP[prob.sys.m]} × {plain(prob.rows[0].b, 3)}{SUP[prob.sys.n]}) = {sci(pk, 3)} {kUnits(prob.sys.m + prob.sys.n)}</div>
            <div class="eq">{kUnitsWorking(prob.sys.m + prob.sys.n)}</div>
            <div class="eq">Experiment 4: rate = {sci(pk, 3)} × {plain(prob.rows[3].a, 3)}{SUP[prob.sys.m]} × {plain(prob.rows[3].b, 3)}{SUP[prob.sys.n]} = {sci(prob.rows[3].r, 3)} mol dm⁻³ s⁻¹</div>
          </div>
          {#if prob.sys.real}<p class="why">This is a real rate equation, found by experiment. Notice that the orders need not match the numbers in the balanced equation{prob.sys.n === 0 ? `: ${prob.sys.B} is zero order, so it is not in the rate-determining step` : ''}.</p>{/if}
        {:else}
          <p class="why">Compare two experiments in which only one concentration changes. If [A] is multiplied by a factor f and the rate by f⁰ = 1, the order is 0; by f, order 1; by f², order 2. Do the same for B. Then put one experiment's numbers into the rate equation to find k, and use k to predict experiment 4, where both concentrations change.</p>
          <p class="why">k can be entered as 2.5e-3 or 2.5 × 10⁻³; within 3% counts.</p>
        {/if}
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="Units of k and terms">
    <div class="ph"><h2>Units of k, and the terms of 11.1</h2></div>
    <div class="cols2">
      <div>
        <table class="rtab units">
          <thead><tr><th>overall order</th><th>rate equation (example)</th><th>units of k</th></tr></thead>
          <tbody>
            {#each [0, 1, 2, 3] as oo (oo)}
              <tr class:on={oo === o}><td>{oo}</td><td>{['rate = k', 'rate = k[A]', 'rate = k[A][B]', 'rate = k[A]²[B]'][oo]}</td><td>{kUnits(oo)}</td></tr>
            {/each}
            {#if o === 4}<tr class="on"><td>4</td><td>rate = k[A]²[B]²</td><td>{kUnits(4)}</td></tr>{/if}
          </tbody>
        </table>
        <div class="work flat"><div class="eq">{kUnitsWorking(o)}</div></div>
      </div>
      <dl class="terms">
        {#each TERMS as [tt, d], i (tt)}
          <div><dt><small>{['i', 'ii', 'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix'][i]}</small> {tt}</dt><dd>{d}</dd></div>
        {/each}
      </dl>
    </div>
  </section>

  <section class="panel full explain" aria-label="Methods">
    <div class="ex-body">
      <h3>Two ways to get rate data <small>spec 11.4</small></h3>
      <div class="cols2 bare">
        <div>
          <p><b>Initial-rate method.</b> Run several separate experiments, each with a different starting concentration of one reagent and everything else the same. Find the initial rate of each (the gradient at t = 0, or 1/t for a clock reaction, which stops at a fixed small amount of product, so 1/t ∝ the initial rate). Then compare rates as concentrations change, as in the table above.</p>
          <p><b>Continuous monitoring.</b> Follow one experiment all the way through (gas volume, mass, colour, titration of samples) to get a concentration–time or volume–time graph. Read the order from its shape and half-lives, or draw tangents at several times, plot rate against concentration and read the order from that graph.</p>
        </div>
        <div class="facts"><b>Key facts</b><ul>
          <li>Orders (0, 1 or 2) come from experiments, never from the balanced equation.</li>
          <li>A constant half-life identifies a first-order reaction.</li>
          <li>To study one reagent, keep the others in large excess so their concentrations hardly change.</li>
          <li>k depends on temperature (and a catalyst), not on concentration.</li>
          <li>Units of k: rearrange rate = k[ ]ⁿ, then cancel mol dm⁻³ terms.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
