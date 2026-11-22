<script lang="ts" module>
  export interface PhotonPrefs {
    mode: 'pe' | 'lines';
    app: 'cell' | 'scope';
    metal: string;
    nm: number;          // lamp wavelength / nm
    I: number;           // intensity, 0–1
    V: number;           // stopping p.d. / V
    atom: string;
    spec: 'emit' | 'abs';
    calc: number;        // log10(λ / m) for the photon-energy calculator
  }
  export const PHOTON: PhotonPrefs = { mode: 'pe', app: 'cell', metal: 'k', nm: 420, I: 0.6, V: 0, atom: 'h', spec: 'emit', calc: -6.3 };
</script>

<script lang="ts">
  /* Photons: spec 57–63. The photoelectric effect in a vacuum photocell or on a zinc plate on a gold-leaf
     electroscope, the wave and photon models side by side with how they developed, atomic energy levels and line
     spectra from a discharge tube through a grating, and a photon-energy calculator across the EM spectrum. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { PLook, PhotonScene } from './photon3d';
  import type { Stage3D } from '../particles/gl';
  import { C, H, E, sci, plain, short, lambdaRGB, lambdaCss } from './consts';
  import { METALS, metal, photonEV, photonJ, freq, f0, nm0, ekMax, vMax, reachFrac, QE, BANDS, bandOf, ATOMS, atom, linesOf, isObserved, lineNm, visible, seriesOf, MODELS, HISTORY } from './photon';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: PhotonPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  /* ---------- the photoelectric effect ---------- */
  const mt = $derived(metal(prefs.metal));
  const Eph = $derived(photonEV(prefs.nm));
  const f = $derived(freq(prefs.nm));
  const ek = $derived(ekMax(prefs.nm, mt.phi));
  const emits = $derived(ek >= 0);
  const vs = $derived(Math.max(ek, 0));
  const PMAX = 2e-3;   // lamp power reaching the cathode at full intensity / W
  const nPh = $derived((prefs.I * PMAX) / photonJ(prefs.nm));
  const nE = $derived(emits ? nPh * QE * reachFrac(ek, prefs.V) : 0);
  const amps = $derived(nE * E);
  const ampText = (a: number) => (a === 0 ? '0' : a >= 1e-3 ? `${plain(a * 1e3)} mA` : a >= 1e-6 ? `${plain(a * 1e6)} μA` : a >= 1e-9 ? `${plain(a * 1e9)} nA` : `${sci(a)} A`);
  const region = $derived(prefs.nm < 400 ? 'ultraviolet' : prefs.nm > 700 ? 'infrared' : 'visible');
  const METAL_RGB: Record<string, [number, number, number]> = { cs: [0.85, 0.75, 0.45], k: [0.72, 0.74, 0.8], na: [0.78, 0.78, 0.74], ca: [0.75, 0.76, 0.78], mg: [0.8, 0.82, 0.86], zn: [0.66, 0.7, 0.78], cu: [0.85, 0.5, 0.32], pt: [0.82, 0.83, 0.85] };

  /* the electroscope */
  let charge = $state(-0.9);
  let playing = $state(!RM);
  let raf = 0, last = 0;
  function step(t: number) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (prefs.mode === 'pe' && prefs.app === 'scope' && playing && emits && charge < 0 && prefs.I > 0) charge = Math.min(0, charge + dt * 0.11 * prefs.I);
    raf = off ? 0 : requestAnimationFrame(step);
  }
  function kick() { if (!raf && !off) { last = performance.now(); raf = requestAnimationFrame(step); } }
  $effect(() => { if (!off) kick(); });
  onDestroy(() => cancelAnimationFrame(raf));

  /* readings recorded for the graph */
  let pts = $state<{ f: number; ek: number; metal: string }[]>([]);
  function record() {
    if (!emits) return;
    pts = [...pts.filter((p) => !(p.metal === mt.id && Math.abs(p.f - f) < 1e12)), { f, ek, metal: mt.id }];
    prefs.V = Math.round(ek * 100) / 100;
  }

  /* Eₖ(max)–f graph */
  const GW = 520, GH = 300, ML = 50, MR = 14, MT = 14, MB = 40, FMAX = 2e15, YMIN = -6, YMAX = 5;
  const gx = (x: number) => ML + (x / FMAX) * (GW - ML - MR);
  const gy = (y: number) => MT + ((YMAX - y) / (YMAX - YMIN)) * (GH - MT - MB);
  const lineFor = (phi: number) => {
    const fa = f0(phi);
    const ySolid = (H * FMAX) / E - phi;
    return { dash: `M${gx(0)} ${gy(-phi)} L${gx(fa)} ${gy(0)}`, solid: `M${gx(fa)} ${gy(0)} L${gx(FMAX)} ${gy(Math.min(ySolid, YMAX))}`, f0: fa };
  };

  /* ---------- line spectra ---------- */
  const at = $derived(atom(prefs.atom));
  let lvl = $state(0);                 // the electron's level (index), or -1 for ionised
  let last2 = $state<{ from: number; to: number } | null>(null);
  $effect(() => { void prefs.atom; lvl = 0; last2 = null; });
  const EMIN = $derived(at.levels[0].e);
  // level diagram geometry: energy axis non-linear near 0 so crowded upper levels stay clickable
  const LW = 340, LH = 330, LT = 22, LB = 20;
  /** y of each level: a compressed energy scale (so the crowded upper levels spread out), then at least 15 px apart. */
  const ys = $derived.by(() => {
    const raw = at.levels.map((l) => LT + 12 + Math.pow(l.e / EMIN, 0.4) * (LH - LT - LB - 12));
    const out = raw.slice();
    for (let i = 1; i < out.length; i++) out[i] = Math.min(out[i], out[i - 1] - 15);
    const top = LT + 10;
    if (out[out.length - 1] < top) { const k = (out[0] - top) / (out[0] - out[out.length - 1]); for (let i = 1; i < out.length; i++) out[i] = out[0] - (out[0] - out[i]) * k; }
    return out;
  });
  const ly = (e: number) => ys[at.levels.findIndex((l) => l.e === e)] ?? LT;
  function go(i: number) {
    if (i === lvl) return;
    last2 = { from: lvl, to: i };
    lvl = i;
  }
  const trans = $derived(last2 ? (() => {
    const eFrom = last2.from < 0 ? 0 : at.levels[last2.from].e, eTo = last2.to < 0 ? 0 : at.levels[last2.to].e;
    const dE = Math.abs(eTo - eFrom), nm = lineNm(eTo, eFrom);
    return { up: eTo > eFrom, dE, nm, f: (dE * E) / H, J: dE * E, ion: last2.to < 0, obs: last2.from >= 0 && last2.to >= 0 && isObserved(at, last2.from, last2.to) };
  })() : null);
  const lines = $derived(linesOf(at));
  const visLines = $derived(lines.filter((l) => visible(l.nm)));
  const invis = $derived(lines.filter((l) => !visible(l.nm)).sort((a, b) => a.nm - b.nm));
  const SW = 560, SH = 92, S0 = 380, S1 = 750;
  const sxp = (nm: number) => 10 + ((nm - S0) / (S1 - S0)) * (SW - 20);
  const rainbow = Array.from({ length: 38 }, (_, i) => { const nm = S0 + (i / 37) * (S1 - S0); return { o: i / 37, c: lambdaCss(nm) }; });

  /* ---------- the calculator ---------- */
  const cm = $derived(10 ** prefs.calc);
  const cband = $derived(bandOf(cm));
  const cJ = $derived((H * C) / cm);
  const cEV = $derived(cJ / E);
  const BW = 560, BH = 58, B0 = -14, B1 = 4;
  const bx = (log: number) => 8 + ((log - B0) / (B1 - B0)) * (BW - 16);
  const lenText = (m: number) => (m >= 1 ? `${short(m)} m` : m >= 1e-3 ? `${short(m * 1e3)} mm` : m >= 1e-6 ? `${short(m * 1e6)} μm` : m >= 1e-9 ? `${short(m * 1e9)} nm` : `${sci(m)} m`);
  const evText = (x: number) => (x >= 1e6 ? `${plain(x / 1e6)} MeV` : x >= 1e3 ? `${plain(x / 1e3)} keV` : x >= 1e-3 ? `${plain(x)} eV` : `${sci(x)} eV`);

  /* ---------- 3D ---------- */
  let scene: PhotonScene | null = null;
  function onscene(s: Stage3D<PLook> | null) { scene = s as PhotonScene | null; }
  const hex = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255];
  const look = $derived<PLook>({
    mode: prefs.mode === 'lines' ? 'tube' : prefs.app,
    nm: prefs.nm, rgb: lambdaRGB(prefs.nm), intensity: prefs.I, emit: emits, ek: Math.max(ek, 0), V: prefs.V,
    metal: METAL_RGB[mt.id] ?? [0.7, 0.72, 0.8], charge,
    lines: lines.map((l) => ({ nm: l.nm, rgb: lambdaRGB(l.nm), w: at.id === 'h' ? 1 / (l.hi * l.hi) + (l.lo === 1 ? 0.3 : 0) : 1 })),
    glow: hex(at.glow), playing, speed: 1,
  });

  $effect(() => {
    stats = prefs.mode === 'pe'
      ? [['Photon', `${plain(Eph)} eV`], ['φ', `${plain(mt.phi)} eV`], [prefs.app === 'cell' ? 'Current' : 'Leaf', prefs.app === 'cell' ? ampText(amps) : charge < -0.02 ? 'open' : charge > 0.02 ? 'open (+)' : 'closed']]
      : [['Atom', at.name], ['Ionisation', `${plain(-EMIN)} eV`], ['Last photon', trans ? `${short(trans.nm)} nm` : '–']];
  });
</script>

<main class="layout photon" hidden={off}>
  <section class="panel stage" aria-label="Apparatus">
    <div class="stage-head">
      <div class="label-chip"><small>{prefs.mode === 'pe' ? 'Photoelectric effect' : 'Line spectra'}</small><span>{prefs.mode === 'lines' ? `${at.name} discharge tube and grating` : prefs.app === 'cell' ? `Vacuum photocell, ${mt.name.toLowerCase()} cathode` : `${mt.name} plate on an electroscope`}</span></div>
      <div class="stage-tools">
        <Seg label="Experiment" options={[['pe', 'Photoelectric effect', 'Photoelectric'], ['lines', 'Line spectra', 'Spectra']]} bind:value={prefs.mode} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./photon3d').then((m) => m.PhotonScene)} {look} {onscene}
          label="3D view of the apparatus: a lamp, a photocell or electroscope, or a discharge tube with a diffraction grating. Drag to turn it.">
          {#if prefs.mode === 'pe'}
            <div class="hud tl"><b style:color={lambdaCss(prefs.nm)}>λ = {prefs.nm} nm · {plain(Eph)} eV</b><span>{emits ? `hf ≥ φ: electrons emitted, up to ${plain(ek)} eV` : `hf < φ = ${plain(mt.phi)} eV: no electrons, however bright`}</span></div>
            {#if prefs.app === 'cell'}
              <div class="hud tr" class:warn={emits && nE === 0}><b>{ampText(amps)}</b><span>{emits && nE === 0 ? 'stopped: eV ≥ Eₖ(max)' : 'photocurrent'}</span></div>
            {:else}
              <div class="hud tr"><b>{charge < -0.02 ? 'Plate negative' : charge > 0.02 ? 'Plate positive' : 'Discharged'}</b><span>{charge < -0.02 ? (emits && prefs.I > 0 ? 'losing electrons: the leaf falls' : 'the leaf stays up') : charge > 0.02 ? 'freed electrons are pulled back' : 'the leaf has fallen'}</span></div>
            {/if}
            <div class="hud bl">Photons drawn as wave packets, electrons blue. Really only about 1 photon in 100 frees an electron.</div>
          {:else}
            <div class="hud tl"><b>{at.name}</b><span>each flash: an atom drops a level and emits one photon</span></div>
            <div class="hud bl">Only visible lines reach the screen as colour; ultraviolet and infrared lines are there too, unseen.</div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      {#if prefs.mode === 'pe'}
        <Seg label="Apparatus" options={[['cell', 'Photocell', 'Cell'], ['scope', 'Gold-leaf electroscope', 'Electroscope']]} bind:value={prefs.app} />
        {#if prefs.app === 'scope'}
          <button class="btn" type="button" onclick={() => (charge = -0.9)}>Charge −</button>
          <button class="btn" type="button" onclick={() => (charge = 0.9)}>Charge +</button>
        {/if}
      {:else}
        <button class="btn" type="button" onclick={() => scene?.clearBars()}>Clear the screen</button>
      {/if}
    </div>
  </section>

  <aside class="side">
    {#if prefs.mode === 'pe'}
      <section class="panel" aria-label="Light and metal">
        <div class="ph"><h2>Light and metal</h2></div>
        <div class="ctls">
          <div class="ctl">
            <span class="ctl-l">Metal surface</span>
            <div class="picker flat" role="group" aria-label="Metal">
              {#each METALS as m (m.id)}
                <button type="button" class="fchip" aria-pressed={prefs.metal === m.id} onclick={() => (prefs.metal = m.id)}>{m.name} <span class="phi">{plain(m.phi)} eV</span></button>
              {/each}
            </div>
          </div>
          <label class="ctl"><span class="ctl-l">Wavelength <b style:color={visible(prefs.nm) ? lambdaCss(prefs.nm) : undefined}>{prefs.nm} nm ({region})</b></span>
            <input class="slider spectrum-slider" type="range" min="150" max="900" step="1" bind:value={prefs.nm} /></label>
          <label class="ctl"><span class="ctl-l">Intensity <b>{Math.round(prefs.I * 100)}%</b></span>
            <input class="slider" type="range" min="0" max="1" step="0.01" bind:value={prefs.I} /></label>
          {#if prefs.app === 'cell'}
            <label class="ctl"><span class="ctl-l">Stopping p.d. (anode negative) <b>{plain(prefs.V, 3)} V</b></span>
              <input class="slider" type="range" min="0" max="5" step="0.01" bind:value={prefs.V} /></label>
          {/if}
        </div>
        <dl class="reads pad">
          <div><dt>Frequency f</dt><dd>{sci(f)} Hz</dd></div>
          <div><dt>Photon energy hf</dt><dd>{plain(Eph)} eV<small class="j">{sci(Eph * E)} J</small></dd></div>
          <div><dt>Work function φ</dt><dd>{plain(mt.phi)} eV<small class="j">{sci(mt.phi * E)} J</small></dd></div>
          <div><dt>Threshold f₀ = φ/h</dt><dd>{sci(f0(mt.phi))} Hz<small class="j">λ₀ = {short(nm0(mt.phi))} nm</small></dd></div>
          <div><dt>Eₖ(max) = hf − φ</dt><dd>{emits ? `${plain(ek)} eV` : 'none'}{#if emits}<small class="j">{sci(ek * E)} J</small>{/if}</dd></div>
          <div><dt>v(max)</dt><dd>{emits ? `${sci(vMax(ek))} m s⁻¹` : '–'}</dd></div>
          {#if prefs.app === 'cell'}
            <div><dt>Photons per second</dt><dd>{sci(nPh, 2)}</dd></div>
            <div><dt>Electrons reaching anode</dt><dd>{nE ? sci(nE, 2) : '0'} s⁻¹</dd></div>
            <div class="wide"><dt>Stopping potential V<sub>s</sub> = Eₖ(max)/e</dt><dd>{emits ? `${plain(vs)} V` : 'no emission'}{#if emits}<button class="btn sm rec" type="button" onclick={record}>Find V<sub>s</sub> and plot it</button>{/if}</dd></div>
          {/if}
        </dl>
      </section>
    {:else}
      <section class="panel" aria-label="Energy levels">
        <div class="ph"><h2>Energy levels</h2></div>
        <div class="picker" role="group" aria-label="Atom">
          {#each ATOMS as a (a.id)}
            <button type="button" class="fchip" aria-pressed={prefs.atom === a.id} onclick={() => (prefs.atom = a.id)}>{a.name}</button>
          {/each}
        </div>
        <svg class="levels" viewBox="0 0 {LW} {LH}" role="group" aria-label="Energy-level diagram for {at.name}. Click a level to move the electron there.">
          <line class="lv ion" x1="70" x2={LW - 70} y1={LT - 8} y2={LT - 8} />
          <text class="lt" x={LW - 66} y={LT - 8}>0 eV (ionised)</text>
          <!-- the ionisation level is clickable too -->
          <rect class="hit" x="70" y={LT - 18} width={LW - 140} height="16" role="button" tabindex="0" aria-label="Ionise the atom" onclick={() => go(-1)} onkeydown={(e) => e.key === 'Enter' && go(-1)} />
          {#each at.levels as l, i (i)}
            <g class="lvg" class:on={lvl === i}>
              <line class="lv" x1="70" x2={LW - 70} y1={ly(l.e)} y2={ly(l.e)} />
              <text class="lt" x={LW - 66} y={ly(l.e)}>{plain(l.e, 3)} eV</text>
              <text class="ln" x="64" y={ly(l.e)} text-anchor="end">{l.name}</text>
              <rect class="hit" x="70" y={ly(l.e) - 7} width={LW - 140} height="14" role="button" tabindex="0" aria-label="Move the electron to {l.name}, {plain(l.e, 3)} eV" onclick={() => go(i)} onkeydown={(e) => e.key === 'Enter' && go(i)} />
            </g>
          {/each}
          {#if last2 && trans}
            {@const y1 = last2.from < 0 ? LT - 8 : ly(at.levels[last2.from].e)}
            {@const y2 = last2.to < 0 ? LT - 8 : ly(at.levels[last2.to].e)}
            <line class="tarrow" x1={LW / 2} x2={LW / 2} y1={y1} y2={y2 + (trans.up ? 6 : -6)} style:stroke={visible(trans.nm) ? lambdaCss(trans.nm) : undefined} marker-end="url(#ah)" />
            <path class="squig" d={Array.from({ length: 9 }, (_, k) => `${k ? 'L' : 'M'}${LW / 2 + 12 + k * 6} ${(y1 + y2) / 2 + (k % 2 ? -5 : 5)}`).join(' ')} style:stroke={visible(trans.nm) ? lambdaCss(trans.nm) : undefined} />
          {/if}
          {#if lvl >= 0}<circle class="eball" cx={LW / 2} cy={ly(at.levels[lvl].e)} r="6" />{:else}<circle class="eball" cx={LW / 2 + 60} cy={LT - 8} r="6" />{/if}
          <defs><marker id="ah" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ahd" /></marker></defs>
        </svg>
        <p class="why pad2">Click a level to move the electron. Down: the atom emits a photon of exactly ΔE. Up: it must absorb exactly ΔE from a photon (or at least ΔE from a colliding electron). Not to scale near 0 eV.</p>
        <dl class="reads pad">
          {#if trans}
            <div><dt>{trans.up ? (trans.ion ? 'Ionisation' : 'Absorbed') : 'Emitted'} ΔE</dt><dd>{plain(trans.dE)} eV<small class="j">{sci(trans.J)} J</small></dd></div>
            <div><dt>{trans.ion ? 'Least photon f' : 'f = ΔE/h'}</dt><dd>{sci(trans.f)} Hz</dd></div>
            <div class="wide"><dt>λ = c/f</dt><dd class="lam"><span class="sw" style:background={visible(trans.nm) ? lambdaCss(trans.nm) : 'transparent'} class:inv={!visible(trans.nm)}></span>{short(trans.nm)} nm · {bandOf(trans.nm * 1e-9).name.toLowerCase()}</dd></div>
            {#if !trans.ion && at.lines && !trans.obs}<div class="wide"><dt>In a real {at.name.toLowerCase()} lamp</dt><dd class="txt">This line is missing or very faint: quantum rules (selection rules) make some jumps unlikely. <span class="beyond">beyond the spec</span></dd></div>{/if}
            {#if at.id === 'h' && !trans.ion && last2 && last2.from >= 0 && last2.to >= 0}<div class="wide"><dt>Series</dt><dd class="txt">{seriesOf(Math.min(last2.from, last2.to))} <span class="beyond">beyond the spec</span></dd></div>{/if}
          {:else}
            <div class="wide"><dt>Ground state</dt><dd class="txt">The electron is in the lowest level. Click a higher one to excite it.</dd></div>
          {/if}
        </dl>
      </section>
    {/if}
  </aside>

  {#if prefs.mode === 'pe'}
    <section class="panel full" aria-label="Graph and working">
      <div class="ph"><h2>Eₖ(max) against frequency</h2></div>
      <div class="cols2">
        <div>
          <svg class="ekplot" viewBox="0 0 {GW} {GH}" role="img" aria-label="Maximum kinetic energy against frequency: straight lines of gradient h, one per metal, crossing the f axis at the threshold frequency">
            {#each [-6, -4, -2, 0, 2, 4] as y (y)}<line class="gl" x1={ML} x2={GW - MR} y1={gy(y)} y2={gy(y)} /><text class="tk" x={ML - 6} y={gy(y)} text-anchor="end">{y}</text>{/each}
            {#each [0, 0.5, 1, 1.5, 2] as x (x)}<line class="gl" x1={gx(x * 1e15)} x2={gx(x * 1e15)} y1={MT} y2={GH - MB} /><text class="tk" x={gx(x * 1e15)} y={GH - MB + 14} text-anchor="middle">{x}</text>{/each}
            <line class="ax" x1={ML} x2={GW - MR} y1={gy(0)} y2={gy(0)} />
            <line class="ax" x1={ML} x2={ML} y1={MT} y2={GH - MB} />
            <rect class="vis" x={gx(C / 700e-9)} width={gx(C / 400e-9) - gx(C / 700e-9)} y={MT} height={GH - MT - MB} />
            <text class="tk vt" x={(gx(C / 700e-9) + gx(C / 400e-9)) / 2} y={MT + 10} text-anchor="middle">visible</text>
            {#each METALS as m (m.id)}
              {@const L = lineFor(m.phi)}
              <g class="mline" class:on={m.id === mt.id}>
                <path class="dash" d={L.dash} /><path class="solid" d={L.solid} />
                {#if m.id === mt.id}
                  <text class="lab" x={gx(L.f0) + 4} y={gy(0) + 14}>f₀</text>
                  <text class="lab" x={ML + 6} y={gy(-m.phi) + 4}>−φ = −{plain(m.phi)} eV</text>
                {/if}
              </g>
            {/each}
            {#each pts as p (p.f + p.metal)}<path class="pt" class:dim={p.metal !== mt.id} d="M{gx(p.f) - 4.5} {gy(p.ek) - 4.5}l9 9m0 -9l-9 9" />{/each}
            {#if f <= FMAX}<line class="now" x1={gx(f)} x2={gx(f)} y1={MT} y2={GH - MB} style:stroke={visible(prefs.nm) ? lambdaCss(prefs.nm) : undefined} />{/if}
            <text class="al" x={GW - MR} y={GH - 6} text-anchor="end">f / 10¹⁵ Hz</text>
            <text class="al" x={12} y={MT + 2} transform="rotate(-90 12 {MT + 2})" text-anchor="end">Eₖ(max) / eV</text>
          </svg>
          <p class="why lg">Every metal gives a straight line with the <b>same gradient, h</b> (the Planck constant) but a different intercept, <b>−φ</b>. The line crosses the f axis at the threshold frequency f₀. Below f₀ (dashed) there is no emission at all. Press “Find V<sub>s</sub> and plot it” at several wavelengths to plot readings, as Millikan did.</p>
        </div>
        <div class="work">
          <h3 class="gh">Working</h3>
          <div class="eq">f = c/λ = 3.00 × 10⁸ ÷ {sci(prefs.nm * 1e-9)} = {sci(f)} Hz</div>
          <div class="eq">E = hf = 6.63 × 10⁻³⁴ × {sci(f)} = {sci(Eph * E)} J</div>
          <div class="eq">In eV: {sci(Eph * E)} ÷ 1.60 × 10⁻¹⁹ = {plain(Eph)} eV</div>
          <div class="eq">hf = φ + ½mv²(max) → Eₖ(max) = {plain(Eph)} − {plain(mt.phi)} = {emits ? `${plain(ek)} eV = ${sci(ek * E)} J` : `${plain(ek)} eV < 0: no emission`}</div>
          {#if emits}
            <div class="eq">v(max) = √(2Eₖ/m) = √(2 × {sci(ek * E)} ÷ 9.11 × 10⁻³¹) = {sci(vMax(ek))} m s⁻¹</div>
            <div class="eq">eV<sub>s</sub> = Eₖ(max) → V<sub>s</sub> = {plain(vs)} V</div>
          {/if}
          <div class="eq">f₀ = φ/h = {plain(mt.phi)} × 1.60 × 10⁻¹⁹ ÷ 6.63 × 10⁻³⁴ = {sci(f0(mt.phi))} Hz</div>
          <div class="facts">
            <b>Key facts</b>
            <ul>
              <li>One photon gives all its energy to one electron. Light of frequency below f₀ frees none, however intense.</li>
              <li>More intensity = more photons per second = more electrons (a larger current), with the same Eₖ(max).</li>
              <li>Emission is instant: there is no build-up time, even in dim light.</li>
              <li>The work function φ is the least energy needed to free an electron from the surface; most need more, so they leave with less than Eₖ(max).</li>
              <li>1 eV = 1.60 × 10⁻¹⁹ J: the energy one electron gains moving through 1 V.</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <section class="panel full" aria-label="The wave model and the photon model">
      <div class="ph"><h2>Wave or particle?</h2></div>
      <div class="models">
        <table class="mtable">
          <thead><tr><th>Question</th><th>Wave model predicts</th><th>Photon model predicts</th><th>What is observed</th></tr></thead>
          <tbody>
            {#each MODELS as r (r.q)}
              <tr><th scope="row">{r.q}</th><td class:win={r.win === 'wave'}>{r.wave}</td><td class:win={r.win === 'photon'}>{r.photon}</td><td>{r.seen}</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="why pad2">Neither model alone explains everything. Light travels and spreads as a wave (diffraction, interference, polarisation) but delivers its energy as photons, E = hf. Electrons are the same the other way round (see Diffraction: λ = h/p).</p>
      </div>
      <h3 class="gh tl-h">How the models developed</h3>
      <ol class="timeline">
        {#each HISTORY as h (h.y + h.who)}
          <li class="m-{h.model}"><span class="yr">{h.y}</span><b>{h.who}</b><span>{h.what}</span></li>
        {/each}
      </ol>
    </section>
  {:else}
    <section class="panel full" aria-label="The spectrum">
      <div class="ph">
        <h2>{at.name} {prefs.spec === 'emit' ? 'emission' : 'absorption'} spectrum</h2>
        <Seg label="Spectrum" options={[['emit', 'Emission', 'Emission'], ['abs', 'Absorption', 'Absorption']]} bind:value={prefs.spec} />
      </div>
      <div class="plotbox">
        <svg class="specstrip" viewBox="0 0 {SW} {SH}" role="img" aria-label="{at.name} {prefs.spec} spectrum from 380 to 750 nm">
          <defs>
            <linearGradient id="rb" x1="0" x2="1">{#each rainbow as s (s.o)}<stop offset={s.o} stop-color={s.c} />{/each}</linearGradient>
          </defs>
          <rect x="10" y="6" width={SW - 20} height="56" rx="4" fill={prefs.spec === 'emit' ? '#05060c' : 'url(#rb)'} />
          {#each visLines as l (l.nm)}
            {@const hot = !!trans && Math.abs(trans.nm - l.nm) < 0.05}
            {#if prefs.spec === 'emit'}
              <rect x={sxp(l.nm) - 1.6} y="6" width="3.2" height="56" fill={lambdaCss(l.nm)} class="eline" />
              <rect x={sxp(l.nm) - 5} y="6" width="10" height="56" fill={lambdaCss(l.nm)} opacity=".25" />
            {:else}
              <rect x={sxp(l.nm) - 1.8} y="6" width="3.6" height="56" fill="#05060c" />
            {/if}
            {#if hot}<path class="hot" d="M{sxp(l.nm)} 2 l-5 -0 l5 4 l5 -4 z" />{/if}
            <text class="tk" x={sxp(l.nm)} y="76" text-anchor="middle">{Math.round(l.nm)}</text>
          {/each}
          {#each [400, 500, 600, 700] as t (t)}<line class="tick" x1={sxp(t)} x2={sxp(t)} y1="62" y2="66" />{/each}
          <text class="tk mute" x="10" y="88">380 nm</text><text class="tk mute" x={SW - 10} y="88" text-anchor="end">750 nm</text>
        </svg>
        {#if invis.length}
          <p class="why"><b>Not visible:</b>
            {#each invis as l, i (l.nm)}{i ? ', ' : ''}{short(l.nm)} nm ({l.nm < 380 ? 'UV' : 'IR'}){/each}.
          </p>
        {/if}
      </div>
      <div class="cols2">
        <div>
          <p class="why">{at.note}</p>
          <p class="why">{prefs.spec === 'emit'
            ? 'Emission: a hot, low-pressure gas glows only at certain wavelengths. Each line is one jump down between two levels: hf = E₁ − E₂. A different element has different levels, so a different fingerprint.'
            : 'Absorption: white light through a cooler gas comes out with dark lines at exactly the wavelengths the gas would emit. Atoms absorb only photons whose energy matches a jump up, then re-emit in all directions, so less light carries on in the beam.'}</p>
          {#if prefs.spec === 'abs' && at.id === 'h'}<p class="why">Hydrogen’s visible absorption lines need atoms already in n = 2, so they show in hot gas such as a star’s atmosphere; cold hydrogen absorbs only ultraviolet (from n = 1).</p>{/if}
        </div>
        <div class="facts">
          <b>Key facts</b>
          <ul>
            <li>Electrons in atoms can only have certain discrete energies: the energy levels. Levels are negative; 0 eV means the electron has just escaped (ionised).</li>
            <li>A transition between levels emits or absorbs one photon: hf = E₁ − E₂, so f = ΔE/h and λ = hc/ΔE.</li>
            <li>Discrete levels → discrete photon energies → separate lines, not a continuous spectrum.</li>
            <li>Ionisation energy of {at.name.toLowerCase()}: {plain(-EMIN)} eV = {sci(-EMIN * E)} J from the ground state.</li>
            <li>Atoms can also be excited by collisions with electrons, which may give up only part of their kinetic energy (unlike a photon, which must be absorbed whole).</li>
          </ul>
        </div>
      </div>
    </section>
  {/if}

  <section class="panel full" aria-label="Photon energy across the electromagnetic spectrum">
    <div class="ph"><h2>Photon energy, E = hf = hc/λ</h2></div>
    <div class="plotbox">
      <svg class="bandstrip" viewBox="0 0 {BW} {BH}" role="img" aria-label="The electromagnetic spectrum from gamma rays to radio, with the chosen wavelength marked">
        {#each BANDS as b, i (b.name)}
          <rect x={bx(Math.log10(b.lo))} y="6" width={bx(Math.log10(b.hi)) - bx(Math.log10(b.lo))} height="26" class="band b{i}" class:on={b === cband} />
          <text class="bt" x={(bx(Math.log10(b.lo)) + bx(Math.log10(b.hi))) / 2} y="23" text-anchor="middle">{b.name === 'Visible' ? 'vis' : b.name.replace('Ultraviolet', 'UV').replace('Microwaves', 'micro').replace('Infrared', 'IR')}</text>
        {/each}
        <path class="mark" d="M{bx(prefs.calc)} 2 V36" />
        {#each [-12, -9, -6, -3, 0, 3] as e (e)}<text class="tk" x={bx(e)} y="50" text-anchor="middle">10{e < 0 ? '⁻' : ''}{String(Math.abs(e)).split('').map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[+ch]).join('')} m</text>{/each}
      </svg>
      <input class="slider" type="range" min="-13.5" max="3.5" step="0.01" bind:value={prefs.calc} aria-label="Wavelength, logarithmic" />
      <dl class="reads four">
        <div><dt>Wavelength</dt><dd>{lenText(cm)}</dd></div>
        <div><dt>Frequency</dt><dd>{sci(C / cm)} Hz</dd></div>
        <div><dt>Energy</dt><dd>{sci(cJ)} J</dd></div>
        <div><dt>Energy</dt><dd>{evText(cEV)}</dd></div>
        <div class="wide"><dt>{cband.name}</dt><dd class="txt">{cband.use}. {cEV >= mt.phi ? `Enough to free an electron from ${mt.name.toLowerCase()} (φ = ${plain(mt.phi)} eV).` : `Not enough to free an electron from ${mt.name.toLowerCase()} (φ = ${plain(mt.phi)} eV).`}{cEV > 13.6 ? ' Enough to ionise a hydrogen atom: ionising radiation.' : ''}</dd></div>
      </dl>
    </div>
  </section>
</main>
