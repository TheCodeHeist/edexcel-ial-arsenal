<script lang="ts" module>
  export interface ShapesPrefs {
    mode: 'preset' | 'build';
    preset: string;
    bp: number;
    lp: number;
    showLP: boolean;
    showAngles: boolean;
    showDipoles: boolean;
  }
  export const SHAPES: ShapesPrefs = {
    mode: 'preset', preset: 'nh3', bp: 3, lp: 1,
    showLP: true, showAngles: true, showDipoles: false,
  };
</script>

<script lang="ts">
  /* Shapes & Polarity: 3D VSEPR shapes, lone-pair repulsion, bond angles and electronegativity/polarity (3.13–3.18, 3.22–3.24). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { ShapeLook } from './shapes3d';
  import { MOLECULES, buildVsepr, netDipole } from './shapes';
  import { EN } from './consts';
  import { chem } from '../../lib/chem';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: ShapesPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const mol = $derived(MOLECULES.find((m) => m.id === prefs.preset) ?? MOLECULES[0]);

  // Keep builder total pairs in [2, 6]
  function setBp(v: number) {
    prefs.bp = v;
    if (prefs.bp + prefs.lp > 6) prefs.lp = Math.max(0, 6 - prefs.bp);
    if (prefs.bp + prefs.lp < 2) prefs.lp = Math.max(0, 2 - prefs.bp);
  }
  function setLp(v: number) {
    prefs.lp = v;
    if (prefs.bp + prefs.lp > 6) prefs.bp = Math.max(1, 6 - prefs.lp);
    if (prefs.bp + prefs.lp < 2) prefs.bp = Math.max(2 - prefs.lp, 1);
  }

  const built = $derived(buildVsepr(prefs.bp, prefs.lp));

  const active = $derived(prefs.mode === 'preset' ? {
    key: `p:${mol.id}`,
    title: mol.name,
    formula: mol.formula,
    central: mol.central,
    bp: mol.bp,
    lp: mol.lp,
    shape: mol.shape,
    angle: mol.angle,
    arcPair: mol.arcPair,
    secondArc: mol.secondArc,
    ethene: !!mol.ethene,
    polar: mol.polar,
    polarWhy: mol.polarWhy,
    bonds: mol.bonds,
    lones: mol.lones,
    beyond: !!mol.beyond,
    facts: mol.facts,
  } : {
    key: `b:${prefs.bp}:${prefs.lp}`,
    title: `AX${prefs.bp}${prefs.lp ? `E${prefs.lp}` : ''}`,
    formula: `A X${prefs.bp}`,
    central: 'A',
    bp: prefs.bp,
    lp: prefs.lp,
    shape: built.shape,
    angle: built.angle,
    arcPair: built.arcPair,
    secondArc: built.secondArc,
    ethene: false,
    polar: built.polar,
    polarWhy: built.polar ? 'Asymmetrical arrangement of bonds leaves a net dipole.' : 'Symmetrical arrangement cancels equal bond dipoles.',
    bonds: built.bonds,
    lones: built.lones,
    beyond: !!built.beyond,
    facts: [built.note, 'Repulsion order: lone pair–lone pair > lone pair–bonding pair > bonding pair–bonding pair.'],
  });

  const dip = $derived(netDipole(active.central, active.bonds));
  const uniqueOuter = $derived([...new Set(active.bonds.map((b) => b.el))].filter((e) => EN[e] !== undefined && e !== active.central));
  const enC = $derived(EN[active.central]);
  const maxDeltaPair = $derived.by(() => {
    if (!enC || !uniqueOuter.length) return '';
    let best = uniqueOuter[0], bestD = -1;
    for (const o of uniqueOuter) {
      const d = Math.abs(EN[o] - enC);
      if (d > bestD) { bestD = d; best = o; }
    }
    return uniqueOuter.length > 1 ? ` (${active.central}–${best})` : '';
  });

  const look = $derived<ShapeLook>({
    key: active.key,
    central: active.central,
    bonds: active.bonds,
    lones: active.lones,
    arcPair: active.arcPair,
    secondArc: active.secondArc,
    ethene: active.ethene,
    showLP: prefs.showLP,
    showAngles: prefs.showAngles,
    showDipoles: prefs.showDipoles,
    angleText: active.angle,
  });

  $effect(() => {
    stats = [
      ['Shape', active.shape],
      ['Angle', active.angle],
      ['Polarity', active.polar ? 'Polar' : 'Non-polar'],
    ];
  });
</script>

<main class="layout ab-shapes" hidden={off}>
  <section class="panel stage" aria-label="3D molecule">
    <div class="stage-head">
      <div class="label-chip">
        <small>{prefs.mode === 'preset' ? 'Molecule' : 'VSEPR builder'}</small>
        <span>
          {#if prefs.mode === 'preset'}{@html chem(mol.formula)} · {mol.name}{:else}{active.title} ({active.bp} BP, {active.lp} LP){/if}
          {#if active.beyond}<span class="beyond">beyond</span>{/if}
        </span>
      </div>
      <div class="stage-tools">
        <Seg label="Mode" options={[['preset', 'Spec molecules', 'Presets'], ['build', 'Pair builder', 'Builder']]} bind:value={prefs.mode} />
      </div>
    </div>

    {#if prefs.mode === 'preset'}
      <div class="picker" role="group" aria-label="Choose a molecule">
        {#each MOLECULES as m (m.id)}
          <button type="button" class="chip" class:on={prefs.preset === m.id} aria-pressed={prefs.preset === m.id} aria-label={m.name} title={m.name} onclick={() => (prefs.preset = m.id)}>
            <span>{@html chem(m.formula)}</span>{#if m.beyond} <span class="ab-tag">ext</span>{/if}
          </button>
        {/each}
      </div>
    {/if}

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./shapes3d').then((m) => m.ShapesScene)} {look} label="3D molecular geometry. Drag to rotate.">
          <div class="hud tl">
            <b>{active.shape}</b>
            <span>{active.bp} bonding · {active.lp} lone · {active.angle}</span>
          </div>
          <div class="hud tr">
            <span>{active.polar ? 'Polar molecule' : 'Non-polar molecule'}</span>
            {#if prefs.mode === 'preset' && enC && uniqueOuter.length}
              <span>{uniqueOuter.length > 1 ? 'max ' : ''}ΔEN = {dip.deltaEN.toFixed(2)}{maxDeltaPair}</span>
            {/if}
          </div>
          <div class="hud bl">Drag to rotate · click then scroll to zoom · purple lobes are lone pairs</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="chip" class:on={prefs.showLP} onclick={() => (prefs.showLP = !prefs.showLP)}>Lone pairs</button>
      <button type="button" class="chip" class:on={prefs.showAngles} onclick={() => (prefs.showAngles = !prefs.showAngles)}>Bond angle</button>
      <button type="button" class="chip" class:on={prefs.showDipoles} onclick={() => (prefs.showDipoles = !prefs.showDipoles)}>Dipoles (δ+ → δ−)</button>
    </div>
  </section>

  <aside class="side">
    {#if prefs.mode === 'build'}
      <section class="panel" aria-label="Electron pair builder">
        <div class="ph"><h2>Electron pairs</h2></div>
        <div class="ctls">
          <label class="ctl">
            <span class="ctl-l">Bonding pairs <b>{prefs.bp}</b></span>
            <input class="slider" type="range" min="2" max="6" step="1" value={prefs.bp} oninput={(e) => setBp(+e.currentTarget.value)} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Lone pairs <b>{prefs.lp}</b></span>
            <input class="slider" type="range" min="0" max="3" step="1" value={prefs.lp} oninput={(e) => setLp(+e.currentTarget.value)} />
          </label>
          <p class="note">Total regions of electron density: <b>{prefs.bp + prefs.lp}</b> (kept between 2 and 6).</p>
        </div>
      </section>
    {/if}

    <section class="panel" aria-label="Geometry & polarity">
      <div class="ph"><h2>Geometry &amp; polarity</h2></div>
      <dl class="reads pad">
        <div><dt>Shape</dt><dd class="txt">{active.shape}</dd></div>
        <div><dt>Bond angle</dt><dd>{active.angle}</dd></div>
        <div><dt>Bonding pairs</dt><dd>{active.bp}</dd></div>
        <div><dt>Lone pairs</dt><dd>{active.lp}</dd></div>
        {#if prefs.mode === 'preset' && enC && uniqueOuter.length}
          <div><dt>EN ({active.central})</dt><dd>{enC.toFixed(2)}</dd></div>
          {#each uniqueOuter as el (el)}
            <div><dt>EN ({el})</dt><dd>{EN[el].toFixed(2)}</dd></div>
          {/each}
        {/if}
        <div class="wide"><dt>Molecular polarity</dt><dd class="txt">{active.polar ? 'Polar' : 'Non-polar'} — {active.polarWhy}</dd></div>
      </dl>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each active.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
