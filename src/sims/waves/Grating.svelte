<script lang="ts" module>
  import type { LaserId } from './grating';
  export interface GratePrefs {
    mode: 'grating' | 'electron';
    laser: LaserId; nm: number; lpm: number; D: number; N: number;
    kV: number; body: string; speed: number;      // speed: log₁₀(m s⁻¹)
  }
  export const GRATE: GratePrefs = { mode: 'grating', laser: 'red', nm: 600, lpm: 300, D: 1.0, N: 6, kV: 3, body: 'e', speed: 6.5 };
</script>

<script lang="ts">
  /* Diffraction: the diffraction grating and Core Practical 6 (spec 50–52), why a grating beats a double slit, and
     electron diffraction as evidence for the wave nature of electrons, with λ = h/p (53, 54). */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Plot from '../circuit/Plot.svelte';
  import type { GLook } from './grating3d';
  import { LASERS, LPMS, orders, spacing, nMax, nSlit, electron, BODIES, GRAPHITE, TUBE_L } from './grating';
  import { H, C, sci, plain, lambdaCss } from './consts';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: GratePrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  /* ---------- the grating ---------- */
  const white = $derived(prefs.laser === 'white');
  const nm = $derived(prefs.laser === 'custom' ? prefs.nm : (LASERS.find((l) => l[0] === prefs.laser)?.[2] ?? 650) || 550);
  const d = $derived(spacing(prefs.lpm));
  const ords = $derived(white ? [] : orders(nm, prefs.lpm));
  const nmx = $derived(nMax(white ? 700 : nm, prefs.lpm));
  const onScreen = $derived(ords.filter((o) => o.n > 0 && Math.abs(prefs.D * Math.tan(o.theta)) <= 1.25));
  /** White light: orders whose violet end reaches the screen. */
  const whiteOn = $derived(white ? orders(400, prefs.lpm).filter((o) => o.n > 0 && Math.abs(prefs.D * Math.tan(o.theta)) <= 1.25).length : 0);
  const deg = (r: number) => (r * 180) / Math.PI;
  const colour = $derived(white ? 'var(--ink)' : lambdaCss(nm));
  // white light: where the orders start to overlap (red of order n beyond violet of order n+1)
  const overlap = $derived.by(() => {
    if (!white) return null;
    for (let n = 1; n < 12; n++) { const red = n * 700e-9, vio = (n + 1) * 400e-9; if (red > vio && vio < d) return n; }
    return null;
  });

  /* ---------- Core Practical 6: measure ---------- */
  interface Reading { n: number; X: number; theta: number; lam: number }
  let readings = $state<Reading[]>([]);
  let nPick = $state(1);
  let rkey = '';
  $effect(() => { const k = `${nm}|${prefs.lpm}|${prefs.D}|${white}`; if (k !== rkey) { rkey = k; readings = []; } });
  $effect.pre(() => { const top = Math.max(1, onScreen.length); if (nPick > top) nPick = top; });
  const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  function measure() {
    const o = onScreen.find((x) => x.n === nPick);
    if (!o) return;
    const Xtrue = 2 * prefs.D * Math.tan(o.theta);
    const X = Math.round((Xtrue + gauss() * 0.0012) * 1000) / 1000;       // a metre rule read to the nearest mm
    const theta = Math.atan(X / 2 / prefs.D);
    readings = [...readings.filter((r) => r.n !== nPick), { n: nPick, X, theta, lam: (d * Math.sin(theta)) / nPick }].sort((a, b) => a.n - b.n);
  }
  const meanLam = $derived(readings.length ? readings.reduce((s, r) => s + r.lam, 0) / readings.length : NaN);

  /* ---------- N slits compared ---------- */
  const NS = [2, 3, 6, 20];
  const xs = Array.from({ length: 721 }, (_, i) => -2.4 + (i * 4.8) / 720);
  const two = $derived(xs.map((x) => [x, nSlit(2, x)] as [number, number]));
  const many = $derived(xs.map((x) => [x, nSlit(prefs.N, x)] as [number, number]));

  /* ---------- electrons ---------- */
  const el = $derived(electron(prefs.kV));
  const ringPts = $derived([1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((kv) => { const e = electron(kv); return { x: 1 / Math.sqrt(kv * 1000), r: e.rings.map((r) => r.r * 1000) }; }));
  const body = $derived(BODIES.find((b) => b.id === prefs.body) ?? BODIES[0]);
  const isBall = $derived(body.id === 'ball');
  const sRange = $derived<[number, number]>(isBall ? [0, 1.7] : [2, 7.4]);
  $effect.pre(() => { const [a, b] = sRange; if (prefs.speed < a || prefs.speed > b) prefs.speed = isBall ? 1.3 : 6.5; });
  const speed = $derived(10 ** prefs.speed);
  const dbP = $derived(body.m * speed);
  const dbL = $derived(H / dbP);
  const scaleWord = $derived(dbL > 1e-7 ? 'like visible light' : dbL > 3e-11 ? 'about the spacing of atoms: these diffract through crystals' : dbL > 1e-14 ? 'smaller than an atom, nucleus-sized: diffraction by nuclei' : 'far smaller than a nucleus: no gap is small enough to diffract it');

  const look = $derived<GLook>({ mode: prefs.mode, nm, white, lpm: prefs.lpm, D: prefs.D, kV: prefs.kV, playing });
  $effect(() => {
    stats = prefs.mode === 'grating'
      ? [['d', `${sci(d)} m`], ['Orders', white ? `up to ${nmx} (violet)` : `n ≤ ${nmx}`], ['λ', white ? '400–700 nm' : `${nm} nm`]]
      : [['V', `${plain(prefs.kV, 2)} kV`], ['λ', `${sci(el.lam)} m`], ['Inner ring', `${plain(el.rings[0].r * 1000, 3)} mm`]];
  });
</script>

<main class="layout wv-grating" hidden={off}>
  <section class="panel stage" aria-label="Diffraction">
    <div class="stage-head">
      <div class="label-chip"><small>{prefs.mode === 'grating' ? 'Core Practical 6' : 'Fine-beam tube'}</small>
        <span>{prefs.mode === 'grating' ? `${white ? 'White light' : `${nm} nm laser`} through ${prefs.lpm} lines/mm` : `Electron diffraction at ${plain(prefs.kV, 2)} kV`}</span></div>
      <div class="stage-tools">
        <Seg label="View" options={[['grating', 'Diffraction grating', 'Grating'], ['electron', 'Electron diffraction', 'Electrons']]} bind:value={prefs.mode} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./grating3d').then((m) => m.GratingScene)} {look}
          label="3D view of the diffraction experiment. Drag to turn it.">
          {#if prefs.mode === 'grating'}
            <div class="hud tl"><b>{white ? `a white centre and ${nmx * 2} spectra` : `${nmx * 2 + 1} bright spots (n = −${nmx} … ${nmx})`}</b><span>{(white ? whiteOn : onScreen.length) < nmx ? `${(white ? whiteOn : onScreen.length) * 2 + 1} land on the 2.5 m screen` : 'all on the screen'}</span></div>
            <div class="hud bl">Spots to scale on a 2.5 m screen with a metre rule. Orders beyond the screen fly past it.</div>
          {:else}
            <div class="hud tl"><b>λ = {sci(el.lam)} m</b><span>rings: {plain(el.rings[0].r * 1000, 3)} mm and {plain(el.rings[1].r * 1000, 3)} mm radius</span></div>
            <div class="hud bl">Rings to scale with the 13 cm tube. Raise V: faster electrons, shorter λ, smaller rings.</div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      {#if prefs.mode === 'grating'}
        <label class="ctl scrub"><span class="ctl-l">Grating to screen, D <b>{plain(prefs.D, 3)} m</b></span>
          <input class="slider" type="range" min="0.3" max="2" step="0.05" bind:value={prefs.D} /></label>
      {:else}
        <label class="ctl scrub"><span class="ctl-l">Accelerating p.d. V <b>{plain(prefs.kV, 2)} kV</b></span>
          <input class="slider" type="range" min="1.5" max="5" step="0.1" bind:value={prefs.kV} /></label>
      {/if}
    </div>
  </section>

  <aside class="side">
    {#if prefs.mode === 'grating'}
      <section class="panel" aria-label="Set-up">
        <div class="ph"><h2>Set-up</h2></div>
        <div class="ctls">
          <div class="ctl"><span class="ctl-l">Light</span>
            <div class="picker flat" role="group" aria-label="Light source">
              {#each LASERS as [id, name, n] (id)}<button type="button" class="fchip lz" aria-pressed={prefs.laser === id} onclick={() => (prefs.laser = id)}>{#if n}<i style:background={lambdaCss(n)}></i>{/if}{name}</button>{/each}
            </div>
          </div>
          {#if prefs.laser === 'custom'}
            <label class="ctl"><span class="ctl-l">Wavelength <b style:color={lambdaCss(prefs.nm)}>{prefs.nm} nm</b></span>
              <input class="slider" type="range" min="380" max="750" step="1" bind:value={prefs.nm} /></label>
          {/if}
          <div class="ctl"><span class="ctl-l">Lines per mm <b>{prefs.lpm}</b></span>
            <div class="picker flat" role="group" aria-label="Grating">
              {#each LPMS as l (l)}<button type="button" class="fchip" aria-pressed={prefs.lpm === l} onclick={() => (prefs.lpm = l)}>{l}</button>{/each}
            </div>
            <input class="slider" type="range" min="50" max="1000" step="10" bind:value={prefs.lpm} aria-label="Lines per mm" />
          </div>
        </div>
        <dl class="reads pad nocase">
          <div><dt>Slit spacing d = 1/N</dt><dd>{sci(d)} m</dd></div>
          <div><dt>Highest order d/λ</dt><dd>{white ? `${nmx} (all colours: ${nMax(700, prefs.lpm)})` : `${plain(d / (nm * 1e-9), 3)} → n = ${nmx}`}</dd></div>
          {#if !white}
            {#each ords.filter((o) => o.n > 0).slice(0, 4) as o (o.n)}
              <div><dt>Angle of order {o.n}</dt><dd>{plain(deg(o.theta), 3)}°</dd></div>
            {/each}
          {:else if overlap !== null}
            <div class="wide"><dt>Orders overlap</dt><dd class="txt">order {overlap}’s red lands beyond order {overlap + 1}’s violet</dd></div>
          {/if}
        </dl>
      </section>
      <section class="panel" aria-label="Working">
        <div class="ph"><h2>Working</h2></div>
        <div class="work">
          <div class="eq">d = 1 ÷ ({prefs.lpm} × 10³ m⁻¹) = {sci(d)} m</div>
          {#if !white && ords.length > 1}
            <div class="eq">nλ = d sin θ → sin θ₁ = {nm} × 10⁻⁹ ÷ {sci(d)} = {plain((nm * 1e-9) / d, 3)}</div>
            <div class="eq">θ₁ = {plain(deg(ords.find((o) => o.n === 1)!.theta), 3)}°; on the screen x₁ = D tan θ₁ = {plain(prefs.D * Math.tan(ords.find((o) => o.n === 1)!.theta) * 100, 3)} cm from the centre</div>
            <div class="eq">Max order: sin θ ≤ 1 → n ≤ d/λ = {plain(d / (nm * 1e-9), 3)} → {nmx}</div>
          {:else if white}
            <div class="eq">Every order but the zeroth is a spectrum: violet (short λ) is diffracted least, red most. The centre stays white.</div>
          {/if}
        </div>
      </section>
    {:else}
      <section class="panel" aria-label="Readings">
        <div class="ph"><h2>Readings</h2></div>
        <dl class="reads pad nocase">
          <div><dt>Eₖ = eV</dt><dd>{sci(el.V)} eV</dd></div>
          <div><dt>Eₖ in joules</dt><dd>{sci(el.Ek)} J</dd></div>
          <div><dt>Speed v</dt><dd>{sci(el.v)} m s⁻¹</dd></div>
          <div><dt>Momentum p</dt><dd>{sci(el.p)} kg m s⁻¹</dd></div>
          <div><dt>λ = h/p</dt><dd>{sci(el.lam)} m</dd></div>
          <div><dt>Graphite spacing</dt><dd>{sci(GRAPHITE[0], 3)} m</dd></div>
        </dl>
        <div class="work">
          <div class="eq">Eₖ = eV = 1.60 × 10⁻¹⁹ × {sci(el.V)} = {sci(el.Ek)} J</div>
          <div class="eq">p = √(2mEₖ) = √(2 × 9.11 × 10⁻³¹ × {sci(el.Ek)}) = {sci(el.p)} kg m s⁻¹</div>
          <div class="eq">λ = h/p = 6.63 × 10⁻³⁴ ÷ {sci(el.p)} = {sci(el.lam)} m</div>
          <div class="eq">λ is comparable to the gaps between carbon atoms ({sci(GRAPHITE[1], 3)}–{sci(GRAPHITE[0], 3)} m), so the electrons diffract.</div>
          {#if el.v > 0.1 * C}<div class="eq">v is {plain((el.v / C) * 100, 2)}% of c: the Newtonian p is a little low <span class="beyond">relativity, beyond the spec</span></div>{/if}
        </div>
      </section>
      <section class="panel" aria-label="de Broglie wavelength of anything">
        <div class="ph"><h2>λ = h/p for anything</h2></div>
        <div class="ctls">
          <div class="picker flat" role="group" aria-label="Particle">
            {#each BODIES as b (b.id)}<button type="button" class="fchip" aria-pressed={prefs.body === b.id} onclick={() => (prefs.body = b.id)}>{b.name}</button>{/each}
          </div>
          <label class="ctl"><span class="ctl-l">Speed <b>{sci(speed)} m s⁻¹</b></span>
            <input class="slider" type="range" min={sRange[0]} max={sRange[1]} step="0.01" bind:value={prefs.speed} /></label>
        </div>
        <dl class="reads pad nocase">
          <div><dt>p = mv</dt><dd>{sci(dbP)} kg m s⁻¹</dd></div>
          <div><dt>λ = h/p</dt><dd>{sci(dbL)} m</dd></div>
          <div class="wide"><dt>That is</dt><dd class="txt">{scaleWord}</dd></div>
        </dl>
      </section>
    {/if}
  </aside>

  {#if prefs.mode === 'grating'}
    <section class="panel full" aria-label="Core Practical 6">
      <div class="ph"><h2>Core Practical 6: the wavelength of a laser</h2></div>
      <div class="cols2">
        <div>
          <ol class="method">
            <li>Set the laser, grating and screen in a line, with the grating at right angles to the beam. Measure D from grating to screen with a metre rule.</li>
            <li>Measure X, the distance between the two spots of order n either side of the centre (−n to +n), and halve it: the error in finding the centre cancels.</li>
            <li>θ = tan⁻¹(X/2D), then λ = d sin θ / n. Repeat for every order on the screen and average.</li>
            <li>A large D makes X larger, so its percentage uncertainty is smaller; so do higher orders.</li>
          </ol>
          <p class="safety"><b>Safety.</b> Never look along the beam or point it at anyone; take off watches and rings and keep reflective surfaces out of the path; use a low-power (class 2) laser and keep the room lights on.</p>
          {#if white}
            <p class="why">Pick a laser to measure: white light gives spectra, not single spots.</p>
          {:else}
            <div class="ctls row">
              <div class="ctl"><span class="ctl-l">Order n</span>
                <div class="picker flat" role="group" aria-label="Order">
                  {#each onScreen as o (o.n)}<button type="button" class="fchip" aria-pressed={nPick === o.n} onclick={() => (nPick = o.n)}>{o.n}</button>{:else}<span class="why">No orders on the screen: move it closer.</span>{/each}
                </div>
              </div>
              <button class="btn primary" type="button" onclick={measure} disabled={!onScreen.length}>Measure −n to +n</button>
              <button class="btn" type="button" onclick={() => (readings = [])} disabled={!readings.length}>Clear</button>
            </div>
          {/if}
        </div>
        <div>
          <table class="rtab">
            <thead><tr><th>n</th><th>X / m</th><th>θ / °</th><th>λ / nm</th></tr></thead>
            <tbody>
              {#each readings as r (r.n)}
                <tr><td>{r.n}</td><td>{r.X.toFixed(3)}</td><td>{plain(deg(r.theta), 3)}</td><td>{plain(r.lam * 1e9, 3)}</td></tr>
              {:else}
                <tr><td colspan="4" class="empty">No readings yet.</td></tr>
              {/each}
            </tbody>
          </table>
          <dl class="reads pad0 nocase">
            <div><dt>Mean λ</dt><dd style:color={colour}>{readings.length ? `${plain(meanLam * 1e9, 3)} nm` : '–'}</dd></div>
            <div><dt>Percentage difference</dt><dd>{readings.length && !white ? `${plain((Math.abs(meanLam * 1e9 - nm) / nm) * 100, 2)}%` : '–'}</dd></div>
          </dl>
          <p class="why">X is read to the nearest millimetre on a metre rule, so each value carries a small error. The uncertainty in X is about ±1 mm; with D = {plain(prefs.D, 2)} m that matters most for the first order.</p>
        </div>
      </div>
    </section>

    <section class="panel full" aria-label="Why a grating">
      <div class="ph"><h2>Two slits or many?</h2></div>
      <div class="cols2">
        <div class="plotbox">
          <Plot xr={[-2.4, 2.4]} yr={[0, 1.05]} xLabel="path difference / λ" yLabel="I (scaled to each peak)" h={260}
            series={[{ color: 'var(--ch2)', pts: two, name: '2 slits' }, { color: 'var(--ch1)', pts: many, name: `${prefs.N} slits` }]} label="Intensity across the pattern for two slits and for many slits" />
        </div>
        <div>
          <div class="ctl"><span class="ctl-l">Number of slits lit</span>
            <div class="picker flat" role="group" aria-label="Number of slits">
              {#each NS as n (n)}<button type="button" class="fchip" aria-pressed={prefs.N === n} onclick={() => (prefs.N = n)}>{n}</button>{/each}
            </div>
          </div>
          <p class="why">Bright fringes appear where the path difference between neighbouring slits is a whole number of wavelengths, nλ: then every wave arrives in phase. With two slits the fringes are broad: just off a maximum the two waves are still nearly in phase. With many slits, a little off the maximum the waves from the many slits are spread through every phase and cancel, so the maxima are <b>sharp</b>, and N slits send N² times the intensity of one into each maximum, so they are <b>bright</b>. That is why a grating measures λ far more precisely than a double slit; a real grating has hundreds of lines in the beam.</p>
          <p class="why">Huygens: every point on a wavefront acts as a source of secondary wavelets. Each slit spreads light out (diffraction), and where the spread-out waves overlap they interfere.</p>
        </div>
      </div>
    </section>
  {:else}
    <section class="panel full" aria-label="Ring size">
      <div class="ph"><h2>Ring radius against 1/√V</h2></div>
      <div class="cols2">
        <div class="plotbox">
          <Plot xr={[0, 0.028]} yr={[0, 60]} xLabel="1/√V / V⁻½" yLabel="r / mm" h={260}
            series={[{ color: 'var(--ch1)', pts: ringPts.map((p) => [p.x, p.r[0]] as [number, number]), name: 'inner' }, { color: 'var(--ch2)', pts: ringPts.map((p) => [p.x, p.r[1]] as [number, number]), name: 'outer' }]}
            now={{ x: 1 / Math.sqrt(prefs.kV * 1000), y: el.rings[0].r * 1000 }} label="Ring radius against one over root V" />
        </div>
        <div>
          <p class="why">λ = h/p and p = √(2meV), so λ ∝ 1/√V. For small angles the ring radius is proportional to λ, so r against 1/√V is a straight line through the origin: the rings behave exactly as waves of wavelength h/p would.</p>
          <p class="why">Ring radius from the geometry: 2d sin θ = λ, and the electrons are turned through 2θ, so r = L tan 2θ, with L = {TUBE_L * 100} cm from the graphite to the screen <span class="beyond">Bragg’s law, beyond the spec</span></p>
          <div class="facts"><b>Why it is evidence</b><ul>
            <li>Diffraction and interference are wave behaviours; particles fired at graphite would just make a spot.</li>
            <li>Rings appear only because λ is about the same as the spacing of the atoms, ~10⁻¹⁰ m.</li>
            <li>Raising V makes the rings smaller, exactly as λ = h/p predicts.</li>
            <li>Graphite is made of many tiny crystals at random angles, so the diffracted beams form cones: rings on the screen.</li>
          </ul></div>
        </div>
      </div>
    </section>
  {/if}

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      {#if prefs.mode === 'grating'}
        <h3>Diffraction and the grating <small>spec 50–52</small></h3>
        <div class="cols2 bare">
          <p>Diffraction is the spreading of a wave as it passes through a gap or round an obstacle. It is most noticeable when the gap is about the size of the wavelength. Huygens’ construction explains it: each point on a wavefront is a source of wavelets, and the new wavefront is the surface they all touch; at the edges of a gap there are no neighbours to cancel the sideways wavelets, so the wave curves round.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>nλ = d sin θ: n the order, d the slit spacing (1/lines per metre), θ measured from the straight-through beam.</li>
            <li>The highest order: n ≤ d/λ (sin θ cannot exceed 1); round down.</li>
            <li>More lines per mm → smaller d → bigger angles and fewer orders.</li>
            <li>White light: a white central maximum and a spectrum in each order, violet nearest the centre.</li>
          </ul></div>
        </div>
      {:else}
        <h3>The wave nature of electrons <small>spec 53, 54</small></h3>
        <div class="cols2 bare">
          <p>In 1924 de Broglie suggested that if light, a wave, can behave as particles, then particles might behave as waves, with λ = h/p. Davisson and Germer (and G. P. Thomson) found electrons diffracting from crystals in 1927, with exactly that wavelength. The same electrons are detected one at a time as particles: both models are needed.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>λ = h/p = h/mv; for a charge accelerated through V, Eₖ = eV and p = √(2mEₖ).</li>
            <li>Faster electrons → larger p → shorter λ → smaller rings.</li>
            <li>Everyday objects have tiny λ (a tennis ball: about 10⁻³⁴ m), far too small to diffract through any gap.</li>
            <li>The electron microscope uses short-λ electrons to see detail far smaller than light can show.</li>
          </ul></div>
        </div>
      {/if}
    </div>
  </section>
</main>
