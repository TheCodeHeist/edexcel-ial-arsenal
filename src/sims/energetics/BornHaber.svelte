<script lang="ts" module>
  export interface BHPrefs {
    id: string;
    step: number;
  }
  export const BH_PREFS: BHPrefs = { id: 'nacl', step: 4 };
</script>

<script lang="ts">
  /* Born–Haber Cycles: 3D energy-level staircase, lattice energy, polarisation (exp vs theo) & enthalpy of solution (Spec 12.1–12.7). */
  import View3D from './View3D.svelte';
  import type { BHLook } from './bornhaber3d';
  import { BH_CYCLES, solEnthalpy } from './bornhaber';
  import { signed } from './consts';
  import { chem } from '../../lib/chem';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: BHPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const cycle = $derived(BH_CYCLES.find((c) => c.id === prefs.id) ?? BH_CYCLES[0]);
  const safeStep = $derived(Math.min(prefs.step, cycle.steps.length - 1));
  const curStep = $derived(cycle.steps[safeStep] ?? cycle.steps[0]);
  const dSol = $derived(solEnthalpy(cycle));
  const diffLE = $derived(Math.abs(cycle.leExp - cycle.leTheo));

  const look = $derived<BHLook>({ cycle, selectedStep: safeStep });

  $effect(() => {
    stats = dSol !== null
      ? [
          ['Compound', cycle.formula],
          ['ΔlattH⊖ (cycle)', `${cycle.leExp} kJ mol⁻¹`],
          ['ΔsolH', `${signed(dSol, 0)} kJ mol⁻¹`],
        ]
      : [
          ['Compound', cycle.formula],
          ['ΔlattH⊖ (cycle)', `${cycle.leExp} kJ mol⁻¹`],
          ['In water', 'Reacts'],
        ];
  });
</script>

<main class="layout en-bh" hidden={off}>
  <section class="panel stage" aria-label="3D Born-Haber staircase">
    <div class="stage-head">
      <div class="label-chip">
        <small>3D Born–Haber energy staircase</small>
        <span>{cycle.name} ({@html chem(cycle.formula)})</span>
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose an ionic compound">
      {#each BH_CYCLES as c (c.id)}
        <button type="button" class="chip" class:on={prefs.id === c.id}
          onclick={() => { prefs.id = c.id; prefs.step = c.steps.length - 1; }}>
          <span>{@html chem(c.formula)}</span>
        </button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./bornhaber3d').then((m) => m.BornHaberScene)} {look} label="3D Born-Haber cycle staircase. Drag to rotate.">
          <div class="hud tl">
            <b>{curStep.name}</b>
            <span>{curStep.symbol} = {signed(curStep.dh, 0)} kJ mol⁻¹</span>
          </div>
          <div class="hud tr">
            <span>Red arrow ↑ = endothermic</span>
            <span>Blue arrow ↓ = exothermic</span>
          </div>
          <div class="hud bl">Click any step on the right to highlight its platform and arrow on the 3D staircase</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="en-steps">
      {#each cycle.steps as st, i (st.id)}
        <button type="button" class="en-step" class:on={safeStep === i} onclick={() => (prefs.step = i)}>
          <span class="st-sym">{st.symbol}</span>
          <span class="st-val" class:endo={st.dh > 0} class:exo={st.dh < 0}>{signed(st.dh, 0)}</span>
        </button>
      {/each}
    </div>
    <p class="note pad"><b>{curStep.name} → {curStep.stateAfter}:</b> {curStep.note}</p>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Lattice energy and polarisation">
      <div class="ph"><h2>Lattice energy &amp; covalent character</h2></div>
      <dl class="reads pad">
        <div><dt>ΔlattH⊖ (from cycle)</dt><dd>{signed(cycle.leExp, 0)} kJ mol⁻¹</dd></div>
        <div><dt>ΔlattH⊖ (theoretical)</dt><dd>{signed(cycle.leTheo, 0)} kJ mol⁻¹</dd></div>
        <div><dt>Discrepancy</dt><dd>{diffLE} kJ mol⁻¹</dd></div>
        <div><dt>ΔfH⊖</dt><dd>{cycle.dfH} kJ mol⁻¹</dd></div>
      </dl>
      <p class="note pad">{cycle.polarNote}</p>
    </section>

    <section class="panel" aria-label="Enthalpy of solution">
      <div class="ph"><h2>Enthalpy of solution (ΔsolH)</h2></div>
      {#if dSol !== null}
        <div class="work">
          <div class="eq">ΔsolH = −ΔlattH⊖ + ΔhydH(cation) + {cycle.nAn > 1 ? `${cycle.nAn}×` : ''}ΔhydH(anion)</div>
          <div class="eq">ΔsolH = +{-cycle.leExp} + ({cycle.hydCat}) + {cycle.nAn > 1 ? `${cycle.nAn}(${cycle.hydAn})` : `(${cycle.hydAn})`} = {signed(dSol, 0)} kJ mol⁻¹</div>
        </div>
      {:else if cycle.solNote}
        <p class="note pad">{cycle.solNote}</p>
      {/if}
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each cycle.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
