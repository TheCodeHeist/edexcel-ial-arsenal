<script lang="ts" module>
  export interface HRPrefs { sel: string; vs: string; regions: boolean; radii: boolean; tracks: boolean; labels: boolean; norm: boolean }
</script>

<script lang="ts">
  /* HR diagram: the named stars of the course on one diagram. Pick a star to see everything you can work out about it
     (L from σAT⁴, the peak wavelength, its parallax and the intensity we receive), its black-body curve, and a
     side-by-side comparison with any other star, worked the way an exam question would want it. */
  import HRPlot from './HRPlot.svelte';
  import BBCurve from './BBCurve.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import { STARS, starById, lumOf, bbCss, sci, plain, short, LSUN, RSUN, MSUN, PC, LY, peak, GROUP_NAME, spectral, cepheidL, type Star } from './data';
  import { track, hrPath } from './evolve';

  let { prefs, hidden: off = false }: { prefs: HRPrefs; hidden?: boolean } = $props();

  // label placements that keep neighbouring names apart
  const LA: Record<string, [number, number, ('start' | 'end')?]> = {
    betelgeuse: [0, -12, 'end'], antares: [0, 10], polaris: [0, 12], 'delta-cep': [0, -6], sun: [0, 10], 'alpha-cen-a': [0, -5],
    barnard: [0, -4, 'end'], proxima: [0, 8, 'end'], vega: [0, -5], 'sirius-a': [0, 9], hde226868: [0, -4], arcturus: [0, 6], aldebaran: [0, -4],
  };
  const dots = STARS.map((s) => ({ id: s.id, T: s.T, L: lumOf(s), R: s.R, label: s.name, group: s.group, la: LA[s.id] }));
  const TRACKS = [1, 4, 15].map((M, i) => ({ M, runs: hrPath(track(M), 400), color: ['var(--ch3)', 'var(--ch4)', 'var(--ch2)'][i] }));
  const s = $derived<Star>(starById(prefs.sel) ?? STARS[0]);
  const v = $derived<Star>(starById(prefs.vs) ?? STARS[0]);
  const L = $derived(lumOf(s)), Lv = $derived(lumOf(v));
  const Lw = $derived(L * LSUN), Rm = $derived(s.R * RSUN);
  const I = $derived(s.d ? Lw / (4 * Math.PI * (s.d * PC) ** 2) : 1361);

  // pick a sensible star to compare with: Sirius B goes with Sirius A, Procyon B with Procyon A, else the Sun
  const PAIR: Record<string, string> = { 'sirius-b': 'sirius-a', 'sirius-a': 'sirius-b', 'procyon-b': 'procyon-a', 'procyon-a': 'procyon-b', betelgeuse: 'rigel', rigel: 'betelgeuse' };
  function pick(id: string) { prefs.sel = id; prefs.vs = PAIR[id] ?? (id === 'sun' ? 'sirius-b' : 'sun'); }

  const rT = $derived(s.T / v.T), rL = $derived(L / Lv), rR = $derived(s.R / v.R);
</script>

<main class="layout hrv" hidden={off}>
  <section class="panel stage" aria-label="Hertzsprung–Russell diagram">
    <div class="stage-head">
      <div class="label-chip"><small>Hertzsprung–Russell diagram</small><span>{STARS.length} named stars · pick one</span></div>
    </div>
    <div class="hrbox big">
      <HRPlot h={470} tr={[50000, 2400]} lr={[1e-5, 1e6]} stars={dots} sel={prefs.sel} onpick={pick}
        regions={prefs.regions} radii={prefs.radii} labels={prefs.labels} label="HR diagram of the named stars"
        tracks={prefs.tracks ? TRACKS.flatMap((t) => t.runs.map((pts) => ({ pts, color: t.color, dashed: true, width: 1.8 }))) : []} />
    </div>
    {#if prefs.tracks}
      <div class="keys tracks">
        {#each TRACKS as t (t.M)}<span><i style:background={t.color}></i>{t.M} M☉ life track</span>{/each}
      </div>
    {/if}
    <div class="shows" role="group" aria-label="Show">
      <b>Show</b>
      <button type="button" class="fchip" aria-pressed={prefs.regions} onclick={() => (prefs.regions = !prefs.regions)}>Regions</button>
      <button type="button" class="fchip" aria-pressed={prefs.radii} onclick={() => (prefs.radii = !prefs.radii)}>Lines of equal radius</button>
      <button type="button" class="fchip" aria-pressed={prefs.tracks} onclick={() => (prefs.tracks = !prefs.tracks)}>Life tracks</button>
      <button type="button" class="fchip" aria-pressed={prefs.labels} onclick={() => (prefs.labels = !prefs.labels)}>Names</button>
    </div>
    <p class="board-note">Hotter stars are on the left; both scales are logarithmic. {prefs.radii ? 'Along a dashed line every star has the same radius, because L = σ4πr²T⁴: going up at the same temperature means bigger.' : 'A star above another at the same temperature must be bigger, because L = σ4πr²T⁴.'}</p>
  </section>

  <aside class="side">
    <section class="panel card" aria-label={s.name}>
      {#key s.id}
        <div class="swap">
          <div class="card-h">
            <span class="ball" style:background={bbCss(s.T)} style:box-shadow="0 0 18px 2px {bbCss(s.T)}"></span>
            <div>
              <h2>{s.name}</h2>
              <p class="sub">{GROUP_NAME[s.group]} · {s.type} · {s.where}</p>
            </div>
          </div>
          <p class="note">{s.note}</p>
          <dl class="reads pad">
            <div><dt>Surface temperature</dt><dd>{sci(s.T, 3, 1e-3, 1e6)} K</dd></div>
            <div><dt>Luminosity</dt><dd>{sci(L)} L☉</dd></div>
            <div><dt>Radius</dt><dd>{sci(s.R)} R☉</dd></div>
            <div><dt>Mass</dt><dd>{short(s.M)} M☉</dd></div>
            <div><dt>Peak wavelength</dt><dd>{plain(peak(s.T) * 1e9)} nm</dd></div>
            <div><dt>Class</dt><dd>{spectral(s.T)}</dd></div>
            {#if s.d}
              <div><dt>Distance</dt><dd>{short(s.d)} pc</dd></div>
              <div><dt>Parallax</dt><dd>{plain(1 / s.d)}″</dd></div>
            {/if}
            {#if s.cepheid}<div class="wide"><dt>Cepheid period</dt><dd>{s.cepheid} days → {sci(cepheidL(s.cepheid))} L☉ from the period–luminosity law</dd></div>{/if}
          </dl>
          <div class="work">
            <div class="eq">L = σ4πr²T⁴ = 5.67 × 10⁻⁸ × 4π × ({sci(Rm)})² × {sci(s.T, 3, 1e-3, 1e6)}⁴ = {sci(Lw)} W</div>
            <div class="eq">λ<sub>max</sub> = 2.898 × 10⁻³ ÷ {sci(s.T, 3, 1e-3, 1e6)} = {sci(peak(s.T))} m</div>
            {#if s.d}
              <div class="eq">d = {short(s.d)} pc = {sci(s.d * PC)} m = {short((s.d * PC) / LY)} light-years</div>
              <div class="eq">I = L ÷ 4πd² = {sci(Lw)} ÷ (4π × ({sci(s.d * PC)})²) = {sci(I)} W m⁻²</div>
            {:else}
              <div class="eq">At the Earth (1 AU): I = L ÷ 4πd² = 1361 W m⁻² (the solar constant)</div>
            {/if}
            <div class="eq">Mass {sci(s.M * MSUN)} kg</div>
          </div>
        </div>
      {/key}
    </section>
  </aside>

  <section class="panel compare" aria-label="Compare">
    <div class="ph"><h2>Compare</h2>
      <label class="pickvs"><span>{s.name} with</span>
        <select bind:value={prefs.vs} aria-label="Star to compare with">
          {#each STARS.filter((x) => x.id !== s.id) as x (x.id)}<option value={x.id}>{x.name}</option>{/each}
        </select>
      </label>
    </div>
    <div class="cmp-body">
      <div class="cmp-plot">
        <BBCurve norm={prefs.norm} label="Black-body curves of {s.name} and {v.name}"
          curves={[{ T: s.T, color: 'var(--ch1)', name: s.name }, { T: v.T, color: 'var(--ch2)', name: v.name, dashed: true }]} />
        <Seg label="Curve scale" options={[['same', 'Same scale'], ['norm', 'Each to its peak']]} value={prefs.norm ? 'norm' : 'same'} onchange={(x) => (prefs.norm = x === 'norm')} />
      </div>
      <div class="cmp-text">
        <dl class="reads">
          <div><dt>Temperature ratio</dt><dd>{plain(rT)}</dd></div>
          <div><dt>Luminosity ratio</dt><dd>{sci(rL)}</dd></div>
          <div><dt>Radius ratio</dt><dd>{sci(rR)}</dd></div>
          <div><dt>Peak ratio</dt><dd>{plain(1 / rT)}</dd></div>
        </dl>
        <div class="eq">r₁/r₂ = √(L₁/L₂) × (T₂/T₁)² = √({sci(rL)}) × ({plain(1 / rT)})² = {sci(rR)}</div>
        <p class="why">{s.T > v.T && L < Lv
          ? `${s.name} is hotter but less luminous, so it must be much smaller: each square metre gives out more, but there are far fewer square metres.`
          : s.T < v.T && L > Lv
          ? `${s.name} is cooler yet more luminous, so it must be much bigger: its huge surface area more than makes up for its cooler surface.`
          : s.T > v.T
          ? `${s.name} is hotter, so its curve peaks at a shorter wavelength (Wien’s law) and each square metre gives out (${plain(rT)})⁴ = ${sci(rT ** 4)} times the power.`
          : `${s.name} is cooler, so its curve peaks at a longer wavelength (Wien’s law) and each square metre gives out less power: P ∝ T⁴.`}</p>
      </div>
    </div>
  </section>
</main>
