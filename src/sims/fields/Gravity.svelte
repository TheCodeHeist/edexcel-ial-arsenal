<script lang="ts" module>
  export interface GravityPrefs {
    body: string;
    rRatio: number; // multiples of planet radius R (1.3..7.0)
  }
  export const GRAVITY_PREFS: GravityPrefs = { body: 'earth', rRatio: 2.0 };
</script>

<script lang="ts">
  /* Gravitational Fields: 3D potential well & orbital mechanics + Gravity vs Electric comparison (WPH14 + WPH15). */
  import View3D from './View3D.svelte';
  import type { GravityLook } from './gravity3d';
  import { BODIES, orbitMetrics, COMPARE_ROWS } from './gravity';
  import { sci } from './consts';
  import { isReducedMotion } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: GravityPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!isReducedMotion());

  const body = $derived(BODIES.find((b) => b.id === prefs.body) ?? BODIES[0]);
  const orb = $derived(orbitMetrics(body, prefs.rRatio));
  const tHours = $derived(orb.T / 3600);
  const isGeo = $derived(body.id === 'earth' && Math.abs(tHours - 24) < 0.8);

  const look = $derived<GravityLook>({
    bodyHex: body.hex, bodyName: body.name, rRatio: prefs.rRatio, playing,
  });

  $effect(() => {
    stats = [
      ['g', `${orb.g.toFixed(2)} N kg⁻¹`],
      ['v (orbit)', `${(orb.vOrb / 1000).toFixed(2)} km s⁻¹`],
      ['Period T', `${tHours.toFixed(1)} h`],
    ];
  });
</script>

<main class="layout fl-grav" hidden={off}>
  <section class="panel stage" aria-label="3D gravitational potential well">
    <div class="stage-head">
      <div class="label-chip">
        <small>Gravitational field &amp; orbits</small>
        <span>{body.name} · r = {prefs.rRatio.toFixed(2)} R</span>
      </div>
      <div class="stage-tools">
        <button type="button" class="btn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
        {#if body.id === 'earth'}
          <button type="button" class="chip" class:on={isGeo} onclick={() => (prefs.rRatio = 6.62)}>Geostationary (24 h)</button>
        {/if}
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose a body">
      {#each BODIES as b (b.id)}
        <button type="button" class="chip" class:on={prefs.body === b.id} onclick={() => (prefs.body = b.id)}>{b.name}</button>
      {/each}
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./gravity3d').then((m) => m.GravityScene)} {look} label="3D gravitational potential well and satellite orbit. Drag to rotate.">
          <div class="hud tl">
            <b>g = {orb.g.toFixed(2)} N kg⁻¹ · Vg = {sci(orb.vg / 1e6, 3)} MJ kg⁻¹</b>
            <span>v = {(orb.vOrb / 1000).toFixed(2)} km s⁻¹ · T = {tHours.toFixed(2)} h {isGeo ? '(Geostationary!)' : ''}</span>
          </div>
          <div class="hud tr">
            <span>Wireframe = negative potential well (−GM/r)</span>
          </div>
          <div class="hud bl">Green = centripetal gravity · Amber = orbital velocity (Kepler’s 3rd law: T² ∝ r³)</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <label class="ctl scrub">
        <span class="ctl-l">Orbital radius r <b>{prefs.rRatio.toFixed(2)} R ({sci(orb.r / 1000, 3)} km)</b></span>
        <input class="slider" type="range" min="1.3" max="7.0" step="0.02" bind:value={prefs.rRatio} />
      </label>
    </div>

    <div class="fl-cmp">
      <div class="ph"><h2>Gravitational vs Electric fields (exam comparison)</h2></div>
      <div class="fl-tblwrap">
        <table class="fl-tbl">
          <thead><tr><th>Feature</th><th>Gravitational field</th><th>Electric field</th></tr></thead>
          <tbody>
            {#each COMPARE_ROWS as [feat, gCol, eCol] (feat)}
              <tr><th>{feat}</th><td>{gCol}</td><td>{eCol}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Orbital readings">
      <div class="ph"><h2>Orbital mechanics</h2></div>
      <dl class="reads pad">
        <div><dt>Field strength g</dt><dd>{orb.g.toFixed(2)} N kg⁻¹</dd></div>
        <div><dt>Potential Vg</dt><dd>{sci(orb.vg, 3)} J kg⁻¹</dd></div>
        <div><dt>Orbital speed v</dt><dd>{(orb.vOrb / 1000).toFixed(2)} km s⁻¹</dd></div>
        <div><dt>Escape speed v_esc</dt><dd>{(orb.vEsc / 1000).toFixed(2)} km s⁻¹</dd></div>
        <div class="wide"><dt>Orbital period T</dt><dd>{tHours.toFixed(2)} h ({sci(orb.T, 3)} s)</dd></div>
      </dl>
      <div class="work">
        <div class="eq">GMm / r² = mv² / r  ⇒  v = √(GM / r)</div>
        <div class="eq">T² = (4π² / GM) r³  (Kepler’s 3rd law)</div>
      </div>
      <div class="facts pad">
        <b>Key facts</b>
        <ul>
          <li>Gravitational potential Vg = −GM/r is ALWAYS negative because zero is at infinity and gravity is always attractive.</li>
          <li>A geostationary satellite orbits directly above the equator with T = 24 h (r ≈ 4.22 × 10⁷ m, ~6.62 Earth radii), travelling west to east.</li>
          <li>Higher orbits have a SLOWER orbital speed v ∝ 1/√r and a LONGER period T ∝ r^(3/2).</li>
        </ul>
      </div>
    </section>
  </aside>
</main>
