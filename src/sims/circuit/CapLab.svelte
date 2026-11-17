<script lang="ts">
  /* The capacitor practical (Unit 4 theory, Unit 6 practical): an unknown capacitor charges through R at A and
     discharges through R at B. A data logger reads the p.d. across it at a fixed interval. Plot V against t, or
     ln V against t for the discharge: a straight line of gradient −1/RC, so C = −1 / (gradient × R). */
  import Board, { type Flow } from './Board.svelte';
  import Plot from './Plot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import CopyButton from '../../components/ui/CopyButton.svelte';
  import { rcRig } from './examples';
  import { Clock } from './transient.svelte';
  import { fit, niceMax } from './lab';
  import { meter, num, ohms, si, sig } from './format';
  import { pick } from '../../lib/util';
  import type { Solution } from './solve';

  let { flow, hidden: off = false, oncap }: { flow: Flow; hidden?: boolean; oncap?: () => void } = $props();

  const E = 6;
  const CS = [100e-6, 220e-6, 470e-6, 1000e-6];
  let C = $state(pick(CS));
  let R = $state(10000);
  let pos = $state<'A' | 'B'>('B');
  let phase = $state<'idle' | 'charge' | 'discharge'>('idle');
  let every = $state(1);
  let view = $state<'v' | 'ln'>('v');
  let revealed = $state(false);
  let reads = $state<{ x: number; y: number }[]>([]);

  const clock = new Clock();
  const c = $derived(rcRig(C, R, pos === 'A', 'Cell', E));
  const capId = $derived(c.parts[4].id);
  const sol = $derived<Solution | null>(clock.sol);
  const v = $derived(sol?.parts[capId]?.v ?? 0);

  /* the data logger: readings at exact multiples of the interval after the switch moved */
  let t0 = 0, next = 0, prev = { t: 0, v: 0 };
  let logging = $state(false);
  // the continuous trace since the switch last moved (its own buffer: the clock's scope only keeps the last 10 s)
  let buf: [number, number][] = [];
  let curve = $state.raw<[number, number][]>([]);
  function flip(p: 'A' | 'B') {
    if (p === pos && phase !== 'idle') return;
    pos = p; phase = p === 'A' ? 'charge' : 'discharge';
    t0 = clock.t; next = 0; prev = { t: clock.t, v }; reads = []; logging = true; buf = [[0, v]]; curve = buf.slice();
    if (p === 'A') view = 'v';
    clock.playing = true;
  }
  function onStep(t: number, s: Solution) {
    const vn = s.parts[capId]?.v ?? 0;
    if (logging) {
      while (logging && t - t0 >= next - 1e-9) {
        const tt = t0 + next, f = t > prev.t ? (tt - prev.t) / (t - prev.t) : 1;
        reads.push({ x: Number(sig(next)), y: Number(sig(prev.v + (vn - prev.v) * Math.max(0, Math.min(1, f)))) });
        next += every;
        // stop once it has settled (within 1% of the e.m.f. or of zero) or after 40 readings
        const last = reads[reads.length - 1].y;
        if (reads.length >= 40 || (phase === 'discharge' ? last < 0.01 * E : last > 0.99 * E)) logging = false;
      }
    }
    // trace until one interval after the last reading, a point every 1/20 of the logging interval
    const r = t - t0, lastT = buf.length ? buf[buf.length - 1][0] : -Infinity;
    if (phase !== 'idle' && (logging || r <= (reads[reads.length - 1]?.x ?? 0) + every) && r - lastT >= every / 20) buf.push([r, vn]);
    prev = { t, v: vn };
  }

  $effect(() => {
    if (off) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      clock.tick($state.snapshot(c), (now - last) / 1000, capId, onStep);
      if (buf.length !== curve.length) curve = buf.slice();
      last = now; raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });

  function newCap() { C = pick(CS.filter((x) => x !== C)); clock.reset(); reads = []; buf = []; curve = []; phase = 'idle'; logging = false; pos = 'B'; revealed = false; view = 'v'; }
  function setR(r: number) { R = r; reads = []; buf = []; curve = []; phase = 'idle'; logging = false; }

  const rel = $derived(phase === 'idle' ? 0 : clock.t - t0);
  // while logging the axis grows with time; afterwards it fits the readings
  const xMax = $derived(niceMax(Math.max(5, logging ? rel : 0, ...reads.map((p) => p.x))));
  const live = $derived(phase === 'idle' ? [] : curve.filter(([x]) => x <= xMax));
  const lnPts = $derived(reads.filter((p) => p.y > 0.03).map((p) => ({ x: p.x, y: Math.log(p.y) })));
  const line = $derived(view === 'ln' && lnPts.length >= 3 ? fit(lnPts) : null);
  const lnRange = $derived.by((): [number, number] => {
    const ys = lnPts.map((p) => p.y);
    return ys.length ? [Math.floor(Math.min(...ys) - 0.1), Math.ceil(Math.log(E))] : [-2, 2];
  });
  const tauM = $derived(line && line.m < 0 ? -1 / line.m : null);
  const cM = $derived(tauM ? tauM / R : null);
  const text = () => ['t / s\tV / V' + (view === 'ln' ? '\tln(V / V)' : ''), ...reads.map((p) => `${p.x}\t${p.y}` + (view === 'ln' && p.y > 0 ? `\t${sig(Math.log(p.y))}` : ''))].join('\n');
  function reveal() { revealed = true; if (cM) oncap?.(); }
</script>

<main class="layout lab" hidden={off}>
  <section class="panel stage" aria-label="Capacitor circuit">
    <div class="stage-head">
      <div class="label-chip"><small>Unknown capacitor</small><span>{revealed ? `C = ${si(C, 'F', 2)}` : 'C hidden'}</span></div>
      <div class="stage-tools">
        <button class="btn" class:primary={pos !== 'A'} type="button" onclick={() => flip('A')}>Charge (A)</button>
        <button class="btn" class:primary={pos === 'A'} type="button" onclick={() => flip('B')}>Discharge (B)</button>
        <button class="btn" type="button" onclick={newCap}>New capacitor</button>
      </div>
    </div>
    <div class="board-box">
      {#if sol}<Board fit {c} {sol} {flow} mask={revealed ? [] : [capId]} label="Capacitor charging and discharging circuit" />{/if}
    </div>
    <div class="lab-ctl">
      <div class="lab-row"><span class="ctl-l"><span>Resistor R</span></span>
        <Seg label="Resistor" options={[['4700', '4.7 kΩ'], ['10000', '10 kΩ'], ['22000', '22 kΩ']]} value={String(R) as '4700'} onchange={(x) => setR(Number(x))} /></div>
      <div class="lab-row"><span class="ctl-l"><span>Log every</span></span>
        <Seg label="Logging interval" options={[['0.5', '0.5 s'], ['1', '1 s'], ['2', '2 s'], ['5', '5 s']]} value={String(every) as '1'} onchange={(x) => (every = Number(x))} /></div>
      <div class="lab-row"><span class="ctl-l"><span>Speed</span></span>
        <Seg label="Speed" options={[['1', '×1'], ['5', '×5'], ['20', '×20']]} value={String(clock.speed) as '1'} onchange={(x) => (clock.speed = Number(x))} />
        <span class="clock">{phase === 'idle' ? 'Ready' : `t = ${rel.toFixed(1)} s${logging ? ' · logging' : ''}`}</span></div>
      <p class="why">Charge the capacitor fully (wait about 5 time constants), then discharge it. The logger restarts at t = 0 each time the switch moves.</p>
    </div>
  </section>

  <section class="panel graph" aria-label="Capacitor graph">
    <div class="ph"><h2>{view === 'ln' ? 'ln V against time' : 'p.d. against time'}</h2><span class="score">{reads.length ? `${reads.length} readings` : ''}</span></div>
    {#if phase === 'discharge'}
      <div class="graph-acts"><Seg label="Graph" options={[['v', 'V against t'], ['ln', 'ln V against t']]} bind:value={view} /></div>
    {/if}
    <div class="plot-box">
      {#if view === 'ln'}
        <Plot xr={[0, xMax]} yr={lnRange} xLabel="t / s" yLabel="ln (V / V)" points={lnPts} {line} label="Graph of ln V against time" />
      {:else}
        <Plot xr={[0, xMax]} yr={[0, niceMax(E * 1.05)]} xLabel="t / s" yLabel="V / V" points={reads} curve={live} trace
          now={phase === 'idle' || rel > xMax ? null : { x: rel, y: v }} label="Graph of capacitor p.d. against time" />
      {/if}
    </div>
    <dl class="reads three">
      <div><dt>V across C</dt><dd>{meter(v, 'V')}</dd></div>
      <div><dt>Current</dt><dd>{meter(sol?.parts[c.parts[3].id]?.reading ?? 0, 'A')}</dd></div>
      <div><dt>R</dt><dd>{ohms(R)}</dd></div>
    </dl>
    {#if view === 'ln' && line && tauM && cM}
      <div class="eq">ln V = ln V₀ − t/RC → gradient = {sig(line.m)} s⁻¹, so RC = {sig(tauM)} s and C = RC / R = {si(cM, 'F', 3)}</div>
    {/if}
    <div class="graph-acts">
      {#if phase === 'discharge'}
        <button class="btn" type="button" disabled={!cM || revealed} onclick={reveal}>{cM ? 'Check against the true value' : view === 'ln' ? 'Log 3+ readings to fit a line' : 'Switch to ln V to find C'}</button>
      {/if}
      {#if reads.length}<CopyButton text={text} label="Copy the readings as a table" />{/if}
    </div>
    {#if revealed && cM}
      <div class="explain swap">
        <p class="look"><b>True value:</b>&nbsp;C = {si(C, 'F', 2)}, so RC = {num(R * C)} s</p>
        <p class="why">Your line gives C = {si(cM, 'F', 3)} ({sig(Math.abs(cM - C) / C * 100, 2)}% out). Readings late in the discharge, when V is small, are the least reliable.</p>
      </div>
    {:else}
      <div class="explain">
        <p class="why">{phase === 'charge'
          ? 'Charging: V = V₀(1 − e^(−t/RC)). The p.d. rises quickly at first, then levels off at the e.m.f. as the current falls.'
          : 'Discharging: V = V₀e^(−t/RC). After one time constant RC the p.d. has fallen to 37% of V₀. Taking logs gives ln V = ln V₀ − t/RC, a straight line.'}</p>
      </div>
    {/if}
  </section>
</main>
