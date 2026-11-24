<script lang="ts" module>
  import type { RMode } from './ripple';
  export interface RipplePrefs {
    mode: RMode;
    f: number;            // dipper frequency / Hz
    d: number;            // source separation / cm
    phiDeg: number;       // source 2 leads source 1 by this / degrees
    gap: number;          // gap width / cm
    obs: number;          // obstacle width / cm
    shade: 'wave' | 'amp';
    coherent: boolean;
    lines: boolean;
    huygens: boolean;
    strobe: boolean;
    slow: number;         // log₁₀ of the time scale
    probe: [number, number];
    sup: 'same' | 'opp';
  }
  export const RIPPLE: RipplePrefs = {
    mode: 'two', f: 10, d: 8, phiDeg: 0, gap: 6, obs: 6, shade: 'wave', coherent: true, lines: true, huygens: true, strobe: false,
    slow: -0.7, probe: [6, 22], sup: 'same',
  };
</script>

<script lang="ts">
  /* Ripple tank: superposition, interference, coherence, path and phase difference (two dippers), and diffraction
     with Huygens' construction (a gap, an obstacle), in a 3D tank. Spec 2.3, statements 39, 40 and 50. Click the
     water to move the probe X. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { RLook, RippleScene } from './ripple3d';
  import type { Stage3D } from '../particles/gl';
  import { ZS, ZB, V, sources, ampAt, lineSet, hyperbola, lamText, type Setup } from './ripple';
  import { plain } from './consts';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: RipplePrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  $effect.pre(() => { if (!Array.isArray(prefs.probe) || prefs.probe.length !== 2) prefs.probe = [...RIPPLE.probe]; });

  const lambda = $derived((V * 100) / prefs.f);                 // cm
  const phi = $derived((prefs.phiDeg * Math.PI) / 180);
  const setup = $derived<Setup>({ mode: prefs.mode, lambda, d: prefs.d, phi, gap: prefs.gap, obs: prefs.obs });
  const src = $derived(sources(setup));

  /* ---------- clock ---------- */
  let t = $state(0);
  let playing = $state(!RM);
  let extra = $state([0, 0]);
  let hopAt = 0;
  const scale = $derived(10 ** prefs.slow);
  let raf = 0, last = 0;
  function frame(now: number) {
    const g = frameReady(now, last);
    if (g !== 'go') { if (g === 'hidden') last = now; raf = off ? 0 : requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) {
      t += dt * scale;
      if (!prefs.coherent && prefs.mode === 'two') {
        hopAt -= dt;
        if (hopAt <= 0) { hopAt = 0.25 + Math.random() * 0.35; extra = [Math.random() * Math.PI * 2, Math.random() * Math.PI * 2]; }
      }
    }
    raf = off ? 0 : requestAnimationFrame(frame);
  }
  $effect(() => { if (!off && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  $effect(() => { if (prefs.coherent) extra = [0, 0]; });
  onDestroy(() => cancelAnimationFrame(raf));
  const ph = $derived(prefs.strobe ? 1.1 : 2 * Math.PI * prefs.f * t);

  let scene: RippleScene | null = null;
  function onscene(s: Stage3D<RLook> | null) {
    scene = s as RippleScene | null;
    if (scene) { scene.onPick = (x, z) => { prefs.probe = [+x.toFixed(2), +z.toFixed(2)]; }; scene.setPhase(ph, extra); }
  }
  // read ph and extra first: with scene still null, `scene?.setPhase(...)` would skip them and the effect would never rerun
  $effect(() => { const p = ph, e = $state.snapshot(extra); scene?.setPhase(p, e); });
  const look = $derived<RLook>({
    mode: prefs.mode, lambda, d: prefs.d, phi, gap: prefs.gap, obs: prefs.obs,
    src: src.list, rmin: src.rmin, obl: src.obl,
    shade: prefs.shade, incoh: !prefs.coherent, lines: prefs.lines, huygens: prefs.huygens, probe: prefs.probe,
  });

  /* ---------- the probe ---------- */
  const px = $derived(prefs.probe[0]);
  const pz = $derived(prefs.probe[1]);
  const r1 = $derived(Math.hypot(px + prefs.d / 2, pz - ZS));
  const r2 = $derived(Math.hypot(px - prefs.d / 2, pz - ZS));
  const D = $derived(r1 - r2);
  const cyc = $derived.by(() => { const c = (D / lambda + prefs.phiDeg / 360) % 1; return c < 0 ? c + 1 : c; });
  const verdict = $derived.by(() => {
    if (prefs.mode !== 'two') return '';
    if (!prefs.coherent) return 'no steady pattern';
    const off0 = Math.min(cyc, 1 - cyc);
    if (off0 < 0.06) return 'constructive: a maximum';
    if (Math.abs(cyc - 0.5) < 0.06) return 'destructive: a minimum';
    return 'in between';
  });
  const here = $derived(ampAt(px, pz, setup, src));
  const one = $derived(Math.sqrt(lambda) / Math.sqrt(Math.max(src.rmin, r1)));      // one source alone at X (S1's distance)
  const theta = $derived((Math.atan2(px, pz - ZB) * 180) / Math.PI);
  const ahead = $derived(ampAt(0, ZB + Math.hypot(px, pz - ZB), setup, src).amp);
  const lines = $derived(lineSet(lambda, prefs.d, phi));
  const firstMin = $derived(lambda < prefs.gap ? (Math.asin(lambda / prefs.gap) * 180) / Math.PI : NaN);

  let pickMax = 0, pickMin = 0;
  function snap(kind: 'max' | 'min') {
    const set = kind === 'max' ? lines.max : lines.min;
    if (!set.length) return;
    const order = [...set].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
    const i = kind === 'max' ? pickMax++ % order.length : pickMin++ % order.length;
    const pts = hyperbola(order[i], prefs.d);
    const want = 22;
    const best = pts.reduce((a, b) => (Math.abs(b[1] - want) < Math.abs(a[1] - want) ? b : a), pts[0]);
    if (best) prefs.probe = [+best[0].toFixed(2), +best[1].toFixed(2)];
  }

  $effect(() => {
    stats = prefs.mode === 'two'
      ? [['λ', `${plain(lambda, 3)} cm`], ['Path difference', lamText(D, lambda)], ['At X', verdict]]
      : [['λ', `${plain(lambda, 3)} cm`], [prefs.mode === 'gap' ? 'Gap / λ' : 'Obstacle / λ', plain((prefs.mode === 'gap' ? prefs.gap : prefs.obs) / lambda, 2)], ['At X', `${plain(here.amp, 2)} × incident`]];
  });

  const slowLabel = $derived(prefs.strobe ? 'stroboscope: frozen' : scale >= 0.995 ? 'real speed' : `${plain(scale, 2)} × real speed`);

  /* ---------- superposition of two pulses on a string ---------- */
  const SW = 520, SH = 170;
  const sCyc = $derived((t * 0.35) % 1);                        // one meeting per cycle
  const pulse = (x: number) => Math.exp(-((x / 34) ** 2));
  const supY = (which: 0 | 1 | 2, x: number) => {
    const c = 40 + sCyc * (SW - 80);
    const a = pulse(x - c) * 46, b = pulse(x - (SW - c)) * 46 * (prefs.sup === 'same' ? 1 : -1);
    return which === 0 ? a : which === 1 ? b : a + b;
  };
    /** the pulse's path; the separate pulses (dashed) are drawn only where they are off the axis */
  const supPath = (w: 0 | 1 | 2) => {
    let out = '', pen = false;
    for (let i = 0; i <= 160; i++) {
      const x = (i / 160) * SW, y = supY(w, x);
      if (w !== 2 && Math.abs(y) < 0.6) { pen = false; continue; }
      out += `${pen ? 'L' : 'M'}${x.toFixed(1)} ${(SH / 2 - y).toFixed(1)}`;
      pen = true;
    }
    return out;
  };
  const sp0 = $derived((void sCyc, supPath(0)));
  const sp1 = $derived((void sCyc, void prefs.sup, supPath(1)));
  const sp2 = $derived((void sCyc, void prefs.sup, supPath(2)));

  /* ---------- Huygens' construction, drawn for a wide and a narrow gap ---------- */
  function huy(gap: number) {
    // a gap in a barrier at y = 70; plane wavefronts above it 16 apart; wavelets of radius 16 and 32 below
    const lam = 16, cx = 110, by = 70, pts = Math.max(3, Math.round(gap / 8) + 1);
    const src = Array.from({ length: pts }, (_, i) => cx - gap / 2 + (gap * i) / (pts - 1));
    const arcs: string[] = [], env: string[] = [];
    for (const r of [lam, 2 * lam, 3 * lam]) {
      for (const x of src) arcs.push(`M${x - r} ${by} A${r} ${r} 0 0 0 ${x + r} ${by}`);
      env.push(`M${cx - gap / 2 - r} ${by} A${r} ${r} 0 0 0 ${cx - gap / 2} ${by + r} H${cx + gap / 2} A${r} ${r} 0 0 0 ${cx + gap / 2 + r} ${by}`);
    }
    return { gap, cx, by, src, arcs, env, fronts: [by - lam, by - 2 * lam, by - 3 * lam] };
  }
  const HUY = [huy(96), huy(14)];
</script>

<main class="layout ripple" hidden={off}>
  <section class="panel stage" aria-label="The ripple tank">
    <div class="stage-head">
      <div class="label-chip"><small>Ripple tank</small><span>{prefs.mode === 'two' ? 'Two coherent sources' : prefs.mode === 'gap' ? 'Diffraction through a gap' : 'Diffraction round an obstacle'}</span></div>
      <div class="stage-tools">
        <Seg label="Set-up" options={[['two', 'Two sources', 'Two'], ['gap', 'Gap', 'Gap'], ['obstacle', 'Obstacle', 'Block']]} bind:value={prefs.mode} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./ripple3d').then((m) => m.RippleScene)} {look} {onscene}
          label="3D ripple tank. The water's surface shows the superposition of the waves. Click the water to move the probe X; drag to turn the view.">
          <div class="hud tl"><b>λ = {plain(lambda, 3)} cm</b><span>{prefs.shade === 'amp' ? 'colour: how much the water moves (time-averaged)' : 'bright: crests · dark: troughs'}</span></div>
          <div class="hud tr"><b>{slowLabel}</b><span>v = {plain(V, 2)} m s⁻¹, f = {plain(prefs.f, 3)} Hz</span></div>
          {#if prefs.mode === 'two' && !prefs.coherent}<div class="hud tr warn rp-incoh"><b>Not coherent</b><span>the phase difference keeps jumping: the pattern won’t stay still</span></div>{/if}
          <div class="hud bl">Click the water to move X. {prefs.mode === 'two' && prefs.lines ? 'Gold: antinodal lines (maxima); dashed pink: nodal lines (minima), labelled with r₁ − r₂.' : prefs.mode === 'gap' && prefs.huygens ? 'Pale arcs: Huygens wavelets; yellow: their envelope, the new wavefront.' : 'Reflections off the barrier and walls are left out.'}</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <Seg label="Show" options={[['wave', 'Waves', 'Waves'], ['amp', 'Time-averaged', 'Average']]} bind:value={prefs.shade} />
      <button type="button" class="fchip" aria-pressed={prefs.strobe} onclick={() => (prefs.strobe = !prefs.strobe)}>Stroboscope</button>
      {#if prefs.mode === 'two'}
        <button type="button" class="fchip" aria-pressed={prefs.lines} onclick={() => (prefs.lines = !prefs.lines)}>Lines</button>
      {:else if prefs.mode === 'gap'}
        <button type="button" class="fchip" aria-pressed={prefs.huygens} onclick={() => (prefs.huygens = !prefs.huygens)}>Huygens</button>
      {/if}
      <label class="ctl scrub"><span class="ctl-l">Time <b>{prefs.strobe ? 'frozen' : `× ${plain(scale, 2)}`}</b></span>
        <input class="slider" type="range" min="-2" max="0" step="0.05" bind:value={prefs.slow} aria-label="Time scale" disabled={prefs.strobe} /></label>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Set-up">
      <div class="ph"><h2>Set-up</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Dipper frequency f <b>{plain(prefs.f, 3)} Hz</b></span>
          <input class="slider" type="range" min="6" max="20" step="0.5" bind:value={prefs.f} /></label>
        {#if prefs.mode === 'two'}
          <label class="ctl"><span class="ctl-l">Source separation d <b>{plain(prefs.d, 3)} cm</b></span>
            <input class="slider" type="range" min="2" max="14" step="0.5" bind:value={prefs.d} /></label>
          <label class="ctl"><span class="ctl-l">S₂ leads S₁ by <b>{prefs.phiDeg}°</b></span>
            <input class="slider" type="range" min="0" max="360" step="15" bind:value={prefs.phiDeg} /></label>
          <div class="ctl">
            <span class="ctl-l">Sources</span>
            <Seg label="Coherence" options={[['c', 'Coherent', 'Coherent'], ['i', 'Not coherent', 'Incoherent']]} value={prefs.coherent ? 'c' : 'i'} onchange={(v) => (prefs.coherent = v === 'c')} />
          </div>
        {:else if prefs.mode === 'gap'}
          <label class="ctl"><span class="ctl-l">Gap width b <b>{plain(prefs.gap, 3)} cm = {plain(prefs.gap / lambda, 2)}λ</b></span>
            <input class="slider" type="range" min="1" max="18" step="0.5" bind:value={prefs.gap} /></label>
        {:else}
          <label class="ctl"><span class="ctl-l">Obstacle width <b>{plain(prefs.obs, 3)} cm = {plain(prefs.obs / lambda, 2)}λ</b></span>
            <input class="slider" type="range" min="1" max="16" step="0.5" bind:value={prefs.obs} /></label>
        {/if}
      </div>
      <dl class="reads pad">
        <div><dt>Wave speed v</dt><dd>{plain(V, 2)} m s⁻¹</dd></div>
        <div><dt>λ = v/f</dt><dd>{plain(lambda, 3)} cm</dd></div>
        {#if prefs.mode === 'two'}
          <div><dt>d / λ</dt><dd>{plain(prefs.d / lambda, 3)}</dd></div>
          <div><dt>Antinodal lines</dt><dd>{lines.max.length}</dd></div>
        {:else if prefs.mode === 'gap'}
          <div><dt>Spreading</dt><dd class="txt">{prefs.gap / lambda < 1.5 ? 'a lot: gap ≈ λ' : prefs.gap / lambda < 4 ? 'noticeable' : 'little: gap ≫ λ'}</dd></div>
          <div><dt>First minimum <span class="beyond">beyond the spec</span></dt><dd>{Number.isFinite(firstMin) ? `${plain(firstMin, 3)}°` : 'none'}</dd></div>
        {/if}
      </dl>
    </section>

    <section class="panel" aria-label="The probe">
      <div class="ph"><h2>Probe X</h2>
        {#if prefs.mode === 'two'}
          <div class="stage-tools">
            <button type="button" class="fchip" onclick={() => snap('max')}>On a maximum</button>
            <button type="button" class="fchip" onclick={() => snap('min')}>On a minimum</button>
          </div>
        {/if}
      </div>
      {#if prefs.mode === 'two'}
        <dl class="reads pad">
          <div><dt>S₁X = r₁</dt><dd>{plain(r1, 3)} cm</dd></div>
          <div><dt>S₂X = r₂</dt><dd>{plain(r2, 3)} cm</dd></div>
          <div><dt>Path difference</dt><dd>{plain(Math.abs(D), 3)} cm</dd></div>
          <div><dt>In wavelengths</dt><dd>{lamText(Math.abs(D), lambda)}</dd></div>
          <div><dt>Phase difference</dt><dd>{prefs.coherent ? `${Math.round(cyc * 360) % 360}°` : 'changing'}</dd></div>
          <div><dt>Amplitude</dt><dd>{prefs.coherent ? `${plain(here.amp / one, 2)} × one source` : '–'}</dd></div>
          <div class="wide"><dt>So at X the waves are</dt><dd class="txt v-{verdict.split(':')[0].replace(/ .*/, '')}">{verdict}</dd></div>
        </dl>
        <div class="work">
          <div class="eq">path difference = r₁ − r₂ = {plain(r1, 3)} − {plain(r2, 3)} = {plain(D, 3)} cm = {plain(D / lambda, 3)}λ</div>
          <div class="eq">phase difference = 2π × (path difference)/λ{prefs.phiDeg ? ` + ${prefs.phiDeg}° (the sources’ own)` : ''} = {plain((D / lambda) * 360 + prefs.phiDeg, 3)}° → {Math.round(cyc * 360)}° after whole cycles</div>
          <div class="eq">{prefs.phiDeg ? 'With the sources out of step, the conditions shift: maxima where the total phase difference is 0, 360°, …' : 'In-phase sources: maximum where r₁ − r₂ = nλ, minimum where r₁ − r₂ = (n + ½)λ'}</div>
        </div>
      {:else if pz <= ZB}
        <p class="note pad">X is in front of the {prefs.mode === 'gap' ? 'barrier' : 'obstacle'}, in the plane waves from the straight dipper. Click the water beyond it.</p>
      {:else}
        <dl class="reads pad">
          <div><dt>Angle from straight ahead</dt><dd>{plain(Math.abs(theta), 3)}°</dd></div>
          <div><dt>Distance from {prefs.mode === 'gap' ? 'the gap' : 'the obstacle'}</dt><dd>{plain(Math.hypot(px, pz - ZB), 3)} cm</dd></div>
          <div><dt>Amplitude at X</dt><dd>{plain(here.amp, 2)} × incident</dd></div>
          <div><dt>{prefs.mode === 'gap' ? 'Straight ahead, same distance' : 'Same distance, on the axis'}</dt><dd>{plain(ahead, 2)} × incident</dd></div>
        </dl>
        <div class="work">
          {#if prefs.mode === 'gap'}
            <div class="eq">b/λ = {plain(prefs.gap, 3)} ÷ {plain(lambda, 3)} = {plain(prefs.gap / lambda, 3)}: {prefs.gap / lambda < 1.5 ? 'the gap is about one wavelength, so the waves spread out almost in semicircles' : 'the wider the gap compared with λ, the less the waves spread'}</div>
            {#if Number.isFinite(firstMin)}<div class="eq">first minimum where sin θ = λ/b ⇒ θ = {plain(firstMin, 3)}° <span class="beyond">beyond the spec</span></div>{/if}
          {:else}
            <div class="eq">{prefs.obs / lambda < 2 ? 'An obstacle about a wavelength across hardly casts a shadow: the waves bend round it and meet again behind.' : 'A wide obstacle leaves a calm shadow behind it; the waves bend into its edges only a little.'}</div>
          {/if}
        </div>
      {/if}
    </section>
  </aside>

  <section class="panel full explain" aria-label="Superposition, Huygens and key facts">
    <div class="cols2 rcols">
      <div>
        <h3 class="gh">Superposition on a string</h3>
        <div class="rp-sup">
          <Seg label="Pulses" options={[['same', 'Same side', 'Same'], ['opp', 'Opposite sides', 'Opposite']]} bind:value={prefs.sup} />
        </div>
        <svg class="logplot sup" viewBox="0 0 {SW} {SH}" role="img" aria-label="Two pulses passing through each other on a string, and their sum">
          <line class="ax" x1="0" x2={SW} y1={SH / 2} y2={SH / 2} />
          <path class="p1" d={sp0} />
          <path class="p2" d={sp1} />
          <path class="ps" d={sp2} />
        </svg>
        <p class="why lg">Where two waves meet, the displacement is the sum of their displacements: the principle of superposition. {prefs.sup === 'same' ? 'Two crests add to a crest twice as tall: constructive.' : 'A crest and a trough cancel for an instant: destructive.'} Then each pulse carries on as if the other had never been there.</p>

        <h3 class="gh">Huygens’ construction</h3>
        <div class="huy">
          {#each HUY as h, i (i)}
            <figure>
              <svg viewBox="0 0 220 140" class="hfig" role="img" aria-label={i ? 'Narrow gap: wavelets spread into semicircles' : 'Wide gap: a flat wavefront with curved ends'}>
                {#each h.fronts as y (y)}<path class="front" d="M14 {y} H206" />{/each}
                <path class="bar" d="M4 {h.by} H{h.cx - h.gap / 2} M{h.cx + h.gap / 2} {h.by} H216" />
                {#each h.arcs as a, j (j)}<path class="wl" d={a} />{/each}
                {#each h.env as a, j (j)}<path class="env" d={a} />{/each}
                {#each h.src as x (x)}<circle class="hs" cx={x} cy={h.by} r="2.2" />{/each}
              </svg>
              <figcaption>{i ? 'Gap ≈ λ: the wavelets’ envelope is almost a semicircle' : 'Gap ≫ λ: a flat front, curved only at its ends'}</figcaption>
            </figure>
          {/each}
        </div>
        <p class="why lg">Every point on a wavefront acts as a source of secondary wavelets, spreading out at the wave’s speed. A short time later the new wavefront is the surface that touches them all (their envelope). In open water the wavelets’ edges cancel each other out; at a gap, the wavelets from the edge points have no neighbours beyond them to cancel against, so the wave bends into the shadow. The wavelength is unchanged.</p>
      </div>
      <div class="facts">
        <b>Key facts</b>
        <ul>
          <li><b>Superposition:</b> where waves meet, the resultant displacement is the vector sum of the individual displacements.</li>
          <li><b>Interference</b> is the steady pattern of maxima and minima produced by the superposition of waves from coherent sources.</li>
          <li><b>Coherent</b> sources have the same frequency and a constant phase difference. Two dippers on one bar, two loudspeakers on one signal generator, or one laser through two slits are coherent; two separate lamps are not.</li>
          <li><b>Path difference:</b> for sources in phase, a maximum (constructive) where the path difference is nλ, a minimum (destructive) where it is (n + ½)λ.</li>
          <li><b>Phase difference</b> = 2π × path difference / λ, in radians (or × 360° / λ in degrees): a path difference of λ/2 is a phase difference of π.</li>
          <li>For a clear minimum the two waves must also have similar amplitudes; otherwise they never cancel completely.</li>
          <li><b>Diffraction</b> is the spreading of a wave as it passes through a gap or round an obstacle. It is most obvious when the gap is about the same size as the wavelength. Wavelength, frequency and speed are all unchanged.</li>
          <li>The amplitude of circular ripples falls as they spread (as 1/√r: their energy is shared round a growing circle). <span class="beyond">beyond the spec</span></li>
        </ul>
      </div>
    </div>
  </section>
</main>
