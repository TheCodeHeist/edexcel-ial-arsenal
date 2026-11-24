<script lang="ts" module>
  export interface CPPrefs {
    view: 'cp9a' | 'cp9b' | 'cp10';
    follow: 'titrate' | 'color';      // CP9a: titration or colorimeter
    cProp: number; cAcid: number;     // CP9a stock concentrations / mol dm⁻³
    vary: 'KI' | 'H2O2';              // CP9b: which reagent is diluted
    vol: number;                      // CP9b: cm³ of that stock in the 50 cm³
    T: number;                        // CP10: bath set point / °C
  }
  export const CP: CPPrefs = { view: 'cp9a', follow: 'titrate', cProp: 2.0, cAcid: 1.0, vary: 'KI', vol: 10, T: 30 };
</script>

<script lang="ts">
  /* Core practicals for Unit 4 kinetics: CP9a (the iodine–propanone reaction followed by titration, or by colorimetry),
     CP9b (an iodine clock, initial-rate method) and CP10 (the activation energy from the clock at several
     temperatures). Spec 11.3, 11.4, 11.5, 11.6i, 11.10, 11.12, 11.13. Every result is the student’s own: generated
     from the real rate equation with the scatter a school lab gives. */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Plot from '../circuit/Plot.svelte';
  import type { CPLook } from './practicals3d';
  import { P9, mix9, iodine, sample9, titreOf, CLK, clockTime, observed, kAt, I2_NEEDED, fit, gauss, type Sample } from './practicals';
  import { R, sci, plain } from './consts';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: CPPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  /* ======================= CP9a ======================= */
  const m9 = $derived(mix9(prefs.cProp, prefs.cAcid));
  const END9 = (P9.n * P9.every + 4) * 60;              // the run ends once the last sample is titrated
  let t9 = $state(0);                                    // reaction time / s
  let run9 = $state(false);
  let samples = $state<Sample[]>([]);
  let reads = $state<{ min: number; abs: number }[]>([]);
  interface RunSum { cProp: number; cAcid: number; P: number; Hp: number; rate: number }
  let runs9 = $state<RunSum[]>([]);
  let key9 = '';
  $effect(() => { const k = `${prefs.cProp}|${prefs.cAcid}|${prefs.follow}`; if (k !== key9) { key9 = k; reset9(); } });
  function reset9() { t9 = 0; run9 = false; samples = []; reads = []; }
  function step9(dtReal: number) {
    const before = t9;
    t9 = Math.min(END9, t9 + dtReal * 60);               // one real second is one minute
    for (let n = 1; n <= P9.n; n++) {
      const ts = n * P9.every * 60;
      if (prefs.follow === 'titrate' && before < ts && t9 >= ts) samples = [...samples, sample9(m9, n * P9.every)];
    }
    if (prefs.follow === 'color') {
      for (let mn = Math.floor(before / 60) + 1; mn <= Math.floor(t9 / 60) && mn <= P9.n * P9.every; mn++) reads = [...reads, { min: mn, abs: sample9(m9, mn).abs }];
    }
    if (t9 >= END9) { run9 = false; finish9(); }
  }
  function finish9() {
    const f = fit9;
    if (!f) return;
    const rate = prefs.follow === 'titrate' ? (-f.m * P9.cThio) / 2 / P9.aliquot / 60 : -f.m / P9.absPerM / 60;
    const s: RunSum = { cProp: prefs.cProp, cAcid: prefs.cAcid, P: m9.P, Hp: m9.Hp, rate };
    runs9 = [...runs9.filter((r) => r.cProp !== s.cProp || r.cAcid !== s.cAcid), s].slice(-6);
  }
  function skip9() { while (t9 < END9) step9(1); }
  const pts9 = $derived(prefs.follow === 'titrate' ? samples.filter((s) => s.titre > 0).map((s) => ({ x: s.min, y: s.titre })) : reads.filter((r) => r.abs > 0.02).map((r) => ({ x: r.min, y: r.abs })));
  const fit9 = $derived(pts9.length >= 3 ? fit(pts9) : null);
  const lastSample = $derived(samples.at(-1));
  const phase9 = $derived(lastSample ? Math.min(1, (t9 - lastSample.t) / 240) : -1);
  const ranOut = $derived(m9.rate * P9.n * P9.every * 60 > m9.I0);
  /** order with respect to one reagent from two summary runs that differ only in it */
  function orderFrom(by: 'P' | 'Hp') {
    const other = by === 'P' ? 'Hp' : 'P';
    for (let i = 0; i < runs9.length; i++) for (let j = i + 1; j < runs9.length; j++) {
      const a = runs9[i], b = runs9[j];
      if (Math.abs(a[other] - b[other]) < 1e-9 && Math.abs(a[by] - b[by]) > 1e-9 && a.rate > 0 && b.rate > 0)
        return { a, b, n: Math.log(b.rate / a.rate) / Math.log(b[by] / a[by]) };
    }
    return null;
  }
  const ordP = $derived(orderFrom('P'));
  const ordH = $derived(orderFrom('Hp'));

  /* ======================= the clock (CP9b and CP10) ======================= */
  type ClockPhase = 'idle' | 'mix' | 'time' | 'done';
  let clk = $state<{ phase: ClockPhase; mixT: number; clock: number; tObs: number; speed: number; blue: number; T: number; v: number }>({ phase: 'idle', mixT: 0, clock: 0, tObs: 0, speed: 1, blue: 0, T: 20, v: 10 });
  const VOLS = [2, 4, 6, 8, 10];
  const VARY: CPPrefs['vary'][] = ['KI', 'H2O2'];
  let rows9b = $state<Record<number, number[]>>({});
  let vary9b = '';
  $effect(() => { if (prefs.vary !== vary9b) { vary9b = prefs.vary; rows9b = {}; if (clk.phase !== 'idle') clk.phase = 'idle'; } });
  const TEMPS = [20, 25, 30, 35, 40, 45, 50, 55, 60];
  let hot = $state<{ set: number; T: number; t: number }[]>([]);

  function startClock() {
    if (clk.phase === 'mix' || clk.phase === 'time') return;
    let tTrue: number, T: number, v = prefs.vol;
    if (prefs.view === 'cp9b') {
      T = CLK.room + gauss() * 0.3;                                    // the lab warms and cools a little
      tTrue = prefs.vary === 'KI' ? clockTime(10, v, T).t : clockTime(v, 10, T).t;
    } else {
      T = prefs.T - 0.04 * (prefs.T - 20) + gauss() * 0.25;            // the mixture runs a little cooler than the bath
      tTrue = clockTime(10, 5, T).t;
      v = 5;
    }
    const tObs = observed(tTrue);
    clk = { phase: RM ? 'done' : 'mix', mixT: 0, clock: RM ? tObs : 0, tObs, speed: Math.max(1, tObs / 7), blue: RM ? 1 : 0, T, v };
    if (RM) record();
  }
  function record() {
    if (prefs.view === 'cp9b') {
      const list = rows9b[clk.v] ?? [];
      rows9b = { ...rows9b, [clk.v]: [...list, clk.tObs].slice(-3) };
    } else {
      const Trec = Math.round((clk.T + gauss() * 0.3) * 2) / 2;          // thermometer read to ±0.5 °C
      hot = [...hot.filter((h) => h.set !== prefs.T), { set: prefs.T, T: Trec, t: clk.tObs }].sort((a, b) => a.set - b.set);
    }
  }
  function stepClock(dt: number) {
    if (clk.phase === 'mix') { clk.mixT += dt; if (clk.mixT >= 0.8) clk.phase = 'time'; }
    else if (clk.phase === 'time') {
      clk.clock = Math.min(clk.tObs, clk.clock + dt * clk.speed);
      if (clk.clock >= clk.tObs) { clk.blue = Math.min(1, clk.blue + dt / 0.18); if (clk.blue >= 1) { clk.phase = 'done'; record(); } }
    }
  }
  // back to idle when the CP changes
  let lastView = '';
  $effect(() => { if (prefs.view !== lastView) { lastView = prefs.view; clk = { ...clk, phase: 'idle', clock: 0, blue: 0, mixT: 0 }; } });

  const rows9bList = $derived(VOLS.map((v) => {
    const ts = rows9b[v] ?? [];
    const mean = ts.length ? ts.reduce((a, b) => a + b, 0) / ts.length : NaN;
    const c = (prefs.vary === 'KI' ? CLK.cKI : CLK.cH2O2) * v / CLK.vTotal;
    return { v, ts, mean, c };
  }));
  const pts9b = $derived(rows9bList.filter((r) => r.ts.length).map((r) => ({ x: r.c * 1000, y: 1000 / r.mean })));
  const fit9b = $derived(pts9b.length >= 2 ? fit(pts9b) : null);
  const ord9b = $derived.by(() => {
    const p = rows9bList.filter((r) => r.ts.length);
    if (p.length < 2) return null;
    const f = fit(p.map((r) => ({ x: Math.log(r.c), y: Math.log(1 / r.mean) })));
    return f ? f.m : null;
  });

  const pts10 = $derived(hot.map((h) => ({ x: 1000 / (h.T + 273), y: Math.log(1 / h.t) })));
  const fit10 = $derived(pts10.length >= 2 ? fit(pts10) : null);
  const Ea10 = $derived(fit10 ? (-fit10.m * 1000 * R) / 1000 : NaN);      // kJ mol⁻¹
  const two = $derived.by(() => {
    if (hot.length < 2) return null;
    const a = hot[0], b = hot[hot.length - 1];
    const T1 = a.T + 273, T2 = b.T + 273;
    const Ea = (R * Math.log(a.t / b.t)) / (1 / T1 - 1 / T2) / 1000;
    return { a, b, T1, T2, Ea };
  });
  const xr10 = $derived<[number, number]>(pts10.length ? [Math.min(...pts10.map((p) => p.x)) - 0.04, Math.max(...pts10.map((p) => p.x)) + 0.04] : [2.98, 3.44]);
  const yr10 = $derived<[number, number]>(pts10.length ? [Math.min(...pts10.map((p) => p.y)) - 0.3, Math.max(...pts10.map((p) => p.y)) + 0.3] : [-5.5, -2]);

  /* ======================= the loop ======================= */
  const busy = $derived(!off && (run9 || clk.phase === 'mix' || clk.phase === 'time'));
  $effect(() => {
    if (!busy) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const g = frameReady(now, last);
      if (g !== 'go') { if (g === 'hidden') last = now; raf = requestAnimationFrame(loop); return; }
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      if (run9 && prefs.view === 'cp9a') step9(dt);
      if (prefs.view !== 'cp9a') stepClock(dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const look = $derived<CPLook>({
    view: prefs.view, follow: prefs.follow,
    i2: m9.I0 > 0 ? iodine(m9, t9) / m9.I0 : 0, phase: phase9, titre: lastSample?.titre ?? 0, samples: samples.length,
    clock: prefs.view === 'cp9a' ? t9 : clk.clock, blue: clk.blue,
    fill: clk.phase === 'idle' ? 0 : clk.phase === 'mix' ? clk.mixT / 0.8 : 1,
    T: prefs.view === 'cp10' ? prefs.T : 20, playing: busy,
  });

  $effect(() => {
    stats = prefs.view === 'cp9a'
      ? [['Time', `${Math.floor(t9 / 60)} min`], [prefs.follow === 'titrate' ? 'Samples' : 'Readings', prefs.follow === 'titrate' ? samples.length : reads.length], ['Gradient', fit9 ? `${plain(fit9.m, 3)} ${prefs.follow === 'titrate' ? 'cm³' : ''}/min` : '–']]
      : prefs.view === 'cp9b'
        ? [['Runs', Object.values(rows9b).reduce((s, l) => s + l.length, 0)], ['Order', ord9b === null ? '–' : plain(ord9b, 2)], ['Last t', clk.phase === 'done' ? `${clk.tObs.toFixed(1)} s` : '–']]
        : [['Bath', `${prefs.T} °C`], ['Runs', hot.length], ['Ea', isFinite(Ea10) ? `${plain(Ea10, 3)} kJ mol⁻¹` : '–']];
  });

  const name = (v: CPPrefs['vary']) => (v === 'KI' ? 'KI' : 'H₂O₂');
</script>

<main class="layout kn-cp" hidden={off}>
  <section class="panel stage" aria-label="Core practical">
    <div class="stage-head">
      <div class="label-chip"><small>{prefs.view === 'cp9a' ? 'Core Practical 9a' : prefs.view === 'cp9b' ? 'Core Practical 9b' : 'Core Practical 10'}</small>
        <span>{prefs.view === 'cp9a' ? 'The iodine–propanone reaction' : prefs.view === 'cp9b' ? 'An iodine clock' : 'The activation energy of a reaction'}</span></div>
      <div class="stage-tools">
        <Seg label="Practical" options={[['cp9a', 'CP9a iodination', '9a'], ['cp9b', 'CP9b clock', '9b'], ['cp10', 'CP10 activation energy', '10']]} bind:value={prefs.view} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./practicals3d').then((m) => m.CPScene)} {look} label="3D view of the practical on a lab bench. Drag to turn it.">
          {#if prefs.view === 'cp9a'}
            <div class="hud tl"><b>[I₂] = {sci(iodine(m9, t9), 3)} mol dm⁻³</b><span>{prefs.follow === 'titrate' ? `${samples.length} of ${P9.n} samples titrated` : `${reads.length} absorbance readings`}</span></div>
            {#if prefs.follow === 'titrate' && phase9 >= 0 && phase9 < 1}
              <div class="hud tr">{phase9 < 0.08 ? 'pipetting 10.0 cm³ into NaHCO₃' : phase9 < 0.55 ? 'titrating: amber → pale straw' : phase9 < 0.6 ? 'starch added: blue-black' : phase9 < 0.86 ? 'dropwise to the end point' : `end point: ${lastSample?.titre.toFixed(2)} cm³`}</div>
            {/if}
            <div class="hud bl">One real second is one minute of reaction. Excess propanone and acid; the iodine is the reagent followed.</div>
          {:else}
            <div class="hud tl"><b>{clk.phase === 'idle' ? 'Ready' : clk.phase === 'mix' ? 'Mixing… start the clock' : clk.phase === 'time' ? `${clk.clock.toFixed(1)} s` : `Blue-black at ${clk.tObs.toFixed(1)} s`}</b>
              <span>{prefs.view === 'cp9b' ? `${prefs.vol} cm³ of ${name(prefs.vary)} stock in 50 cm³` : `bath at ${prefs.T} °C`}</span></div>
            {#if clk.phase === 'time' && clk.speed > 1.5}<div class="hud tr">clock running ×{plain(clk.speed, 2)}</div>{/if}
            <div class="hud bl">The thiosulfate turns the iodine back into iodide until it is used up; then starch turns the mixture blue-black.</div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      {#if prefs.view === 'cp9a'}
        <button class="btn primary big playbtn" type="button" onclick={() => { if (t9 >= END9) reset9(); run9 = !run9; }}>{run9 ? 'Pause' : t9 >= END9 ? 'Run again' : t9 > 0 ? 'Resume' : 'Start'}</button>
        <button class="btn" type="button" onclick={skip9} disabled={t9 >= END9}>Finish the run</button>
        <button class="btn" type="button" onclick={reset9} disabled={t9 === 0}>Reset</button>
      {:else}
        <button class="btn primary big playbtn" type="button" onclick={startClock} disabled={clk.phase === 'mix' || clk.phase === 'time'}>{clk.phase === 'done' ? 'Run again' : 'Mix and time'}</button>
        {#if prefs.view === 'cp9b'}
          <div class="ctl"><span class="ctl-l">Vary</span>
            <div class="picker flat" role="group" aria-label="Reagent to vary">
              {#each VARY as v (v)}<button type="button" class="fchip" aria-pressed={prefs.vary === v} onclick={() => (prefs.vary = v)}>{name(v)}</button>{/each}
            </div></div>
          <div class="ctl"><span class="ctl-l">Volume of {name(prefs.vary)} (+ water to 10 cm³)</span>
            <div class="picker flat" role="group" aria-label="Volume">
              {#each VOLS as v (v)}<button type="button" class="fchip" aria-pressed={prefs.vol === v} onclick={() => (prefs.vol = v)}>{v} cm³</button>{/each}
            </div></div>
        {:else}
          <div class="ctl"><span class="ctl-l">Water bath</span>
            <div class="picker flat" role="group" aria-label="Bath temperature">
              {#each TEMPS as T (T)}<button type="button" class="fchip" aria-pressed={prefs.T === T} onclick={() => (prefs.T = T)}>{T} °C</button>{/each}
            </div></div>
        {/if}
      {/if}
    </div>
  </section>

  <aside class="side">
    {#if prefs.view === 'cp9a'}
      <section class="panel" aria-label="The mixture">
        <div class="ph"><h2>The mixture</h2></div>
        <div class="ctls">
          <div class="ctl"><span class="ctl-l">Follow it by</span>
            <Seg label="Method" options={[['titrate', 'Titration'], ['color', 'Colorimeter']]} bind:value={prefs.follow} /></div>
          <label class="ctl"><span class="ctl-l">Propanone stock, 25 cm³ <b>{plain(prefs.cProp, 2)} mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.5" max="2" step="0.5" bind:value={prefs.cProp} /></label>
          <label class="ctl"><span class="ctl-l">Hydrochloric acid, 25 cm³ <b>{plain(prefs.cAcid, 2)} mol dm⁻³</b></span>
            <input class="slider" type="range" min="0.5" max="2" step="0.5" bind:value={prefs.cAcid} /></label>
        </div>
        <dl class="reads pad nocase">
          <div><dt>[CH₃COCH₃]</dt><dd>{plain(m9.P, 3)} M</dd></div>
          <div><dt>[H⁺]</dt><dd>{plain(m9.Hp, 3)} M</dd></div>
          <div><dt>[I₂] at the start</dt><dd>{plain(m9.I0, 2)} M</dd></div>
          <div><dt>Titre at the start</dt><dd>{plain(titreOf(m9.I0), 3)} cm³</dd></div>
          <div class="wide"><dt>Volumes</dt><dd class="txt">25 cm³ propanone + 25 cm³ acid + 50 cm³ of 0.020 M iodine (in KI) = 100 cm³</dd></div>
        </dl>
        {#if ranOut}<p class="why pad2">At these concentrations the iodine runs out before 35 minutes: the last titres are zero.</p>{/if}
      </section>
      <section class="panel" aria-label="Rate from each run">
        <div class="ph"><h2>Rate from each run</h2></div>
        <table class="rtab pad">
          <thead><tr><th>[CH₃COCH₃]</th><th>[H⁺]</th><th>rate / mol dm⁻³ s⁻¹</th></tr></thead>
          <tbody>
            {#each runs9 as r (r.cProp + '|' + r.cAcid)}<tr><td>{plain(r.P, 3)}</td><td>{plain(r.Hp, 3)}</td><td>{sci(r.rate, 3)}</td></tr>
            {:else}<tr><td colspan="3" class="empty">Finish a run to add its rate here; then change one concentration and run again.</td></tr>{/each}
          </tbody>
        </table>
        <div class="work">
          {#if ordP}<div class="eq">Propanone ×{plain(ordP.b.P / ordP.a.P, 2)}, rate ×{plain(ordP.b.rate / ordP.a.rate, 2)} → order {plain(ordP.n, 2)} ≈ {Math.round(ordP.n)}</div>{/if}
          {#if ordH}<div class="eq">H⁺ ×{plain(ordH.b.Hp / ordH.a.Hp, 2)}, rate ×{plain(ordH.b.rate / ordH.a.rate, 2)} → order {plain(ordH.n, 2)} ≈ {Math.round(ordH.n)}</div>{/if}
          {#if ordP && ordH}<div class="eq">rate = k[CH₃COCH₃][H⁺][I₂]⁰ → k = {sci(runs9.at(-1)!.rate / (runs9.at(-1)!.P * runs9.at(-1)!.Hp), 3)} dm³ mol⁻¹ s⁻¹</div>{/if}
          {#if !ordP || !ordH}<p class="why">Change only one of the two sliders between runs to find each order.</p>{/if}
        </div>
      </section>
    {:else if prefs.view === 'cp9b'}
      <section class="panel" aria-label="The recipe">
        <div class="ph"><h2>Each run: 50 cm³</h2></div>
        <dl class="reads pad nocase">
          <div><dt>{prefs.vary === 'KI' ? 'KI, 0.10 M' : 'H₂O₂, 0.10 M'}</dt><dd>{prefs.vol} cm³ + {10 - prefs.vol} cm³ water</dd></div>
          <div><dt>{prefs.vary === 'KI' ? 'H₂O₂, 0.10 M' : 'KI, 0.10 M'}</dt><dd>10 cm³</dd></div>
          <div><dt>H₂SO₄, 1.0 M</dt><dd>10 cm³</dd></div>
          <div><dt>Na₂S₂O₃, 0.005 M</dt><dd>5 cm³</dd></div>
          <div><dt>Starch + water</dt><dd>to 50 cm³</dd></div>
          <div><dt>[{prefs.vary === 'KI' ? 'I⁻' : 'H₂O₂'}] in the mixture</dt><dd>{sci((0.1 * prefs.vol) / 50, 3)} M</dd></div>
          <div class="wide"><dt>Iodine formed before the blue appears</dt><dd class="txt">½ × n(S₂O₃²⁻) = 1.25 × 10⁻⁵ mol, so {sci(I2_NEEDED, 3)} mol dm⁻³ every run</dd></div>
        </dl>
      </section>
      <section class="panel" aria-label="Why a clock works">
        <div class="ph"><h2>Why 1/t is a rate</h2></div>
        <div class="work">
          <div class="eq">H₂O₂ + 2I⁻ + 2H⁺ → I₂ + 2H₂O <small>(slow)</small></div>
          <div class="eq">I₂ + 2S₂O₃²⁻ → 2I⁻ + S₄O₆²⁻ <small>(instant)</small></div>
          <div class="eq">rate = Δ[I₂]/t = {sci(I2_NEEDED, 3)}/t, so rate ∝ 1/t</div>
          <p class="why">Every run forms the same amount of iodine before the blue appears, and so little H₂O₂ has been used (about 1%) that the rate barely changes: 1/t measures the initial rate. Total volume stays at 50 cm³, so the concentration is proportional to the volume of stock.</p>
        </div>
      </section>
    {:else}
      <section class="panel" aria-label="Arrhenius">
        <div class="ph"><h2>The Arrhenius equation</h2></div>
        <div class="work">
          <div class="eq">k = A e<sup>−Ea/RT</sup> (given if needed)</div>
          <div class="eq">ln k = −(Ea/R) × (1/T) + ln A</div>
          <div class="eq">The same iodine forms each run, so k ∝ 1/t and ln(1/t) = −(Ea/R)(1/T) + constant</div>
          <div class="eq">gradient of ln(1/t) against 1/T = −Ea/R → Ea = −gradient × 8.31</div>
        </div>
        <dl class="reads pad nocase">
          <div><dt>Mixture</dt><dd class="txt">10 cm³ H₂O₂, 5 cm³ KI, acid, thiosulfate, starch: 50 cm³</dd></div>
          <div><dt>k at {prefs.T} °C <small>(model)</small></dt><dd>{sci(kAt(prefs.T), 3)} dm³ mol⁻¹ s⁻¹</dd></div>
        </dl>
      </section>
      <section class="panel" aria-label="Two temperatures">
        <div class="ph"><h2>From two temperatures</h2></div>
        <div class="work">
          {#if two}
            <div class="eq">ln(k₂/k₁) = (Ea/R)(1/T₁ − 1/T₂), with k ∝ 1/t so k₂/k₁ = t₁/t₂</div>
            <div class="eq">t₁ = {two.a.t.toFixed(1)} s at {two.T1.toFixed(1)} K; t₂ = {two.b.t.toFixed(1)} s at {two.T2.toFixed(1)} K</div>
            <div class="eq">ln({two.a.t.toFixed(1)}/{two.b.t.toFixed(1)}) = {plain(Math.log(two.a.t / two.b.t), 3)}; 1/T₁ − 1/T₂ = {sci(1 / two.T1 - 1 / two.T2, 3)} K⁻¹</div>
            <div class="eq">Ea = 8.31 × {plain(Math.log(two.a.t / two.b.t), 3)} ÷ {sci(1 / two.T1 - 1 / two.T2, 3)} = {plain(two.Ea, 3)} kJ mol⁻¹</div>
          {:else}
            <p class="why">Time the clock at two or more temperatures: the coldest and hottest runs are used here.</p>
          {/if}
        </div>
      </section>
    {/if}
  </aside>

  <!-- ===== results ===== -->
  <section class="panel full" aria-label="Results">
    <div class="ph"><h2>{prefs.view === 'cp9a' ? (prefs.follow === 'titrate' ? 'Results: titre against time' : 'Results: absorbance against time') : prefs.view === 'cp9b' ? `Results: 1/t against [${prefs.vary === 'KI' ? 'I⁻' : 'H₂O₂'}]` : 'Results: ln(1/t) against 1/T'}</h2></div>
    <div class="cols2">
      <div class="tabwrap">
        {#if prefs.view === 'cp9a'}
          {#if prefs.follow === 'titrate'}
            <table class="rtab">
              <thead><tr><th>time / min</th><th>final / cm³</th><th>initial / cm³</th><th>titre / cm³</th></tr></thead>
              <tbody>
                {#each samples as s (s.min)}<tr><td>{s.min}</td><td>{(1 + s.titre).toFixed(2)}</td><td>1.00</td><td>{s.titre.toFixed(2)}</td></tr>
                {:else}<tr><td colspan="4" class="empty">Start the reaction: a sample is taken every 5 minutes.</td></tr>{/each}
              </tbody>
            </table>
          {:else}
            <table class="rtab">
              <thead><tr><th>time / min</th><th>absorbance</th><th>time / min</th><th>absorbance</th></tr></thead>
              <tbody>
                {#each Array.from({ length: Math.ceil(reads.length / 2) }, (_, i) => i) as i (i)}
                  <tr><td>{reads[2 * i].min}</td><td>{reads[2 * i].abs.toFixed(2)}</td><td>{reads[2 * i + 1]?.min ?? ''}</td><td>{reads[2 * i + 1]?.abs.toFixed(2) ?? ''}</td></tr>
                {:else}<tr><td colspan="4" class="empty">Start the reaction: the colorimeter logs a reading every minute.</td></tr>{/each}
              </tbody>
            </table>
          {/if}
        {:else if prefs.view === 'cp9b'}
          <table class="rtab">
            <thead><tr><th>{name(prefs.vary)} / cm³</th><th>[{prefs.vary === 'KI' ? 'I⁻' : 'H₂O₂'}] / M</th><th>t / s</th><th>mean t / s</th><th>1/t / s⁻¹</th></tr></thead>
            <tbody>
              {#each rows9bList as r (r.v)}
                <tr class:cur={r.v === prefs.vol}><td>{r.v}</td><td>{sci(r.c, 2)}</td><td class="lft">{r.ts.map((x) => x.toFixed(1)).join(', ') || '–'}</td><td>{r.ts.length ? r.mean.toFixed(1) : '–'}</td><td>{r.ts.length ? sci(1 / r.mean, 3) : '–'}</td></tr>
              {/each}
            </tbody>
          </table>
        {:else}
          <table class="rtab">
            <thead><tr><th>bath / °C</th><th>T mixture / °C</th><th>t / s</th><th>1/T / K⁻¹</th><th>ln(1/t)</th></tr></thead>
            <tbody>
              {#each hot as h (h.set)}<tr class:cur={h.set === prefs.T}><td>{h.set}</td><td>{h.T.toFixed(1)}</td><td>{h.t.toFixed(1)}</td><td>{sci(1 / (h.T + 273), 4)}</td><td>{plain(Math.log(1 / h.t), 3)}</td></tr>
              {:else}<tr><td colspan="5" class="empty">Pick a bath temperature and time the clock. Five temperatures give a good line.</td></tr>{/each}
            </tbody>
          </table>
        {/if}
      </div>
      <div class="plotbox">
        {#if prefs.view === 'cp9a'}
          <Plot xr={[0, 40]} yr={prefs.follow === 'titrate' ? [0, Math.max(10, titreOf(m9.I0) * 1.1)] : [0, 0.9]} xLabel="time / min" yLabel={prefs.follow === 'titrate' ? 'titre / cm³' : 'absorbance'} h={280}
            points={prefs.follow === 'titrate' ? samples.map((s) => ({ x: s.min, y: s.titre })) : reads.map((r) => ({ x: r.min, y: r.abs }))} line={fit9 ? { m: fit9.m, c: fit9.c } : null}
            label="Graph of titre or absorbance against time" />
        {:else if prefs.view === 'cp9b'}
          <Plot xr={[0, 22]} yr={[0, Math.max(5, ...pts9b.map((p) => p.y)) * 1.15]} xLabel={`[${prefs.vary === 'KI' ? 'I⁻' : 'H₂O₂'}] / 10⁻³ mol dm⁻³`} yLabel="1/t / 10⁻³ s⁻¹" h={280}
            points={pts9b} line={fit9b ? { m: fit9b.m, c: fit9b.c } : null} label="Graph of one over time against concentration" />
        {:else}
          <Plot xr={xr10} yr={yr10} xLabel="1/T / 10⁻³ K⁻¹" yLabel="ln(1/t)" h={280} points={pts10} line={fit10 ? { m: fit10.m, c: fit10.c } : null}
            label="Arrhenius plot of ln one over t against one over T" />
        {/if}
      </div>
    </div>
    <div class="concl">
      {#if prefs.view === 'cp9a'}
        {#if fit9}
          <p><b>Conclusion.</b> The points lie on a straight line (gradient {plain(fit9.m, 3)} {prefs.follow === 'titrate' ? 'cm³' : 'absorbance units'} per minute, r² = {plain(fit9.r2, 3)}): the iodine is used up at a <b>constant rate</b> however much is left, so the reaction is <b>zero order with respect to iodine</b>.
            Rate = {prefs.follow === 'titrate' ? `${plain(-fit9.m, 3)} cm³ min⁻¹ × 0.010 mol dm⁻³ ÷ 2 ÷ 10.0 cm³ ÷ 60` : `${plain(-fit9.m, 3)} min⁻¹ ÷ ${P9.absPerM} dm³ mol⁻¹ ÷ 60`} = {sci(prefs.follow === 'titrate' ? (-fit9.m * P9.cThio) / 2 / P9.aliquot / 60 : -fit9.m / P9.absPerM / 60, 3)} mol dm⁻³ s⁻¹.</p>
        {:else}
          <p class="why">Three or more points give the line. A straight line means zero order in iodine; a curve would mean first or second order.</p>
        {/if}
      {:else if prefs.view === 'cp9b'}
        {#if fit9b && ord9b !== null}
          <p><b>Conclusion.</b> 1/t against concentration is a straight line through the origin: rate ∝ [{prefs.vary === 'KI' ? 'I⁻' : 'H₂O₂'}]. The gradient of ln(1/t) against ln(concentration) is {plain(ord9b, 2)}, so the reaction is <b>first order with respect to {prefs.vary === 'KI' ? 'iodide ions' : 'hydrogen peroxide'}</b>.
            (Doubling the volume of stock doubles the concentration and halves the time.)</p>
        {:else}
          <p class="why">Time at least two concentrations, ideally all five, with a repeat of each. A straight line through the origin means first order; a horizontal line, zero order; an upward curve, second order.</p>
        {/if}
      {:else}
        {#if fit10 && hot.length >= 2}
          <p><b>Conclusion.</b> Gradient = {plain(fit10.m, 3)} × 10³ K, so Ea = −gradient × R = {plain(-fit10.m, 3)} × 10³ × 8.31 = <b>{plain(Ea10, 3)} kJ mol⁻¹</b> (this simulation’s true value: {CLK.Ea / 1000} kJ mol⁻¹).
            A rise of 10 °C near room temperature about doubles the rate.</p>
        {:else}
          <p class="why">At least two temperatures give the gradient; five spread from 20 °C to 60 °C give a reliable one.</p>
        {/if}
      {/if}
    </div>
  </section>

  <!-- ===== method, safety, errors ===== -->
  <section class="panel full" aria-label="Method">
    <div class="ph"><h2>Method, safety and errors</h2></div>
    <div class="cols2">
      <div>
        {#if prefs.view === 'cp9a'}
          <ol class="method">
            <li>Pipette 25 cm³ of propanone and 25 cm³ of hydrochloric acid into a flask; add 50 cm³ of 0.020 mol dm⁻³ iodine solution and <b>start the clock</b> as you mix.</li>
            <li>Every 5 minutes, pipette out a 10.0 cm³ sample and run it into a conical flask holding sodium hydrogencarbonate solution. Note the time it is half-emptied.</li>
            <li>The hydrogencarbonate <b>neutralises the acid catalyst</b> (HCO₃⁻ + H⁺ → H₂O + CO₂), which stops the reaction: it is <b>quenched</b>.</li>
            <li>Titrate the iodine left with 0.010 mol dm⁻³ sodium thiosulfate until pale straw; add starch (blue-black) and continue until the blue-black just disappears.</li>
            <li>Plot titre (∝ [I₂]) against time. Repeat with different concentrations of propanone or acid to find their orders.</li>
          </ol>
          <p class="alt"><b>Colorimetric alternative.</b> Iodine solution is yellow-brown, absorbing blue light, so use a <b>blue filter</b> (the complementary colour). Calibrate with known iodine concentrations, then log the absorbance (∝ [I₂]) continuously without removing samples or quenching.</p>
        {:else if prefs.view === 'cp9b'}
          <ol class="method">
            <li>Measure the potassium iodide (and water to keep 10 cm³), the sulfuric acid, the sodium thiosulfate and the starch into a beaker on a white tile.</li>
            <li>Add the hydrogen peroxide last, swirl, and <b>start the stopwatch</b> at the moment of mixing.</li>
            <li>Stop the clock when the blue-black colour suddenly appears. Record t.</li>
            <li>Repeat with 8, 6, 4 and 2 cm³ of KI made up to 10 cm³ with water: <b>the total volume stays the same</b>, so [I⁻] ∝ volume of KI. Repeat each run and average.</li>
            <li>Plot 1/t (∝ initial rate) against [I⁻].</li>
          </ol>
        {:else}
          <ol class="method">
            <li>Measure the reagents into two boiling tubes (the hydrogen peroxide alone in one) and stand both in a water bath at the chosen temperature for several minutes.</li>
            <li>Mix them, start the stopwatch and leave the tube in the bath. Read the temperature of the mixture at the start and end and take the mean.</li>
            <li>Stop the clock when the blue-black appears. Repeat at about five temperatures between room temperature and 60 °C, with the same volumes each time.</li>
            <li>Plot ln(1/t) against 1/T (T in kelvin); Ea = −gradient × R.</li>
          </ol>
          <p class="alt"><b>Other reactions.</b> The same method works for any clock reaction, and for <b>magnesium and hydrochloric acid</b>: time how long a fixed length of magnesium ribbon takes to react at each temperature; 1/t is again proportional to the rate.</p>
        {/if}
        <p class="safety"><b>Safety.</b>
          {#if prefs.view === 'cp9a'}Wear eye protection. Propanone is highly flammable: no flames. Iodine solution is harmful and stains; hydrochloric acid is an irritant. Iodopropanone, the product, irritates the eyes (a lachrymator): work in a well-ventilated room.
          {:else if prefs.view === 'cp9b'}Wear eye protection. Hydrogen peroxide and sulfuric acid are irritants at these concentrations; wash off any splashes.
          {:else}Wear eye protection. Hydrogen peroxide and sulfuric acid are irritants. Take care with hot water above 50 °C: it scalds; keep electrical water baths away from spills.{/if}</p>
      </div>
      <div>
        <div class="facts"><b>Errors and improvements</b><ul>
          {#if prefs.view === 'cp9a'}
            <li>The time of each sample is uncertain by several seconds (pipetting takes time): record when it is half run into the hydrogencarbonate.</li>
            <li>The end point is judged by eye; adding starch only near the end point makes it sharper (too early and the iodine–starch complex releases iodine slowly).</li>
            <li>The temperature is not controlled: stand the flask in a thermostatic water bath.</li>
            <li>A colorimeter gives many more points, continuously, with no sampling or quenching errors.</li>
          {:else if prefs.view === 'cp9b'}
            <li>Judging the instant the blue appears: use a white tile and the same observer; a light sensor and data logger removes reaction time.</li>
            <li>Starting the clock exactly at mixing: add the last reagent quickly and swirl.</li>
            <li>Temperature changes between runs change k: use a water bath.</li>
            <li>Short times (concentrated runs) have a larger percentage uncertainty: repeat and average, and reject anomalies.</li>
          {:else}
            <li>The mixture is not at the bath temperature: pre-warm both solutions, keep the tube in the bath and average the start and end temperatures.</li>
            <li>At high temperature the times are short, so the timing error is a larger percentage: use smaller concentrations or a light sensor.</li>
            <li>Above about 60 °C hydrogen peroxide starts to decompose and the line curves.</li>
            <li>Two temperatures give Ea, but five or more on a graph show anomalies and give a better value.</li>
          {/if}
        </ul></div>
      </div>
    </div>
  </section>

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      {#if prefs.view === 'cp9a'}
        <h3>Following a reaction continuously <small>spec 11.3, 11.4ii, 11.5i, 11.6i, 11.12</small></h3>
        <div class="cols2 bare">
          <p>A <b>continuous monitoring method</b> follows one run from start to finish, giving a concentration–time graph. Its shape gives the order of the reagent followed: a straight line (constant gradient) means zero order; a curve with a constant half-life means first order. Here [I₂] falls in a straight line, so iodine does not appear in the rate equation: it is not involved in the rate-determining step (see the Mechanisms tab).</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>rate = k[CH₃COCH₃][H⁺]: first order in propanone, first order in H⁺, zero order in I₂; second order overall.</li>
            <li>H⁺ is a catalyst: it is in the rate equation but not used up (HI is formed, so [H⁺] even rises slightly).</li>
            <li>Propanone and acid are in large excess, so their concentrations stay almost constant during one run.</li>
            <li>Quenching stops the reaction in each sample so the titre shows [I₂] at the moment it was taken.</li>
          </ul></div>
        </div>
      {:else if prefs.view === 'cp9b'}
        <h3>The initial-rate method and clock reactions <small>spec 11.4i, 11.5iii, 11.12</small></h3>
        <div class="cols2 bare">
          <p>An <b>initial-rate method</b> runs separate experiments, changing the initial concentration of one reagent at a time and keeping everything else (the other concentrations, the total volume, the temperature) the same. A <b>clock reaction</b> is an acceptable approximation: it times how long a small, fixed amount of product takes to form, so 1/t is proportional to the initial rate.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>Order 0: t does not change with concentration. Order 1: double the concentration, half the time. Order 2: double it, a quarter of the time.</li>
            <li>The thiosulfate sets the amount of iodine that must form: the blue appears only when it has all been used.</li>
            <li>For this reaction rate = k[H₂O₂][I⁻]: first order in each.</li>
            <li>Keep the total volume constant by making up with water, so the concentration is proportional to the volume of stock.</li>
          </ul></div>
        </div>
      {:else}
        <h3>Finding the activation energy <small>spec 11.10, 11.13</small></h3>
        <div class="cols2 bare">
          <p>Raising the temperature increases the rate constant k, because a larger fraction of collisions have at least the activation energy. The Arrhenius equation puts numbers on this; taking logs turns it into a straight line, y = mx + c, with ln k on the y-axis, 1/T on the x-axis and gradient −Ea/R. Any quantity proportional to k, such as 1/t from a clock reaction, gives the same gradient.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>ln k = −Ea/RT + ln A; the gradient of ln k (or ln 1/t) against 1/T is −Ea/R.</li>
            <li>T must be in kelvin; R = 8.31 J mol⁻¹ K⁻¹, so Ea comes out in J mol⁻¹: divide by 1000 for kJ mol⁻¹.</li>
            <li>The intercept is ln A (A is the pre-exponential factor), when ln k is plotted.</li>
            <li>The larger Ea, the steeper the line: the more sensitive the rate is to temperature.</li>
          </ul></div>
        </div>
      {/if}
    </div>
  </section>
</main>
