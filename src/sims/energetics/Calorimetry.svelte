<script lang="ts" module>
  export interface CalPrefs {
    rxn: string;
    mass: number;
    mol: number;
    loss: number;   // 0..1 heat-loss severity
    lid: boolean;
  }
  export const CAL_PREFS: CalPrefs = {
    rxn: 'zn_cuso4', mass: 50, mol: 0.025, loss: 0.35, lid: true,
  };
</script>

<script lang="ts">
  /* Calorimetry: 3D polystyrene cup & spirit burner apparatus + cooling-curve extrapolation back to t = 4 min (Topic 6). */
  import View3D from './View3D.svelte';
  import type { CalLook } from './calorimetry3d';
  import { CAL_REACTIONS, simulateCal } from './calorimetry';
  import { C_WATER, signed } from './consts';
  import { chem } from '../../lib/chem';
  import { frameReady, isReducedMotion } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: CalPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!isReducedMotion());
  let progress = $state(isReducedMotion() ? 1 : 0);

  const rxn = $derived(CAL_REACTIONS.find((r) => r.id === prefs.rxn) ?? CAL_REACTIONS[0]);
  const effLoss = $derived(rxn.mode === 'cup' && prefs.lid ? prefs.loss * 0.55 : prefs.loss);
  const sim = $derived(simulateCal(rxn, prefs.mass, prefs.mol, effLoss));

  function replay() {
    progress = 0;
    playing = true;
  }

  function pickRxn(id: string) {
    const r = CAL_REACTIONS.find((x) => x.id === id);
    if (!r) return;
    prefs.rxn = id;
    prefs.mass = r.defaultMass;
    prefs.mol = r.defaultMol;
    progress = isReducedMotion() ? 1 : 0;
  }

  $effect(() => {
    if (off || !playing || progress >= 1) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const g = frameReady(now, last);
      if (g === 'go') {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        progress = Math.min(1, progress + dt * 0.38);
      } else if (g === 'hidden') {
        last = now;
      }
      if (progress < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const dynNote = $derived.by(() => {
    if (rxn.id === 'zn_cuso4') {
      const conc = prefs.mol / (prefs.mass / 1000);
      return `Excess zinc powder added to ${prefs.mass} cm³ of ${conc.toFixed(2)} mol dm⁻³ CuSO₄(aq) at t = 4 min. Blue colour fades as Cu²⁺ is displaced.`;
    }
    if (rxn.id === 'hcl_naoh') {
      const half = prefs.mass / 2;
      const conc = prefs.mol / (half / 1000);
      return `${half.toFixed(0)} cm³ HCl + ${half.toFixed(0)} cm³ NaOH at ${conc.toFixed(2)} mol dm⁻³ (total mass ${prefs.mass} g, ${prefs.mol.toFixed(3)} mol H₂O formed).`;
    }
    if (rxn.id === 'nh4no3') {
      const solidG = prefs.mol * (rxn.molarMass ?? 80.0);
      return `${solidG.toFixed(2)} g (${prefs.mol.toFixed(3)} mol) NH₄NO₃ dissolves in ${prefs.mass} cm³ water: temperature drops, so ΔH is positive (endothermic).`;
    }
    if (rxn.id === 'ethanol') {
      return `Spirit burner heats ${prefs.mass} g water in a copper can; Δm = ${(sim.massFuel ?? 0).toFixed(2)} g ethanol burned gives n = Δm / 46.0 = ${prefs.mol.toFixed(3)} mol.`;
    }
    return `Spirit burner heats ${prefs.mass} g water in a copper can; Δm = ${(sim.massFuel ?? 0).toFixed(2)} g propan-1-ol burned gives n = Δm / 60.0 = ${prefs.mol.toFixed(3)} mol.`;
  });

  const tempFrac = $derived(Math.max(-1, Math.min(1, (sim.extrapDeltaT * progress) / 35)));
  const look = $derived<CalLook>({
    mode: rxn.mode,
    liquidHex: rxn.liquidHex,
    endHex: rxn.endHex,
    tempFrac,
    lid: prefs.lid,
    playing,
    progress,
  });

  $effect(() => {
    stats = rxn.mode === 'cup'
      ? [
          ['ΔT (extrap)', `${signed(sim.extrapDeltaT, 1)} °C`],
          ['ΔH (exp)', `${signed(sim.dhExp, 0)} kJ mol⁻¹`],
          ['Data book', `${signed(rxn.dhLit, 0)} kJ mol⁻¹`],
        ]
      : [
          ['ΔT', `${signed(sim.peakDeltaT, 1)} °C`],
          ['Burner Δm', `${(sim.massFuel ?? 0).toFixed(2)} g`],
          ['ΔH (exp)', `${signed(sim.dhExp, 0)} kJ mol⁻¹`],
        ];
  });

  // Cooling-curve SVG (viewBox 0 0 560 240, generous headroom)
  const X0 = 54, X1 = 532, Y0 = 200, Y1 = 38;
  const minT = $derived(sim.points.length ? Math.min(15, ...sim.points.map((p) => p.T), sim.extrapLine.T1) - 2 : 15);
  const maxT = $derived(sim.points.length ? Math.max(25, ...sim.points.map((p) => p.T), sim.extrapLine.T1) + 3 : 60);
  const xT = (t: number) => X0 + (t / 10) * (X1 - X0);
  const yT = (T: number) => Y0 - ((T - minT) / Math.max(1, maxT - minT)) * (Y0 - Y1);
  const prePath = $derived(
    sim.points.filter((p) => p.t <= 3).map((p, i) => `${i ? 'L' : 'M'}${xT(p.t).toFixed(1)} ${yT(p.T).toFixed(1)}`).join(' ')
  );
  const postPath = $derived(
    sim.points.filter((p) => p.t >= 5).map((p, i) => `${i ? 'L' : 'M'}${xT(p.t).toFixed(1)} ${yT(p.T).toFixed(1)}`).join(' ')
  );
</script>

<main class="layout en-cal" hidden={off}>
  <section class="panel stage" aria-label="3D calorimeter and temperature data">
    <div class="stage-head">
      <div class="label-chip">
        <small>{rxn.mode === 'cup' ? 'Topic 6 · Polystyrene cup calorimetry' : 'Combustion calorimetry · Spirit burner'}</small>
        <span>{rxn.name}</span>
      </div>
      <div class="stage-tools">
        {#if rxn.mode === 'cup'}
          <button type="button" class="chip" class:on={prefs.lid} onclick={() => (prefs.lid = !prefs.lid)}>Insulating lid</button>
          <button type="button" class="btn" onclick={replay}>Replay mixing</button>
        {/if}
        <button type="button" class="btn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a reaction">
      {#each CAL_REACTIONS as r (r.id)}
        <button type="button" class="chip" class:on={prefs.rxn === r.id} onclick={() => pickRxn(r.id)}>{r.name}</button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./calorimetry3d').then((m) => m.CalorimetryScene)} {look} label="3D calorimeter apparatus. Drag to rotate.">
          <div class="hud tl">
            <b>ΔT = {signed(sim.extrapDeltaT, 1)} °C</b>
            <span>{sim.extrapDeltaT >= 0 ? 'Exothermic (heat released to water)' : 'Endothermic (heat absorbed from water)'}</span>
          </div>
          <div class="hud tr">
            <span>ΔH = {signed(sim.dhExp, 1)} kJ mol⁻¹</span>
            <span>Literature: {signed(rxn.dhLit, 1)} kJ mol⁻¹</span>
          </div>
          <div class="hud bl">
            {rxn.mode === 'cup' ? 'Drag to rotate · compare extrapolated ΔT with raw peak temperature below' : 'Drag to rotate · measure ΔT and mass of fuel burned (Δm)'}
          </div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    {#if rxn.mode === 'cup'}
      <div class="en-curve">
        <div class="ph"><h2>Temperature–time cooling curve (extrapolated to t = 4 min)</h2></div>
        <div class="plotbox">
          <svg viewBox="0 0 560 240" class="en-svg" role="img" aria-label="Cooling curve extrapolated to time of mixing">
            <line class="ax" x1={X0} x2={X1} y1={Y0} y2={Y0} />
            <line class="ax" x1={X0} x2={X0} y1={Y1 - 10} y2={Y0} />
            <text class="axlbl" x="10" y="16">Temperature / °C</text>
            <text class="axlbl" x={X1} y="230" text-anchor="end">Time / min</text>

            {#each [0, 2, 4, 6, 8, 10] as t (t)}
              <line class="grid" x1={xT(t)} x2={xT(t)} y1={Y1} y2={Y0} />
              <text class="axlbl" x={xT(t)} y={Y0 + 15} text-anchor="middle">{t}</text>
            {/each}

            <!-- Vertical mixing line at t = 4 -->
            <line x1={xT(4)} x2={xT(4)} y1={Y1} y2={Y0} stroke="var(--amph)" stroke-width="1.5" stroke-dasharray="4 3" />
            <text class="axlbl" x={xT(4) + 5} y={Y1 + 10}>mix (4 min)</text>

            <!-- Baseline & cooling curve -->
            <path d={prePath} fill="none" stroke="var(--accent)" stroke-width="2.4" />
            <path d={postPath} fill="none" stroke="var(--accent)" stroke-width="2.4" />

            <!-- Extrapolation line back to t = 4 -->
            <line x1={xT(sim.extrapLine.t1)} y1={yT(sim.extrapLine.T1)} x2={xT(sim.extrapLine.t2)} y2={yT(sim.extrapLine.T2)}
              stroke="var(--redox)" stroke-width="2.2" stroke-dasharray="5 4" />
            <circle cx={xT(4)} cy={yT(sim.extrapLine.T1)} r="5" fill="var(--redox)" />
            <line x1={xT(4)} y1={yT(sim.t0)} x2={xT(4)} y2={yT(sim.extrapLine.T1)} stroke="var(--redox)" stroke-width="2.6" />

            {#each sim.points as pt (pt.t)}
              <circle cx={xT(pt.t)} cy={yT(pt.T)} r="4" fill="var(--solid)" stroke="var(--accent)" stroke-width="2" />
            {/each}
          </svg>
        </div>
      </div>
    {:else}
      <div class="en-curve en-burner-sum">
        <div class="ph"><h2>Spirit-burner measurements (start / end readings)</h2></div>
        <dl class="reads pad">
          <div><dt>Initial water T</dt><dd>{sim.t0.toFixed(1)} °C</dd></div>
          <div><dt>Final water T</dt><dd>{(sim.t0 + sim.peakDeltaT).toFixed(1)} °C</dd></div>
          <div><dt>Temperature rise ΔT</dt><dd>{signed(sim.peakDeltaT, 1)} °C</dd></div>
          <div><dt>Mass of fuel burned Δm</dt><dd>{(sim.massFuel ?? 0).toFixed(2)} g</dd></div>
        </dl>
      </div>
    {/if}
  </section>

  <aside class="side">
    <section class="panel" aria-label="Experiment controls">
      <div class="ph"><h2>Variables</h2></div>
      <div class="ctls">
        <label class="ctl">
          <span class="ctl-l">Mass of water / solution (m) <b>{prefs.mass} g</b></span>
          <input class="slider" type="range" min="25" max="150" step="5" bind:value={prefs.mass} />
        </label>
        <label class="ctl">
          <span class="ctl-l">Moles of limiting reagent (n) <b>{prefs.mol.toFixed(3)} mol</b></span>
          <input class="slider" type="range" min="0.005" max="0.12" step="0.005" bind:value={prefs.mol} />
        </label>
        <label class="ctl">
          <span class="ctl-l">Heat loss to surroundings <b>{Math.round(prefs.loss * 100)}%</b></span>
          <input class="slider" type="range" min="0" max="1" step="0.05" bind:value={prefs.loss} />
        </label>
      </div>
    </section>

    <section class="panel" aria-label="Calculation and key facts">
      <div class="ph"><h2>Calculation</h2></div>
      <div class="en-eq">{@html chem(rxn.eq)}</div>
      {#if rxn.mode === 'cup'}
        <dl class="reads pad">
          <div><dt>Peak ΔT (raw)</dt><dd>{signed(sim.peakDeltaT, 1)} °C</dd></div>
          <div><dt>Extrapolated ΔT</dt><dd>{signed(sim.extrapDeltaT, 1)} °C</dd></div>
          <div><dt>Heat q</dt><dd>{(Math.abs(sim.qExp) / 1000).toFixed(2)} kJ</dd></div>
          <div><dt>Experimental ΔH</dt><dd>{signed(sim.dhExp, 1)} kJ mol⁻¹</dd></div>
        </dl>
      {:else}
        <dl class="reads pad">
          <div><dt>Temperature rise ΔT</dt><dd>{signed(sim.peakDeltaT, 1)} °C</dd></div>
          <div><dt>Burner Δm</dt><dd>{(sim.massFuel ?? 0).toFixed(2)} g</dd></div>
          <div><dt>Heat q</dt><dd>{(Math.abs(sim.qExp) / 1000).toFixed(2)} kJ</dd></div>
          <div><dt>Experimental ΔcH</dt><dd>{signed(sim.dhExp, 1)} kJ mol⁻¹</dd></div>
        </dl>
      {/if}
      <div class="work">
        <div class="eq">q = m c ΔT = {prefs.mass} × {C_WATER} × {Math.abs(sim.extrapDeltaT).toFixed(2)} = {Math.abs(sim.qExp).toFixed(0)} J</div>
        <div class="eq">ΔH = {sim.extrapDeltaT >= 0 ? '−' : '+'}{(Math.abs(sim.qExp) / 1000).toFixed(2)} / {prefs.mol.toFixed(3)} = {signed(sim.dhExp, 1)} kJ mol⁻¹</div>
      </div>
      <p class="note pad">{dynNote}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each rxn.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
