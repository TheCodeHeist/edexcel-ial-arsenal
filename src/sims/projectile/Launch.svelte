<script lang="ts" module>
  export interface LPrefs {
    u: number; deg: number; h: number; g: number; k: number;
    strobe: boolean; shadows: boolean; vectors: boolean; aim: boolean;
    speed: number; graph: 'x' | 'y' | 'vx' | 'vy';
  }
  export const GRAVITY = [['9.81', 'Earth'], ['1.62', 'Moon'], ['3.71', 'Mars'], ['24.8', 'Jupiter']] as const;
  export const DRAG = [['0', 'None'], ['0.004', 'Light'], ['0.02', 'Heavy']] as const;
</script>

<script lang="ts">
  /* Launch: set the speed, angle, height, gravity and air resistance, fire, and compare shots. The ball leaves its
     strobe images, shadows on both axes and velocity components; the graph below plots any component against time
     for every shot, with a cursor at the moment shown. */
  import Scene from './Scene.svelte';
  import type { Shot, Ball } from './scene';
  import Plot from '../circuit/Plot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import { fly, at, speed, dip, type Launch, type Flight } from './physics';
  import { Player } from './player.svelte';
  import { sig } from '../circuit/format';
  import { EXAMPLES } from './examples';

  let { prefs, shots = $bindable(), hidden: off = false }: {
    prefs: LPrefs; shots: Launch[]; hidden?: boolean;
  } = $props();

  const COLORS = ['var(--ch1)', 'var(--ch2)', 'var(--ch3)', 'var(--ch4)', 'var(--ch5)', 'var(--ch6)'];
  const MAX = 6;

  const flights = $derived(shots.map((L) => fly(L)));
  let sel = $state(Math.max(0, shots.length - 1));
  // which shots are moving: the one just fired, or all of them on Replay all
  let moving = $state<number[]>([]);
  const player = new Player();
  $effect(() => { player.speed = prefs.speed; });

  const L = $derived<Launch>({ u: prefs.u, deg: prefs.deg, h: prefs.h, g: prefs.g, k: prefs.k });
  const same = (a: Launch, b: Launch) => a.u === b.u && a.deg === b.deg && a.h === b.h && a.g === b.g && a.k === b.k;
  const aimF = $derived(prefs.aim && !(player.playing && moving.length) && !(shots[sel] && same(shots[sel], L)) ? fly(L) : null);
  const f = $derived<Flight | null>(flights[sel] ?? null);
  // an angle below the horizontal only makes sense from a height
  $effect(() => { if (prefs.h === 0 && prefs.deg < 0) prefs.deg = 0; });

  function fire() {
    const next = [...shots, { ...L }];
    shots = next.slice(-MAX);
    sel = shots.length - 1;
    moving = [sel];
    player.play(flights[sel]?.T ?? fly(L).T);
  }
  function replayAll() {
    if (!shots.length) return;
    moving = shots.map((_, i) => i);
    player.play(Math.max(...flights.map((x) => x.T)));
  }
  function select(i: number) {
    sel = i; moving = [i];
    const s = shots[i];
    Object.assign(prefs, { u: s.u, deg: s.deg, h: s.h, g: s.g, k: s.k });
    player.done(flights[i].T);
  }
  function remove(i: number) {
    shots = shots.filter((_, j) => j !== i);
    sel = Math.min(sel, shots.length - 1);
    moving = []; player.reset();
  }
  function toggle() {
    if (!f) return;
    if (player.playing) { player.pause(); return; }
    if (!moving.length) moving = [sel];
    const T = Math.max(...moving.map((i) => flights[i]?.T ?? 0));
    if (player.T !== T || player.t >= T) player.play(T); else player.resume();
  }
  function clear() { shots = []; sel = 0; moving = []; player.reset(); }
  function example(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id)!;
    shots = ex.shots.map((s) => ({ ...s }));
    const last = shots[shots.length - 1];
    Object.assign(prefs, { u: last.u, deg: last.deg, h: last.h, g: last.g, k: last.k }, ex.show ?? {});
    sel = shots.length - 1;
    replayAll();
  }

  /* what the scene draws */
  const balls = $derived<Ball[]>(moving.filter((i) => flights[i]).map((i) => ({ f: flights[i], t: player.t, color: COLORS[i] })));
  const trails = $derived<Shot[]>(flights.map((x, i) => ({ f: x, color: COLORS[i] })).filter((_, i) => !moving.includes(i)));

  /* readings at the moment shown */
  const tNow = $derived(f ? (moving.includes(sel) ? Math.min(player.t, f.T) : f.T) : 0);
  const p = $derived(f ? at(f, tNow) : null);
  const ideal = $derived(f && f.L.k > 0 ? fly({ ...f.L, k: 0 }) : null);
  const u = (x: number, unit: string) => `${sig(x)} ${unit}`;
  const MS = 'm s⁻¹';

  /* the graph */
  const GRAPHS = [['x', 'Horizontal', 'x'], ['y', 'Height', 'h'], ['vx', 'v horizontal', 'vH'], ['vy', 'v vertical', 'vV']] as const;
  const AXIS = { x: 'x / m', y: 'h / m', vx: 'vH / m s⁻¹', vy: 'vV / m s⁻¹' } as const;
  const val = (q: LPrefs['graph'], pt: { x: number; y: number; vx: number; vy: number }) => pt[q];
  const series = $derived(flights.map((x, i) => ({ color: COLORS[i], name: `#${i + 1}`, pts: x.pts.map((pt) => [pt.t, val(prefs.graph, pt)] as [number, number]) })));
  const range = $derived.by(() => {
    const ys = series.flatMap((s) => s.pts.map((q) => q[1]));
    const tMax = Math.max(1, ...flights.map((x) => x.T));
    let lo = Math.min(0, ...ys), hi = Math.max(1, ...ys);
    const pad = (hi - lo) * 0.08;
    return { xr: [0, tMax * 1.04] as [number, number], yr: [lo < 0 ? lo - pad : 0, hi + pad] as [number, number] };
  });
  const WHY: Record<LPrefs['graph'], [string, string]> = {
    x: ['A straight line: no horizontal force, so the horizontal velocity stays the same and equal distances pass in equal times.',
        'With air resistance the line bends over: drag slows the horizontal motion all the way.'],
    y: ['A parabola: the height changes like a dropped ball’s, whatever the horizontal speed.',
        'With air resistance the way down is steeper and shorter than the way up.'],
    vx: ['Flat: the only force is the weight, which is vertical, so the horizontal component never changes.',
        'Air resistance acts against the motion, so the horizontal component falls.'],
    vy: ['A straight line with gradient −g: the vertical acceleration is g the whole way, even at the top.',
        'The gradient is steeper than −g on the way up (weight and drag both act down) and shallower on the way down.'],
  };
  const anyDrag = $derived(flights.some((x) => x.L.k > 0));

  const fmtShot = (s: Launch) => `${sig(s.u, 3).replace(/\.0+$/, '')} m s⁻¹ · ${s.deg}°${s.h ? ` · ${s.h} m up` : ''}${s.g !== 9.81 ? ` · g ${s.g}` : ''}${s.k ? ' · drag' : ''}`;
</script>

<main class="layout launch" hidden={off}>
  <section class="panel stage" aria-label="Flight">
    <div class="stage-head">
      <div class="label-chip"><small>Flight</small><span>{f ? `Shot ${sel + 1} · ${fmtShot(f.L)}` : 'Set it up and fire'}</span></div>
      <div class="stage-tools">
        <button class="btn" type="button" onclick={replayAll} disabled={!shots.length}>Replay all</button>
        <button class="btn" type="button" onclick={clear} disabled={!shots.length}>Clear</button>
      </div>
    </div>
    <div class="sky">
      <Scene launch={L} shots={trails} {balls} preview={aimF} strobe={prefs.strobe} shadows={prefs.shadows} vectors={prefs.vectors} label="Projectile flight" />
    </div>
    <div class="playbar">
      <button class="btn primary big fire" type="button" onclick={fire}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 18c4-9 10-12 16-12" /><circle cx="20" cy="6" r="2.2" fill="currentColor" /></svg>
        Fire
      </button>
      <button class="btn playbtn" type="button" disabled={!f} onclick={toggle}>
        {player.playing ? 'Pause' : player.t >= player.T && player.T > 0 ? 'Replay' : 'Play'}
      </button>
      <input class="slider scrub" type="range" min="0" max={player.T || 1} step="0.001" value={player.t} disabled={!f}
        aria-label="Time" oninput={(e) => { if (!moving.length) moving = [sel]; player.seek(+e.currentTarget.value); }} />
      <span class="clock">t = {sig(tNow)} s</span>
      <Seg label="Playback speed" options={[['0.25', '×¼'], ['1', '×1'], ['4', '×4']]} value={String(prefs.speed)} onchange={(v) => (prefs.speed = +v)} />
    </div>
    {#if shots.length}
      <div class="shots" role="group" aria-label="Shots">
        {#each shots as s, i (i)}
          <span class="shot" style:--cc={COLORS[i]}>
            <button type="button" aria-pressed={i === sel} onclick={() => select(i)}><i></i>{i + 1} · {fmtShot(s)} → {sig(flights[i].R)} m</button>
            <button type="button" class="x" aria-label="Remove shot {i + 1}" onclick={() => remove(i)}>×</button>
          </span>
        {/each}
      </div>
    {/if}
    <div class="shows" role="group" aria-label="Show">
      <b>Show</b>
      <button type="button" class="fchip" aria-pressed={prefs.aim} onclick={() => (prefs.aim = !prefs.aim)}>Aim line</button>
      <button type="button" class="fchip" aria-pressed={prefs.strobe} onclick={() => (prefs.strobe = !prefs.strobe)}>Strobe images</button>
      <button type="button" class="fchip" aria-pressed={prefs.shadows} onclick={() => (prefs.shadows = !prefs.shadows)}>Shadows</button>
      <button type="button" class="fchip" aria-pressed={prefs.vectors} onclick={() => (prefs.vectors = !prefs.vectors)}>Velocity components</button>
    </div>
  </section>

  <aside class="side">
    <section class="panel ctlpanel" aria-label="Launch settings">
      <div class="ph"><h2>Launch</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Speed <b>{prefs.u} m s⁻¹</b></span>
          <input class="slider" type="range" min="0" max="50" step="0.5" bind:value={prefs.u} /></label>
        <label class="ctl"><span class="ctl-l">Angle above horizontal <b>{prefs.deg}°</b></span>
          <input class="slider" type="range" min={prefs.h > 0 ? -60 : 0} max="90" step="1" bind:value={prefs.deg} /></label>
        <label class="ctl"><span class="ctl-l">Launch height <b>{prefs.h} m</b></span>
          <input class="slider" type="range" min="0" max="80" step="1" bind:value={prefs.h} /></label>
        <div class="ctl"><span class="ctl-l">Gravity <b>g = {prefs.g} N kg⁻¹</b></span>
          <Seg label="Gravity" options={GRAVITY} value={String(prefs.g)} onchange={(v) => (prefs.g = +v)} /></div>
        <div class="ctl"><span class="ctl-l">Air resistance</span>
          <Seg label="Air resistance" options={DRAG} value={String(prefs.k)} onchange={(v) => (prefs.k = +v)} /></div>
        {#if prefs.k > 0}<p class="why">Exam questions ignore air resistance. Turn it on to see why that matters.</p>{/if}
      </div>
    </section>

    <section class="panel" aria-label="Readings">
      <div class="ph"><h2>{f ? `Shot ${sel + 1} at t = ${sig(tNow)} s` : 'Readings'}</h2></div>
      {#if f && p}
        <dl class="reads pad">
          <div><dt>Across</dt><dd>{u(p.x, 'm')}</dd></div>
          <div><dt>Height</dt><dd>{u(p.y, 'm')}</dd></div>
          <div class="h"><dt>v horizontal</dt><dd>{u(p.vx, MS)}</dd></div>
          <div class="v"><dt>v vertical</dt><dd>{u(p.vy, MS)}</dd></div>
          <div><dt>Speed</dt><dd>{u(speed(p), MS)}</dd></div>
          <div><dt>Direction</dt><dd>{Math.abs(dip(p)) < 0.05 ? 'horizontal' : `${sig(Math.abs(dip(p)))}° ${dip(p) > 0 ? 'below' : 'above'}`}</dd></div>
        </dl>
        <div class="ph"><h2>Whole flight</h2></div>
        <dl class="reads pad">
          <div><dt>Time of flight</dt><dd>{u(f.T, 's')}</dd></div>
          <div><dt>Range</dt><dd>{u(f.R, 'm')}</dd></div>
          <div><dt>Greatest height</dt><dd>{u(f.H, 'm')}</dd></div>
          <div><dt>Top reached at</dt><dd>{f.tTop > 0 ? u(f.tTop, 's') : 'launch'}</dd></div>
          <div><dt>Landing speed</dt><dd>{u(speed(f.end), MS)}</dd></div>
          <div><dt>Landing angle</dt><dd>{sig(dip(f.end))}° below</dd></div>
        </dl>
        {#if ideal}<p class="why pad2">Without air resistance it would fly {sig(ideal.R)} m in {sig(ideal.T)} s and reach {sig(ideal.H)} m.</p>{/if}
      {:else}
        <p class="why pad2">Fire a shot to read its position and velocity at any moment.</p>
      {/if}
    </section>

    <section class="panel" aria-label="Examples">
      <div class="ph"><h2>Try these</h2></div>
      <div class="exlist">
        {#each EXAMPLES as ex (ex.id)}
          <button class="exbtn" type="button" onclick={() => example(ex.id)}><b>{ex.name}</b><small>{ex.note}</small></button>
        {/each}
      </div>
    </section>
  </aside>

  <section class="panel graph" aria-label="Graph">
    <div class="ph"><h2>Against time</h2>
      <Seg label="Quantity" options={GRAPHS.map(([v, l, s]) => [v, l, s] as const)} bind:value={prefs.graph} />
    </div>
    {#if flights.length}
      <div class="graph-body">
        <div class="plot-box">
          <Plot xr={range.xr} yr={range.yr} xLabel="t / s" yLabel={AXIS[prefs.graph]} {series} probe h={300}
            now={p ? { x: tNow, y: val(prefs.graph, p) } : null} label="Graph of {AXIS[prefs.graph]} against time" />
        </div>
        <div class="graph-side">
          <p class="why">{WHY[prefs.graph][0]}{anyDrag ? ' ' + WHY[prefs.graph][1] : ''}</p>
          <p class="why">Hover or drag across the graph to read every shot at one moment. The ring is shot {sel + 1} at the time shown above.</p>
        </div>
      </div>
    {:else}
      <p class="why pad2">Each shot you fire is plotted here in its own colour.</p>
    {/if}
  </section>
</main>
