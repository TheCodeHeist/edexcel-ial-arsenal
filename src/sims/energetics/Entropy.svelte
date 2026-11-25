<script lang="ts" module>
  export interface EntropyPrefs {
    preset: string;
    phase: EntropyPhase;
    T: number;       // K
    custom: boolean;
    dh: number;      // kJ mol⁻¹
    ds: number;      // J K⁻¹ mol⁻¹
  }
  export const ENTROPY_PREFS: EntropyPrefs = {
    preset: 'caco3', phase: 'decomp', T: 1200, custom: false, dh: 178, ds: 161,
  };
</script>

<script lang="ts">
  /* Entropy & Gibbs Free Energy: 3D disorder box + ΔStotal and ΔG = ΔH − TΔS feasibility graph (Spec 12.8–12.14). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { EntropyLook } from './entropy3d';
  import { FEAS_PRESETS, calcThermo, type EntropyPhase } from './entropy';
  import { signed } from './consts';
  import { chem } from '../../lib/chem';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: EntropyPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  const cur = $derived(FEAS_PRESETS.find((p) => p.id === prefs.preset) ?? FEAS_PRESETS[0]);
  const dh = $derived(prefs.custom ? prefs.dh : cur.dh);
  const ds = $derived(prefs.custom ? prefs.ds : cur.ds);
  const th = $derived(calcThermo(dh, ds, prefs.T));

  function pickPreset(id: string) {
    const p = FEAS_PRESETS.find((x) => x.id === id);
    if (!p) return;
    prefs.preset = id;
    prefs.phase = p.phase;
    prefs.dh = p.dh;
    prefs.ds = p.ds;
    prefs.custom = false;
  }

  const look = $derived<EntropyLook>({ phase: prefs.phase, T: prefs.T, playing });

  $effect(() => {
    stats = [
      ['T', `${prefs.T} K`],
      ['ΔG', `${signed(th.dg, 1)} kJ mol⁻¹`],
      ['Feasible?', th.feasible ? 'Yes (ΔG ≤ 0)' : 'No (ΔG > 0)'],
    ];
  });

  // ΔG vs T SVG (T: 100..1500 K, generous headroom)
  const X0 = 56, X1 = 532, Y0 = 200, Y1 = 36;
  const gMin = $derived(Math.min(-250, dh - (1500 * ds) / 1000, dh - (100 * ds) / 1000) - 40);
  const gMax = $derived(Math.max(250, dh - (1500 * ds) / 1000, dh - (100 * ds) / 1000) + 40);
  const xT = (t: number) => X0 + ((t - 100) / 1400) * (X1 - X0);
  const yG = (g: number) => Y0 - ((g - gMin) / Math.max(1, gMax - gMin)) * (Y0 - Y1);
  const yZero = $derived(yG(0));
</script>

<main class="layout en-ent" hidden={off}>
  <section class="panel stage" aria-label="3D entropy box and ΔG graph">
    <div class="stage-head">
      <div class="label-chip">
        <small>Entropy &amp; disorder</small>
        <span>S(solid) &lt; S(liquid) &lt;&lt; S(gas)</span>
      </div>
      <div class="stage-tools">
        <Seg label="Phase" options={[['solid', 'Solid', 'Solid'], ['liquid', 'Liquid', 'Liquid'], ['gas', 'Gas', 'Gas'], ['decomp', 'Solid → Gas', 'Decomp']]} bind:value={prefs.phase} />
      </div>
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./entropy3d').then((m) => m.EntropyScene)} {look} label="3D particle disorder box. Drag to rotate.">
          <div class="hud tl">
            <b>{th.feasible ? 'Thermodynamically feasible' : 'Not feasible at this T'}</b>
            <span>ΔG = {signed(th.dg, 1)} kJ mol⁻¹ · ΔStotal = {signed(th.dsTotal, 1)} J K⁻¹ mol⁻¹</span>
          </div>
          <div class="hud tr">
            <span>T = {prefs.T} K ({prefs.T - 273} °C)</span>
            {#if th.crossoverK !== null}
              <span>Crossover: {Math.round(th.crossoverK)} K</span>
            {/if}
          </div>
          <div class="hud bl">More ways to arrange particles and quanta of energy = higher entropy S</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="btn primary playbtn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <label class="ctl scrub">
        <span class="ctl-l">Temperature T <b>{prefs.T} K ({prefs.T - 273} °C)</b></span>
        <input class="slider" type="range" min="100" max="1500" step="10" bind:value={prefs.T} />
      </label>
    </div>

    <div class="en-dg">
      <div class="ph"><h2>ΔG = ΔH − TΔS against temperature</h2></div>
      <div class="plotbox">
        <svg viewBox="0 0 560 236" class="en-svg" role="img" aria-label="Gibbs free energy against temperature">
          <!-- Feasible region shading (below ΔG = 0) -->
          <rect x={X0} y={yZero} width={X1 - X0} height={Math.max(0, Y0 - yZero)} fill="color-mix(in srgb,var(--good) 10%,transparent)" />
          <line x1={X0} x2={X1} y1={yZero} y2={yZero} stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="5 4" />
          <text class="axlbl" x={X1 - 4} y={yZero - 5} text-anchor="end">ΔG = 0 (feasible below)</text>

          <line class="ax" x1={X0} x2={X1} y1={Y0} y2={Y0} />
          <line class="ax" x1={X0} x2={X0} y1={Y1 - 8} y2={Y0} />
          <text class="axlbl" x="10" y="16">ΔG / kJ mol⁻¹</text>
          <text class="axlbl" x={X1} y="226" text-anchor="end">Temperature / K</text>

          {#each [200, 500, 800, 1100, 1400] as t (t)}
            <text class="axlbl" x={xT(t)} y={Y0 + 15} text-anchor="middle">{t}</text>
          {/each}

          <!-- ΔG line -->
          <line x1={xT(100)} y1={yG(dh - (100 * ds) / 1000)} x2={xT(1500)} y2={yG(dh - (1500 * ds) / 1000)}
            stroke="var(--accent)" stroke-width="2.8" />

          <!-- Crossover dot if in range -->
          {#if th.crossoverK !== null && th.crossoverK >= 100 && th.crossoverK <= 1500}
            <circle cx={xT(th.crossoverK)} cy={yZero} r="5.5" fill="var(--amph)" />
            <text class="sym" x={xT(th.crossoverK)} y={yZero + 16} text-anchor="middle">T = {Math.round(th.crossoverK)} K</text>
          {/if}

          <!-- Current T marker -->
          <circle cx={xT(prefs.T)} cy={yG(th.dg)} r="6.5" fill={th.feasible ? 'var(--good)' : 'var(--redox)'} stroke="var(--solid)" stroke-width="2" />
        </svg>
      </div>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Reaction presets and custom sliders">
      <div class="ph"><h2>Four sign quadrants</h2></div>
      <div class="picker" role="group" aria-label="Choose a reaction">
        {#each FEAS_PRESETS as p (p.id)}
          <button type="button" class="chip" class:on={!prefs.custom && prefs.preset === p.id} onclick={() => pickPreset(p.id)}>{p.name}</button>
        {/each}
        <button type="button" class="chip" class:on={prefs.custom} onclick={() => (prefs.custom = !prefs.custom)}>Custom ΔH / ΔS</button>
      </div>

      {#if prefs.custom}
        <div class="ctls">
          <label class="ctl">
            <span class="ctl-l">ΔH <b>{signed(prefs.dh, 0)} kJ mol⁻¹</b></span>
            <input class="slider" type="range" min="-1000" max="3000" step="1" bind:value={prefs.dh} />
          </label>
          <label class="ctl">
            <span class="ctl-l">ΔSsystem <b>{signed(prefs.ds, 0)} J K⁻¹ mol⁻¹</b></span>
            <input class="slider" type="range" min="-300" max="300" step="1" bind:value={prefs.ds} />
          </label>
        </div>
      {:else}
        <div class="en-eq">{@html chem(cur.eq)}</div>
        <p class="note pad"><b>{cur.quadrant}:</b> {cur.note}</p>
      {/if}
    </section>

    <section class="panel" aria-label="Thermodynamic calculations">
      <div class="ph"><h2>ΔStotal &amp; ΔG</h2></div>
      <dl class="reads pad">
        <div><dt>ΔSsystem</dt><dd>{signed(th.dsSys, 1)} J K⁻¹ mol⁻¹</dd></div>
        <div><dt>ΔSsurroundings</dt><dd>{signed(th.dsSurr, 1)} J K⁻¹ mol⁻¹</dd></div>
        <div><dt>ΔStotal</dt><dd>{signed(th.dsTotal, 1)} J K⁻¹ mol⁻¹</dd></div>
        <div><dt>ΔG</dt><dd>{signed(th.dg, 1)} kJ mol⁻¹</dd></div>
      </dl>
      <div class="work">
        <div class="eq">ΔSsurr = −ΔH / T = −({dh * 1000}) / {prefs.T} = {signed(th.dsSurr, 1)} J K⁻¹ mol⁻¹</div>
        <div class="eq">ΔG = ΔH − TΔS = {dh} − ({prefs.T} × {(ds / 1000).toFixed(3)}) = {signed(th.dg, 1)} kJ mol⁻¹</div>
      </div>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          <li>A reaction is thermodynamically feasible when <b>ΔStotal ≥ 0</b> (equivalently <b>ΔG ≤ 0</b>).</li>
          <li>Always convert ΔS from J K⁻¹ mol⁻¹ to kJ K⁻¹ mol⁻¹ (÷ 1000) before using ΔG = ΔH − TΔS!</li>
          <li>Thermodynamic feasibility does NOT tell you the rate — a reaction with ΔG &lt; 0 can still be kinetically inert if Ea is very high.</li>
        </ul>
      </div>
    </section>
  </aside>
</main>
