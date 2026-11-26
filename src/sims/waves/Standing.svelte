<script lang="ts" module>
  import type { Reading, XAxis, TubeEnd } from './standing';
  export interface StandPrefs {
    mode: 'string' | 'sound' | 'tube';
    strobe: '0' | '0.25' | '0.5' | '1';
    // string (Core Practical 5)
    wire: string; mu: number; mass: number; l: number; f: number; parts: boolean;
    reads: Reading[]; ax: XAxis;
    // sound (Core Practical 4)
    fs: number; temp: number; mic: number; tb: string; v1: string; v2: string; marks: number[]; phase: boolean;
    // the air column
    tube: TubeEnd; L: number; ft: number;
  }
  export const STAND: StandPrefs = {
    mode: 'string', strobe: '0.5',
    wire: 'steel25', mu: 1e-3, mass: 0.2, l: 1.0, f: 20, parts: false, reads: [], ax: 'invl',
    fs: 2000, temp: 20, mic: 0.1, tb: '0.2', v1: '1', v2: '0.2', marks: [], phase: false,
    tube: 'closed', L: 0.5, ft: 160,
  };
</script>

<script lang="ts">
  /* Standing waves (spec 37, 41, 42; Core Practicals 4 and 5). Three benches: a string driven by a vibration
     generator (the exact damped steady state, so it only comes alive near f = nv/2l), the speed of sound with a
     loudspeaker, a microphone and a two-beam oscilloscope, and an air column. Readings go into tables and straight-line
     graphs the way the practical write-up wants them. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { StLook } from './standing3d';
  import { WIRES, tension, waveSpeed, f1Of, nearest, peakAmp, A0, XAXES, X_LABEL, xOf, fit, spread, soundSpeed, lagDeg, tubeF, niceTicks } from './standing';
  import { scopePaths, micAmp, DIV_X, DIV_Y } from './standingScope';
  import { sci, plain, short } from './consts';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: StandPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  /* ---------- the string ---------- */
  const wire = $derived(WIRES.find((w) => w.id === prefs.wire) ?? WIRES[2]);
  const mu = $derived(wire.id === 'custom' ? prefs.mu : wire.mu);
  const T = $derived(tension(prefs.mass));
  const v = $derived(waveSpeed(T, mu));
  const f1 = $derived(f1Of(v, prefs.l));
  const near = $derived(nearest(prefs.f, f1));
  const lam = $derived((2 * prefs.l) / near.n);
  const amp = $derived(peakAmp(prefs.f, v, prefs.l));
  const FMAX = 400;

  // sweep: raise f slowly from where it is and stop on the next resonance peak (how the practical is done)
  let sweeping = $state(false);
  let rose = false, raf = 0, last = 0;
  function sweep() {
    if (sweeping) { sweeping = false; return; }
    sweeping = true; rose = false; last = performance.now();
    raf = requestAnimationFrame(tickSweep);
  }
  function tickSweep(t: number) {
    const g = frameReady(t, last);
    if (g !== 'go') { if (g === 'hidden') last = t; raf = requestAnimationFrame(tickSweep); return; }
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    if (!sweeping || off) { sweeping = false; return; }
    const step = Math.max(0.01, Math.min(0.5, f1 * 0.003)) * (RM ? 3 : 1);
    let f = prefs.f;
    for (let i = 0; i < Math.max(1, Math.round(dt * 60)); i++) {
      const a = peakAmp(f, v, prefs.l), b = peakAmp(f + step, v, prefs.l);
      if (b > a) rose = true;
      else if (rose && a > 4 * A0) { prefs.f = Math.round(f * 100) / 100; sweeping = false; return; }
      f += step;
      if (f >= FMAX) { prefs.f = FMAX; sweeping = false; return; }
    }
    prefs.f = Math.round(f * 100) / 100;
    raf = requestAnimationFrame(tickSweep);
  }
  onDestroy(() => cancelAnimationFrame(raf));
  const nudge = (d: number) => { prefs.f = Math.max(1, Math.min(FMAX, Math.round((prefs.f + d) * 100) / 100)); };

  // response curve: the amplitude at the antinodes against f, 0 → a few harmonics past f
  const RW = 520, RH = 232, RL = 48, RR = 14, RT = 14, RB = 46;
  const rMax = $derived(Math.min(FMAX, Math.max(prefs.f * 1.25, f1 * 5.5)));
  const resp = $derived(Array.from({ length: 420 }, (_, i) => { const f = 0.5 + (i / 419) * rMax; return [f, peakAmp(f, v, prefs.l) * 1000] as [number, number]; }));
  const rYmax = $derived(Math.max(...resp.map((p) => p[1])) * 1.08);
  const rx = (f: number) => RL + (f / rMax) * (RW - RL - RR);
  const ry = (a: number) => RH - RB - (a / rYmax) * (RH - RT - RB);
  const respPath = $derived(resp.map(([f, a], i) => `${i ? 'L' : 'M'}${rx(f).toFixed(1)} ${ry(a).toFixed(1)}`).join(''));
  const harmonics = $derived(Array.from({ length: Math.floor(rMax / f1) }, (_, i) => i + 1));

  // snapshots of the ideal n-th harmonic, y–x, at five instants in half a cycle
  const SW = 520, SH = 200, SL = 30, SR = 14;
  const snapN = $derived(near.n);
  const snapPath = (phi: number) => Array.from({ length: 161 }, (_, i) => {
    const x = i / 160, y = Math.sin(snapN * Math.PI * x) * Math.cos(phi);
    return `${i ? 'L' : 'M'}${(SL + x * (SW - SL - SR)).toFixed(1)} ${(SH / 2 - y * 70).toFixed(1)}`;
  }).join('');
  const PHIS = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI];
  // three probe points: P and R in the same loop, Q in the next one (if there is one)
  const probe = $derived.by(() => {
    const loop = 1 / snapN;
    const P = loop * 0.3, R = loop * 0.75, Q = snapN > 1 ? loop * 1.4 : NaN;
    return { P, R, Q };
  });
  const sx = (x: number) => SL + x * (SW - SL - SR);

  // Core Practical 5 readings
  function record() {
    if (!near.on) return;
    prefs.reads = [...prefs.reads, { l: prefs.l, m: prefs.mass, mu, f: prefs.f, n: near.n }];
  }
  const drop = (i: number) => { prefs.reads = prefs.reads.filter((_, j) => j !== i); };
  const pts = $derived(prefs.reads.map((r) => [xOf(r, prefs.ax), r.f / r.n] as [number, number]));
  const line = $derived(fit(pts));
  const controlled = $derived.by(() => {
    const rs = prefs.reads;
    if (rs.length < 2) return { ok: true, what: '' };
    const T_ = rs.map((r) => r.m), L_ = rs.map((r) => r.l), M_ = rs.map((r) => r.mu);
    const bad: string[] = [];
    if (prefs.ax !== 'sqrtT' && spread(T_) > 0.01) bad.push('T');
    if (prefs.ax !== 'invl' && spread(L_) > 0.01) bad.push('l');
    if (prefs.ax !== 'invsqrtmu' && spread(M_) > 0.01) bad.push('μ');
    return { ok: !bad.length, what: bad.join(' and ') };
  });
  const theory = $derived.by(() => {
    const rs = prefs.reads;
    if (!rs.length) return NaN;
    const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
    const Tm = mean(rs.map((r) => tension(r.m))), lm = mean(rs.map((r) => r.l)), mm = mean(rs.map((r) => r.mu));
    return prefs.ax === 'invl' ? Math.sqrt(Tm / mm) / 2 : prefs.ax === 'sqrtT' ? 1 / (2 * lm * Math.sqrt(mm)) : Math.sqrt(Tm) / (2 * lm);
  });
  const GW = 520, GH = 260, GL = 54, GR = 16, GT = 14, GB = 42;
  const gx = $derived.by(() => { const xs = pts.map((p) => p[0]); return [0, xs.length ? Math.max(...xs) * 1.12 : 1] as [number, number]; });
  const gy = $derived.by(() => { const ys = pts.map((p) => p[1]); return [0, ys.length ? Math.max(...ys) * 1.15 : 100] as [number, number]; });
  const px_ = (x: number) => GL + ((x - gx[0]) / (gx[1] - gx[0])) * (GW - GL - GR);
  const py_ = (y: number) => GH - GB - ((y - gy[0]) / (gy[1] - gy[0])) * (GH - GT - GB);

  /* ---------- sound ---------- */
  const vs = $derived(soundSpeed(prefs.temp));
  const lamS = $derived(vs / prefs.fs);
  const lag = $derived(lagDeg(prefs.mic, lamS));
  const inPhase = $derived(Math.min(lag, 360 - lag) < 8);
  const scope = $derived({ tb: Number(prefs.tb) * 1e-3, v1: Number(prefs.v1), v2: Number(prefs.v2) });
  const OW = 500, OH = 400;
  const tr = $derived(scopePaths(OW, OH, prefs.fs, vs, prefs.mic, scope));
  const nudgeMic = (d: number) => { prefs.mic = Math.max(0, Math.min(1, Math.round((prefs.mic + d) * 1000) / 1000)); };
  function mark() { if (!prefs.marks.some((m) => Math.abs(m - prefs.mic) < 0.002)) prefs.marks = [...prefs.marks, prefs.mic].sort((a, b) => a - b); }
  const marks = $derived(prefs.marks);
  const lamMeas = $derived(marks.length >= 2 ? (marks[marks.length - 1] - marks[0]) / (marks.length - 1) : NaN);
  const markFit = $derived(fit(marks.map((m, i) => [i, m])));
  // marks that don't sit about a whole number of wavelengths from the first one
  const offMarks = $derived(marks.filter((m) => { const k = (m - (marks[0] ?? 0)) / lamS; return Math.abs(k - Math.round(k)) > 0.06; }).length);
  const MW = 520, MH = 220, ML = 52, MR = 14, MT = 14, MB = 40;
  const mxMax = $derived(Math.max(3, marks.length));
  const myMax = $derived(Math.max(0.1, ...marks) * 1.1);

  /* ---------- the air column ---------- */
  const tubeRes = $derived(Array.from({ length: 6 }, (_, i) => tubeF(prefs.tube, i + 1, vs, prefs.L)));
  const tNear = $derived.by(() => {
    let best = 0;
    tubeRes.forEach((f, i) => { if (Math.abs(f - prefs.ft) < Math.abs(tubeRes[best] - prefs.ft)) best = i; });
    const f = tubeRes[best];
    return { i: best, f, on: Math.abs(prefs.ft - f) < 0.03 * f };
  });
  const tLabel = $derived(prefs.tube === 'closed' ? 2 * tNear.i + 1 : tNear.i + 1);

  /* ---------- the 3D view and the status line ---------- */
  const look = $derived<StLook>({
    mode: prefs.mode, strobe: Number(prefs.strobe),
    l: prefs.l, f: prefs.f, v, mass: prefs.mass, parts: prefs.parts, n: near.n, on: near.on,
    fs: prefs.fs, vs, mic: prefs.mic, scope,
    tube: prefs.tube, L: prefs.L, ft: prefs.ft, tn: tNear.i + 1, ton: tNear.on,
  });
  $effect(() => {
    stats = prefs.mode === 'string'
      ? [['f', `${plain(prefs.f, 4)} Hz`], ['v', `${plain(v, 3)} m s⁻¹`], ['Resonance', near.on ? `n = ${near.n}` : 'no']]
      : prefs.mode === 'sound'
        ? [['f', `${prefs.fs} Hz`], ['λ', `${plain(lamS * 100, 3)} cm`], ['Marks', marks.length]]
        : [['f', `${prefs.ft} Hz`], ['Tube', `${prefs.L.toFixed(2)} m, ${prefs.tube}`], ['Resonance', tNear.on ? `harmonic ${tLabel}` : 'no']];
  });

  const ORD = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th'];
  const STROBE = [['0', 'Strobe off', 'Off'], ['0.25', '0.25 Hz', '¼'], ['0.5', '0.5 Hz', '½'], ['1', '1 Hz', '1']] as const;
  const fmtMs = (s: string) => `${s} ms/div`;

  /* Kernel hooks */
  export async function kSweep(maxMs = 15000): Promise<boolean> {
    if (!sweeping) sweep();
    const endAt = performance.now() + maxMs;
    while (sweeping && performance.now() < endAt) await new Promise((r) => setTimeout(r, 40));
    return !sweeping;
  }
  export function kRecord(): boolean { const before = prefs.reads.length; record(); return prefs.reads.length > before; }
  export function kClearReads() { prefs.reads = []; }
  export function kMark(): boolean { const before = prefs.marks.length; mark(); return prefs.marks.length > before; }
  export function kClearMarks() { prefs.marks = []; }
  export function kReadouts() {
    return { wire, mu, T, v, f1, near, lam, amp, sweeping, line, theory, vs, lamS, lag, inPhase, lamMeas, markFit, tubeRes, tNear, tLabel };
  }
</script>

<main class="layout wv-standing" hidden={off}>
  <section class="panel stage" aria-label="Standing waves bench">
    <div class="stage-head">
      <div class="label-chip">
        <small>{prefs.mode === 'string' ? 'Core Practical 5' : prefs.mode === 'sound' ? 'Core Practical 4' : 'Air column'}</small>
        <span>{prefs.mode === 'string' ? 'A vibrating string' : prefs.mode === 'sound' ? 'Speed of sound in air' : `A tube ${prefs.tube === 'closed' ? 'closed at one end' : 'open at both ends'}`}</span>
      </div>
      <div class="stage-tools">
        <Seg label="Bench" options={[['string', 'String', 'String'], ['sound', 'Speed of sound', 'Sound'], ['tube', 'Air column', 'Tube']]} bind:value={prefs.mode} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./standing3d').then((m) => m.StandingScene)} {look}
          label="3D view of the apparatus. Drag to turn it.">
          {#if prefs.mode === 'string'}
            <div class="hud tl">
              <b>{near.on ? `Resonating: harmonic ${near.n}` : 'Not resonating'}</b>
              <span>{near.on ? `${near.n} loop${near.n > 1 ? 's' : ''}, λ = 2l/${near.n} = ${plain(lam, 3)} m` : 'tune f until the string comes alive'}</span>
            </div>
            <div class="hud tr amp"><b>{sci(amp * 1000, 2)} mm</b><span>at the antinodes</span></div>
            <div class="hud bl">{prefs.strobe === '0' ? 'Strobe off: the string moves too fast to follow, so it blurs into its envelope.' : `Lit by a strobe ${prefs.strobe} Hz below f, so it seems to move at ${prefs.strobe} Hz.`} Up–down movement exaggerated.</div>
            {#if prefs.parts && prefs.strobe !== '0'}<div class="hud trl"><span class="k inc">→ incident</span><span class="k ref">← reflected</span><span class="k sum">sum: the string</span></div>{/if}
          {:else if prefs.mode === 'sound'}
            <div class="hud tl"><b>d = {plain(prefs.mic * 100, 3)} cm</b><span>{prefs.phase ? `phase difference ${Math.round(lag)}°` : 'compare the two traces'}</span></div>
            <div class="hud bl">Air molecules move to and fro along the direction of travel: a longitudinal wave. Bright = compression. Movement exaggerated.</div>
          {:else}
            <div class="hud tl"><b>{tNear.on ? `Resonating: harmonic ${tLabel}` : 'Not resonating'}</b><span>N: displacement node · A: antinode</span></div>
            <div class="hud bl">Amber lines: the displacement envelope. Movement exaggerated.</div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <Seg label="Stroboscope" options={STROBE} bind:value={prefs.strobe} />
      {#if prefs.mode === 'string'}
        <label class="tog"><input type="checkbox" bind:checked={prefs.parts} disabled={prefs.strobe === '0'} /> Show the two travelling waves</label>
      {/if}
    </div>
  </section>

  <aside class="side">
    {#if prefs.mode === 'string'}
      <section class="panel" aria-label="String set-up">
        <div class="ph"><h2>Set-up</h2></div>
        <div class="ctls">
          <label class="ctl"><span class="ctl-l">String or wire</span>
            <select class="sel" bind:value={prefs.wire}>{#each WIRES as w (w.id)}<option value={w.id}>{w.name}{w.id === 'custom' ? '' : ` (μ = ${plain(w.mu * 1000, 3)} g m⁻¹)`}</option>{/each}</select>
            <small class="hint">{wire.note}</small>
          </label>
          {#if wire.id === 'custom'}
            <label class="ctl"><span class="ctl-l">Mass per unit length μ <b>{plain(prefs.mu * 1000, 3)} g m⁻¹</b></span>
              <input class="slider" type="range" min="0.0001" max="0.005" step="0.0001" bind:value={prefs.mu} /></label>
          {/if}
          <label class="ctl"><span class="ctl-l">Hanging mass <b>{Math.round(prefs.mass * 1000)} g → T = {plain(T, 3)} N</b></span>
            <input class="slider" type="range" min="0.05" max="1" step="0.05" bind:value={prefs.mass} /></label>
          <label class="ctl"><span class="ctl-l">Length l <b>{prefs.l.toFixed(2)} m</b></span>
            <input class="slider" type="range" min="0.3" max="1.5" step="0.01" bind:value={prefs.l} /></label>
          <label class="ctl"><span class="ctl-l">Signal generator f <b>{plain(prefs.f, 4)} Hz</b></span>
            <input class="slider" type="range" min="1" max={FMAX} step="0.1" bind:value={prefs.f} /></label>
          <div class="fine" role="group" aria-label="Fine tune">
            <button class="btn sm" type="button" onclick={() => nudge(-1)}>−1</button>
            <button class="btn sm" type="button" onclick={() => nudge(-0.1)}>−0.1</button>
            <button class="btn sm" type="button" onclick={() => nudge(0.1)}>+0.1</button>
            <button class="btn sm" type="button" onclick={() => nudge(1)}>+1</button>
            <button class="btn sm primary" type="button" onclick={sweep}>{sweeping ? 'Stop' : 'Sweep up ↗'}</button>
          </div>
        </div>
        <dl class="reads pad">
          <div><dt>Tension T = mg</dt><dd>{plain(T, 3)} N</dd></div>
          <div><dt>Wave speed v</dt><dd>{plain(v, 3)} m s⁻¹</dd></div>
          <div><dt>Fundamental f₁</dt><dd>{plain(f1, 3)} Hz</dd></div>
          <div><dt>Nearest harmonic</dt><dd>{near.n} ({plain(near.n * f1, 4)} Hz)</dd></div>
          <div><dt>Wavelength on the string</dt><dd>{plain(v / prefs.f, 3)} m</dd></div>
          <div><dt>Resonating?</dt><dd class:okc={near.on}>{near.on ? `yes, ${near.n} loop${near.n > 1 ? 's' : ''}` : 'no'}</dd></div>
        </dl>
      </section>
      <section class="panel" aria-label="Working">
        <div class="ph"><h2>Working</h2></div>
        <div class="work">
          <div class="eq">T = mg = {plain(prefs.mass, 3)} × 9.81 = {plain(T, 3)} N</div>
          <div class="eq">v = √(T/μ) = √({plain(T, 3)} ÷ {sci(mu, 3)}) = {plain(v, 3)} m s⁻¹</div>
          <div class="eq">Resonance when l = nλ/2, so fₙ = nv/2l</div>
          <div class="eq">f₁ = v/2l = {plain(v, 3)} ÷ (2 × {prefs.l.toFixed(2)}) = {plain(f1, 3)} Hz</div>
          {#if near.n > 1}<div class="eq">f{near.n === 2 ? '₂' : near.n === 3 ? '₃' : `(${near.n})`} = {near.n} × {plain(f1, 3)} = {plain(near.n * f1, 4)} Hz</div>{/if}
        </div>
      </section>
    {:else if prefs.mode === 'sound'}
      <section class="panel" aria-label="Sound set-up">
        <div class="ph"><h2>Set-up</h2></div>
        <div class="ctls">
          <label class="ctl"><span class="ctl-l">Signal generator f <b>{prefs.fs} Hz</b></span>
            <input class="slider" type="range" min="500" max="5000" step="10" bind:value={prefs.fs} /></label>
          <label class="ctl"><span class="ctl-l">Microphone at d <b>{plain(prefs.mic * 100, 3)} cm</b></span>
            <input class="slider" type="range" min="0" max="1" step="0.001" bind:value={prefs.mic} /></label>
          <div class="fine" role="group" aria-label="Move the microphone">
            <button class="btn sm" type="button" onclick={() => nudgeMic(-0.01)}>−1 cm</button>
            <button class="btn sm" type="button" onclick={() => nudgeMic(-0.001)}>−1 mm</button>
            <button class="btn sm" type="button" onclick={() => nudgeMic(0.001)}>+1 mm</button>
            <button class="btn sm" type="button" onclick={() => nudgeMic(0.01)}>+1 cm</button>
          </div>
          <label class="ctl"><span class="ctl-l"><span>Air temperature <span class="beyond">beyond the spec</span></span><b>{prefs.temp} °C</b></span>
            <input class="slider" type="range" min="0" max="40" step="1" bind:value={prefs.temp} /></label>
          <label class="tog"><input type="checkbox" bind:checked={prefs.phase} /> Show the phase difference (a hint)</label>
        </div>
        <dl class="reads pad">
          <div><dt>Traces</dt><dd class:okc={inPhase}>{inPhase ? 'in phase' : prefs.phase ? `${Math.round(lag)}° apart` : 'not in phase'}</dd></div>
          <div><dt>Marked positions</dt><dd>{marks.length}</dd></div>
        </dl>
      </section>
      <section class="panel" aria-label="Method">
        <div class="ph"><h2>Method</h2></div>
        <ol class="steps">
          <li>Start with the microphone close to the speaker and move it away until the two traces are <b>in phase</b>. Mark the position.</li>
          <li>Keep moving it: every time the traces come back into phase it has moved one more wavelength. Mark each one.</li>
          <li>Measure across several wavelengths (it halves the % uncertainty in each λ), then λ = distance ÷ number of wavelengths, and v = fλ.</li>
        </ol>
        <div class="fine pad2"><button class="btn primary" type="button" onclick={mark}>Mark this position</button><button class="btn" type="button" onclick={() => (prefs.marks = [])} disabled={!marks.length}>Clear</button></div>
      </section>
    {:else}
      <section class="panel" aria-label="Air column set-up">
        <div class="ph"><h2>Set-up <span class="beyond">not named in the spec</span></h2></div>
        <div class="ctls">
          <Seg label="Far end" options={[['closed', 'Closed at the far end', 'Closed'], ['open', 'Open at both ends', 'Open']]} bind:value={prefs.tube} />
          <label class="ctl"><span class="ctl-l">Tube length L <b>{prefs.L.toFixed(2)} m</b></span>
            <input class="slider" type="range" min="0.2" max="1" step="0.01" bind:value={prefs.L} /></label>
          <label class="ctl"><span class="ctl-l">Frequency f <b>{prefs.ft} Hz</b></span>
            <input class="slider" type="range" min="80" max="2000" step="1" bind:value={prefs.ft} /></label>
        </div>
        <dl class="reads pad">
          {#each tubeRes.slice(0, 4) as f, i (i)}
            <div><dt>{ORD[prefs.tube === 'closed' ? 2 * i : i]} harmonic{i ? '' : ' (fundamental)'}</dt>
              <dd class:okc={tNear.on && tNear.i === i}>{plain(f, 3)} Hz</dd></div>
          {/each}
        </dl>
        <div class="work">
          <div class="eq">{prefs.tube === 'closed' ? 'Closed end: node; open end: antinode → L = λ/4, 3λ/4, 5λ/4…' : 'Open ends: antinodes → L = λ/2, λ, 3λ/2…'}</div>
          <div class="eq">f = {prefs.tube === 'closed' ? '(2n − 1)v/4L' : 'nv/2L'}, v = {plain(vs, 3)} m s⁻¹</div>
          <div class="eq">A closed tube has only odd harmonics.</div>
        </div>
      </section>
    {/if}
  </aside>

  {#if prefs.mode === 'string'}
    <section class="panel full" aria-label="Response and shape">
      <div class="cols2">
        <div>
          <h3 class="gh">Resonance: amplitude against frequency</h3>
          <svg class="plot" viewBox="0 0 {RW} {RH}" role="img" aria-label="Amplitude of the string's antinodes against the signal generator's frequency, peaking at each harmonic">
            {#each harmonics as n (n)}
              <line class="hm" x1={rx(n * f1)} x2={rx(n * f1)} y1={RT} y2={RH - RB} />
              {#if rx(n * f1) - rx((n - 1) * f1) > 26 || n === 1}<text class="tk" x={rx(n * f1)} y={RH - RB + 14} text-anchor="middle">{n === 1 ? 'f₁' : `${n}f₁`}</text>{/if}
            {/each}
            <line class="ax" x1={RL} x2={RW - RR} y1={RH - RB} y2={RH - RB} />
            <line class="ax" x1={RL} x2={RL} y1={RT} y2={RH - RB} />
            <path class="curve" d={respPath} />
            <line class="cur" x1={rx(prefs.f)} x2={rx(prefs.f)} y1={RT} y2={RH - RB} />
            <circle class="dot" cx={rx(prefs.f)} cy={ry(amp * 1000)} r="4.5" />
            <text class="al" x={RW - RR} y={RH - 4} text-anchor="end">f / Hz (0 – {Math.round(rMax)})</text>
            <text class="al" x={12} y={RT} transform="rotate(-90 12 {RT})" text-anchor="end">amplitude</text>
          </svg>
          <p class="why">The string only moves a lot when l is a whole number of half-wavelengths. Peaks sit at f₁, 2f₁, 3f₁…; higher harmonics are smaller because the damping takes more energy per loop. The generator's end is very nearly a node: it moves only {sci(A0 * 1000, 2)} mm.</p>
        </div>
        <div>
          <h3 class="gh">The {snapN === 1 ? 'fundamental' : `${snapN}th harmonic`}: y against x at five instants</h3>
          <svg class="plot" viewBox="0 0 {SW} {SH}" role="img" aria-label="Snapshots of the standing wave at five moments in half a cycle, with nodes and three marked points">
            <line class="ax" x1={SL} x2={SW - SR} y1={SH / 2} y2={SH / 2} />
            {#each PHIS as phi, i (i)}<path class="snap" style="opacity:{1 - i * 0.16}" d={snapPath(phi)} />{/each}
            {#each Array.from({ length: snapN + 1 }, (_, j) => j / snapN) as x (x)}
              <circle class="node" cx={sx(x)} cy={SH / 2} r="4" />{#if snapN <= 8}<text class="tk" x={sx(x)} y={SH / 2 + 18} text-anchor="middle">N</text>{/if}
            {/each}
            {#if snapN <= 8}{#each Array.from({ length: snapN }, (_, j) => (j + 0.5) / snapN) as x (x)}<text class="tk an" x={sx(x)} y={SH / 2 - 82} text-anchor="middle">A</text>{/each}{/if}
            {#each [['P', probe.P], ['R', probe.R], ['Q', probe.Q]] as [nm, x] (nm)}
              {#if Number.isFinite(x as number)}
                {@const y = Math.sin(snapN * Math.PI * (x as number)) * 70}
                <line class="pl" x1={sx(x as number)} x2={sx(x as number)} y1={SH / 2} y2={SH / 2 - y} />
                <circle class="pp" cx={sx(x as number)} cy={SH / 2 - y} r="5" /><text class="pn" x={sx(x as number) + 8} y={SH / 2 - y - 6}>{nm}</text>
              {/if}
            {/each}
          </svg>
          <p class="why">Every point between two nodes moves <b>in phase</b> (P and R reach their tops together), with its own amplitude. Points in neighbouring loops move in <b>antiphase</b>, 180° apart{Number.isFinite(probe.Q) ? ' (Q is down when P is up)' : ''}. In a progressive wave every point has the same amplitude and the phase changes steadily along it.</p>
        </div>
      </div>
    </section>

    <section class="panel full" aria-label="Core Practical 5 readings">
      <div class="ph"><h2>Core Practical 5 · investigate f, l, T and μ</h2></div>
      <div class="cp5">
        <div class="cp5-left">
          <div class="fine">
            <button class="btn primary" type="button" onclick={record} disabled={!near.on}>{near.on ? `Record f = ${plain(prefs.f, 4)} Hz (n = ${near.n})` : 'Tune to a resonance to record'}</button>
            <button class="btn" type="button" onclick={() => (prefs.reads = [])} disabled={!prefs.reads.length}>Clear</button>
          </div>
          <div class="tscroll">
            <table class="rtab">
              <thead><tr><th>l / m</th><th>T / N</th><th>μ / g m⁻¹</th><th>n</th><th>f / Hz</th><th>f₁ = f/n</th><th></th></tr></thead>
              <tbody>
                {#each prefs.reads as r, i (i)}
                  <tr><td>{r.l.toFixed(2)}</td><td>{plain(tension(r.m), 3)}</td><td>{plain(r.mu * 1000, 3)}</td><td>{r.n}</td><td>{plain(r.f, 4)}</td><td>{plain(r.f / r.n, 3)}</td>
                    <td><button class="xbtn" type="button" aria-label="Delete this reading" onclick={() => drop(i)}>×</button></td></tr>
                {:else}
                  <tr><td colspan="7" class="empty">No readings yet. Change one variable at a time, find a resonance, record it.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="facts">
            <b>Doing it well</b>
            <ul>
              <li>Increase f slowly from zero: the first big resonance is f₁ (one loop). Find it again coming down from above, and take the mean.</li>
              <li>Change one variable at a time: l (move the vibration generator), T (add 50 g masses) or μ (a different wire). Keep the other two fixed.</li>
              <li>Measure l from the generator's rod to the top of the pulley with a metre rule; μ = mass ÷ length of a long sample on a top-pan balance.</li>
              <li>Repeat each reading; uncertainty = half the range of the repeats.</li>
              <li>Safety: a falling mass hanger, and a wire under tension can snap. Keep feet clear and wear eye protection.</li>
            </ul>
          </div>
        </div>
        <div class="cp5-right">
          <Seg label="Graph" options={XAXES} bind:value={prefs.ax} />
          <svg class="plot" viewBox="0 0 {GW} {GH}" role="img" aria-label="Graph of the recorded readings with a line of best fit">
            {#each niceTicks(gx[0], gx[1], 5) as t (t)}<line class="gl" x1={px_(t)} x2={px_(t)} y1={GT} y2={GH - GB} /><text class="tk" x={px_(t)} y={GH - GB + 14} text-anchor="middle">{short(t, 3)}</text>{/each}
            {#each niceTicks(gy[0], gy[1], 5) as t (t)}<line class="gl" x1={GL} x2={GW - GR} y1={py_(t)} y2={py_(t)} /><text class="tk" x={GL - 6} y={py_(t)} text-anchor="end">{short(t, 3)}</text>{/each}
            <line class="ax" x1={GL} x2={GW - GR} y1={GH - GB} y2={GH - GB} />
            <line class="ax" x1={GL} x2={GL} y1={GT} y2={GH - GB} />
            {#if line}<line class="fitl" x1={px_(gx[0])} y1={py_(line.c + line.m * gx[0])} x2={px_(gx[1])} y2={py_(line.c + line.m * gx[1])} />{/if}
            {#each pts as [x, y], i (i)}<path class="pt" d="M{px_(x) - 4.5} {py_(y) - 4.5}l9 9m0 -9l-9 9" />{/each}
            <text class="al" x={GW - GR} y={GH - 6} text-anchor="end">{X_LABEL[prefs.ax]}</text>
            <text class="al" x={12} y={GT} transform="rotate(-90 12 {GT})" text-anchor="end">f₁ / Hz</text>
            {#if pts.length < 2}<text class="msg" x={(GL + GW) / 2} y={GH / 2} text-anchor="middle">Record two or more readings</text>{/if}
          </svg>
          {#if line}
            <div class="work">
              <div class="eq">gradient = {sci(line.m, 3)}, intercept = {plain(line.c, 2)} Hz</div>
              <div class="eq">theory: f₁ = (1/2l)√(T/μ) → gradient {prefs.ax === 'invl' ? '½√(T/μ)' : prefs.ax === 'sqrtT' ? '1/(2l√μ)' : '√T/2l'} = {sci(theory, 3)}</div>
              <div class="eq">difference {plain(Math.abs(line.m / theory - 1) * 100, 2)}%{Math.abs(line.c) < 0.05 * gy[1] ? ', through the origin: f₁ ∝ ' + (prefs.ax === 'invl' ? '1/l' : prefs.ax === 'sqrtT' ? '√T' : '1/√μ') : ''}</div>
            </div>
          {/if}
          {#if !controlled.ok}<p class="warnline">{controlled.what} changed between readings: for this graph keep {controlled.what} fixed, or the points won't lie on one line.</p>{/if}
        </div>
      </div>
    </section>
  {:else if prefs.mode === 'sound'}
    <section class="panel full" aria-label="Oscilloscope and results">
      <div class="cols2">
        <div>
          <h3 class="gh">Two-beam oscilloscope</h3>
          <div class="scopebox">
            <svg class="oscope" viewBox="0 0 {OW} {OH}" role="img" aria-label="Oscilloscope screen: the signal generator's trace and the microphone's trace">
              <rect width={OW} height={OH} class="scr" />
              {#each Array.from({ length: DIV_X + 1 }, (_, i) => i) as i (i)}<line class="grat" x1={(i / DIV_X) * OW} x2={(i / DIV_X) * OW} y1="0" y2={OH} />{/each}
              {#each Array.from({ length: DIV_Y + 1 }, (_, i) => i) as i (i)}<line class="grat" x1="0" x2={OW} y1={(i / DIV_Y) * OH} y2={(i / DIV_Y) * OH} />{/each}
              <line class="grat c" x1="0" x2={OW} y1={OH / 2} y2={OH / 2} /><line class="grat c" x1={OW / 2} x2={OW / 2} y1="0" y2={OH} />
              <path class="b1" d={tr.p1} /><path class="b2" d={tr.p2} />
            </svg>
            <div class="scopectl">
              <label class="ctl"><span class="ctl-l">Time base</span><select class="sel" bind:value={prefs.tb}>{#each ['0.05', '0.1', '0.2', '0.5', '1'] as t (t)}<option value={t}>{fmtMs(t)}</option>{/each}</select></label>
              <label class="ctl"><span class="ctl-l"><span class="sw1">●</span> Beam 1 (generator)</span><select class="sel" bind:value={prefs.v1}>{#each ['0.5', '1', '2', '5'] as t (t)}<option value={t}>{t} V/div</option>{/each}</select></label>
              <label class="ctl"><span class="ctl-l"><span class="sw2">●</span> Beam 2 (microphone)</span><select class="sel" bind:value={prefs.v2}>{#each ['0.02', '0.05', '0.1', '0.2', '0.5'] as t (t)}<option value={t}>{t} V/div</option>{/each}</select></label>
            </div>
          </div>
          <p class="why">Period from the screen: T = (divisions for one cycle) × time base = {plain(1000 / prefs.fs, 3)} ms, so f = 1/T = {prefs.fs} Hz (check it against the dial). Beam 2 is {plain(micAmp(prefs.mic), 2)} V: smaller further away.</p>
        </div>
        <div>
          <h3 class="gh">Results</h3>
          <div class="tscroll">
            <table class="rtab">
              <thead><tr><th>mark</th><th>d / cm</th><th>gap / cm</th><th></th></tr></thead>
              <tbody>
                {#each marks as m, i (m)}
                  <tr><td>{i}</td><td>{plain(m * 100, 3)}</td><td>{i ? plain((m - marks[i - 1]) * 100, 3) : '–'}</td>
                    <td><button class="xbtn" type="button" aria-label="Delete this mark" onclick={() => (prefs.marks = marks.filter((_, j) => j !== i))}>×</button></td></tr>
                {:else}
                  <tr><td colspan="4" class="empty">Move the microphone until the traces are in phase, then mark it.</td></tr>
                {/each}
              </tbody>
            </table>
          </div>
          {#if marks.length >= 2}
            <svg class="plot" viewBox="0 0 {MW} {MH}" role="img" aria-label="Microphone position against mark number">
              {#each niceTicks(0, mxMax, Math.min(6, mxMax)) as t (t)}<text class="tk" x={ML + (t / mxMax) * (MW - ML - MR)} y={MH - MB + 14} text-anchor="middle">{t}</text>{/each}
              {#each niceTicks(0, myMax * 100, 4) as t (t)}<line class="gl" x1={ML} x2={MW - MR} y1={MH - MB - (t / 100 / myMax) * (MH - MT - MB)} y2={MH - MB - (t / 100 / myMax) * (MH - MT - MB)} /><text class="tk" x={ML - 6} y={MH - MB - (t / 100 / myMax) * (MH - MT - MB)} text-anchor="end">{short(t, 3)}</text>{/each}
              <line class="ax" x1={ML} x2={MW - MR} y1={MH - MB} y2={MH - MB} /><line class="ax" x1={ML} x2={ML} y1={MT} y2={MH - MB} />
              {#if markFit}<line class="fitl" x1={ML} y1={MH - MB - (markFit.c / myMax) * (MH - MT - MB)} x2={MW - MR} y2={MH - MB - ((markFit.c + markFit.m * mxMax) / myMax) * (MH - MT - MB)} />{/if}
              {#each marks as m, i (i)}<path class="pt" d="M{ML + (i / mxMax) * (MW - ML - MR) - 4.5} {MH - MB - (m / myMax) * (MH - MT - MB) - 4.5}l9 9m0 -9l-9 9" />{/each}
              <text class="al" x={MW - MR} y={MH - 6} text-anchor="end">mark number</text>
              <text class="al" x={12} y={MT} transform="rotate(-90 12 {MT})" text-anchor="end">d / cm</text>
            </svg>
            <div class="work">
              <div class="eq">λ = ({plain(marks[marks.length - 1] * 100, 3)} − {plain(marks[0] * 100, 3)}) cm ÷ {marks.length - 1} = {plain(lamMeas * 100, 3)} cm{markFit ? ` (gradient: ${plain(markFit.m * 100, 3)} cm)` : ''}</div>
              <div class="eq">v = fλ = {prefs.fs} × {plain(lamMeas, 3)} = <b>{plain(prefs.fs * lamMeas, 3)} m s⁻¹</b></div>
              {#if offMarks}<div class="eq warnline">{offMarks} mark{offMarks > 1 ? 's are' : ' is'} not a whole number of wavelengths from the first: check the traces were really in phase there.</div>{/if}
            </div>
          {/if}
        </div>
      </div>
    </section>
  {:else}
    <section class="panel full" aria-label="About air columns">
      <div class="ex-body">
        <h3>Stationary waves in air <small>exam questions use these; the spec names only strings</small></h3>
        <p>Sound reflects from the end of a tube, and the reflected wave meets the incoming one: a stationary wave forms when the length fits. At a <b>closed end</b> the air cannot move, so there is a displacement node. At an <b>open end</b> it moves most: an antinode (a pressure node). So a tube closed at one end fits λ/4, 3λ/4, 5λ/4…, and a tube open at both ends fits λ/2, λ, 3λ/2….</p>
        <p>Measured lengths come out a little short: the antinode sits just beyond an open end (the end correction, about 0.3 × the diameter) <span class="beyond">beyond the spec</span>.</p>
      </div>
    </section>
  {/if}

  <section class="panel full" aria-label="Progressive and stationary waves">
    <div class="cols2">
      <div class="tscroll">
        <h3 class="gh">Progressive and stationary waves</h3>
        <table class="ctab">
          <thead><tr><th></th><th>Progressive</th><th>Stationary</th></tr></thead>
          <tbody>
            <tr><th>Energy</th><td>carried along the wave</td><td>not transferred: stored, moving between kinetic and potential</td></tr>
            <tr><th>Amplitude</th><td>the same everywhere (no losses)</td><td>zero at nodes, largest at antinodes</td></tr>
            <tr><th>Phase</th><td>changes steadily along the wave: 360° per λ</td><td>in phase within a loop, antiphase in the next</td></tr>
            <tr><th>Wavelength</th><td>distance between neighbouring points in phase</td><td>twice the node-to-node distance</td></tr>
            <tr><th>Waveform</th><td>moves along at v</td><td>stays in place</td></tr>
          </tbody>
        </table>
      </div>
      <div class="facts">
        <b>Key facts</b>
        <ul>
          <li>A stationary wave forms when two waves of the same frequency (and similar amplitude) travel in opposite directions and superpose, usually a wave and its reflection.</li>
          <li>Nodes: always zero displacement (destructive superposition). Antinodes: maximum amplitude. Node to node is λ/2.</li>
          <li>On a string fixed at both ends, l = nλ/2, so fₙ = nv/2l = (n/2l)√(T/μ).</li>
          <li>f ∝ 1/l, f ∝ √T and f ∝ 1/√μ: shorter, tighter or lighter strings sound higher.</li>
          <li>v = √(T/μ) is the speed of the travelling waves that make up the stationary wave, not the speed of any point on the string.</li>
          <li>Speed of sound in air: about 330–340 m s⁻¹. Sound is longitudinal: the air moves along the direction of travel, in compressions and rarefactions.</li>
        </ul>
      </div>
    </div>
  </section>
</main>
