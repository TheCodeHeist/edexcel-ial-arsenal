<script lang="ts" module>
  import type { Who } from './matter';
  export interface MatterPrefs {
    mode: 'annih' | 'pair';
    who: Who;            // annihilation: which pair
    pwho: Exclude<Who, 'n'>;   // pair production: which pair
    K: number;           // kinetic energy of each, as a fraction of mc²
    Eg: Record<'e' | 'mu' | 'p', number>;   // photon energy / MeV, for each pair
    B: number;           // T
    slow: number;        // log₁₀ real seconds per screen second
  }
  export const MATTER: MatterPrefs = { mode: 'annih', who: 'e', pwho: 'e', K: 0, Eg: { e: 6, mu: 330, p: 2400 }, B: 0.5, slow: -9.4 };
</script>

<script lang="ts">
  /* Annihilation and pair production (spec: ΔE = c²Δm for the creation and annihilation of matter and antimatter;
     antiparticles; MeV and MeV/c²). Annihilation: a particle meets its antiparticle and both become two photons, back
     to back. Pair production: a γ-ray near a nucleus becomes a particle and its antiparticle, if it has at least 2mc².
     On a real clock slowed down about a billion times; the numbers and working beside the view follow every event. */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { MLook, MatterScene } from './matter3d';
  import type { Stage3D } from './gl';
  import type { Event } from './matter';
  import { REST, WHO_NAME, WHO_SYM, fOf, lamOf, pMeV, radiusCm, speed } from './matter';
  import { MEV, MEVC2, C, sci, plain, short } from './data';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: MatterPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  // older saved prefs may lack a field
  $effect.pre(() => { if (!prefs.Eg || typeof prefs.Eg !== 'object') prefs.Eg = { ...MATTER.Eg }; if (!Number.isFinite(prefs.slow)) prefs.slow = MATTER.slow; });

  let playing = $state(!RM);
  let seq = $state(0);
  let ev = $state<Event | null>(null);

  const annih = $derived(prefs.mode === 'annih');
  const who = $derived<Who>(annih ? prefs.who : prefs.pwho);
  const m = $derived(REST[who]);
  const [nA, nB] = $derived(WHO_NAME[who]);
  const [sA, sB] = $derived(WHO_SYM[who]);
  const K = $derived(prefs.K * m);
  const Eg = $derived(prefs.Eg?.[prefs.pwho] ?? MATTER.Eg[prefs.pwho]);
  const EG_RANGE: Record<'e' | 'mu' | 'p', [number, number, number]> = { e: [0.5, 20, 0.01], mu: [150, 700, 1], p: [1500, 5000, 5] };
  const thr = $derived(2 * m);
  const below = $derived(!annih && Eg < thr);
  const Ephot = $derived(m + K);                      // each annihilation photon
  const Kt = $derived(Math.max(0, Eg - thr));

  const look = $derived<MLook>({ mode: prefs.mode, who, K, Eg, B: prefs.B, slow: prefs.slow, playing, seq });
  function onscene(s: Stage3D<MLook> | null) { const sc = s as MatterScene | null; if (sc) sc.onevent = (e) => (ev = e); }

  /* the last event's split of the kinetic energy (pair production) */
  const kp = $derived(ev?.kp ?? Kt / 2), km = $derived(ev?.km ?? Kt / 2);
  const rOf = (k: number) => radiusCm(pMeV(k, m), prefs.B);
  const rText = (k: number) => { const r = rOf(k); return !Number.isFinite(r) ? 'straight (B = 0)' : r >= 100 ? `${plain(r / 100, 3)} m` : `${plain(r, 3)} cm`; };

  /* slow motion */
  const scale = $derived(10 ** prefs.slow);
  const tText = (x: number) => (x >= 1e-9 ? `${plain(x * 1e9, 3)} ns` : `${plain(x * 1e12, 3)} ps`);
  const slowWords = $derived(1 / scale >= 1e9 ? `${short(1 / scale / 1e9, 2)} billion` : `${short(1 / scale / 1e6, 2)} million`);

  $effect(() => {
    stats = annih
      ? [['Pair', `${sA} + ${sB}`], ['Each photon', `${short(Ephot, 4)} MeV`], ['f', `${sci(fOf(Ephot), 3)} Hz`]]
      : [['Photon', `${short(Eg, 4)} MeV`], ['Threshold', `${short(thr, 4)} MeV`], ['Result', below ? 'nothing' : `${sA} + ${sB}`]];
  });

  /* energy bars: before and after, to the same scale */
  const bars = $derived.by(() => {
    type Bit = { w: number; cls: string; t: string };
    if (annih) {
      const tot = 2 * (m + K);
      const before: Bit[] = [{ w: m, cls: 'rest', t: `${sA} rest ${short(m, 4)}` }, ...(K > 0 ? [{ w: K, cls: 'ke', t: `Eₖ ${short(K, 3)}` }] : []), { w: m, cls: 'rest anti', t: `${sB} rest ${short(m, 4)}` }, ...(K > 0 ? [{ w: K, cls: 'ke', t: `Eₖ ${short(K, 3)}` }] : [])];
      const after: Bit[] = [{ w: m + K, cls: 'ph', t: `γ ${short(m + K, 4)}` }, { w: m + K, cls: 'ph', t: `γ ${short(m + K, 4)}` }];
      return { tot, before, after };
    }
    const tot = Math.max(Eg, thr);
    const before: Bit[] = [{ w: Eg, cls: 'ph', t: `γ ${short(Eg, 4)}` }];
    const after: Bit[] = below ? [{ w: Eg, cls: 'ph', t: 'γ passes through: not enough energy' }]
      : [{ w: m, cls: 'rest', t: `${sA} ${short(m, 4)}` }, { w: m, cls: 'rest anti', t: `${sB} ${short(m, 4)}` }, ...(Kt > 0 ? [{ w: km, cls: 'ke', t: `Eₖ ${short(km, 3)}` }, { w: kp, cls: 'ke', t: `Eₖ ${short(kp, 3)}` }] : [])];
    return { tot, before, after };
  });
  const ANN: Who[] = ['e', 'mu', 'p', 'n'], PAIRS: Who[] = ['e', 'mu', 'p'];
</script>

<main class="layout matter" hidden={off}>
  <section class="panel stage" aria-label="Annihilation and pair production">
    <div class="stage-head">
      <div class="label-chip"><small>{annih ? 'Matter + antimatter → energy' : 'Energy → matter + antimatter'}</small><span>{annih ? `${nA[0].toUpperCase() + nA.slice(1)}–${nB} annihilation` : `Pair production: ${sA} ${sB}`}</span></div>
      <div class="stage-tools">
        <Seg label="Process" options={[['annih', 'Annihilation', 'Annihilate'], ['pair', 'Pair production', 'Pair']]} bind:value={prefs.mode} onchange={() => (seq += 1)} />
      </div>
    </div>
    <div class="picker" role="group" aria-label="Particle and antiparticle">
      {#each annih ? ANN : PAIRS as w (w)}
        <button type="button" class="fchip" aria-pressed={who === w} onclick={() => { if (annih) prefs.who = w; else prefs.pwho = w as Exclude<Who, 'n'>; seq += 1; }}>{WHO_SYM[w][0]} {WHO_SYM[w][1]}<small class="mz">{short(2 * REST[w], 4)} MeV</small></button>
      {/each}
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./matter3d').then((mod) => mod.MatterScene)} {look} {onscene}
          label={annih ? 'A particle and its antiparticle meet and annihilate into two photons. Drag to turn the view.' : 'A gamma-ray photon passes a nucleus in a bubble chamber and makes a particle and its antiparticle, which curl opposite ways in the magnetic field. Drag to turn the view.'}>
          {#if annih}
            <div class="hud tl"><b>{sA} + {sB} → γ + γ</b><span>each photon: {short(Ephot, 4)} MeV, back to back</span></div>
            <div class="hud bl">Blue: matter · red: antimatter · wavy: photons. Grid: 1 cm.</div>
            {#if ev?.note}<div class="hud tr">{ev.note}</div>{:else if K === 0}<div class="hud tr">At rest: drawn drifting together so you can see them meet</div>{/if}
          {:else if below}
            <div class="hud tl"><b>γ → nothing</b><span>{short(Eg, 4)} MeV &lt; 2mc² = {short(thr, 4)} MeV</span></div>
            <div class="hud tr warn"><b>Below the threshold</b><span>the photon can’t make the pair’s rest mass</span></div>
          {:else}
            <div class="hud tl"><b>γ → {sA} + {sB}</b><span>{short(Kt, 4)} MeV left over as kinetic energy</span></div>
            <div class="hud bl">Red: positive · blue: negative · dashed: photons (no track). Grid: 1 cm.</div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button class="btn" type="button" onclick={() => { seq += 1; playing = true; }}>New event</button>
    </div>
    <div class="clock">
      <label class="ctl"><span class="ctl-l"><span>Slow motion: 1 s on screen = <b class="tt">{tText(scale)}</b> of real time</span><b>× 1/{slowWords}</b></span>
        <input class="slider" type="range" min="-10.3" max="-8.5" step="0.05" bind:value={prefs.slow} aria-label="Time scale: real time per second on screen" /></label>
      <p class="why">Everything moves at its true speed, only slowed down: light crosses the 30 cm chamber in 1 ns.</p>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Settings">
      <div class="ph"><h2>Settings</h2></div>
      <div class="ctls">
        {#if annih}
          <label class="ctl"><span class="ctl-l"><span>Kinetic energy of each, Eₖ</span><b>{K === 0 ? 'at rest' : `${short(K, 3)} MeV`}</b></span>
            <input class="slider" type="range" min="0" max="2" step="0.01" bind:value={prefs.K} onchange={() => (seq += 1)} /></label>
        {:else}
          <label class="ctl"><span class="ctl-l"><span>Photon energy, E = hf</span><b>{short(Eg, 4)} MeV</b></span>
            <input class="slider" type="range" min={EG_RANGE[prefs.pwho][0]} max={EG_RANGE[prefs.pwho][1]} step={EG_RANGE[prefs.pwho][2]} value={Eg}
              oninput={(e) => (prefs.Eg = { ...prefs.Eg, [prefs.pwho]: +e.currentTarget.value })} /></label>
          <label class="ctl"><span class="ctl-l"><span>Magnetic flux density, B</span><b>{plain(prefs.B, 2)} T</b></span>
            <input class="slider" type="range" min="0" max="2" step="0.05" bind:value={prefs.B} /></label>
        {/if}
      </div>
      <dl class="reads pad">
        <div><dt>Rest mass of each</dt><dd>{short(m, 4)} MeV/c²</dd></div>
        <div><dt>in kg</dt><dd>{sci(m * MEVC2, 3)} kg</dd></div>
        {#if annih}
          <div><dt>Each photon, E</dt><dd>{short(Ephot, 4)} MeV</dd></div>
          <div><dt>in J</dt><dd>{sci(Ephot * MEV, 3)} J</dd></div>
          <div><dt>Frequency, f = E/h</dt><dd>{sci(fOf(Ephot), 3)} Hz</dd></div>
          <div><dt>Wavelength, λ = c/f</dt><dd>{sci(lamOf(Ephot), 3)} m</dd></div>
          <div><dt>Speed of each before</dt><dd>{K === 0 ? '≈ 0' : `${plain(speed(K, m) / C, 3)}c`}</dd></div>
          <div><dt>Total momentum</dt><dd>0 before, 0 after</dd></div>
        {:else}
          <div><dt>Threshold, 2mc²</dt><dd>{short(thr, 4)} MeV</dd></div>
          <div><dt>Longest λ that works</dt><dd>{sci(lamOf(thr), 3)} m</dd></div>
          <div><dt>Photon f</dt><dd>{sci(fOf(Eg), 3)} Hz</dd></div>
          <div><dt>Photon λ</dt><dd>{sci(lamOf(Eg), 3)} m</dd></div>
          {#if !below}
            <div><dt>{sA} Eₖ (this event)</dt><dd>{short(km, 3)} MeV</dd></div>
            <div><dt>{sB} Eₖ (this event)</dt><dd>{short(kp, 3)} MeV</dd></div>
            <div><dt>{sA} first radius</dt><dd>{rText(km)}</dd></div>
            <div><dt>{sB} first radius</dt><dd>{rText(kp)}</dd></div>
          {/if}
        {/if}
      </dl>
    </section>
    <section class="panel" aria-label="Working">
      <div class="ph"><h2>ΔE = c²Δm</h2></div>
      <div class="work">
        {#if annih}
          <div class="eq">Mass that disappears: 2 × {short(m, 4)} MeV/c² = {short(2 * m, 4)} MeV/c² = {sci(2 * m * MEVC2, 3)} kg</div>
          <div class="eq">ΔE = c²Δm = (3.00 × 10⁸)² × {sci(2 * m * MEVC2, 3)} = {sci(2 * m * MEV, 3)} J{K > 0 ? `, plus the kinetic energy 2 × ${short(K, 3)} MeV` : ''}</div>
          <div class="eq">Total {short(2 * (m + K), 4)} MeV, shared by two photons: {short(Ephot, 4)} MeV = {sci(Ephot * MEV, 3)} J each</div>
          <div class="eq">f = E/h = {sci(Ephot * MEV, 3)} ÷ 6.63 × 10⁻³⁴ = {sci(fOf(Ephot), 3)} Hz</div>
        {:else}
          <div class="eq">Mass to make: 2 × {short(m, 4)} MeV/c², so E ≥ 2mc² = {short(thr, 4)} MeV = {sci(thr * MEV, 3)} J</div>
          <div class="eq">f_min = E/h = {sci(thr * MEV, 3)} ÷ 6.63 × 10⁻³⁴ = {sci(fOf(thr), 3)} Hz; λ_max = c/f = {sci(lamOf(thr), 3)} m</div>
          {#if below}
            <div class="eq">This photon: {short(Eg, 4)} MeV &lt; {short(thr, 4)} MeV, so no pair can be made</div>
          {:else}
            <div class="eq">Left over: {short(Eg, 4)} − {short(thr, 4)} = {short(Kt, 4)} MeV, shared as kinetic energy</div>
            <div class="eq">Tracks: r = p/BQ, so the faster one curls less; opposite charges curl opposite ways</div>
          {/if}
        {/if}
      </div>
    </section>
  </aside>

  <section class="panel full" aria-label="Energy before and after">
    <div class="ph"><h2>Energy before and after</h2></div>
    <div class="plotbox">
      <div class="ebars" role="img" aria-label="Bars of energy before and after, to the same scale">
        {#each [['Before', bars.before], ['After', bars.after]] as const as [name, bits] (name)}
          <div class="erow">
            <span class="bl">{name}</span>
            <div class="etrack">
              {#each bits as b, i (i)}<span class="bit {b.cls}" style:flex-grow={b.w} title={b.t}><i>{b.t}</i></span>{/each}
              {#if bits.reduce((t, q) => t + q.w, 0) < bars.tot * 0.999}<span class="gap" style:flex-grow={bars.tot - bits.reduce((t, q) => t + q.w, 0)}></span>{/if}
            </div>
          </div>
        {/each}
      </div>
      <p class="why">Energies in MeV, to scale. {annih ? 'All of the rest energy and all of the kinetic energy become photon energy.' : below ? 'The photon’s energy is less than the rest energy of the pair.' : 'The photon’s energy becomes the rest energy of the pair; what is left over is their kinetic energy (the nucleus takes almost none).'}</p>
    </div>
  </section>

  <section class="panel full" aria-label="Key facts">
    <div class="cols2 ncols">
      <div class="facts">
        <b>Annihilation</b>
        <ul>
          <li>A particle meets its antiparticle: both disappear and their total energy (rest energy + kinetic energy) becomes photons. ΔE = c²Δm.</li>
          <li><b>Two photons, not one:</b> the total momentum before is zero (at rest), so the photons must go off in opposite directions with equal energies. One photon would carry momentum away.</li>
          <li>Electron + positron at rest: two γ-ray photons of 0.511 MeV each (f = 1.23 × 10²⁰ Hz).</li>
          <li>Charge, baryon number and lepton number are all zero before and after.</li>
          <li>A positron from β⁺ decay slows down and annihilates within a nanosecond or so: that is why positrons are so short-lived on Earth.</li>
          <li>PET scanners detect the two back-to-back 0.511 MeV photons to locate a β⁺ tracer in the body. <span class="beyond">beyond the spec</span></li>
        </ul>
      </div>
      <div class="facts">
        <b>Pair production</b>
        <ul>
          <li>A photon becomes a particle and its antiparticle: energy becomes mass. It needs E = hf ≥ 2mc² (1.022 MeV for an electron–positron pair).</li>
          <li>Any extra energy becomes the kinetic energy of the pair.</li>
          <li><b>It happens near a nucleus</b>, which takes up some momentum: a photon on its own in empty space can’t conserve energy and momentum at once.</li>
          <li>A pair always has opposite charges, so in a magnetic field the tracks curl in opposite directions from the same point; the photon itself leaves no track (it is uncharged).</li>
          <li>Matter is only ever made together with the same amount of antimatter: charge, baryon number and lepton number are conserved.</li>
          <li>The tracks spiral inwards because the particles lose energy ionising the liquid, so p and r = p/BQ fall. <span class="beyond">beyond the spec</span></li>
        </ul>
      </div>
    </div>
  </section>
</main>
