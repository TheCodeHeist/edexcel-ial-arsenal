<script lang="ts" module>
  export interface BuffersPrefs {
    preset: string;
    ha: number;
    a: number;
    spike: number; // mol added (+ = H+, - = OH-)
  }
  export const BUFFERS_PREFS: BuffersPrefs = {
    preset: 'ethanoate', ha: 0.50, a: 0.50, spike: 0,
  };
</script>

<script lang="ts">
  /* Buffers & Blood: 3D HA/A⁻ reservoir, live acid/alkali spike resistance & pure-water comparison (Spec 14.12–14.14). */
  import View3D from './View3D.svelte';
  import type { BufferLook } from './buffers3d';
  import { BUFFER_PRESETS, calcBuffer } from './buffers';
  import { chem } from '../../lib/chem';
  import { isReducedMotion } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: BuffersPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!isReducedMotion());

  const preset = $derived(BUFFER_PRESETS.find((b) => b.id === prefs.preset) ?? BUFFER_PRESETS[0]);
  const res = $derived(calcBuffer(preset, prefs.ha, prefs.a, prefs.spike));
  const haFrac = $derived(res.ha / Math.max(0.01, res.ha + res.a));

  function pickPreset(id: string) {
    const p = BUFFER_PRESETS.find((x) => x.id === id);
    if (!p) return;
    prefs.preset = id;
    prefs.ha = p.defaultHA;
    prefs.a = p.defaultA;
    prefs.spike = 0;
  }

  const look = $derived<BufferLook>({ haFrac, playing });

  $effect(() => {
    stats = [
      ['Buffer pH', res.pH.toFixed(2)],
      ['ΔpH', `${res.deltaPH >= 0 ? '+' : '−'}${Math.abs(res.deltaPH).toFixed(2)}`],
      ['Water pH', res.waterPH.toFixed(2)],
    ];
  });
</script>

<main class="layout ac-buf" hidden={off}>
  <section class="panel stage" aria-label="3D buffer reservoir">
    <div class="stage-head">
      <div class="label-chip">
        <small>Buffer solution (1.0 dm³)</small>
        <span>{preset.name} (pKa = {preset.pKa})</span>
      </div>
      <div class="stage-tools">
        <button type="button" class="btn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a buffer">
      {#each BUFFER_PRESETS as b (b.id)}
        <button type="button" class="chip" class:on={prefs.preset === b.id} onclick={() => pickPreset(b.id)}>{b.name}</button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./buffers3d').then((m) => m.BuffersScene)} {look} label="3D buffer reservoir of HA and A- ions. Drag to rotate.">
          <div class="hud tl">
            <b>Buffer pH = {res.pH.toFixed(2)} ({res.deltaPH >= 0 ? '+' : '−'}{Math.abs(res.deltaPH).toFixed(2)})</b>
            <span>{res.broken ? 'Buffer capacity exceeded!' : `Same spike in pure water → pH ${res.waterPH.toFixed(2)}`}</span>
          </div>
          <div class="hud tr">
            <span>Amber = {preset.haName} ({res.ha.toFixed(2)} mol)</span>
            <span>Blue = {preset.aName} ({res.a.toFixed(2)} mol)</span>
          </div>
          <div class="hud bl">Large reservoirs of both HA and A⁻ absorb added OH⁻ or H⁺ so [HA]/[A⁻] barely changes</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="btn" onclick={() => (prefs.spike = Number(Math.min(0.4, prefs.spike + 0.02).toFixed(2)))}>+0.02 mol H⁺</button>
      <button type="button" class="btn" onclick={() => (prefs.spike = Number(Math.max(-0.4, prefs.spike - 0.02).toFixed(2)))}>+0.02 mol OH⁻</button>
      <button type="button" class="btn" onclick={() => (prefs.spike = 0)} disabled={prefs.spike === 0}>Reset spike</button>
      <label class="ctl scrub">
        <span class="ctl-l">Added {prefs.spike > 0 ? 'H⁺' : prefs.spike < 0 ? 'OH⁻' : 'acid/base'} <b>{Math.abs(prefs.spike).toFixed(2)} mol</b></span>
        <input class="slider" type="range" min="-0.30" max="0.30" step="0.01" bind:value={prefs.spike} />
      </label>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Buffer composition">
      <div class="ph"><h2>Reservoir composition</h2></div>
      <div class="ctls">
        <label class="ctl">
          <span class="ctl-l">Initial [{preset.haName}] <b>{prefs.ha.toFixed(2)} mol dm⁻³</b></span>
          <input class="slider" type="range" min="0.05" max="1.20" step="0.05" bind:value={prefs.ha} />
        </label>
        <label class="ctl">
          <span class="ctl-l">Initial [{preset.aName}] <b>{prefs.a.toFixed(2)} mol dm⁻³</b></span>
          <input class="slider" type="range" min="0.05" max="1.20" step="0.05" bind:value={prefs.a} />
        </label>
      </div>
    </section>

    <section class="panel" aria-label="Buffer working">
      <div class="ph"><h2>Henderson–Hasselbalch</h2></div>
      <div class="ac-eq">{@html chem(preset.eq)}</div>
      <dl class="reads pad">
        <div><dt>Buffer pH</dt><dd>{res.pH.toFixed(2)}</dd></div>
        <div><dt>Pure water pH</dt><dd>{res.waterPH.toFixed(2)}</dd></div>
        <div><dt>[{preset.haName}] now</dt><dd>{res.ha.toFixed(2)} mol dm⁻³</dd></div>
        <div><dt>[{preset.aName}] now</dt><dd>{res.a.toFixed(2)} mol dm⁻³</dd></div>
      </dl>
      <div class="work">
        <div class="eq">pH = pKa + log₁₀([A⁻] / [HA])</div>
        <div class="eq">pH = {preset.pKa.toFixed(2)} + log₁₀({res.a.toFixed(2)} / {res.ha.toFixed(2)}) = {res.pH.toFixed(2)}</div>
      </div>
      <p class="note pad">{preset.note}</p>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          {#each preset.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
