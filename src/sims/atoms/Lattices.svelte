<script lang="ts" module>
  export interface LatticesPrefs {
    id: LatticeId;
    shear: number;
    showElectrons: boolean;
  }
  export const LATTICES_PREFS: LatticesPrefs = {
    id: 'nacl', shear: 0, showElectrons: true,
  };
</script>

<script lang="ts">
  /* Crystal Lattices: 3D giant ionic, giant covalent, giant metallic & simple molecular structures (3.1–3.12, 3.19–3.21). */
  import View3D from './View3D.svelte';
  import type { LatticeLook } from './lattices3d';
  import { LATTICES, type LatticeId } from './lattices';
  import { chem } from '../../lib/chem';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: LatticesPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const info = $derived(LATTICES.find((l) => l.id === prefs.id) ?? LATTICES[0]);
  const hasElectrons = $derived(prefs.id === 'copper' || prefs.id === 'graphite' || prefs.id === 'graphene');
  const canShear = $derived(prefs.id === 'nacl' || prefs.id === 'copper' || prefs.id === 'graphite' || prefs.id === 'iodine');

  const look = $derived<LatticeLook>({
    id: prefs.id,
    shear: prefs.shear,
    showElectrons: prefs.showElectrons,
  });

  $effect(() => {
    stats = [
      ['Structure', info.structure],
      ['Melting point', info.mp.replace(/\s*\([^)]*\)$/, '')],
      ['Conducts (s)', info.conductSolid.startsWith('Yes') ? 'Yes' : 'No'],
    ];
  });
</script>

<main class="layout ab-lattices" hidden={off}>
  <section class="panel stage" aria-label="3D crystal lattice">
    <div class="stage-head">
      <div class="label-chip">
        <small>{info.structure}</small>
        <span>{info.name} ({@html chem(info.formula)})</span>
      </div>
      <div class="stage-tools">
        {#if hasElectrons}
          <button type="button" class="chip" class:on={prefs.showElectrons} onclick={() => (prefs.showElectrons = !prefs.showElectrons)}>
            Delocalised e⁻
          </button>
        {/if}
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a crystal structure">
      {#each LATTICES as l (l.id)}
        <button type="button" class="chip" class:on={prefs.id === l.id} onclick={() => { prefs.id = l.id; prefs.shear = 0; }}>
          {l.name}
        </button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./lattices3d').then((m) => m.LatticesScene)} {look} label="3D crystal lattice. Drag to rotate.">
          <div class="hud tl">
            <b>{info.name}</b>
            <span>{info.structure}</span>
          </div>
          <div class="hud tr">
            <span>{info.shearTitle}</span>
            {#if prefs.id === 'nacl'}
              <span class="ab-key">Purple Na⁺ · Green Cl⁻</span>
            {:else if prefs.id === 'ice'}
              <span class="ab-key">Red O · White H · Blue dashed H-bond</span>
            {:else if prefs.id === 'copper'}
              <span class="ab-key">Copper metal⁺ ions · Blue e⁻</span>
            {:else if prefs.id === 'graphite' || prefs.id === 'graphene'}
              <span class="ab-key">Grey C · {prefs.id === 'graphite' ? 'Amber London · ' : ''}Blue delocalised e⁻</span>
            {:else if prefs.id === 'diamond'}
              <span class="ab-key">Grey C · Cyan covalent bonds</span>
            {:else if prefs.id === 'iodine'}
              <span class="ab-key">Purple I₂ molecules</span>
            {/if}
            {#if prefs.id === 'nacl' && prefs.shear > 0.55}
              <span class="ab-warn">Like charges align → repulsion!</span>
            {/if}
          </div>
          <div class="hud bl">Drag to rotate · slide the shear stress bar below to test brittleness vs malleability</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <label class="ctl scrub">
        <span class="ctl-l">Apply shear stress (push top layer) <b>{canShear ? `${Math.round(prefs.shear * 100)}%` : 'Rigid lattice'}</b></span>
        <input class="slider" type="range" min="0" max="1" step="0.02" disabled={!canShear} bind:value={prefs.shear} />
      </label>
      <button type="button" class="btn" disabled={prefs.shear === 0} onclick={() => (prefs.shear = 0)}>Reset</button>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Structure properties">
      <div class="ph"><h2>Properties &amp; bonding</h2></div>
      <dl class="reads pad">
        <div class="wide"><dt>Bonding</dt><dd class="txt">{info.bonding}</dd></div>
        <div><dt>Melting point</dt><dd class="txt">{info.mp}</dd></div>
        <div><dt>Under stress</dt><dd class="txt">{info.shearTitle}</dd></div>
        <div class="wide"><dt>Conductivity (solid)</dt><dd class="txt">{info.conductSolid}</dd></div>
        <div class="wide"><dt>Conductivity (molten / aq)</dt><dd class="txt">{info.conductMolten}</dd></div>
      </dl>
      <p class="note pad">{info.shearText}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each info.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
