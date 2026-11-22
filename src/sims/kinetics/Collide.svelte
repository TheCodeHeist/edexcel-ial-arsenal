<script lang="ts" module>
  export interface CollidePrefs {
    mode: 'gas' | 'solid';
    T: number;            // K
    n: number;            // particles in the box (concentration)
    vol: number;          // fraction of the box below the piston
    lump: boolean;        // solid: one lump or a powder
    cat: boolean;
    T2: number;           // second temperature for the comparison curve (0: off)
    hist: boolean; mag: boolean;
  }
  export const COLLIDE: CollidePrefs = { mode: 'gas', T: 300, n: 120, vol: 1, lump: true, cat: false, T2: 0, hist: true, mag: false };
</script>

<script lang="ts">
  /* Collisions: collision theory (spec 9.1, 9.2), the Maxwell–Boltzmann distribution and temperature (9.4), and a
     catalyst on the same curve (9.8). A real box of colliding particles: change the temperature, the concentration,
     the pressure or the surface area, or add a catalyst, and count the collisions and the successful ones. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import CollideMB from './CollideMB.svelte';
  import type { CLook, CollideScene } from './collide3d';
  import { EA, EA_CAT, fracAbove, peakE } from './collide';
  import { plain } from './consts';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: CollidePrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);
  let seq = $state(0);

  /* ---------- reading the box ---------- */
  let scene: CollideScene | null = null;
  let live = $state({ hits: 0, wins: 0, A: 0, B: 0, P: 0, exposed: 0 });
  let energies = $state<number[]>([]);
  let buf: number[][] = [];
  const timer = setInterval(() => {
    if (off || !scene || scene.dead) return;
    const s = scene.sim, r = s.rates(), c = s.counts();
    live = { hits: r.hits, wins: r.wins, A: c.A, B: c.B, P: c.P, exposed: prefs.mode === 'solid' ? s.exposed() : 0 };
    if (prefs.hist) { buf.push(s.energies()); if (buf.length > 25) buf.shift(); energies = buf.flat(); }
  }, 400);
  onDestroy(() => clearInterval(timer));
  $effect(() => { void prefs.T; void prefs.n; void prefs.mode; void prefs.lump; void seq; buf = []; });

  const ea = $derived(prefs.cat ? EA_CAT : EA);
  const above = $derived(fracAbove(ea, prefs.T));
  const share = $derived(live.hits > 0 ? live.wins / live.hits : 0);
  const conc = $derived(prefs.mode === 'gas' ? prefs.n / 120 / prefs.vol : 1);
  const press = $derived(prefs.mode === 'gas' ? (prefs.n / 120) * (prefs.T / 300) / prefs.vol : 1);
  const realRatio = $derived(fracAbove(50, prefs.T + 10) / fracAbove(50, prefs.T));

  const look = $derived<CLook>({ mode: prefs.mode, T: prefs.T, n: prefs.n, vol: prefs.vol, lump: prefs.lump, cat: prefs.cat, playing, seq });
  $effect(() => {
    stats = [['T', `${prefs.T} K`], ['Successful', `${plain(live.wins, 2)} s⁻¹`], ['E ≥ Ea', `${plain(above * 100, 2)}%`]];
  });
  const eas = $derived(prefs.cat ? [{ E: EA, name: 'Ea', tone: 'a' as const }, { E: EA_CAT, name: 'Ea (catalysed)', tone: 'b' as const }] : [{ E: EA, name: 'Ea', tone: 'a' as const }]);
  const T2 = $derived(prefs.T2 ? prefs.T2 : null);
  $effect.pre(() => { if (prefs.T2 && prefs.T2 === prefs.T) prefs.T2 = prefs.T + 100 > 700 ? prefs.T - 100 : prefs.T + 100; });
</script>

<main class="layout kn-collide" hidden={off}>
  <section class="panel stage" aria-label="The particle box">
    <div class="stage-head">
      <div class="label-chip"><small>{prefs.mode === 'gas' ? 'Two gases' : 'A solid in acid'}</small>
        <span>{prefs.mode === 'gas' ? 'A + B → products' : prefs.lump ? 'One lump of the solid' : 'The same solid as a powder'}</span></div>
      <div class="stage-tools">
        <Seg label="Experiment" options={[['gas', 'Gases: T, concentration, pressure', 'Gases'], ['solid', 'Solid: surface area', 'Solid']]} bind:value={prefs.mode} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./collide3d').then((m) => m.CollideScene)} {look} onscene={(s) => (scene = s as CollideScene | null)}
          label="3D box of moving particles. Drag to turn it.">
          <div class="hud tl"><b>{plain(live.wins, 2)} successful collisions s⁻¹</b><span>of {plain(live.hits, 3)} {prefs.mode === 'gas' ? 'A–B collisions' : 'hits on the solid'} s⁻¹</span></div>
          <div class="hud tr">
            {#if prefs.mode === 'gas'}<span><i class="dot a"></i>A {live.A}</span><span><i class="dot b"></i>B {live.B}</span><span><i class="dot p"></i>products {live.P}</span>
            {:else}<span><i class="dot s"></i>solid {live.A}</span><span><i class="dot b"></i>acid (in excess)</span><span>{live.exposed} faces exposed</span>{/if}
          </div>
          <div class="hud bl">Flash: E ≥ Ea, they react. Blue spark: E &lt; Ea, they bounce apart. Ea is scaled down so you can watch it happen.</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button class="btn" type="button" onclick={() => seq++}>Start again</button>
      <label class="ctl scrub"><span class="ctl-l">Temperature <b>{prefs.T} K ({prefs.T - 273} °C)</b></span>
        <input class="slider" type="range" min="200" max="700" step="10" bind:value={prefs.T} /></label>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Conditions">
      <div class="ph"><h2>Conditions</h2></div>
      <div class="ctls">
        {#if prefs.mode === 'gas'}
          <label class="ctl"><span class="ctl-l">Particles (concentration) <b>{prefs.n}</b></span>
            <input class="slider" type="range" min="40" max="240" step="20" bind:value={prefs.n} /></label>
          <label class="ctl"><span class="ctl-l">Piston: volume <b>{Math.round(prefs.vol * 100)}%</b></span>
            <input class="slider" type="range" min="0.35" max="1" step="0.05" bind:value={prefs.vol} /></label>
        {:else}
          <div class="ctl"><span class="ctl-l">The solid (same mass)</span>
            <Seg label="Solid" options={[['lump', 'One lump'], ['powder', 'Powder']]} value={prefs.lump ? 'lump' : 'powder'} onchange={(v) => (prefs.lump = v === 'lump')} /></div>
          <label class="ctl"><span class="ctl-l">Acid particles <b>{prefs.n}</b></span>
            <input class="slider" type="range" min="40" max="240" step="20" bind:value={prefs.n} /></label>
        {/if}
        <div class="ctl"><span class="ctl-l">Catalyst</span>
          <div class="picker flat" role="group" aria-label="Catalyst">
            <button type="button" class="fchip" aria-pressed={!prefs.cat} onclick={() => (prefs.cat = false)}>None · Ea {EA}</button>
            <button type="button" class="fchip t-acidbase" aria-pressed={prefs.cat} onclick={() => (prefs.cat = true)}>Added · Ea {EA_CAT}</button>
          </div>
        </div>
      </div>
      <dl class="reads pad nocase">
        <div><dt>Collisions s⁻¹</dt><dd>{plain(live.hits, 3)}</dd></div>
        <div><dt>Successful s⁻¹</dt><dd>{plain(live.wins, 2)}</dd></div>
        <div><dt>Share that succeed</dt><dd>{live.hits ? `${plain(share * 100, 2)}%` : '–'}</dd></div>
        <div><dt>Molecules with E ≥ Ea</dt><dd>{plain(above * 100, 2)}%</dd></div>
        {#if prefs.mode === 'gas'}
          <div><dt>Concentration</dt><dd>× {plain(conc, 2)}</dd></div>
          <div><dt>Pressure</dt><dd>× {plain(press, 2)}</dd></div>
        {:else}
          <div><dt>Exposed faces</dt><dd>{live.exposed}</dd></div>
          <div><dt>Surface</dt><dd>{prefs.lump ? '1 lump' : '27 grains'}</dd></div>
        {/if}
      </dl>
      <p class="why pad2">Faster pairs meet more often, so the share of collisions that succeed is a little higher than the share of molecules beyond Ea.</p>
    </section>
  </aside>

  <section class="panel full" aria-label="Maxwell–Boltzmann distribution">
    <div class="ph"><h2>The Maxwell–Boltzmann distribution</h2></div>
    <div class="cols2">
      <div class="plotbox">
        <CollideMB T={prefs.T} {T2} {eas} hist={prefs.hist ? energies : null} mag={prefs.mag}
          label="Maxwell–Boltzmann distribution of molecular energies at {prefs.T} K with the activation energy marked" />
        <div class="picker flat mbctl" role="group" aria-label="What to show">
          <button type="button" class="fchip" aria-pressed={prefs.T2 !== 0} onclick={() => (prefs.T2 = prefs.T2 ? 0 : Math.min(700, prefs.T + 100) === prefs.T ? prefs.T - 100 : Math.min(700, prefs.T + 100))}>Compare a 2nd temperature</button>
          <button type="button" class="fchip" aria-pressed={prefs.hist} onclick={() => (prefs.hist = !prefs.hist)}>Particles in the box</button>
          <button type="button" class="fchip" aria-pressed={prefs.mag} onclick={() => (prefs.mag = !prefs.mag)}>Tail × 10</button>
        </div>
        {#if prefs.T2}
          <label class="ctl t2ctl"><span class="ctl-l">Second temperature <b>{prefs.T2} K</b></span>
            <input class="slider" type="range" min="200" max="700" step="10" bind:value={prefs.T2} /></label>
        {/if}
      </div>
      <div>
        <dl class="reads pad0 nocase">
          <div><dt>Most probable energy, ½RT</dt><dd>{plain(peakE(prefs.T), 3)} kJ mol⁻¹</dd></div>
          <div><dt>Fraction with E ≥ Ea</dt><dd>{plain(above * 100, 3)}%</dd></div>
          {#if T2}
            <div><dt>At {T2} K</dt><dd>{plain(fracAbove(ea, T2) * 100, 3)}%</dd></div>
            <div><dt>Ratio</dt><dd>× {plain(fracAbove(ea, T2) / above, 3)}</dd></div>
          {/if}
        </dl>
        <div class="facts"><b>Reading the curve</b><ul>
          <li>It starts at the origin: no molecules have zero energy.</li>
          <li>It has no maximum energy: the tail gets closer and closer to the axis but never meets it.</li>
          <li>The area under the curve is the total number of molecules, so it stays the same when T changes.</li>
          <li>At a higher temperature the peak is <strong>lower</strong> and moves to <strong>higher energy</strong>, and the curve is more spread out.</li>
          <li>Only the molecules in the shaded area, beyond Ea, can react when they collide.</li>
        </ul></div>
        <p class="why">The box is scaled: Ea here is {EA} kJ mol⁻¹. For a real reaction with Ea = 50 kJ mol⁻¹, warming from {prefs.T} K to {prefs.T + 10} K multiplies the fraction with E ≥ Ea by {plain(realRatio, 3)}: that is why a 10 K rise can roughly double a rate near room temperature.</p>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="What changes the rate">
    <div class="ph"><h2>What changes the rate, and why</h2></div>
    <div class="factors">
      <article class:on={prefs.mode === 'gas'}>
        <h4>Concentration</h4>
        <p>More particles in the same volume. The particles collide <b>more frequently</b> (more collisions per second), so there are more successful collisions per second. The fraction with E ≥ Ea does not change.</p>
      </article>
      <article class:on={prefs.mode === 'gas' && prefs.vol < 1}>
        <h4>Pressure (gases)</h4>
        <p>Squeezing the gas into a smaller volume puts the same particles closer together: the same as raising the concentration. <b>More frequent collisions</b>, so more successful collisions per second.</p>
      </article>
      <article class:on={prefs.mode === 'solid'}>
        <h4>Surface area</h4>
        <p>Only the particles on the surface of a solid can be hit. A powder has a much larger surface area than one lump of the same mass, so there are <b>more frequent collisions</b> with the solid.</p>
      </article>
      <article class:on={prefs.T2 !== 0 || prefs.T !== 300}>
        <h4>Temperature</h4>
        <p>The particles have more kinetic energy, so a <b>greater proportion of collisions have energy ≥ Ea</b> (the main effect). They also move faster and collide more often, but that is a much smaller effect.</p>
      </article>
      <article class:on={prefs.cat}>
        <h4>Catalyst</h4>
        <p>Provides an <b>alternative route with a lower activation energy</b>. The curve does not change, but the Ea line moves left, so a greater proportion of the molecules have E ≥ Ea and more collisions are successful.</p>
      </article>
    </div>
  </section>

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      <h3>Collision theory <small>spec 9.1, 9.2, 9.4, 9.8</small></h3>
      <div class="cols2 bare">
        <p>For particles to react they must collide, in the right orientation, with at least a minimum energy: the activation energy, Ea, the energy needed to start breaking bonds. Most collisions don’t have enough energy, so the particles just bounce apart. The rate depends on how often successful collisions happen: either more collisions per second, or a larger share of them with E ≥ Ea.</p>
        <div class="facts"><b>Exam phrases</b><ul>
          <li>Concentration, pressure, surface area: “more frequent collisions” (not “more collisions”).</li>
          <li>Temperature: “more molecules have energy greater than or equal to Ea, so a greater proportion of collisions are successful”.</li>
          <li>Catalyst: “alternative route with lower Ea, so more molecules have E ≥ Ea”; the catalyst is not used up.</li>
          <li>On an M–B sketch, label the axes: number of molecules with energy E, and energy.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
