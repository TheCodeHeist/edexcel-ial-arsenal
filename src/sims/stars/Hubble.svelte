<script lang="ts" module>
  export interface HubblePrefs { seed: number; sel: number; done: number[] }
</script>

<script lang="ts">
  /* Redshift and Hubble's law. Eight galaxies, each with a distance from a standard candle and a spectrum. Compare its
     absorption lines with the laboratory's: they are all shifted to longer wavelengths by the same factor, so
     z = Δλ/λ, and v = cz. Measure each galaxy and plot v against d: the gradient of the best line through the
     origin is the Hubble constant, and 1/H₀ estimates the age of the universe. */
  import Plot from '../circuit/Plot.svelte';
  import { LINES, nmColor, sci, short, plain, C, MPC, YEAR, seeded, parseNum, close } from './data';

  let { prefs, hidden: off = false }: { prefs: HubblePrefs; hidden?: boolean } = $props();

  const set = $derived.by(() => {
    const r = seeded(prefs.seed * 104729 + 3);
    const H0 = 66 + r() * 9;
    const gauss = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
    const used = new Set<string>();
    const gal = Array.from({ length: 8 }, (_, i) => {
      const d = Number((15 + (i + r() * 0.8) * 52).toPrecision(2));     // Mpc
      const v = Math.max(300, H0 * d + gauss() * 320);                  // km s⁻¹ (with a little peculiar motion)
      let name: string;
      do { name = `${['NGC', 'UGC', 'IC', 'PGC'][Math.floor(r() * 4)]} ${1000 + Math.floor(r() * 8000)}`; } while (used.has(name));
      used.add(name);
      return { name, d, v, z: (v * 1e3) / C };
    });
    return { H0, gal };
  });
  const g = $derived(set.gal[prefs.sel] ?? set.gal[0]);
  const ha = $derived(656.3 * (1 + g.z));
  const isDone = (i: number) => prefs.done.includes(i);

  /* fit a line through the origin to the plotted galaxies */
  const pts = $derived(prefs.done.map((i) => set.gal[i]).filter(Boolean).map((x) => ({ x: x.d, y: x.v })));
  const fit = $derived(pts.length >= 2 ? pts.reduce((s, p) => s + p.x * p.y, 0) / pts.reduce((s, p) => s + p.x * p.x, 0) : null);
  const H0si = $derived(fit ? (fit * 1e3) / MPC : null);
  const age = $derived(H0si ? 1 / H0si / YEAR : null);

  let vIn = $state('');
  const vVal = $derived(parseNum(vIn));
  let tried = $state<null | boolean>(null);
  function measure() {
    tried = isFinite(vVal) ? close(vVal, g.v, 0.06) : null;
    if (!isDone(prefs.sel)) prefs.done = [...prefs.done, prefs.sel];
  }
  function choose(i: number) { prefs.sel = i; vIn = ''; tried = null; }
  function fresh() { prefs.seed = Math.floor(Math.random() * 1e6); prefs.done = []; prefs.sel = 0; vIn = ''; tried = null; }
  function all() { prefs.done = set.gal.map((_, i) => i); }
  export function selectGalaxy(i: number) { choose(Math.max(0, Math.min(set.gal.length - 1, i))); }
  export function plotCurrent() { if (!isDone(prefs.sel)) prefs.done = [...prefs.done, prefs.sel]; }
  export function plotAll() { all(); }
  export function newGalaxies() { fresh(); }
  export function getState() { return { gal: set.gal, sel: prefs.sel, done: prefs.done, g, ha, fit, H0si, age }; }

  /* ---------- spectra ---------- */
  const SW = 520, lo = 370, hi = 790;
  const sx = (nm: number) => 10 + ((nm - lo) / (hi - lo)) * (SW - 20);
  const stops = Array.from({ length: 43 }, (_, k) => lo + k * 10);
</script>

<div class="dgrid hub" hidden={off}>
  <section class="panel stage" aria-label="Spectra">
    <div class="stage-head">
      <div class="label-chip"><small>{g.name}</small><span>distance {short(g.d)} Mpc (from a standard candle)</span></div>
      <div class="stage-tools"><button class="btn" type="button" onclick={fresh}>New galaxies</button></div>
    </div>
    <div class="gals" role="group" aria-label="Galaxies">
      {#each set.gal as x, i (x.name)}
        <button type="button" class="fchip" class:done={isDone(i)} aria-pressed={prefs.sel === i} onclick={() => choose(i)}>{x.name}{isDone(i) ? ' ✓' : ''}</button>
      {/each}
    </div>
    <svg class="spec" viewBox="0 0 {SW} 172" role="img" aria-label="Laboratory spectrum above, the galaxy's spectrum below, with the absorption lines shifted to the red">
      <defs>
        <linearGradient id="rainbow" x1="0" x2="1">
          {#each stops as nm (nm)}<stop offset={(nm - lo) / (hi - lo)} stop-color={nmColor(nm)} />{/each}
        </linearGradient>
      </defs>
      <text x="10" y="13" class="sl">Laboratory (at rest)</text>
      <rect x={sx(lo)} y="20" width={sx(hi) - sx(lo)} height="38" rx="6" fill="url(#rainbow)" />
      {#each LINES as l (l.name)}
        <rect x={sx(l.nm) - 1.2} y="20" width="2.4" height="38" fill="#08080c" />
      {/each}
      {#each LINES.filter((l) => l.kind === 'H') as l (l.name)}
        <text x={sx(l.nm)} y="70" class="ll">{l.name}</text>
      {/each}
      {#each LINES as l (l.name)}
        <path d="M{sx(l.nm)} 76 L{sx(l.nm * (1 + g.z))} 104" class="shift" />
      {/each}
      <text x="10" y="102" class="sl">{g.name}</text>
      <rect x={sx(lo)} y="108" width={sx(hi) - sx(lo)} height="38" rx="6" fill="url(#rainbow)" />
      {#each LINES as l (l.name)}
        {#if l.nm * (1 + g.z) < hi}<rect x={sx(l.nm * (1 + g.z)) - 1.2} y="108" width="2.4" height="38" fill="#08080c" />{/if}
      {/each}
      {#each [400, 450, 500, 550, 600, 650, 700, 750] as nm (nm)}
        <text x={sx(nm)} y="162" class="tk">{nm}</text>
      {/each}
      <text x={SW - 10} y="171" class="tk end">λ / nm</text>
    </svg>
    <dl class="reads three">
      <div><dt>Hα in the lab</dt><dd>656.3 nm</dd></div>
      <div><dt>Hα measured</dt><dd>{plain(ha, 4)} nm</dd></div>
      <div><dt>Shift Δλ</dt><dd>{plain(ha - 656.3)} nm</dd></div>
    </dl>
    <div class="steps">
      <div class="stepq">
        <label>Recession speed v <input class="num wide" inputmode="decimal" bind:value={vIn} placeholder="km/s" aria-label="Recession speed in kilometres per second" /> km s⁻¹</label>
        <button class="btn primary" type="button" onclick={measure}>{isDone(prefs.sel) ? 'Check' : vIn ? 'Check and plot' : 'Plot it'}</button>
        {#if tried !== null}<span class="tag {tried ? 'ok' : 'no'}">{tried ? 'Yes' : 'Not quite'}</span>{/if}
      </div>
      {#if isDone(prefs.sel)}
        <div class="work swap">
          <div class="eq">z = Δλ / λ = {plain(ha - 656.3)} ÷ 656.3 = {sci(g.z)}</div>
          <div class="eq">v = cz = 3.00 × 10⁸ × {sci(g.z)} = {sci(g.v * 1e3)} m s⁻¹ = {short(g.v, 3)} km s⁻¹</div>
        </div>
      {/if}
    </div>
    <p class="board-note">Every line moves by the same factor (1 + z), so every line gives the same z. Redshift means the galaxy is moving away from us.</p>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Hubble's law">
      <div class="ph"><h2>v against d</h2>
        {#if prefs.done.length < set.gal.length}<button class="btn" type="button" onclick={all}>Plot them all</button>{/if}
      </div>
      <div class="plotbox">
        <Plot xr={[0, 480]} yr={[0, 36000]} xLabel="d / Mpc" yLabel="v / km s⁻¹" points={pts} line={fit ? { m: fit, c: 0 } : null} h={330}
          label="Recession speed against distance" />
      </div>
      {#if fit && H0si && age}
        <dl class="reads pad">
          <div><dt>Gradient H₀</dt><dd>{plain(fit)} km s⁻¹ Mpc⁻¹</dd></div>
          <div><dt>In SI units</dt><dd>{sci(H0si)} s⁻¹</dd></div>
          <div class="wide"><dt>Age ≈ 1/H₀</dt><dd>{sci(1 / H0si)} s = {plain(age / 1e9)} billion years</dd></div>
        </dl>
        <div class="work pad2">
          <div class="eq">H₀ = {plain(fit)} × 10³ m s⁻¹ ÷ {sci(MPC)} m = {sci(H0si)} s⁻¹</div>
          <div class="eq">t ≈ 1/H₀ = {sci(1 / H0si)} s ÷ {sci(YEAR)} s per year = {sci(age)} years</div>
        </div>
      {:else}
        <p class="why pad2">Plot at least two galaxies to draw the best line through the origin.</p>
      {/if}
    </section>
    <section class="panel" aria-label="The controversy">
      <div class="ph"><h2>Why the age is argued about</h2></div>
      <p class="why pad2">If everything has always moved apart at today’s speed, it all started together a time 1/H₀ ago. But H₀ is hard to pin down: the distance ladder gives about 73 km s⁻¹ Mpc⁻¹ (about 13.4 billion years) while the cosmic microwave background gives about 67 (about 14.6 billion years). Distances to far galaxies are uncertain, and the expansion has not been steady: gravity from matter, including dark matter we cannot see, slows it, so the true age depends on how much matter there is.</p>
    </section>
  </aside>
</div>
