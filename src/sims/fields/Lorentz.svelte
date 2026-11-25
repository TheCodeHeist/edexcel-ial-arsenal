<script lang="ts" module>
  export interface LorentzPrefs {
    mode: 'orbit' | 'selector';
    particle: ParticleId;
    vScale: number;
    bScale: number;
    eScale: number;
  }
  export const LORENTZ_PREFS: LorentzPrefs = {
    mode: 'orbit', particle: 'electron', vScale: 1.0, bScale: 1.0, eScale: 1.0,
  };
</script>

<script lang="ts">
  /* Charged Particles: 3D circular path r = mv/BQ & crossed E/B velocity selector v = E/B (WPH14). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { LorentzLook } from './lorentz3d';
  import { PARTICLES, cyclotron, type ParticleId } from './lorentz';
  import { sci } from './consts';
  import { isReducedMotion } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: LorentzPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!isReducedMotion());

  const p = $derived(PARTICLES[prefs.particle]);
  // One unified physical scale across all particles (v = vScale × 10⁶ m/s, B = bScale × 0.05 T, E = eScale × 5×10⁴ V/m)
  const vPhys = $derived(prefs.vScale * 1e6);
  const bPhys = $derived(prefs.bScale * 0.05);
  const ePhys = $derived(prefs.eScale * 5e4);
  const cyc = $derived(cyclotron(p, vPhys, bPhys));
  const vSel = $derived(ePhys / bPhys);
  const matched = $derived(Math.abs(prefs.eScale - prefs.vScale * prefs.bScale) < 0.08);

  const look = $derived<LorentzLook>({
    mode: prefs.mode, particle: prefs.particle,
    vScale: prefs.vScale, bScale: prefs.bScale, eScale: prefs.eScale, playing,
  });

  $effect(() => {
    stats = prefs.mode === 'orbit'
      ? [['Particle', p.sym], ['Radius r', `${sci(cyc.r, 3)} m`], ['Period T', `${sci(cyc.T, 3)} s`]]
      : [['v', `${sci(vPhys, 3)} m s⁻¹`], ['E / B', `${sci(vSel, 3)} m s⁻¹`], ['Slit', matched ? 'Passes!' : 'Deflected']];
  });
</script>

<main class="layout fl-lor" hidden={off}>
  <section class="panel stage" aria-label="3D charged particle chamber">
    <div class="stage-head">
      <div class="label-chip">
        <small>{prefs.mode === 'orbit' ? 'Circular magnetic path' : 'Crossed E & B velocity selector'}</small>
        <span>{p.name} ({p.sym})</span>
      </div>
      <div class="stage-tools">
        <Seg label="Mode" options={[['orbit', 'r = mv/BQ', 'Orbit'], ['selector', 'v = E/B selector', 'Selector']]} bind:value={prefs.mode} />
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a particle">
      {#each Object.values(PARTICLES) as pt (pt.id)}
        <button type="button" class="chip" class:on={prefs.particle === pt.id} onclick={() => (prefs.particle = pt.id)}>{pt.name} ({pt.sym})</button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./lorentz3d').then((m) => m.LorentzScene)} {look} label="3D charged particle path. Drag to rotate.">
          <div class="hud tl">
            <b>{prefs.mode === 'orbit' ? `r = ${sci(cyc.r, 3)} m` : matched ? 'Balanced: v = E / B' : 'Unbalanced: beam deflected'}</b>
            <span>{prefs.mode === 'orbit' ? 'Green = centripetal F · Amber = velocity v (always 90°)' : `Target speed E/B = ${sci(vSel, 3)} m s⁻¹`}</span>
          </div>
          <div class="hud tr">
            <span>{p.q > 0 ? 'Positive charge' : 'Negative charge (curves opposite way!)'}</span>
            <span>{prefs.mode === 'orbit' ? 'Orbit radius not to scale (e⁻/p⁺ ≈ 1/1836)' : 'Top +V · Bottom −V → E ↓ · B ⊗'}</span>
          </div>
          <div class="hud bl">F = BQv acts perpendicular to v, so speed and kinetic energy stay constant</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="btn primary playbtn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      {#if prefs.mode === 'selector'}
        <button type="button" class="btn" onclick={() => (prefs.eScale = Math.min(4.0, Math.max(0.15, Number((prefs.vScale * prefs.bScale).toFixed(2)))))}>Balance (v = E/B)</button>
      {/if}
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Field parameters">
      <div class="ph"><h2>Controls</h2></div>
      <div class="ctls">
        <label class="ctl">
          <span class="ctl-l">Speed v <b>{sci(vPhys, 3)} m s⁻¹</b></span>
          <input class="slider" type="range" min="0.4" max="2.0" step="0.05" bind:value={prefs.vScale} />
        </label>
        <label class="ctl">
          <span class="ctl-l">Magnetic flux density B <b>{bPhys.toFixed(3)} T</b></span>
          <input class="slider" type="range" min="0.4" max="2.0" step="0.05" bind:value={prefs.bScale} />
        </label>
        {#if prefs.mode === 'selector'}
          <label class="ctl">
            <span class="ctl-l">Electric field E <b>{sci(ePhys, 3)} V m⁻¹</b></span>
            <input class="slider" type="range" min="0.15" max="4.0" step="0.05" bind:value={prefs.eScale} />
          </label>
        {/if}
      </div>
    </section>

    <section class="panel" aria-label="Equations and facts">
      <div class="ph"><h2>Equations &amp; readings</h2></div>
      <dl class="reads pad">
        <div><dt>Magnetic force F</dt><dd>{sci(cyc.F, 3)} N</dd></div>
        <div><dt>Orbit radius r</dt><dd>{sci(cyc.r, 3)} m</dd></div>
        <div><dt>Cyclotron period T</dt><dd>{sci(cyc.T, 3)} s</dd></div>
        <div><dt>Selected speed E/B</dt><dd>{sci(vSel, 3)} m s⁻¹</dd></div>
      </dl>
      <div class="work">
        <div class="eq">BQv = mv² / r  ⇒  r = mv / BQ = p / BQ</div>
        <div class="eq">T = 2πr / v = 2πm / BQ  (independent of speed v!)</div>
      </div>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          <li>Magnetic force F = BQv is always perpendicular to velocity v → zero work done → speed is constant and path is circular.</li>
          <li>Opposite charges (e⁻ vs p⁺) deflect in opposite directions.</li>
          <li>In a velocity selector, EQ = BQv gives v = E / B — independent of both mass and charge!</li>
        </ul>
      </div>
    </section>
  </aside>
</main>
