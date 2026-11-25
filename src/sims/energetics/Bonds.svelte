<script lang="ts" module>
  export interface BondsPrefs {
    rxn: string;
    progress: number;
  }
  export const BONDS_PREFS: BondsPrefs = { rxn: 'ch4_comb', progress: 0.5 };
</script>

<script lang="ts">
  /* Bond Enthalpies: 3D bond breaking (endothermic) & bond making (exothermic) + enthalpy-level diagram (Spec 6.10–6.12). */
  import View3D from './View3D.svelte';
  import type { BondsLook } from './bonds3d';
  import { BOND_REACTIONS, sumBonds } from './bonds';
  import { signed } from './consts';
  import { chem } from '../../lib/chem';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: BondsPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const rxn = $derived(BOND_REACTIONS.find((r) => r.id === prefs.rxn) ?? BOND_REACTIONS[0]);
  const broken = $derived(sumBonds(rxn.broken));
  const made = $derived(sumBonds(rxn.made));
  const dhEst = $derived(broken - made);

  const stageText = $derived(
    prefs.progress < 0.25 ? 'Reactant molecules (intact)' :
    prefs.progress < 0.75 ? 'Gaseous atoms (bonds broken: +energy)' :
    'Product molecules (new bonds made: −energy)'
  );

  const look = $derived<BondsLook>({ progress: prefs.progress, rxnId: rxn.id });

  $effect(() => {
    stats = [
      ['Broken (+)', `+${broken} kJ`],
      ['Made (−)', `−${made} kJ`],
      ['ΔH (est)', `${signed(dhEst, 0)} kJ mol⁻¹`],
    ];
  });
</script>

<main class="layout en-bonds" hidden={off}>
  <section class="panel stage" aria-label="3D bond breaking and making">
    <div class="stage-head">
      <div class="label-chip">
        <small>Mean bond enthalpies</small>
        <span>{rxn.name}</span>
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a reaction">
      {#each BOND_REACTIONS as r (r.id)}
        <button type="button" class="chip" class:on={prefs.rxn === r.id} onclick={() => (prefs.rxn = r.id)}>{r.name}</button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./bonds3d').then((m) => m.BondsScene)} {look} label="3D bond breaking and making. Drag to rotate.">
          <div class="hud tl">
            <b>{stageText}</b>
            <span>ΔH = +{broken} − {made} = {signed(dhEst, 0)} kJ mol⁻¹</span>
          </div>
          <div class="hud tr">
            <span>Mean BE: {signed(dhEst, 0)} kJ mol⁻¹</span>
            <span>Actual ΔrH: {signed(rxn.dhLit, 0)} kJ mol⁻¹</span>
          </div>
          <div class="hud bl">Scrub reaction progress below: red bonds break (endothermic), blue bonds form (exothermic)</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <label class="ctl scrub">
        <span class="ctl-l">Reaction progress <b>{Math.round(prefs.progress * 100)}%</b></span>
        <input class="slider" type="range" min="0" max="1" step="0.02" bind:value={prefs.progress} />
      </label>
      <button type="button" class="chip" onclick={() => (prefs.progress = 0)}>Reactants</button>
      <button type="button" class="chip" onclick={() => (prefs.progress = 0.5)}>Atoms</button>
      <button type="button" class="chip" onclick={() => (prefs.progress = 1)}>Products</button>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Bond tally">
      <div class="ph"><h2>Bond tally</h2></div>
      <div class="en-eq">{@html chem(rxn.eq)}</div>

      <div class="en-tally">
        <div>
          <h3 class="en-th red">Bonds broken (+)</h3>
          {#each rxn.broken as b (b.bond)}
            <div class="en-row"><span>{b.count} × ({b.bond})</span><b>+{b.count * b.be}</b></div>
          {/each}
          <div class="en-row tot"><span>Total broken</span><b>+{broken} kJ mol⁻¹</b></div>
        </div>
        <div>
          <h3 class="en-th blue">Bonds made (−)</h3>
          {#each rxn.made as b (b.bond)}
            <div class="en-row"><span>{b.count} × ({b.bond})</span><b>−{b.count * b.be}</b></div>
          {/each}
          <div class="en-row tot"><span>Total made</span><b>−{made} kJ mol⁻¹</b></div>
        </div>
      </div>

      <div class="work">
        <div class="eq">ΔH = Σ(broken) − Σ(made) = {broken} − {made} = {signed(dhEst, 0)} kJ mol⁻¹</div>
      </div>
      <p class="note pad"><b>Why it differs from actual ΔrH ({signed(rxn.dhLit, 0)} kJ mol⁻¹):</b> {rxn.whyDiff}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each rxn.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
