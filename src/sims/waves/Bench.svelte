<script lang="ts" module>
  import { SETS, type Medium, type MediumSet } from './bench';
  export interface BenchPrefs {
    medium: Medium;
    sets: Record<Medium, MediumSet>;    // amplitude, frequency, speed and time scale, kept per medium
    pulse: boolean;
    P: number; Q: number;               // marker rest positions, as fractions of the length shown
    pressure: boolean;
    ghost: boolean;
  }
  export const BENCH: BenchPrefs = { medium: 'rope', sets: SETS, pulse: false, P: 0.2, Q: 0.6, pressure: true, ghost: true };
</script>

<script lang="ts">
  /* Waves: one progressive wave on a rope (transverse), a slinky or in air (longitudinal), in 3D, with two tagged
     particles P and Q, the phase difference between them, and the two graphs every exam asks about: displacement
     against distance (a snapshot of the whole wave) and displacement against time (one particle, over time). Spec
     2.3, statements 33–37, 39 and 40. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { BLook, BenchScene } from './bench3d';
  import type { Stage3D } from '../particles/gl';
  import { MEDIA, disp, grad, aLimit, phaseOf, phaseWords, piText, aText, lenText, timeText, type WaveSpec } from './bench';
  import { plain } from './consts';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: BenchPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  // older saved prefs may lack a medium's settings
  $effect.pre(() => {
    if (!prefs.sets || typeof prefs.sets !== 'object') prefs.sets = structuredClone(SETS);
    for (const k of Object.keys(SETS) as Medium[]) if (!prefs.sets[k] || !Number.isFinite(prefs.sets[k].f)) prefs.sets[k] = { ...SETS[k] };
    if (!MEDIA[prefs.medium]) prefs.medium = 'rope';
  });

  const M = $derived(MEDIA[prefs.medium] ?? MEDIA.rope);
  const S = $derived(prefs.sets?.[prefs.medium] ?? SETS[prefs.medium] ?? SETS.rope);
  const long = $derived(M.kind === 'longitudinal');
  const lam = $derived(S.v / S.f);
  const T = $derived(1 / S.f);
  // a slinky's coils mustn't pass through each other: cap the amplitude
  const aMax = $derived(prefs.medium === 'slinky' ? Math.min(M.A[1], Math.floor(aLimit(S.f, S.v) / M.A[2]) * M.A[2]) : M.A[1]);
  $effect(() => { if (S.A > aMax) S.A = Math.max(M.A[0], aMax); });
  const A = $derived(Math.min(S.A, aMax));
  /** world units per metre of displacement: true scale, except sound, drawn so the largest amplitude is readable */
  const sxw = $derived(12 / M.L);
  const gain = $derived(prefs.medium === 'air' ? (sxw * 0.85 * aLimit(S.f, S.v)) / M.A[1] : sxw);
  const exagg = $derived(gain / sxw);

  /* ---------- the clock ---------- */
  let t = $state(0);
  let t0 = $state(-1e3);
  let pulses = $state<number[]>([]);
  let playing = $state(!RM);
  const scale = $derived(10 ** S.slow);
  let raf = 0, last = 0;
  function frame(now: number) {
    const g = frameReady(now, last);
    if (g !== 'go') { if (g === 'hidden') last = now; raf = off ? 0 : requestAnimationFrame(frame); return; }
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (playing) t += dt * scale;
    raf = off ? 0 : requestAnimationFrame(frame);
  }
  $effect(() => { if (!off && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } });
  onDestroy(() => cancelAnimationFrame(raf));
  // keep the time base sensible for each medium: restart the clock (wave already filling the medium) on a change
  let lastMed = '';
  $effect(() => { if (prefs.medium !== lastMed) { lastMed = prefs.medium; t = 0; t0 = -1e3 * T; pulses = []; } });
  function restart() { t0 = t; pulses = []; }
  function sendPulse() { pulses = [...pulses.filter((p) => t - p < (M.L / S.v) + T), t]; if (!playing) playing = true; }
  function step() { playing = false; t += T / 16; }

  const w = $derived<WaveSpec>({ A, f: S.f, v: S.v, pulse: prefs.pulse, t0, pulses });
  const P = $derived(prefs.P * M.L);
  const Q = $derived(prefs.Q * M.L);

  /* ---------- 3D ---------- */
  let scene: BenchScene | null = null;
  function onscene(s: Stage3D<BLook> | null) { scene = s as BenchScene | null; scene?.setTime(t); }
  // read t first: with scene still null, `scene?.setTime(t)` would skip t, leaving the effect with no dependency
  $effect(() => { const now = t; scene?.setTime(now); });
  const look = $derived<BLook>({ medium: prefs.medium, L: M.L, w, gain, P, Q, pressure: prefs.pressure, ghost: prefs.ghost });

  /* ---------- phase between P and Q ---------- */
  const dx = $derived(Q - P);
  const phi = $derived(phaseOf(dx, lam));
  const words = $derived(phaseWords(phi));
  function setQ(frac: number) { const q = P + frac * lam; if (q <= M.L) prefs.Q = q / M.L; else if (P - frac * lam >= 0) prefs.Q = (P - frac * lam) / M.L; }

  /* ---------- the graphs ---------- */
  const GW = 520, GH = 230, ML = 52, MR = 14, MT = 18, MB = 40;
  const yTop = $derived(M.A[1] * 1.15);
  const gy = (s: number) => MT + (GH - MT - MB) / 2 - (s / yTop) * ((GH - MT - MB) / 2);
  const gx = (m: number) => ML + (m / M.L) * (GW - ML - MR);
  const N = 200;
  const xPath = $derived(Array.from({ length: N + 1 }, (_, i) => { const m = (i / N) * M.L; return `${i ? 'L' : 'M'}${gx(m).toFixed(1)} ${gy(disp(m, t, w)).toFixed(1)}`; }).join(''));
  // pressure (∝ −∂s/∂x), scaled to the same height as the displacement
  const pPath = $derived(long ? Array.from({ length: N + 1 }, (_, i) => { const m = (i / N) * M.L; const k = (2 * Math.PI) / lam; return `${i ? 'L' : 'M'}${gx(m).toFixed(1)} ${gy(-grad(m, t, w) / k).toFixed(1)}`; }).join('') : '');
  // compressions (s falling through zero) and rarefactions (s rising through zero) at this instant
  const marksCR = $derived.by(() => {
    if (!long || prefs.pulse) return [] as { m: number; c: boolean }[];
    const out: { m: number; c: boolean }[] = [];
    const base = t - t0;
    for (let n = Math.floor(S.f * base) + 2; n > Math.floor(S.f * base) - 40; n--) {
      for (const [h, c] of [[0, true], [0.5, false]] as const) {
        const m = S.v * (base - (n + h) / S.f);
        if (m > 0.01 * M.L && m < 0.99 * M.L) out.push({ m, c });
      }
    }
    return out;
  });
  // a crest for the A label and the λ bracket on the graph
  const crest = $derived.by(() => {
    if (prefs.pulse) return null;
    const base = t - t0, off = long ? 0 : 0.25, want = 0.06 * M.L;
    const n = Math.ceil(S.f * (base - want / S.v) - off - 1e-9);
    let x1 = S.v * (base - (n + off) / S.f);
    while (x1 < want) x1 += lam;
    while (x1 - lam >= want) x1 -= lam;
    const xc = S.v * (base - (Math.ceil(S.f * (base - want / S.v) - 0.25 - 1e-9) + 0.25) / S.f);
    let c = xc; while (c < want) c += lam; while (c - lam >= want) c -= lam;
    return { x1, x2: x1 + lam, c };
  });

  // displacement–time: an oscilloscope-style sweep of 2.5 periods, restarting at the left
  const span = $derived(2.5 * T);
  const sweep0 = $derived(Math.floor(t / span) * span);
  const tx = (s: number) => ML + (s / span) * (GW - ML - MR);
  const tPath = (m: number) => {
    const n = Math.max(2, Math.round(((t - sweep0) / span) * N));
    return Array.from({ length: n + 1 }, (_, i) => { const s = ((t - sweep0) * i) / n; return `${i ? 'L' : 'M'}${tx(s).toFixed(1)} ${gy(disp(m, sweep0 + s, w)).toFixed(1)}`; }).join('');
  };
  const pT = $derived(tPath(P));
  const qT = $derived(tPath(Q));
  const tTicks = $derived(Array.from({ length: 6 }, (_, i) => (i * T) / 2));

  const pAmp = $derived(1.2 * 340 * 2 * Math.PI * S.f * A); // ρvωA, air only

  $effect(() => {
    stats = [['λ', lenText(lam)], ['T', timeText(T)], ['P → Q', words ?? `${Math.round((phi * 180) / Math.PI)}°`]];
  });

  const slowLabel = $derived(scale >= 0.999 ? 'real speed' : scale >= 0.01 ? `${plain(scale, 2)} × real speed` : `slowed ${Math.round(1 / scale).toLocaleString()} times`);

  /* Kernel hooks */
  export function kSetPlaying(on: boolean) { playing = on; }
  export function kStep() { step(); }
  export function kRestart() { restart(); }
  export function kSendPulse() { sendPulse(); }
  export function kSetQ(frac: number) { setQ(frac); }
  export function kReadouts() {
    return { playing, M, S, A, aMax, lam, T, P, Q, dx, phi, words, pAmp };
  }
</script>

<main class="layout bench" hidden={off}>
  <section class="panel stage" aria-label="The wave in 3D">
    <div class="stage-head">
      <div class="label-chip"><small>{M.kind} wave</small><span>{M.name}</span></div>
      <div class="stage-tools">
        <Seg label="Medium" options={[['rope', 'Rope', 'Rope'], ['slinky', 'Slinky', 'Slinky'], ['air', 'Sound in air', 'Air']]} bind:value={prefs.medium} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./bench3d').then((m) => m.BenchScene)} {look} {onscene}
          label="3D view of a wave travelling along the chosen medium, with two marked particles P and Q. Drag to turn it.">
          <div class="hud tl"><b>λ = {lenText(lam)}</b><span>{long ? 'particles move along the direction of travel' : 'particles move at right angles to the direction of travel'}</span></div>
          <div class="hud tr"><b>wave travels →</b><span>{slowLabel}</span></div>
          <div class="hud bl">{prefs.medium === 'air' ? `Displacements drawn ${Math.round(exagg).toLocaleString()} times larger (real amplitude ${aText(A, 'μm')}). ` : ''}Each particle only oscillates about its rest position: energy travels, the medium does not.</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      <button class="btn" type="button" onclick={step} aria-label="Step forward one sixteenth of a period">Step</button>
      <Seg label="Source" options={[['wave', 'Continuous', 'Wave'], ['pulse', 'Pulses', 'Pulse']]} value={prefs.pulse ? 'pulse' : 'wave'} onchange={(v) => { prefs.pulse = v === 'pulse'; restart(); }} />
      {#if prefs.pulse}
        <button class="btn" type="button" onclick={sendPulse}>Send a pulse</button>
      {:else}
        <button class="btn" type="button" onclick={restart}>Start from the source</button>
      {/if}
      <label class="ctl scrub"><span class="ctl-l">Time <b>{slowLabel}</b></span>
        <input class="slider" type="range" min={M.slow[0]} max={M.slow[1]} step="0.05" bind:value={S.slow} aria-label="Time scale" /></label>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="The wave">
      <div class="ph"><h2>The wave</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Amplitude A <b>{aText(A, M.aUnit)}</b></span>
          <input class="slider" type="range" min={M.A[0]} max={aMax} step={M.A[2]} bind:value={S.A} /></label>
        <label class="ctl"><span class="ctl-l">Frequency f <b>{plain(S.f, 3)} Hz</b></span>
          <input class="slider" type="range" min={M.f[0]} max={M.f[1]} step={M.f[2]} bind:value={S.f} /></label>
        <label class="ctl"><span class="ctl-l">Wave speed v <b>{plain(S.v, 3)} m s⁻¹</b></span>
          <input class="slider" type="range" min={M.v[0]} max={M.v[1]} step={M.v[2]} bind:value={S.v} /></label>
        {#if prefs.medium === 'slinky' && aMax < M.A[1]}<p class="why sm">Amplitude capped at {aText(aMax, 'cm')} here: any more and neighbouring coils would pass through each other.</p>{/if}
        {#if prefs.medium === 'air'}<p class="why sm">Sound’s speed is set by the air (about 340 m s⁻¹ at room temperature), not by the loudspeaker: change f and λ changes instead.</p>{/if}
      </div>
      <dl class="reads pad">
        <div><dt>Wavelength λ = v/f</dt><dd>{lenText(lam)}</dd></div>
        <div><dt>Period T = 1/f</dt><dd>{timeText(T)}</dd></div>
        <div><dt>Amplitude A</dt><dd>{aText(A, M.aUnit)}</dd></div>
        <div><dt>Wavelengths shown</dt><dd>{plain(M.L / lam, 2)}</dd></div>
        {#if prefs.medium === 'air'}<div class="wide"><dt>Pressure amplitude ≈ ρvωA <span class="beyond">beyond the spec</span></dt><dd>{plain(pAmp, 2)} Pa</dd></div>{/if}
      </dl>
      <div class="work">
        <div class="eq">v = fλ ⇒ λ = v/f = {plain(S.v, 3)} ÷ {plain(S.f, 3)} = {lenText(lam)}</div>
        <div class="eq">T = 1/f = 1 ÷ {plain(S.f, 3)} = {timeText(T)}</div>
      </div>
    </section>

    <section class="panel" aria-label="Phase between P and Q">
      <div class="ph"><h2>Phase: P and Q</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l"><span><span class="mk cp">P</span> at</span> <b>{lenText(P)}</b></span>
          <input class="slider" type="range" min="0" max="1" step="0.0025" bind:value={prefs.P} /></label>
        <label class="ctl"><span class="ctl-l"><span><span class="mk cq">Q</span> at</span> <b>{lenText(Q)}</b></span>
          <input class="slider" type="range" min="0" max="1" step="0.0025" bind:value={prefs.Q} /></label>
        <div class="picker flat" role="group" aria-label="Place Q">
          <button type="button" class="fchip" onclick={() => setQ(0.25)}>Q = P + λ/4</button>
          <button type="button" class="fchip" onclick={() => setQ(0.5)}>Q = P + λ/2</button>
          <button type="button" class="fchip" onclick={() => setQ(1)}>Q = P + λ</button>
        </div>
      </div>
      <dl class="reads pad">
        <div><dt>Separation Δx</dt><dd>{lenText(Math.abs(dx))}</dd></div>
        <div><dt>Δx / λ</dt><dd>{plain(Math.abs(dx) / lam, 3)}</dd></div>
        <div><dt>Phase difference</dt><dd>{piText(phi)} rad</dd></div>
        <div><dt>In degrees</dt><dd>{Math.round((phi * 180) / Math.PI)}°</dd></div>
        <div class="wide"><dt>So P and Q are</dt><dd class="txt">{words ?? (prefs.pulse ? 'not on a continuous wave: a pulse has no phase' : 'neither in phase nor in antiphase')}</dd></div>
      </dl>
      <div class="work">
        <div class="eq">φ = 2πΔx/λ = 2π × {plain(Math.abs(dx), 3)} ÷ {plain(lam, 3)} = {plain((2 * Math.PI * Math.abs(dx)) / lam, 3)} rad{(2 * Math.PI * Math.abs(dx)) / lam >= 2 * Math.PI ? ` → ${piText(phi)} after whole cycles` : ''}</div>
        <div class="eq">A crest takes Δx/v = {timeText(Math.abs(dx) / S.v)} to go from {dx >= 0 ? 'P to Q' : 'Q to P'}{dx !== 0 ? `, so ${dx >= 0 ? 'Q' : 'P'} lags by that much` : ''}</div>
      </div>
    </section>
  </aside>

  <section class="panel full" aria-label="Graphs">
    <div class="ph"><h2>Two graphs of the same wave</h2>
      {#if long}
        <div class="stage-tools">
          <button type="button" class="fchip" aria-pressed={prefs.pressure} onclick={() => (prefs.pressure = !prefs.pressure)}>Pressure</button>
          <button type="button" class="fchip" aria-pressed={prefs.ghost} onclick={() => (prefs.ghost = !prefs.ghost)}>Drawn sideways</button>
        </div>
      {/if}
    </div>
    <div class="cols2">
      <div>
        <h3 class="gh">Displacement against distance <small>a snapshot</small></h3>
        <svg class="logplot wplot" viewBox="0 0 {GW} {GH}" role="img" aria-label="Displacement against distance along the medium at this instant">
          <line class="ax" x1={ML} x2={GW - MR} y1={gy(0)} y2={gy(0)} />
          <line class="ax" x1={ML} x2={ML} y1={MT} y2={GH - MB} />
          <text class="tk" x={ML - 6} y={gy(A)} text-anchor="end">+{aText(A, M.aUnit).split(' ')[0]}</text>
          <text class="tk" x={ML - 6} y={gy(-A)} text-anchor="end">−{aText(A, M.aUnit).split(' ')[0]}</text>
          <text class="tk" x={ML - 6} y={gy(0)} text-anchor="end">0</text>
          {#each Array.from({ length: Math.round(M.L / (M.L <= 2 ? 0.5 : 1)) + 1 }, (_, i) => i * (M.L <= 2 ? 0.5 : 1)) as m (m)}
            <line class="gl" x1={gx(m)} x2={gx(m)} y1={MT} y2={GH - MB} />
            <text class="tk" x={gx(m)} y={GH - MB + 14} text-anchor="middle">{m}</text>
          {/each}
          <text class="al" x={GW - MR} y={GH - 6} text-anchor="end">x / m</text>
          <text class="al" x={12} y={MT + 2} transform="rotate(-90 12 {MT + 2})" text-anchor="end">s / {M.aUnit}</text>
          {#if long && prefs.pressure}<path class="press" d={pPath} />{/if}
          {#each marksCR as k (k.m.toFixed(4) + k.c)}
            <text class="cr {k.c ? 'c' : 'r'}" x={gx(k.m)} y={MT + 4} text-anchor="middle">{k.c ? 'C' : 'R'}</text>
          {/each}
          <path class="wv" d={xPath} />
          {#if crest && crest.x2 < M.L}
            {@const yb = GH - MB - 10}
            <path class="brk" d="M{gx(crest.x1)} {yb - 6} V{yb} H{gx(crest.x2)} V{yb - 6}" />
            <text class="bl" x={(gx(crest.x1) + gx(crest.x2)) / 2} y={yb - 5} text-anchor="middle">λ</text>
          {/if}
          {#if crest && !long && crest.c < M.L}
            <path class="amp" d="M{gx(crest.c)} {gy(0)} V{gy(A)}" />
            <text class="bl" x={gx(crest.c) + 6} y={(gy(0) + gy(A)) / 2} >A</text>
          {/if}
          <line class="mkl cp" x1={gx(P)} x2={gx(P)} y1={MT} y2={GH - MB} />
          <line class="mkl cq" x1={gx(Q)} x2={gx(Q)} y1={MT} y2={GH - MB} />
          <circle class="dot cp" cx={gx(P)} cy={gy(disp(P, t, w))} r="5" />
          <circle class="dot cq" cx={gx(Q)} cy={gy(disp(Q, t, w))} r="5" />
        </svg>
        {#if long}
          <p class="why lg">For a longitudinal wave, s is the displacement <i>along</i> the direction of travel (to the right is positive). C marks a compression, where the graph crosses zero going <b>down</b>: particles on the left are pushed right, particles on the right pushed left, so they crowd together. R marks a rarefaction (crossing going up). {prefs.pressure ? 'Dashed: the excess pressure, highest at the compressions, a quarter of a wavelength away from the largest displacements.' : ''}</p>
        {:else}
          <p class="why lg">Every particle at once, at one instant: a picture of the rope. The distance from one crest to the next is the wavelength λ; the height of a crest above the rest position is the amplitude A.</p>
        {/if}
      </div>
      <div>
        <h3 class="gh">Displacement against time <small>particles P and Q</small></h3>
        <svg class="logplot wplot" viewBox="0 0 {GW} {GH}" role="img" aria-label="Displacement of P and Q against time">
          <line class="ax" x1={ML} x2={GW - MR} y1={gy(0)} y2={gy(0)} />
          <line class="ax" x1={ML} x2={ML} y1={MT} y2={GH - MB} />
          <text class="tk" x={ML - 6} y={gy(A)} text-anchor="end">+{aText(A, M.aUnit).split(' ')[0]}</text>
          <text class="tk" x={ML - 6} y={gy(-A)} text-anchor="end">−{aText(A, M.aUnit).split(' ')[0]}</text>
          <text class="tk" x={ML - 6} y={gy(0)} text-anchor="end">0</text>
          {#each tTicks as s, i (i)}
            <line class="gl" x1={tx(s)} x2={tx(s)} y1={MT} y2={GH - MB} />
            <text class="tk" x={tx(s)} y={GH - MB + 14} text-anchor="middle">{i === 0 ? '0' : i % 2 === 0 ? `${i / 2}T` : `${i}T/2`}</text>
          {/each}
          <text class="al" x={GW - MR} y={GH - 6} text-anchor="end">t (T = {timeText(T)})</text>
          <text class="al" x={12} y={MT + 2} transform="rotate(-90 12 {MT + 2})" text-anchor="end">s / {M.aUnit}</text>
          <path class="wv cq" d={qT} />
          <path class="wv cp" d={pT} />
          {#if !prefs.pulse}
            {@const yb = GH - MB - 10}
            <path class="brk" d="M{tx(T * 0.5)} {yb - 6} V{yb} H{tx(T * 1.5)} V{yb - 6}" />
            <text class="bl" x={tx(T)} y={yb - 5} text-anchor="middle">T</text>
          {/if}
        </svg>
        <p class="why lg">One particle over time: the distance between peaks on this graph is the period T, not the wavelength. <span class="mk cp">P</span> and <span class="mk cq">Q</span> trace the same curve, shifted: Q {dx >= 0 ? 'lags' : 'leads'} by Δx/v = {timeText(Math.abs(dx) / S.v)}, which is {plain(phi / (2 * Math.PI), 2)} of a period after whole cycles.</p>
      </div>
    </div>
  </section>

  <section class="panel full explain" aria-label="Words and key facts">
    <div class="cols2 bcols">
      <div>
        <h3 class="gh">The words, exactly</h3>
        <dl class="gloss">
          <div><dt>Amplitude</dt><dd>The maximum displacement of a particle from its equilibrium (rest) position.</dd></div>
          <div><dt>Frequency</dt><dd>The number of complete oscillations per second (of a particle, or of the source); unit hertz, Hz.</dd></div>
          <div><dt>Period</dt><dd>The time for one complete oscillation: T = 1/f.</dd></div>
          <div><dt>Wavelength</dt><dd>The distance between two adjacent points oscillating in phase, e.g. crest to crest or compression to compression.</dd></div>
          <div><dt>Wave speed</dt><dd>The distance the wave (the energy) travels per second: v = fλ, because the wave moves one wavelength in one period.</dd></div>
          <div><dt>Wavefront</dt><dd>A line or surface joining points that are in phase, e.g. along a crest. Wavefronts are one wavelength apart and at right angles to the direction the wave travels.</dd></div>
          <div><dt>Phase difference</dt><dd>How far one oscillation is ahead of or behind another, as a fraction of a cycle, in radians or degrees: φ = 2πΔx/λ for two points Δx apart on the same wave.</dd></div>
        </dl>
      </div>
      <div>
        <h3 class="gh">Transverse or longitudinal?</h3>
        <div class="tl-table" role="table" aria-label="Transverse and longitudinal waves compared">
          <div class="tr" role="row"><span role="columnheader"></span><b role="columnheader">Transverse</b><b role="columnheader">Longitudinal</b></div>
          <div class="tr" role="row"><span role="rowheader">Particles oscillate</span><span role="cell">at right angles to the direction of travel</span><span role="cell">parallel to (along) the direction of travel</span></div>
          <div class="tr" role="row"><span role="rowheader">Pattern</span><span role="cell">crests and troughs</span><span role="cell">compressions and rarefactions: regions of higher and lower pressure</span></div>
          <div class="tr" role="row"><span role="rowheader">Polarised?</span><span role="cell">can be <a href="#light">plane polarised</a></span><span role="cell">never: there is only one direction to oscillate in</span></div>
          <div class="tr" role="row"><span role="rowheader">Examples</span><span role="cell">{MEDIA.rope.examples}</span><span role="cell">{MEDIA.slinky.examples}</span></div>
        </div>
        <div class="facts">
          <b>Key facts</b>
          <ul>
            <li>A progressive wave transfers energy from place to place without transferring matter: each particle returns to where it started.</li>
            <li>The speed of a wave is set by the medium; the frequency is set by the source. Change f and λ changes so that v = fλ still holds.</li>
            <li>Points one whole wavelength apart (or any whole number of wavelengths) are in phase; points half a wavelength apart are in antiphase (φ = π rad = 180°).</li>
            <li>In a sound wave the pressure is highest at a compression, where the displacement is zero; the particles with the largest displacement sit where the pressure is normal.</li>
            <li>Sound needs a medium; electromagnetic waves don’t, and travel through a vacuum at c = 3.00 × 10⁸ m s⁻¹.</li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</main>
