<script lang="ts" module>
  export interface MassPrefs {
    sample: string;
    mode: 'tof' | 'mag';
    custom: boolean;
    m1: number; p1: number;
    m2: number; p2: number;
  }
  export const MASS_PREFS: MassPrefs = {
    sample: 'cl2', mode: 'tof', custom: false,
    m1: 35, p1: 75, m2: 37, p2: 25,
  };
</script>

<script lang="ts">
  /* Mass Spectrometer: 3D TOF drift tube & magnetic deflection, isotope peaks, Cl2/Br2 molecular ion peaks & Ar calculation (2.3–2.5). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { MassSpecLook } from './massspec3d';
  import { SAMPLES, calcAr, type Peak } from './massspec';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: MassPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);
  let seq = $state(0);

  const preset = $derived(SAMPLES.find((s) => s.id === prefs.sample) ?? SAMPLES[1]);

  const isotopes = $derived(prefs.custom
    ? [
        { mass: prefs.m1, pct: prefs.p1, label: `${prefs.m1}X⁺` },
        { mass: prefs.m2, pct: Math.max(0, 100 - prefs.p1), label: `${prefs.m2}X⁺` },
      ]
    : preset.isotopes);

  const peaks = $derived<Peak[]>(prefs.custom
    ? isotopes.map((x) => ({ mz: x.mass, rel: x.pct, label: x.label }))
    : preset.peaks);

  const ar = $derived(calcAr(isotopes));

  const look = $derived<MassSpecLook>({ mode: prefs.mode, peaks, playing, seq });

  $effect(() => {
    stats = [
      ['Sample', prefs.custom ? 'Custom' : preset.name],
      ['Ar', ar.toFixed(1)],
      ['Peaks', peaks.length],
    ];
  });

  // Spectrum SVG helpers (viewBox 0 0 560 236)
  const X0 = 50, X1 = 536, Y0 = 198, Y1 = 46;
  const rawMin = $derived(Math.min(...peaks.map((p) => p.mz)));
  const rawMax = $derived(Math.max(...peaks.map((p) => p.mz)));
  const pad = $derived(Math.max(4, Math.ceil((rawMax - rawMin) * 0.14)));
  const minMz = $derived(Math.max(0, rawMin - pad));
  const maxMz = $derived(rawMax + pad);
  const maxRel = $derived(Math.max(...peaks.map((p) => p.rel), 10));
  const xMz = (mz: number) => X0 + ((mz - minMz) / Math.max(1, maxMz - minMz)) * (X1 - X0);
  const yRel = (rel: number) => Y0 - (rel / maxRel) * (Y0 - Y1);
  // Stagger label y slightly when consecutive peaks are close in x so labels never overlap
  const labelY = $derived(peaks.map((pk, i) => {
    const base = yRel(pk.rel) - 8;
    if (i > 0 && Math.abs(xMz(pk.mz) - xMz(peaks[i - 1].mz)) < 54 && Math.abs(base - (yRel(peaks[i - 1].rel) - 8)) < 16) {
      return Math.max(24, base - 13);
    }
    return base;
  }));
</script>

<main class="layout ab-mass" hidden={off}>
  <section class="panel stage" aria-label="3D mass spectrometer">
    <div class="stage-head">
      <div class="label-chip">
        <small>{prefs.mode === 'tof' ? 'Time-of-flight (TOF)' : 'Magnetic sector'}</small>
        <span>{prefs.custom ? 'Custom isotope mix' : `${preset.name} (${preset.formula})`}</span>
      </div>
      <div class="stage-tools">
        <Seg label="Analyser" options={[['tof', 'TOF drift tube', 'TOF'], ['mag', 'Magnetic deflection', 'Magnetic']]} bind:value={prefs.mode} />
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a sample">
      {#each SAMPLES as s (s.id)}
        <button type="button" class="chip" class:on={!prefs.custom && prefs.sample === s.id}
          onclick={() => { prefs.custom = false; prefs.sample = s.id; }}>
          {s.name}
        </button>
      {/each}
      <button type="button" class="chip" class:on={prefs.custom} onclick={() => (prefs.custom = true)}>Custom</button>
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./massspec3d').then((m) => m.MassSpecScene)} {look} label="3D mass spectrometer. Drag to rotate.">
          <div class="hud tl">
            <b>{prefs.mode === 'tof' ? 'Lighter ions arrive first' : 'Lighter ions deflect more'}</b>
            <span>KE = ½mv² (same KE for all +1 ions)</span>
          </div>
          <div class="hud tr">
            <span>Ar = {ar.toFixed(2)}</span>
          </div>
          <div class="hud bl">Each coloured pulse represents an ion of a different m/z ratio hitting the detector</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="btn primary playbtn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button type="button" class="btn" onclick={() => seq++}>Fire pulse</button>
    </div>

    <div class="ab-spec">
      <div class="ph"><h2>Mass spectrum</h2></div>
      <div class="plotbox">
        <svg viewBox="0 0 560 236" class="ab-svg" role="img" aria-label="Mass spectrum">
          <line class="ax" x1={X0} x2={X1} y1={Y0} y2={Y0} />
          <line class="ax" x1={X0} x2={X0} y1={Y1 - 12} y2={Y0} />
          <text class="axlbl" x="10" y="16">Relative abundance</text>
          <text class="axlbl" x={X1} y="226" text-anchor="end">m/z</text>

          {#each peaks as pk, i (pk.mz)}
            {@const x = xMz(pk.mz)}
            {@const y = yRel(pk.rel)}
            <line x1={x} x2={x} y1={Y0} y2={y} stroke="var(--accent)" stroke-width="5" stroke-linecap="round" />
            <text class="sym" x={x} y={labelY[i]} text-anchor="middle">{pk.label}</text>
            <text class="axlbl" x={x} y={Y0 + 15} text-anchor="middle">{pk.mz}</text>
          {/each}
        </svg>
      </div>
    </div>
  </section>

  <aside class="side">
    {#if prefs.custom}
      <section class="panel" aria-label="Custom isotopes">
        <div class="ph"><h2>Custom two-isotope mix</h2></div>
        <div class="ctls">
          <label class="ctl">
            <span class="ctl-l">Isotope 1 mass <b>{prefs.m1}</b></span>
            <input class="slider" type="range" min="10" max="100" step="1" bind:value={prefs.m1} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Isotope 1 abundance <b>{prefs.p1}%</b> (Isotope 2: {100 - prefs.p1}%)</span>
            <input class="slider" type="range" min="5" max="95" step="1" bind:value={prefs.p1} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Isotope 2 mass <b>{prefs.m2}</b></span>
            <input class="slider" type="range" min="10" max="100" step="1" bind:value={prefs.m2} />
          </label>
        </div>
      </section>
    {/if}

    <section class="panel" aria-label="Ar calculation">
      <div class="ph"><h2>Relative atomic mass (A<sub>r</sub>)</h2></div>
      <dl class="reads pad">
        <div><dt>Calculated A<sub>r</sub></dt><dd>{ar.toFixed(1)}</dd></div>
        <div><dt>Unrounded</dt><dd>{ar.toFixed(3)}</dd></div>
      </dl>

      <div class="work">
        <div class="eq">Aᵣ = Σ(isotopic mass × abundance) / Σ(abundance)</div>
        <div class="eq">Aᵣ = ({isotopes.map((x) => `${x.mass} × ${x.pct}`).join(' + ')}) / {isotopes.reduce((s, x) => s + x.pct, 0).toFixed(1)} = {ar.toFixed(2)}</div>
      </div>

      {#if !prefs.custom}
        <p class="note pad">{preset.note}</p>
        <div class="facts pad">
          <b>Key facts</b>
          <ul>
            {#each preset.facts as f, i (i)}<li>{f}</li>{/each}
          </ul>
        </div>
      {/if}
    </section>
  </aside>
</main>
