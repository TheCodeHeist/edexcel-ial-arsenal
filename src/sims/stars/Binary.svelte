<script lang="ts" module>
  export interface BinPrefs { sys: string; earth: boolean; speed: number }
</script>

<script lang="ts">
  /* Binaries: five systems, each showing one way binaries matter in the course. The 3D view, the light curve, the
     radial velocities and the Doppler-shifted Hα lines all come from one orbit (binary.ts), so they always agree. */
  import { onMount, onDestroy } from 'svelte';
  import Plot from '../circuit/Plot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { BinaryScene, BLook } from './binary3d';
  import { SYSTEMS, periodYears, periodSeconds, speeds, radial, brightness, massFromOrbit, shifted, HALPHA, radii, lumW, toScale, type Sys } from './binary';
  import { sci, plain, short, MSUN, AU, SN_IA_L, nmColor } from './data';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false }: { prefs: BinPrefs; hidden?: boolean } = $props();

  const s = $derived<Sys>(SYSTEMS.find((x) => x.id === prefs.sys) ?? SYSTEMS[0]);
  const Py = $derived(periodYears(s)), Ps = $derived(periodSeconds(s));
  const inDays = $derived(Py < 1);
  const Pshow = $derived(inDays ? Py * 365.25 : Py);
  const unitT = $derived(inDays ? 'days' : 'years');

  /* ---------- time: one orbit every 8 s at ×1; the type Ia build-up and explosion on top ---------- */
  let phi = $state(0.15);
  let feed = $state(0), boom = $state(0);
  let playing = $state(!RM);
  let raf = 0, last = 0;
  function step(t: number) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (playing) {
      phi = (phi + (dt * prefs.speed) / 8) % 1;
      if (s.kind === 'typeIa') {
        if (boom > 0) boom = Math.min(1, boom + dt / 8);
        else { feed = Math.min(1, feed + (dt * prefs.speed) / 22); if (feed >= 1) boom = 0.0001; }
      }
    }
    raf = off ? 0 : requestAnimationFrame(step);
  }
  function kick() { if (!raf && !off) { last = performance.now(); raf = requestAnimationFrame(step); } }
  $effect(() => { if (!off) kick(); });
  onDestroy(() => cancelAnimationFrame(raf));
  function choose(id: string) { prefs.sys = id; feed = 0; boom = 0; phi = 0.15; }
  function restartIa() { feed = 0; boom = 0; playing = true; }

  /* ---------- 3D ---------- */
  let canvas = $state<HTMLCanvasElement>();
  let scene = $state<BinaryScene | null>(null);
  let failed = $state(false);
  onMount(() => {
    let dead = false;
    import('./binary3d').then(({ BinaryScene }) => {
      if (dead || !canvas) return;
      try { scene = new BinaryScene(canvas, matchMedia('(max-width: 760px)').matches); } catch { failed = true; }
    }).catch(() => { failed = true; });
    return () => { dead = true; scene?.dispose(); scene = null; };
  });
  $effect(() => { scene?.set({ sys: s, phi, earth: prefs.earth, boom, feed } satisfies BLook); });

  /* ---------- graphs ---------- */
  const N = 240;
  const tSeries = $derived(Array.from({ length: N + 1 }, (_, k) => (k / N) * 2));      // two orbits, in periods
  const light = $derived(tSeries.map((p) => [p * Pshow, brightness(s, p % 1)] as [number, number]));
  const rv = $derived([0, 1].map((j) => tSeries.map((p) => [p * Pshow, radial(s, p % 1)[j] / 1e3] as [number, number])));
  const visible = $derived(s.bodies.map((b) => b.kind !== 'blackhole' && lumW(b) / (lumW(s.bodies[0]) + lumW(s.bodies[1])) > 0.01));
  const vmax = $derived(Math.max(...speeds(s)) / 1e3 * 1.25);
  const eclipses = $derived(light.some(([, b]) => b < 0.97));
  const tNow = $derived(phi * Pshow);
  const rvNow = $derived(radial(s, phi));
  const lam = $derived(shifted(s, phi));
  const share = $derived(s.bodies.map((b) => lumW(b) / (lumW(s.bodies[0]) + lumW(s.bodies[1]))));

  /* ---------- working ---------- */
  const v = $derived(speeds(s));
  const Mtot = $derived(massFromOrbit(s));
  const wdMass = $derived(1.2 + 0.2 * feed);
  // the type Ia light curve after the explosion
  const iaCurve = Array.from({ length: 121 }, (_, k) => { const t = k; const f = t < 18 ? (t / 18) ** 2 : Math.exp(-(t - 18) / 22); return [t, f * SN_IA_L / 1e9] as [number, number]; });

  /* the zoomed spectrum around Hα */
  const lo = HALPHA - 1.2, hi = HALPHA + 1.2;
  const sx = (nm: number) => 10 + ((nm - lo) / (hi - lo)) * 500;
  const sdepth = (k: number) => Math.max(0.25, Math.sqrt(share[k]));
</script>

<main class="layout bin" hidden={off}>
  <section class="panel stage" aria-label="The binary system">
    <div class="stage-head">
      <div class="label-chip"><small>{s.label}</small><span>{s.name}</span></div>
      <div class="stage-tools">
        <Seg label="View" options={[['free', 'Free view', 'Free'], ['earth', 'From the Earth', 'Earth']]} value={prefs.earth ? 'earth' : 'free'} onchange={(x) => (prefs.earth = x === 'earth')} />
      </div>
    </div>
    <div class="systems" role="group" aria-label="Systems">
      {#each SYSTEMS as x (x.id)}
        <button type="button" class="fchip" aria-pressed={prefs.sys === x.id} onclick={() => choose(x.id)}>{x.label}</button>
      {/each}
    </div>
    <div class="spacebox">
      <div class="space">
        <canvas bind:this={canvas} aria-label="3D view of the two stars orbiting their centre of mass. Drag to turn it."></canvas>
        {#if failed}<p class="nogl">This view needs WebGL, which this browser has turned off. The graphs below still work.</p>{/if}
        <div class="hud tl"><b>{s.name}</b><span>period {plain(Pshow)} {unitT} · shown sped up</span></div>
        <div class="hud bl">{toScale(s) ? 'Stars and orbit to scale' : 'Stars drawn larger than to scale'}{prefs.earth ? '' : ' · blue arrow: towards the Earth'}</div>
        {#if s.kind === 'typeIa'}
          <div class="hud tr" class:future={boom > 0}>{boom > 0 ? 'Type Ia supernova' : `White dwarf ${plain(wdMass)} M☉ of 1.40`}</div>
        {/if}
        {#if scene}
          <div class="zoom" role="group" aria-label="Zoom">
            <button type="button" class="zb" aria-label="Zoom in" onclick={() => scene?.zoomBy(0.8)}>+</button>
            <button type="button" class="zb" aria-label="Zoom out" onclick={() => scene?.zoomBy(1.25)}>−</button>
          </div>
        {/if}
      </div>
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <input class="slider scrub" type="range" min="0" max="0.999" step="0.001" bind:value={phi} aria-label="Orbital phase" oninput={() => (playing = false)} />
      <Seg label="Speed" options={[['0.5', '×½'], ['1', '×1'], ['3', '×3']]} value={String(prefs.speed)} onchange={(x) => (prefs.speed = +x)} />
      {#if s.kind === 'typeIa'}<button class="btn" type="button" onclick={restartIa}>Start again</button>{/if}
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="About this system">
      {#key s.id}
        <div class="swap">
          <p class="note pad">{s.what}</p>
          <div class="facts pad">
            <b>Key facts</b>
            <ul>{#each s.facts as f (f)}<li>{f}</li>{/each}</ul>
          </div>
        </div>
      {/key}
    </section>
    <section class="panel" aria-label="Working">
      <div class="ph"><h2>{s.kind === 'typeIa' ? 'Towards the limit' : 'Masses from the orbit'}</h2></div>
      <dl class="reads pad">
        <div><dt>Period</dt><dd>{plain(Pshow)} {unitT}</dd></div>
        <div><dt>Separation</dt><dd>{plain(s.a)} AU</dd></div>
        {#each s.bodies as b, k (b.name)}
          <div class="wide"><dt>{b.name.split(' (')[0]}</dt><dd>{short(b.M)} M☉, orbiting at {plain(v[k] / 1e3)} km s⁻¹</dd></div>
        {/each}
      </dl>
      <div class="work pad2">
        {#if s.kind === 'typeIa'}
          <div class="eq">White dwarf: {plain(wdMass)} M☉ → limit 1.40 M☉ (Chandrasekhar)</div>
          <div class="eq">Peak L ≈ {sci(SN_IA_L)} L☉, the same every time → d = √(L/4πI)</div>
        {:else}
          <div class="eq">Gravity gives each star its centripetal force: GM₁M₂/a² = M₁ω²r₁ = M₂ω²r₂</div>
          <div class="eq">Adding r₁ + r₂ = a: ω²a³ = G(M₁ + M₂), so M₁ + M₂ = 4π²a³ / GP²</div>
          <div class="eq">= 4π² × ({sci(s.a * AU)})³ ÷ (6.67 × 10⁻¹¹ × ({sci(Ps)})²) = {sci(Mtot)} kg = {plain(Mtot / MSUN)} M☉</div>
          <div class="eq">M₁/M₂ = r₂/r₁ = v₂/v₁ = {plain(radii(s)[1] / radii(s)[0])}</div>
          {#if s.kind === 'spectroscopic' || s.kind === 'xray'}
            <div class="eq">From the Doppler shift: v = cΔλ/λ, e.g. Δλ = {plain(Math.abs(lam[0] - HALPHA) || 0.001)} nm now → {plain(Math.abs(rvNow[0]) / 1e3)} km s⁻¹ along our line of sight</div>
          {/if}
          {#if s.kind === 'xray'}
            <div class="eq">Unseen companion: {short(s.bodies[1].M)} M☉ &gt; 3 M☉ → not a neutron star: a black hole</div>
          {/if}
        {/if}
      </div>
    </section>
  </aside>

  <section class="panel graphs" aria-label="What we observe">
    <div class="ph"><h2>What a telescope on the Earth records</h2></div>
    <div class="gbody">
      <div>
        {#if s.kind === 'typeIa' && boom > 0}
          <h3 class="gh">Light curve of the supernova</h3>
          <Plot xr={[0, 120]} yr={[0, 4.6]} xLabel="t / days" yLabel="L / 10⁹ L☉" curve={iaCurve} trace h={250}
            now={{ x: Math.min(120, boom * 120), y: iaCurve[Math.min(120, Math.round(boom * 120))][1] }} label="Type Ia supernova light curve" />
          <p class="why">Every type Ia peaks at about the same luminosity: measure its peak intensity and the inverse-square law gives the galaxy’s distance.</p>
        {:else}
          <h3 class="gh">Brightness (light curve)</h3>
          <Plot xr={[0, 2 * Pshow]} yr={[0, 1.08]} xLabel="t / {unitT}" yLabel="relative intensity" curve={light} trace h={230}
            now={{ x: tNow, y: brightness(s, phi) }} label="Total brightness against time" />
          <p class="why">{eclipses ? 'Dips: one star passing in front of the other. The deeper dip is when the hotter star is hidden.' : `No dips: from the Earth the orbit is tilted ${s.inc}° from face-on, so the stars never pass in front of each other.`}</p>
        {/if}
      </div>
      <div>
        <h3 class="gh">Radial velocity (from the Doppler shift)</h3>
        <Plot xr={[0, 2 * Pshow]} yr={[-vmax, vmax]} xLabel="t / {unitT}" yLabel="v / km s⁻¹" h={230}
          series={[0, 1].filter((k) => visible[k]).map((k) => ({ color: k ? 'var(--ch2)' : 'var(--ch1)', pts: rv[k], name: s.bodies[k].name.split(' (')[0] }))}
          now={visible[0] ? { x: tNow, y: rvNow[0] / 1e3 } : null} label="Radial velocity of each star against time" />
        <p class="why">Positive: moving away (redshift). {visible[1] ? 'The two curves are always opposite: the stars orbit the same centre of mass.' : `Only ${s.bodies[0].name.split(' (')[0]} shows up: its companion ${s.bodies[1].kind === 'blackhole' ? 'emits no light' : 'is too faint'}.`}</p>
      </div>
    </div>
    <div class="ph"><h2>Hα absorption line, zoomed in</h2></div>
    <svg class="spec zoomspec" viewBox="0 0 520 86" role="img" aria-label="The hydrogen-alpha line from each star, shifted by its motion">
      <defs><linearGradient id="hazoom" x1="0" x2="1">{#each [lo, HALPHA, hi] as nm, k (k)}<stop offset={k / 2} stop-color={nmColor(nm)} />{/each}</linearGradient></defs>
      <rect x="10" y="8" width="500" height="44" rx="6" fill="url(#hazoom)" />
      <path d="M{sx(HALPHA)} 4 V56" class="labline" />
      {#each [0, 1] as k (k)}
        {#if visible[k] && lam[k] > lo && lam[k] < hi}
          <rect x={sx(lam[k]) - 2.5} y="8" width="5" height="44" fill="#08080c" opacity={sdepth(k)} />
          <text x={sx(lam[k])} y="66" class="ll">{k ? 'B' : 'A'}</text>
        {/if}
      {/each}
      <text x={sx(HALPHA)} y="80" class="tk">656.28 nm (at rest)</text>
      <text x="12" y="80" class="tk start">← blueshift</text>
      <text x="506" y="80" class="tk end">redshift →</text>
    </svg>
  </section>
</main>
