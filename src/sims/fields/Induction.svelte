<script lang="ts" module>
  export interface IndPrefs {
    mode: IndMode;
    B: number;
    N: number;
    freq: number;
  }
  export const IND_PREFS: IndPrefs = { mode: 'generator', B: 0.4, N: 200, freq: 1.0 };
</script>

<script lang="ts">
  /* Electromagnetic Induction: 3D Magnet+Coil & AC Generator + live Faraday/Lenz flux & emf trace (WPH14). */
  import { onMount } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { IndLook } from './induction3d';
  import { genState, magnetState, IND_FACTS, type IndMode } from './induction';
  import { signed } from './consts';
  import { frameReady, isReducedMotion } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: IndPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!isReducedMotion());
  let t = $state(0);

  onMount(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const g = frameReady(now, last);
      if (g !== 'go') { if (g === 'hidden') last = now; raf = requestAnimationFrame(loop); return; }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!off && playing) t += dt;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  const AREA = 0.015; // m²
  const gen = $derived(genState(prefs.B, AREA, prefs.N, prefs.freq, t));
  const mag = $derived(magnetState(prefs.N, prefs.freq * 0.7, t));

  const fluxNow = $derived(prefs.mode === 'generator' ? gen.fluxLink : mag.fluxLink);
  const emfNow = $derived(prefs.mode === 'generator' ? gen.emf : mag.emf);
  const phase = $derived(prefs.mode === 'generator' ? gen.theta : 2 * Math.PI * prefs.freq * 0.7 * t);
  const emfNorm = $derived(prefs.mode === 'generator' ? gen.emf / Math.max(0.1, gen.peakEmf) : Math.max(-1, Math.min(1, mag.emf / 2)));

  const look = $derived<IndLook>({ mode: prefs.mode, phase, emfSign: emfNorm, turns: prefs.N });

  $effect(() => {
    stats = [
      ['NΦ', `${fluxNow.toFixed(2)} Wb`],
      ['Induced ε', `${signed(emfNow, 2)} V`],
      ['Peak ε₀', `${gen.peakEmf.toFixed(1)} V`],
    ];
  });

  // Dual trace SVG (NΦ and ε over one full cycle 0..2π)
  const X0 = 48, X1 = 532, YMID = 112, AMP = 68;
  const fluxPath = $derived(Array.from({ length: 81 }, (_, i) => {
    const u = i / 80, ph = u * Math.PI * 2;
    const val = prefs.mode === 'generator' ? Math.cos(ph) : Math.exp(-3.2 * Math.cos(ph) ** 2) * 2 - 1;
    return `${i ? 'L' : 'M'}${(X0 + u * (X1 - X0)).toFixed(1)} ${(YMID - val * AMP).toFixed(1)}`;
  }).join(' '));
  const emfPath = $derived(Array.from({ length: 81 }, (_, i) => {
    const u = i / 80, ph = u * Math.PI * 2;
    let val = Math.sin(ph);
    if (prefs.mode === 'magnet') {
      const x = Math.cos(ph);
      val = Math.max(-1, Math.min(1, -1.6 * x * Math.exp(-3.2 * x * x) * Math.sin(ph) * 2.2));
    }
    return `${i ? 'L' : 'M'}${(X0 + u * (X1 - X0)).toFixed(1)} ${(YMID - val * AMP).toFixed(1)}`;
  }).join(' '));
  const cursorX = $derived(X0 + (((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2) * (X1 - X0));
</script>

<main class="layout fl-ind" hidden={off}>
  <section class="panel stage" aria-label="3D electromagnetic induction">
    <div class="stage-head">
      <div class="label-chip">
        <small>Faraday’s &amp; Lenz’s laws</small>
        <span>{prefs.mode === 'generator' ? 'Rotating AC generator (ε = BANω sin ωt)' : 'Bar magnet plunging through a coil'}</span>
      </div>
      <div class="stage-tools">
        <Seg label="Experiment" options={[['generator', 'AC generator', 'Generator'], ['magnet', 'Magnet & coil', 'Magnet']]} bind:value={prefs.mode} />
      </div>
    </div>

    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./induction3d').then((m) => m.InductionScene)} {look} label="3D electromagnetic induction. Drag to rotate.">
          <div class="hud tl">
            <b>Induced ε = {signed(emfNow, 2)} V</b>
            <span>Flux linkage NΦ = {fluxNow.toFixed(2)} Wb</span>
          </div>
          <div class="hud tr">
            <span>Blue / amber coil glow = + / − induced current</span>
          </div>
          <div class="hud bl">Peak e.m.f. occurs where flux linkage changes fastest (steepest gradient d(NΦ)/dt)</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>

    <div class="playbar">
      <button type="button" class="btn primary playbtn" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <label class="ctl scrub">
        <span class="ctl-l">Frequency f <b>{prefs.freq.toFixed(1)} Hz</b></span>
        <input class="slider" type="range" min="0.2" max="2.5" step="0.1" bind:value={prefs.freq} />
      </label>
    </div>

    <div class="fl-trace">
      <div class="ph"><h2>Flux linkage NΦ (blue) &amp; induced e.m.f. ε (red)</h2></div>
      <div class="plotbox">
        <svg viewBox="0 0 560 212" class="fl-svg" role="img" aria-label="Flux linkage and induced emf waveforms">
          <line class="ax" x1={X0} x2={X1} y1={YMID} y2={YMID} />
          <line class="ax" x1={X0} x2={X0} y1="28" y2="194" />
          <text class="axlbl" x="10" y="16">NΦ / ε</text>
          <text class="axlbl" x={X1} y="204" text-anchor="end">One cycle (0 → 2π)</text>

          <path d={fluxPath} fill="none" stroke="var(--accent)" stroke-width="2.4" />
          <path d={emfPath} fill="none" stroke="var(--redox)" stroke-width="2.4" />
          <line x1={cursorX} x2={cursorX} y1="28" y2="194" stroke="var(--amph)" stroke-width="1.8" stroke-dasharray="4 3" />
        </svg>
      </div>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Coil controls">
      <div class="ph"><h2>Coil &amp; field</h2></div>
      <div class="ctls">
        <label class="ctl">
          <span class="ctl-l">Number of turns N <b>{prefs.N}</b></span>
          <input class="slider" type="range" min="50" max="500" step="25" bind:value={prefs.N} />
        </label>
        {#if prefs.mode === 'generator'}
          <label class="ctl">
            <span class="ctl-l">Magnetic flux density B <b>{prefs.B.toFixed(2)} T</b></span>
            <input class="slider" type="range" min="0.1" max="1.2" step="0.05" bind:value={prefs.B} />
          </label>
        {/if}
      </div>
      <div class="work">
        <div class="eq">ε = −d(NΦ) / dt</div>
        {#if prefs.mode === 'generator'}
          <div class="eq">ε₀ = B A N ω = {prefs.B.toFixed(2)} × {AREA} × {prefs.N} × {(2 * Math.PI * prefs.freq).toFixed(2)} = {gen.peakEmf.toFixed(2)} V</div>
        {/if}
      </div>
    </section>

    <section class="panel" aria-label="Key facts">
      <div class="ph"><h2>Key facts</h2></div>
      <div class="facts pad">
        <b>Exam points</b>
        <ul>
          {#each IND_FACTS[prefs.mode] as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
