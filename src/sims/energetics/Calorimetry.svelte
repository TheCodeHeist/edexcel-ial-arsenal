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
  /* Calorimetry: 3D polystyrene cup & spirit burner apparatus + cooling-curve extrapolation back to t = 4 min (CP 4 & 5). */
  import View3D from './View3D.svelte';
  import type { CalLook } from './calorimetry3d';
  import { CAL_REACTIONS, simulateCal } from './calorimetry';
  import { C_WATER, signed } from './consts';
  import { chem } from '../../lib/chem';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: CalPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  const rxn = $derived(CAL_REACTIONS.find((r) => r.id === prefs.rxn) ?? CAL_REACTIONS[0]);
  const effLoss = $derived(rxn.mode === 'cup' && prefs.lid ? prefs.loss * 0.55 : prefs.loss);
  const sim = $derived(simulateCal(rxn, prefs.mass, prefs.mol, effLoss));

  function pickRxn(id: string) {
    const r = CAL_REACTIONS.find((x) => x.id === id);
    if (!r) return;
    prefs.rxn = id;
    prefs.mass = r.defaultMass;
    prefs.mol = r.defaultMol;
  }

  const tempFrac = $derived(Math.max(-1, Math.min(1, sim.extrapDeltaT / 35)));
  const look = $derived<CalLook>({
    mode: rxn.mode,
    liquidHex: rxn.liquidHex,
    endHex: rxn.endHex,
    tempFrac,
    lid: prefs.lid,
    playing,
    progress: 1,
  });

  $effect(() => {
    stats = [
      ['ΔT (extrap)', `${signed(sim.extrapDeltaT, 1)} °C`],
      ['ΔH (exp)', `${signed(sim.dhExp, 0)} kJ mol⁻¹`],
      ['Data book', `${signed(rxn.dhLit, 0)} kJ mol⁻¹`],
    ];
  });

  // Cooling-curve SVG (viewBox 0 0 560 240, generous headroom)
  const X0 = 54, X1 = 532, Y0 = 200, Y1 = 38;
  const minT = $derived(Math.min(15, ...sim.points.map((p) => p.T), sim.extrapLine.T1) - 2);
  const maxT = $derived(Math.max(25, ...sim.points.map((p) => p.T), sim.extrapLine.T1) + 3);
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
  <section class="panel stage" aria-label="3D calorimeter and cooling curve">
    <div class="stage-head">
      <div class="label-chip">
        <small>{rxn.mode === 'cup' ? 'Core Practical 4 · Polystyrene cup' : 'Combustion calorimetry · Spirit burner'}</small>
        <span>{rxn.name}</span>
      </div>
      <div class="stage-tools">
        {#if rxn.mode === 'cup'}
          <button type="button" class="chip" class:on={prefs.lid} onclick={() => (prefs.lid = !prefs.lid)}>Insulating lid</button>
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
          <div class="hud bl">Drag to rotate · compare extrapolated ΔT with raw peak temperature below</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

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
      <dl class="reads pad">
        <div><dt>Peak ΔT (raw)</dt><dd>{signed(sim.peakDeltaT, 1)} °C</dd></div>
        <div><dt>Extrapolated ΔT</dt><dd>{signed(sim.extrapDeltaT, 1)} °C</dd></div>
        <div><dt>Heat q</dt><dd>{(Math.abs(sim.qExp) / 1000).toFixed(2)} kJ</dd></div>
        <div><dt>Experimental ΔH</dt><dd>{signed(sim.dhExp, 1)} kJ mol⁻¹</dd></div>
      </dl>
      <div class="work">
        <div class="eq">q = m c ΔT = {prefs.mass} × {C_WATER} × {Math.abs(sim.extrapDeltaT).toFixed(2)} = {Math.abs(sim.qExp).toFixed(0)} J</div>
        <div class="eq">ΔH = {sim.extrapDeltaT >= 0 ? '−' : '+'}{(Math.abs(sim.qExp) / 1000).toFixed(2)} / {prefs.mol.toFixed(3)} = {signed(sim.dhExp, 1)} kJ mol⁻¹</div>
      </div>
      <p class="note pad">{rxn.note}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each rxn.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
