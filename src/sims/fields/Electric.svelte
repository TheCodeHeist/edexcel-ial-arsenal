<script lang="ts" module>
  export interface ElectricPrefs {
    preset: ElectricPresetId;
    showEquipot: boolean;
    probeX: number;
    probeY: number;
    plateV: number;
    plateD: number;
  }
  export const ELECTRIC_PREFS: ElectricPrefs = {
    preset: 'dipole', showEquipot: true, probeX: 0, probeY: 0.7, plateV: 2.0, plateD: 5.0,
  };
</script>

<script lang="ts">
  /* Electric Fields: 3D radial/dipole/like-charge field lines & equipotentials + uniform parallel plates (WPH14). */
  import View3D from './View3D.svelte';
  import type { ElectricLook } from './electric3d';
  import { ELECTRIC_PRESETS, evalRadial, type ElectricPresetId, type PointCharge } from './electric';
  import { sci, signed } from './consts';
  import { isReducedMotion } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: ElectricPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!isReducedMotion());
  let custom = $state<PointCharge[] | null>(null);

  const preset = $derived(ELECTRIC_PRESETS.find((p) => p.id === prefs.preset) ?? ELECTRIC_PRESETS[0]);
  const activeMode = $derived<'radial' | 'plates'>(custom ? 'radial' : preset.mode);
  const activeCharges = $derived<PointCharge[]>(custom ?? preset.charges);
  const activeName = $derived(custom ? `Custom (${custom.length} charge${custom.length === 1 ? '' : 's'})` : preset.name);
  const lookKey = $derived(custom ? 'custom:' + custom.map((c) => `${c.qMicro}@${c.x.toFixed(2)},${c.y.toFixed(2)}`).join('|') : preset.id);
  const probe = $derived(evalRadial(activeCharges, prefs.probeX, prefs.probeY));
  const plateE = $derived((prefs.plateV * 1000) / (prefs.plateD / 100)); // V m⁻¹

  const look = $derived<ElectricLook>({
    key: lookKey,
    mode: activeMode,
    charges: activeCharges,
    showEquipot: prefs.showEquipot,
    probeX: prefs.probeX,
    probeY: prefs.probeY,
    plateV: prefs.plateV,
    plateD: prefs.plateD,
    playing,
  });

  $effect(() => {
    if (activeMode === 'radial') {
      stats = probe.insideCharge
        ? [['|E| at probe', '—'], ['V at probe', '—']]
        : [
            ['|E| at probe', `${sci(probe.eMag, 3)} N C⁻¹`],
            ['V at probe', `${sci(probe.v, 3)} V`],
          ];
    } else {
      stats = [
        ['E = V / d', `${sci(plateE, 3)} V m⁻¹`],
        ['V', `${prefs.plateV.toFixed(1)} kV`],
        ['d', `${prefs.plateD.toFixed(1)} cm`],
      ];
    }
  });

  /* Kernel hooks */
  export function kSetPreset(id: ElectricPresetId) { custom = null; prefs.preset = id; }
  export function kSetCustom(charges: PointCharge[] | null) { custom = charges && charges.length ? charges : null; }
  export function kAddCharge(c: PointCharge, clear = false) {
    const base = clear ? [] : (custom ?? (preset.mode === 'radial' ? preset.charges.map((x) => ({ ...x })) : []));
    custom = [...base.slice(-5), c]; // cap at 6 charges so 3D streamlines stay responsive
  }
  export function kSetPlaying(on: boolean) { playing = on; }
  export function kReadouts() {
    return { playing, custom: custom !== null, activeMode, activeCharges, activeName, preset, probe, plateE };
  }
</script>

<main class="layout fl-elec" hidden={off}>
  <section class="panel stage" aria-label="3D electric field">
    <div class="stage-head">
      <div class="label-chip">
        <small>{activeMode === 'radial' ? 'Radial Coulomb field' : 'Uniform parallel plates'}</small>
        <span>{activeName}</span>
      </div>
      <div class="stage-tools">
        <button type="button" class="chip" class:on={prefs.showEquipot} onclick={() => (prefs.showEquipot = !prefs.showEquipot)}>Equipotentials</button>
        {#if activeMode === 'plates'}
          <button type="button" class="btn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
        {/if}
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose charge arrangement">
      {#each ELECTRIC_PRESETS as p (p.id)}
        <button type="button" class="chip" class:on={!custom && prefs.preset === p.id} onclick={() => { custom = null; prefs.preset = p.id; }}>{p.name}</button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./electric3d').then((m) => m.ElectricScene)} {look} label="3D electric field. Drag to rotate.">
          <div class="hud tl">
            <b>{activeName}</b>
            <span>
              {#if activeMode === 'radial'}
                {#if probe.insideCharge}
                  Probe inside charge sphere
                {:else}
                  |E| = {sci(probe.eMag, 3)} N C⁻¹ · V = {sci(probe.v, 3)} V
                {/if}
              {:else}
                E = V / d = {sci(plateE, 3)} V m⁻¹
              {/if}
            </span>
          </div>
          <div class="hud tr">
            <span>Red = +Q · Blue = −Q</span>
            <span>{activeMode === 'radial' ? 'Yellow dot = + test probe' : 'Green beam = electron'}</span>
          </div>
          <div class="hud bl">Field lines always cross equipotentials at 90° and point from + to −</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Field controls">
      <div class="ph"><h2>{activeMode === 'radial' ? 'Test charge probe (+q)' : 'Parallel plates'}</h2></div>
      <div class="ctls">
        {#if activeMode === 'radial'}
          <label class="ctl">
            <span class="ctl-l">Probe x <b>{signed(prefs.probeX * 10, 0)} cm</b></span>
            <input class="slider" type="range" min="-2.8" max="2.8" step="0.1" bind:value={prefs.probeX} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Probe y <b>{signed(prefs.probeY * 10, 0)} cm</b></span>
            <input class="slider" type="range" min="-1.8" max="1.8" step="0.1" bind:value={prefs.probeY} />
          </label>
          {#if activeCharges.length >= 2}
            <button type="button" class="btn" onclick={() => { prefs.probeX = 0; prefs.probeY = 0; }}>Place at midpoint (0, 0)</button>
          {/if}
        {:else}
          <label class="ctl">
            <span class="ctl-l">Potential difference V <b>{prefs.plateV.toFixed(1)} kV</b></span>
            <input class="slider" type="range" min="0.5" max="5.0" step="0.5" bind:value={prefs.plateV} />
          </label>
          <label class="ctl">
            <span class="ctl-l">Plate separation d <b>{prefs.plateD.toFixed(1)} cm</b></span>
            <input class="slider" type="range" min="2.0" max="10.0" step="0.5" bind:value={prefs.plateD} />
          </label>
        {/if}
      </div>
    </section>

    <section class="panel" aria-label="Readings and facts">
      <div class="ph"><h2>Readings &amp; key facts</h2></div>
      {#if activeMode === 'radial'}
        <dl class="reads pad">
          <div><dt>Field strength |E|</dt><dd>{probe.insideCharge ? '— (inside charge)' : `${sci(probe.eMag, 3)} N C⁻¹`}</dd></div>
          <div><dt>Potential V</dt><dd>{probe.insideCharge ? '— (inside charge)' : `${sci(probe.v, 3)} V`}</dd></div>
        </dl>
      {:else}
        <dl class="reads pad">
          <div><dt>Uniform E = V/d</dt><dd>{sci(plateE, 3)} V m⁻¹</dd></div>
          <div><dt>Force on e⁻</dt><dd>{sci(plateE * 1.6e-19, 3)} N</dd></div>
        </dl>
      {/if}
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
