<script lang="ts" module>
  import type { Kind } from './accel';
  export interface AccelPrefs {
    kind: Kind;
    gunV: number; gunB: number;                                     // V, mT
    linBeam: 'p' | 'e'; linV: number; linFp: number; linFe: number; linN: number;   // kV, MHz, MHz, gaps
    cycBeam: 'p' | 'd' | 'a'; cycB: number; cycV: number; cycR: number;            // T, kV, m
    syncE: number;                                                  // GeV per beam
    slow: Record<Kind, number>;                                     // log₁₀ (real seconds per second on screen)
  }
  /** Slider range for each machine's time scale (log₁₀ s per s) and the default for the linac by particle. */
  export const SLOW_RANGE: Record<Kind, [number, number]> = { gun: [-10.5, -6], linac: [-11.5, -5], cyclo: [-9, -3], sync: [-7, -1] };
  export const LIN_SLOW = { p: -7.9, e: -9.7 };
  export const ACCEL: AccelPrefs = {
    kind: 'cyclo', gunV: 250, gunB: 1.2, linBeam: 'p', linV: 200, linFp: 50, linFe: 3000, linN: 12,
    cycBeam: 'p', cycB: 1.0, cycV: 30, cycR: 0.4, syncE: 6800,
    slow: { gun: -8, linac: -7.9, cyclo: -6.8, sync: -4.5 },
  };
</script>

<script lang="ts">
  /* Accelerators: an electron gun with a fine-beam tube, a linac, a cyclotron and the LHC, each in 3D with live
     readings, the working an exam answer needs (Newtonian, as the course does it) and the key facts. Where Newtonian
     mechanics gives the wrong speed (more than 1% out) the tab says so and shows the true value. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Plot from '../circuit/Plot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { ALook, ALive, AccelScene } from './accel3d';
  import type { Stage3D } from './gl';
  import { MACHINES, NAME, REL, NUCLEON, BULB, GUN_Y, LHC_R, HIGGS_GEV, gun, linac, cyclo, sync, gunPlan, linacPlan, cycloPlan } from './accel';
  import { BEAMS } from './physics';
  import { E, C, H, sci, plain, eV, short } from './data';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: AccelPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  /* ---------- the numbers ---------- */
  const G = $derived(gun(prefs.gunV, prefs.gunB));
  const lb = $derived(BEAMS[prefs.linBeam]);
  const linF = $derived(prefs.linBeam === 'e' ? prefs.linFe : prefs.linFp);
  const Lc = $derived(linac(lb, prefs.linV, linF, prefs.linN));
  const cb = $derived(BEAMS[prefs.cycBeam]);
  const Cy = $derived(cyclo(cb, prefs.cycB, prefs.cycV, prefs.cycR));
  const Sy = $derived(sync(prefs.syncE));
  /* ---------- motion on a real clock, slowed down ---------- */
  // older saved prefs had no time scales
  $effect.pre(() => { if (!prefs.slow || typeof prefs.slow !== 'object') prefs.slow = { ...ACCEL.slow }; });
  const slowOf = (k: Kind) => (Number.isFinite(prefs.slow?.[k]) ? prefs.slow[k] : ACCEL.slow[k]);
  const scale = $derived(10 ** slowOf(prefs.kind));                // real seconds per second on screen
  const GP = $derived(gunPlan(prefs.gunV, prefs.gunB));
  const LP = $derived(linacPlan(lb, prefs.linV, linF, prefs.linN));
  const CP = $derived(cycloPlan(cb, prefs.cycB, prefs.cycV, prefs.cycR));
  let epoch = $state(0);
  let live = $state<ALive | null>(null);
  function setBeam(b: 'p' | 'e') { if (b !== prefs.linBeam) { prefs.linBeam = b; prefs.slow = { ...prefs.slow, linac: LIN_SLOW[b] }; } }
  export function setLinacBeam(b: 'p' | 'e') { setBeam(b); }
  export function restart() { epoch += 1; playing = true; }
  export function setPlaying(on: boolean) { playing = on; }
  export function startRamp() { if (!ramping) ramp(); }
  function onscene(sc: Stage3D<ALook> | null) { if (sc) (sc as AccelScene).onTick = (x) => { live = x; }; }

  const look = $derived<ALook>({
    kind: prefs.kind, playing, scale, epoch,
    gun: { r: G.r * 100, plan: GP },
    linac: LP,
    cyclo: CP,
    sync: { B: Sy.B / 8.33, frev: Sy.frev },
  });
  const liveNow = $derived(live && live.kind === prefs.kind ? live : null);
  /** A time in words: 12.5 ns, 3.20 μs, 89.0 μs, 1.20 s. */
  function tText(x: number) {
    const a = Math.abs(x);
    if (a === 0) return '0 s';
    const [d, u] = a >= 1 ? [1, 's'] : a >= 1e-3 ? [1e-3, 'ms'] : a >= 1e-6 ? [1e-6, 'μs'] : a >= 1e-9 ? [1e-9, 'ns'] : [1e-12, 'ps'];
    return `${short(x / d, 3)} ${u}`;
  }
  const slowBy = $derived(1 / scale);
  const slowWords = $derived(slowBy >= 1e9 ? `${short(slowBy / 1e9, 2)} billion` : slowBy >= 1e6 ? `${short(slowBy / 1e6, 2)} million` : slowBy >= 1e3 ? `${short(slowBy / 1e3, 2)} thousand` : short(slowBy, 2));
  const keLive = $derived(liveNow && liveNow.p > 0 ? (() => { const m = prefs.kind === 'gun' ? 9.11e-31 : prefs.kind === 'linac' ? lb.m : cb.m; return Math.hypot(liveNow.p * C, m * C * C) - m * C * C; })() : 0);

  $effect(() => {
    const k = prefs.kind;
    stats = k === 'gun' ? [['Machine', 'Electron gun'], ['Eₖ', eV(prefs.gunV)], ['r', `${plain(G.r * 100)} cm`]]
      : k === 'linac' ? [['Machine', 'Linac'], ['Eₖ out', eV(Lc.last.KE / E)]]
      : k === 'cyclo' ? [['Machine', 'Cyclotron'], ['f', `${plain(Cy.f / 1e6)} MHz`], ['Eₖ max', eV(Cy.KE / E)]]
      : [['Machine', 'LHC'], ['Beam', eV(prefs.syncE * 1e9)], ['B', `${plain(Sy.B)} T`]];
  });

  /* ---------- LHC ramp: 450 GeV injection to 6.8 TeV, the field following the momentum ---------- */
  let ramping = $state(false), rraf = 0;
  function ramp() {
    if (ramping) { ramping = false; cancelAnimationFrame(rraf); return; }
    ramping = true;
    prefs.syncE = 450;
    let last = performance.now();
    const step = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000); last = t;
      prefs.syncE = Math.min(6800, Math.round(prefs.syncE + dt * 900));
      if (prefs.syncE < 6800 && ramping && !off) rraf = requestAnimationFrame(step); else ramping = false;
    };
    rraf = requestAnimationFrame(step);
  }
  onDestroy(() => cancelAnimationFrame(rraf));

  /* ---------- graphs ---------- */
  const gunCurve = $derived(Array.from({ length: 61 }, (_, i) => { const V = 50 + i * 7.5; return [V, gun(V, prefs.gunB).r * 100] as [number, number]; }));
  const gunLimit = (BULB * 0.96 + GUN_Y) / 2 * 100;          // the biggest circle that fits, in cm
  const linUnit = $derived(Lc.last.LT < 0.1 ? 'cm' : 'm');
  const linK = $derived(linUnit === 'cm' ? 100 : 1);
  const linMax = $derived(Math.max(...Lc.tubes.map((t) => Math.min(t.LN, 3 * t.LT))) * linK * 1.1);
  const cycCurve = $derived(Array.from({ length: 61 }, (_, i) => { const r = (prefs.cycR * i) / 60; return [r, (prefs.cycB * Cy.q * r) ** 2 / (2 * Cy.m) / E / 1e6] as [number, number]; }));
  const syncCurve = Array.from({ length: 41 }, (_, i) => { const e = 450 + (6800 - 450) * (i / 40); return [e / 1000, sync(e).B] as [number, number]; });

  const pNow = $derived(prefs.kind === 'gun' ? G.p : prefs.kind === 'linac' ? Lc.p : prefs.kind === 'cyclo' ? Cy.pmax : Sy.p);
  const fmtV = (v: number) => `${sci(v)} m s⁻¹`;
  const frac = (v: number) => (v / C < 0.001 ? sci(v / C) : plain(v / C));
  const nucleonE = (H * C) / NUCLEON;      // J: the energy whose wavelength is a nucleon's size
  const qName = $derived(cb.q === 2 * E ? '2e = 3.20 × 10⁻¹⁹ C' : '1.60 × 10⁻¹⁹ C');
</script>

<main class="layout accel" hidden={off}>
  <section class="panel stage" aria-label="The accelerator">
    <div class="stage-head">
      <div class="label-chip"><small>{prefs.kind === 'sync' ? 'Circular collider' : prefs.kind === 'cyclo' ? 'Circular accelerator' : prefs.kind === 'linac' ? 'Straight-line accelerator' : 'Electron source'}</small><span>{NAME[prefs.kind]}</span></div>
    </div>
    <div class="picker" role="group" aria-label="Machine">
      {#each MACHINES as [k, long, sh] (k)}
        <button type="button" class="fchip" aria-pressed={prefs.kind === k} onclick={() => (prefs.kind = k)} title={long}>{sh === 'LHC' ? 'Synchrotron (LHC)' : long}</button>
      {/each}
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./accel3d').then((m) => m.AccelScene)} {look} {onscene} label="3D view of the accelerator. Drag to turn it.">
          {#if prefs.kind === 'gun'}
            <div class="hud tl"><b>Fine-beam tube</b><span>{prefs.gunV} V · {plain(prefs.gunB)} mT · r = {plain(G.r * 100)} cm</span>
              {#if liveNow}<span class="live">{liveNow.stage}</span><span class="live">v = {sci(liveNow.v)} m s⁻¹</span>{/if}</div>
            {#if !G.fits}<div class="hud tr warn">Circle too big: the beam hits the glass</div>{/if}
            <div class="hud bl">To scale: 16 cm bulb · electrons bunch up where they are slow, near the filament</div>
          {:else if prefs.kind === 'linac'}
            <div class="hud tl"><b>Linac · {lb.name}s</b><span>{prefs.linN} gaps × {short(prefs.linV)} kV → {eV(Lc.last.KE / E)}</span>
              {#if liveNow}<span class="live">{liveNow.stage}</span><span class="live">v = {frac(liveNow.v)}c · Eₖ = {eV(keLive / E)}</span>{#if liveNow.v / C > 0.9}<span class="live hwarn">almost c: more energy, hardly any more speed</span>{/if}{/if}</div>
            <div class="hud tr"><span>p.d. reverses every {sci(Lc.half * 1e9)} ns</span><span>at each gap: tube behind <i class="pm {prefs.linBeam === 'e' ? 'm' : 'p'}">{prefs.linBeam === 'e' ? '−' : '+'}</i> pushes, tube ahead <i class="pm {prefs.linBeam === 'e' ? 'p' : 'm'}">{prefs.linBeam === 'e' ? '+' : '−'}</i> pulls</span></div>
            <div class="hud bl">Tubes and gaps to scale · p.d. = V₀ cos 2πft on the same clock</div>
          {:else if prefs.kind === 'cyclo'}
            <div class="hud tl"><b>Cyclotron · {cb.name}s</b><span>f = {plain(Cy.f / 1e6)} MHz · Eₖ out = {eV(Cy.KE / E)}</span>
              {#if liveNow}<span class="live">half-turn {liveNow.k} of {CP.n} · {liveNow.stage}</span><span class="live">v = {sci(liveNow.v)} m s⁻¹{liveNow.r ? ` · r = ${plain(liveNow.r * 100)} cm` : ''} · Eₖ = {eV(keLive / E)}</span>{/if}</div>
            <div class="hud tr"><span>Every half-turn takes the same time</span>{#if Cy.slip > REL}<span class="hwarn">Mass increase {plain(Cy.slip * 100, 2)}%: drifting out of step</span>{/if}</div>
            <div class="hud bl">All {CP.n.toLocaleString('en-GB')} semicircles drawn, to scale{CP.n > 300 ? ': so many they merge into a disc' : ''}</div>
          {:else}
            <div class="hud tl"><b>LHC · two proton beams</b><span>{eV(prefs.syncE * 1e9)} each · B = {plain(Sy.B)} T</span>
              <span class="live">{Math.round(Sy.frev).toLocaleString('en-GB')} laps a second: v = c × (1 − {sci(Sy.lag, 2)})</span>{#if liveNow}<span class="live">laps so far: {liveNow.k.toLocaleString('en-GB')}</span>{/if}</div>
            <div class="hud tr"><span>red and blue beams go opposite ways</span><span>and collide in the four detectors</span></div>
            <div class="hud bl">27 km ring, not to scale · 2808 bunches really, 25 ns apart; {28} drawn</div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button class="btn" type="button" onclick={() => (epoch += 1)}>Start again</button>
      {#if prefs.kind === 'sync'}<button class="btn" type="button" onclick={ramp}>{ramping ? 'Stop the ramp' : 'Ramp up from injection'}</button>{/if}
    </div>
    <div class="clock">
      <label class="ctl"><span class="ctl-l"><span>Slow motion: 1 s on screen = <b class="tt">{tText(scale)}</b> of real time</span><b>× 1/{slowWords}</b></span>
        <input class="slider" type="range" min={SLOW_RANGE[prefs.kind][0]} max={SLOW_RANGE[prefs.kind][1]} step="0.05" value={slowOf(prefs.kind)}
          oninput={(e) => (prefs.slow = { ...prefs.slow, [prefs.kind]: +e.currentTarget.value })} aria-label="Time scale: real time per second on screen" /></label>
      <p class="why">{liveNow ? `Real time since the start: ${tText(liveNow.t)}. ` : ''}Everything moves at its true speed, only slowed down{prefs.kind === 'cyclo' ? `: the whole spiral takes ${tText(CP.tEnd)}` : prefs.kind === 'linac' ? `: the bunch takes ${tText(LP.tEnd)} to reach the target` : prefs.kind === 'gun' ? `: ${tText(GP.tAcc)} from filament to anode, then ${tText(GP.loop)} per circle` : `: one lap takes ${tText(1 / Sy.frev)}`}.</p>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Settings">
      <div class="ph"><h2>Settings</h2></div>
      <div class="ctls">
        {#if prefs.kind === 'gun'}
          <label class="ctl"><span class="ctl-l"><span>Accelerating p.d., V</span><b>{prefs.gunV} V</b></span>
            <input class="slider" type="range" min="100" max="400" step="10" bind:value={prefs.gunV} /></label>
          <label class="ctl"><span class="ctl-l"><span>Magnetic flux density, B</span><b>{plain(prefs.gunB)} mT</b></span>
            <input class="slider" type="range" min="0.5" max="3" step="0.05" bind:value={prefs.gunB} /></label>
        {:else if prefs.kind === 'linac'}
          <Seg label="Particle" options={[['p', 'Protons'], ['e', 'Electrons']]} value={prefs.linBeam} onchange={setBeam} />
          <label class="ctl"><span class="ctl-l"><span>Peak p.d. across each gap</span><b>{short(prefs.linV)} kV</b></span>
            <input class="slider" type="range" min="50" max="1000" step="10" bind:value={prefs.linV} /></label>
          {#if prefs.linBeam === 'e'}
            <label class="ctl"><span class="ctl-l"><span>Frequency of the p.d., f</span><b>{prefs.linFe} MHz</b></span>
              <input class="slider" type="range" min="500" max="3000" step="50" bind:value={prefs.linFe} /></label>
          {:else}
            <label class="ctl"><span class="ctl-l"><span>Frequency of the p.d., f</span><b>{prefs.linFp} MHz</b></span>
              <input class="slider" type="range" min="10" max="400" step="5" bind:value={prefs.linFp} /></label>
          {/if}
          <label class="ctl"><span class="ctl-l"><span>Number of gaps</span><b>{prefs.linN}</b></span>
            <input class="slider" type="range" min="4" max="20" step="1" bind:value={prefs.linN} /></label>
        {:else if prefs.kind === 'cyclo'}
          <Seg label="Particle" options={[['p', 'Protons', 'p'], ['d', 'Deuterons', 'd'], ['a', 'α particles', 'α']]} bind:value={prefs.cycBeam} />
          <label class="ctl"><span class="ctl-l"><span>Magnetic flux density, B</span><b>{plain(prefs.cycB)} T</b></span>
            <input class="slider" type="range" min="0.5" max="2" step="0.05" bind:value={prefs.cycB} /></label>
          <label class="ctl"><span class="ctl-l"><span>Peak p.d. across the gap</span><b>{prefs.cycV} kV</b></span>
            <input class="slider" type="range" min="10" max="100" step="1" bind:value={prefs.cycV} /></label>
          <label class="ctl"><span class="ctl-l"><span>Radius of the dees, R</span><b>{plain(prefs.cycR)} m</b></span>
            <input class="slider" type="range" min="0.2" max="1" step="0.01" bind:value={prefs.cycR} /></label>
        {:else}
          <label class="ctl"><span class="ctl-l"><span>Energy of each proton</span><b>{eV(prefs.syncE * 1e9)}</b></span>
            <input class="slider" type="range" min="450" max="6800" step="10" bind:value={prefs.syncE} oninput={() => { ramping = false; }} /></label>
          <p class="why">Bending radius fixed at {plain(LHC_R / 1000)} km, so the field must rise with the momentum. 450 GeV is the injection energy from the SPS.</p>
        {/if}
      </div>
    </section>

    <section class="panel" aria-label="Readings">
      <div class="ph"><h2>Readings</h2></div>
      <dl class="reads pad">
        {#if prefs.kind === 'gun'}
          <div><dt>Kinetic energy</dt><dd>{prefs.gunV} eV</dd></div>
          <div><dt>in joules</dt><dd>{sci(G.KE)} J</dd></div>
          <div><dt>Speed v</dt><dd>{fmtV(G.v)}</dd></div>
          <div><dt>v / c</dt><dd>{frac(G.v)}</dd></div>
          <div><dt>Momentum p</dt><dd>{sci(G.p)} kg m s⁻¹</dd></div>
          <div><dt>Radius r</dt><dd>{plain(G.r * 100)} cm</dd></div>
          <div class="wide"><dt>Time for one circle</dt><dd>{sci(G.T)} s</dd></div>
        {:else if prefs.kind === 'linac'}
          <div><dt>Energy gained per gap</dt><dd>{eV(prefs.linV * 1e3)}</dd></div>
          <div><dt>Energy out</dt><dd>{eV(Lc.last.KE / E)}</dd></div>
          <div><dt>in joules</dt><dd>{sci(Lc.last.KE)} J</dd></div>
          <div><dt>Speed out (true)</dt><dd>{frac(Lc.last.vT)} c</dd></div>
          <div><dt>First tube</dt><dd>{plain(Lc.tubes[0].LT * linK)} {linUnit}</dd></div>
          <div><dt>Last tube</dt><dd>{plain(Lc.last.LT * linK)} {linUnit}</dd></div>
          <div class="wide"><dt>Time in each tube (½ period)</dt><dd>{sci(Lc.half)} s</dd></div>
        {:else if prefs.kind === 'cyclo'}
          <div><dt>Frequency f</dt><dd>{plain(Cy.f / 1e6)} MHz</dd></div>
          <div><dt>Period T</dt><dd>{sci(Cy.T)} s</dd></div>
          <div><dt>Energy out</dt><dd>{eV(Cy.KE / E)}</dd></div>
          <div><dt>in joules</dt><dd>{sci(Cy.KE)} J</dd></div>
          <div><dt>Speed out</dt><dd>{fmtV(Cy.vmax)}</dd></div>
          <div><dt>v / c</dt><dd>{plain(Cy.vmax / C)}</dd></div>
          <div><dt>Turns</dt><dd>{Math.round(Cy.turns).toLocaleString('en-GB')}</dd></div>
          <div><dt>Momentum out</dt><dd>{sci(Cy.pmax)} kg m s⁻¹</dd></div>
        {:else}
          <div><dt>Energy per proton</dt><dd>{eV(prefs.syncE * 1e9)}</dd></div>
          <div><dt>Collision energy</dt><dd>{eV(Sy.coll * 1e9)}</dd></div>
          <div><dt>Momentum p</dt><dd>{sci(Sy.p)} kg m s⁻¹</dd></div>
          <div><dt>Dipole field B</dt><dd>{plain(Sy.B)} T</dd></div>
          <div><dt>Speed</dt><dd>c × (1 − {sci(Sy.lag, 2)})</dd></div>
          <div><dt>Laps per second</dt><dd>{Math.round(Sy.frev).toLocaleString('en-GB')}</dd></div>
        {/if}
        <div class="wide"><dt>de Broglie wavelength λ = h/p</dt><dd>{sci(H / pNow)} m {H / pNow < NUCLEON ? '(smaller than a nucleon)' : '(bigger than a nucleon, 10⁻¹⁵ m)'}</dd></div>
      </dl>
    </section>
  </aside>

  <section class="panel explain full" aria-label="How it works">
    {#key prefs.kind}
      <div class="ex-body swap">
        {#if prefs.kind === 'gun'}
          <h3>Electron gun and fine-beam tube <small>thermionic emission · eV = ½mv² · r = p/BQ</small></h3>
          <p>A current heats the filament until some of its free electrons have enough kinetic energy to escape the metal: <b>thermionic emission</b>. The p.d. between the filament (the cathode) and the anode accelerates them; they pass through the hole in the anode as a narrow beam. In the tube, low-pressure gas glows where the electrons hit its atoms, so you can see the path.</p>
          <p>The coils give a uniform magnetic field at right angles to the beam. The force on each electron, F = Bev, is always at right angles to its velocity: it does no work, so the speed stays the same, and it provides the centripetal force, so the beam goes round in a circle.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>Thermionic emission: heating a metal gives free electrons enough energy to leave its surface.</li>
            <li>Work done by the p.d. = gain in kinetic energy: eV = ½mv², so v = √(2eV/m).</li>
            <li>In a magnetic field perpendicular to its velocity a charge feels F = BQv, perpendicular to v: speed constant, path a circle.</li>
            <li>BQv = mv²/r gives r = mv/BQ = p/BQ: more p.d. (faster) → bigger circle; stronger field → smaller circle.</li>
            <li>Fleming’s left-hand rule gives the force direction; for electrons the current is opposite to their motion.</li>
            <li>An electric field (plates with E = V/d) can also deflect the beam: F = eE, a parabola, not a circle.</li>
          </ul></div>
        {:else if prefs.kind === 'linac'}
          <h3>Linear accelerator <small>drift tubes · alternating p.d. · L = v/2f</small></h3>
          <p>A line of hollow metal drift tubes is connected alternately to the two terminals of a high-frequency alternating p.d. Inside a tube there is no electric field, so a particle coasts at constant speed. It is accelerated only across the gaps.</p>
          <p>While the particle is inside a tube the p.d. reverses, so each time it reaches a gap the tube behind it repels it and the tube ahead attracts it. It gains energy QV at every gap. It spends exactly half a period in each tube, and it is getting faster, so each tube must be longer than the last.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>Particles are accelerated in the gaps by the electric field; inside the tubes there is no field and the speed is constant.</li>
            <li>The p.d. alternates so that it reverses while the particle is inside a tube: at each gap it is pushed from behind and pulled from in front.</li>
            <li>Each gap adds QV of kinetic energy: after n gaps Eₖ = nQV.</li>
            <li>Time in each tube = half the period of the p.d. = 1/2f, so the tube length is L = v/2f: the tubes get longer as the particles speed up.</li>
            <li>Close to the speed of light the speed barely rises (the energy still does), so the tubes for electrons end up almost the same length. <span class="beyond">relativity: beyond the spec</span></li>
          </ul></div>
        {:else if prefs.kind === 'cyclo'}
          <h3>Cyclotron <small>dees · r = p/BQ · f = BQ/2πm</small></h3>
          <p>Two hollow D-shaped electrodes, the dees, sit in a vacuum between the poles of a strong magnet. Inside a dee there is no electric field: the magnetic force BQv provides the centripetal force and the particle goes round a semicircle. Each time it crosses the gap the alternating p.d. accelerates it, so each semicircle is bigger than the last: it spirals outwards until a deflector steers it out.</p>
          <p>The time for a half-turn is πr/v = πm/BQ, which does not depend on the speed or the radius: a fast particle goes round a bigger semicircle in the same time. So an alternating p.d. of fixed frequency f = BQ/2πm stays in step with it the whole way out.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>A uniform magnetic field perpendicular to the dees makes the particles move in semicircles; an alternating p.d. across the gap accelerates them twice every turn.</li>
            <li>BQv = mv²/r gives r = p/BQ: the radius grows as the particles speed up, so they spiral outwards.</li>
            <li>Period T = 2πm/BQ and frequency f = BQ/2πm are the same at every radius, so a fixed-frequency p.d. keeps in step.</li>
            <li>The maximum energy is set by the radius of the dees: v = BQR/m, so Eₖ = (BQR)²/2m.</li>
            <li>Number of turns = Eₖ/2QV (two gap crossings per turn).</li>
            <li>At high speeds the particle’s mass effectively increases, it takes longer per turn and drifts out of step; synchrocyclotrons and synchrotrons change the frequency or field to follow it. <span class="beyond">beyond the spec</span></li>
          </ul></div>
        {:else}
          <h3>Synchrotron: the Large Hadron Collider <small>fixed radius · B = p/QR · colliding beams</small></h3>
          <p>A synchrotron keeps its particles on a ring of fixed radius. Radio-frequency (RF) cavities accelerate them a little on every lap; bending magnets steer them round. Since r = p/BQ, as the momentum rises the magnetic field has to rise with it, in step (synchronised), to keep r the same. At the LHC, protons are injected at 450 GeV and ramped to 6.8 TeV in about 20 minutes, while the dipole field rises to about 8 T.</p>
          <p>The protons are already moving at over 0.999 99 c when they arrive: the extra energy hardly changes their speed. Two beams go round in opposite directions and are brought into head-on collision inside the detectors. <span class="beyond">synchrotrons: beyond the spec; r = p/BQ is in it</span></p>
          <div class="facts"><b>Key facts</b><ul>
            <li>r = p/BQ with r fixed: B must increase in proportion to the momentum: B = p/QR.</li>
            <li>Electric fields (RF cavities) increase the energy; magnetic fields change only the direction, because the magnetic force is perpendicular to the velocity.</li>
            <li>Near the speed of light, extra energy increases the momentum and mass-energy, not the speed.</li>
            <li>Head-on collisions of two beams make all their energy available to create new particles (ΔE = c²Δm); with a fixed target much of it must stay as kinetic energy. <span class="beyond">beyond the spec</span></li>
          </ul></div>
        {/if}
      </div>
    {/key}
    <div class="cols2">
      <div>
        <h3 class="gh">Working with these numbers</h3>
        <div class="work wk">
          {#if prefs.kind === 'gun'}
            <div class="eq">Eₖ = eV = 1.60 × 10⁻¹⁹ × {prefs.gunV} = {sci(G.KE)} J</div>
            <div class="eq">½mv² = eV → v = √(2eV/m) = √(2 × {sci(G.KE)} ÷ 9.11 × 10⁻³¹) = {fmtV(G.v)}</div>
            <div class="eq">Bev = mv²/r → r = mv/Be = (9.11 × 10⁻³¹ × {sci(G.v)}) ÷ ({sci(G.B)} × 1.60 × 10⁻¹⁹) = {sci(G.r)} m = {plain(G.r * 100)} cm</div>
            <div class="eq">{G.fits ? `Diameter ${plain(G.r * 200)} cm: the circle fits in the 16 cm bulb.` : `Diameter ${plain(G.r * 200)} cm: too big for the 16 cm bulb, so the beam hits the glass. Increase B or lower V.`}</div>
            <div class="eq">v/c = {frac(G.v)}: far below c, so ½mv² is accurate here.</div>
          {:else if prefs.kind === 'linac'}
            {@const t1 = Lc.tubes[0]}
            <div class="eq">Each gap: ΔEₖ = QV = 1.60 × 10⁻¹⁹ × {sci(Lc.V)} = {sci(Lc.q * Lc.V)} J</div>
            <div class="eq">After {prefs.linN} gaps: Eₖ = nQV = {prefs.linN} × {sci(Lc.q * Lc.V)} = {sci(Lc.last.KE)} J = {eV(Lc.last.KE / E)}</div>
            <div class="eq">Time in each tube = T/2 = 1/2f = 1 ÷ (2 × {sci(Lc.f)}) = {sci(Lc.half)} s</div>
            <div class="eq">First tube: v = √(2QV/m) = {fmtV(t1.vN)}{Math.abs(t1.vN / t1.vT - 1) > REL ? ` (true speed ${fmtV(t1.vT)})` : ''}, so L = v/2f = {plain(t1.LT * linK)} {linUnit}</div>
            <div class="eq">Last tube: v = {fmtV(Lc.last.vT)}, L = v/2f = {plain(Lc.last.LT * linK)} {linUnit}</div>
            <div class="eq">In the 3D view each tube is drawn a little shorter than v/2f: the {plain(LP.g * linK)} {linUnit} gaps take some of the half-period, so it is the distance from one gap’s centre to the next that is v/2f.</div>
            {#if Lc.firstOff}
              <div class="eq warnq">From gap {Lc.firstOff}, ½mv² = Eₖ gives the wrong speed{Lc.tubes.some((t) => t.vN > C) ? ' (it even says faster than light, which is impossible)' : ''}. The true speed {Lc.last.vT / C > 0.95 ? 'is almost c, so the tubes stop getting longer: each is about c/2f = ' + plain((C / (2 * Lc.f)) * linK) + ' ' + linUnit : 'grows more slowly'}. <span class="beyond">relativity</span></div>
            {/if}
          {:else if prefs.kind === 'cyclo'}
            <div class="eq">BQv = mv²/r → r = mv/BQ; half a turn takes πr/v = πm/BQ: the same at every radius</div>
            <div class="eq">f = BQ/2πm = ({plain(prefs.cycB)} × {qName}) ÷ (2π × {sci(Cy.m)}) = {sci(Cy.f)} Hz = {plain(Cy.f / 1e6)} MHz</div>
            <div class="eq">At r = R: v = BQR/m = {fmtV(Cy.vmax)}</div>
            <div class="eq">Eₖ = ½mv² = (BQR)²/2m = {sci(Cy.KE)} J = {eV(Cy.KE / E)}</div>
            <div class="eq">Turns = Eₖ ÷ 2QV = {sci(Cy.KE)} ÷ (2 × {sci(Cy.q * Cy.V)}) = {Math.round(Cy.turns).toLocaleString('en-GB')}</div>
            <div class="eq {Cy.slip > REL ? 'warnq' : ''}">Eₖ/mc² = {plain(Cy.slip * 100, 2)}%{Cy.slip > REL ? ': the particle is relativistic, its period grows by this fraction and it falls out of step with a fixed f' : ': still non-relativistic, the fixed frequency works'}. <span class="beyond">relativity</span></div>
          {:else}
            <div class="eq">At these energies E ≈ pc: p = E/c = ({sci(prefs.syncE * 1e9)} × 1.60 × 10⁻¹⁹) ÷ 3.00 × 10⁸ = {sci(Sy.p)} kg m s⁻¹</div>
            <div class="eq">r = p/BQ → B = p/QR = {sci(Sy.p)} ÷ (1.60 × 10⁻¹⁹ × {LHC_R}) = {plain(Sy.B)} T</div>
            <div class="eq">λ = h/p = 6.63 × 10⁻³⁴ ÷ {sci(Sy.p)} = {sci(H / Sy.p)} m</div>
            <div class="eq warnq">½mv² would give v = √(2E/m) = {plain(Math.sqrt((2 * Sy.KE) / 1.67e-27) / C)} c: impossible. The true speed is c × (1 − {sci(Sy.lag, 2)}). <span class="beyond">relativity</span></div>
          {/if}
        </div>
      </div>
      <div class="plotbox">
        {#if prefs.kind === 'gun'}
          <h3 class="gh">Radius of the beam against p.d. at {plain(prefs.gunB)} mT</h3>
          <Plot xr={[0, 500]} yr={[0, Math.max(gunLimit * 1.3, gunCurve[60][1] * 1.05)]} xLabel="V / V" yLabel="r / cm" curve={gunCurve} trace h={250}
            series={[{ color: 'var(--ch2)', pts: [[0, gunLimit], [500, gunLimit]], name: 'largest that fits' }]}
            now={{ x: prefs.gunV, y: G.r * 100 }} label="Radius of the electron beam against accelerating p.d." />
          <p class="why">r ∝ √V (since v ∝ √V). The red line is the largest circle that fits in the bulb.</p>
        {:else if prefs.kind === 'linac'}
          <h3 class="gh">Length of each drift tube</h3>
          <Plot xr={[0, prefs.linN + 1]} yr={[0, linMax]} xLabel="tube number" yLabel="L / {linUnit}" h={250}
            series={[
              { color: 'var(--ch2)', pts: Lc.tubes.map((t) => [t.k, Math.min(t.LN, 3 * t.LT) * linK] as [number, number]), name: '½mv²' },
              { color: 'var(--ch1)', pts: Lc.tubes.map((t) => [t.k, t.LT * linK] as [number, number]), name: 'true' },
            ]}
            points={Lc.tubes.map((t) => ({ x: t.k, y: t.LT * linK }))} label="Drift tube length against tube number" />
          <p class="why">Blue: the real lengths. Red: what ½mv² = nQV predicts (capped on the graph); {Lc.firstOff ? 'the two part company once the speed is a sizeable fraction of c.' : 'here they agree, so only one line shows: the particles are far below c.'}</p>
        {:else if prefs.kind === 'cyclo'}
          <h3 class="gh">Kinetic energy against radius</h3>
          <Plot xr={[0, prefs.cycR * 1.05]} yr={[0, cycCurve[60][1] * 1.12]} xLabel="r / m" yLabel="Eₖ / MeV" curve={cycCurve} trace h={250}
            now={{ x: prefs.cycR, y: Cy.KE / E / 1e6 }} label="Kinetic energy against radius in the cyclotron" />
          <p class="why">Eₖ = (BQr)²/2m: doubling the dee radius gives four times the energy. α particles: twice the charge, four times the mass, so the same B gives half the frequency.</p>
        {:else}
          <h3 class="gh">Dipole field against beam energy</h3>
          <Plot xr={[0, 7.2]} yr={[0, 9]} xLabel="E / TeV" yLabel="B / T" curve={syncCurve} trace h={250}
            now={{ x: prefs.syncE / 1000, y: Sy.B }} label="Bending field against proton energy at the LHC" />
          <p class="why">B ∝ p, and p ∝ E at these energies: a straight line through the origin.</p>
        {/if}
      </div>
    </div>
  </section>

  {#if prefs.kind === 'sync'}
    <section class="panel full" aria-label="Why such high energies">
      <div class="ph"><h2>Why such high energies?</h2></div>
      <div class="cols2 why-hi">
        <div>
          <h3 class="gh">1 · To see inside a nucleon</h3>
          <p class="note">To resolve a structure, the de Broglie wavelength of the probing particle, λ = h/p, must be about the size of the structure or smaller. A nucleon is about 10⁻¹⁵ m across.</p>
          <div class="eq">λ = 10⁻¹⁵ m needs p = h/λ = 6.63 × 10⁻¹⁹ kg m s⁻¹, E ≈ pc = {sci(nucleonE)} J ≈ {eV(nucleonE / E)}</div>
          <div class="eq">This beam: λ = {sci(H / Sy.p)} m, about {short(NUCLEON / (H / Sy.p), 2)} times smaller than a nucleon</div>
          <p class="why">This is why the quarks inside the proton were first seen (SLAC, 1968) with electrons of about 20 GeV.</p>
        </div>
        <div>
          <h3 class="gh">2 · To make heavy particles</h3>
          <p class="note">New particles are made from the energy of the collision: ΔE = c²Δm. To create a particle of mass m there must be at least mc² of energy available.</p>
          <ul class="hlist">
            {#each [['Z boson', 91.19], ['Higgs boson', HIGGS_GEV], ['top–antitop pair', 345.1]] as [n, gev] (n)}
              <li><b>{n}</b> needs {short(gev as number, 4)} GeV · <span class={Sy.coll >= (gev as number) ? 'okq' : 'noq'}>{Sy.coll >= (gev as number) ? 'possible at this energy' : 'not enough energy'}</span></li>
            {/each}
          </ul>
          <div class="eq">Collision energy here: 2 × {eV(prefs.syncE * 1e9)} = {eV(Sy.coll * 1e9)}; Higgs: Δm = 125 GeV/c² = {sci((HIGGS_GEV * 1e9 * E) / (C * C))} kg</div>
          <p class="why">In practice only a fraction of the energy goes to the quarks and gluons that actually collide, which is why the Higgs needed the LHC.</p>
        </div>
      </div>
    </section>
  {/if}
</main>
