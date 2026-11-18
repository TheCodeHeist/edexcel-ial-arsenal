<script lang="ts" module>
  import type { Flight, Launch } from './physics';
  import type { Shot, Dim, Annot, Target, Wall, Ball } from './scene';
  export type { Shot, Dim, Annot, Target, Wall, Ball };
  let uid = 0;
</script>

<script lang="ts">
  /* The flight scene: ground, cliff and launcher, every shot's path, and the ball in flight with its strobe
     images, shadows and velocity arrows. One SVG unit is one CSS pixel, so labels stay readable on phones, and the
     scale is the same both ways, so angles look right. The view fits whatever it is given and glides when that
     changes. */
  import { Tween } from 'svelte/motion';
  import { cubicOut } from 'svelte/easing';
  import { at, niceStep, speed, rad } from './physics';
  import { RM } from '../../lib/util';

  let { launch, shots = [], balls = [], preview = null, fit = null, strobe = false, shadows = false, vectors = false,
    target = null, wall = null, dims = [], annot = null, label, tall = 0.5, snug = false }: {
    launch: Launch;
    shots?: Shot[];                                   // finished paths, drawn in full
    balls?: Ball[];                                   // flights being played, each drawn up to its t
    preview?: Flight | null;                          // a dashed aiming path
    fit?: { x: number; y: number } | null;           // fit the view to this box (from the launch point) instead of the paths
    strobe?: boolean; shadows?: boolean; vectors?: boolean;
    target?: Target | null; wall?: Wall | null;
    dims?: Dim[];                                     // dimension lines (Predict reveals)
    annot?: Annot | null;                             // the u, θ and h labels of a question's set-up
    label: string;
    tall?: number;                                    // height as a fraction of width (at most)
    snug?: boolean;                                   // shrink the height to what the view needs (no empty sky)
  } = $props();

  let cw = $state(800);
  const W = $derived(Math.max(300, Math.round(cw)));
  const phone = $derived(W < 560);
  const ML = $derived(phone ? 44 : 70), MR = 18, MT = 26, MB = 34;
  const Hmax = $derived(Math.round(Math.min(520, Math.max(260, W * tall))));

  /* ---------- the view: metres → pixels ---------- */
  const want = $derived.by(() => {
    let x = 8, y = Math.max(3, launch.h * 1.15);
    const take = (f: Flight | null | undefined) => { if (f) { x = Math.max(x, f.R, ...f.pts.map((p) => p.x)); y = Math.max(y, f.H); } };
    if (fit) { x = Math.max(x, fit.x); y = Math.max(y, fit.y); }
    else { for (const s of shots) take(s.f); for (const b of balls) take(b.f); take(preview); }
    if (target) { x = Math.max(x, target.x + target.w); y = Math.max(y, target.y); }
    if (wall) { x = Math.max(x, wall.x); y = Math.max(y, wall.h); }
    return { x: x * 1.06, y: y * 1.12 };
  });
  const H = $derived(snug ? Math.round(Math.min(Hmax, Math.max(phone ? 200 : 240, ((W - ML - MR) * want.y) / want.x + MT + MB))) : Hmax);
  const sNow = $derived(Math.min((W - ML - MR) / want.x, (H - MT - MB) / want.y));
  const sc = Tween.of(() => sNow, { duration: RM ? 0 : 550, easing: cubicOut });
  const s = $derived(sc.current);
  const X = (x: number) => ML + x * s;
  const Y = (y: number) => H - MB - y * s;

  /* grid: square, in tidy steps of metres */
  const step = $derived(niceStep((W - ML - MR) / s, phone ? 5 : 9));
  const gx = $derived(Array.from({ length: Math.floor((W - ML - MR) / s / step) + 1 }, (_, i) => i * step));
  const gy = $derived(Array.from({ length: Math.floor((H - MT - MB) / s / step) + 1 }, (_, i) => i * step).filter((v) => v > 0));
  const num = (v: number) => String(Number(v.toPrecision(4)));

  const path = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join('');
  const upTo = (f: Flight, t: number) => [...f.pts.filter((p) => p.t < t), at(f, t)];

  /* the balls in flight */
  const id = `sc${++uid}`;
  const live = $derived(balls.map((b) => {
    const now = at(b.f, b.t);
    const dt = niceStep(Math.max(b.f.T, 0.05), 12);
    const flashes = [];
    if (strobe || shadows) for (let t = 0; t <= b.t + 1e-9 && flashes.length < 80; t += dt) flashes.push(at(b.f, t));
    return { ...b, now, flashes };
  }));
  // velocity arrows: the fastest launch is 70 px long (52 px on phones)
  const vs = $derived((phone ? 52 : 70) / Math.max(4, ...balls.map((b) => Math.max(b.f.L.u, speed(b.f.end)))));

  function arrow(x1: number, y1: number, x2: number, y2: number, head = 8) {
    const a = Math.atan2(y2 - y1, x2 - x1), len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 2) return { line: '', head: '' };
    const hl = Math.min(head, len * 0.6), bx = x2 - hl * Math.cos(a), by = y2 - hl * Math.sin(a), w = hl * 0.5;
    return {
      line: `M${x1.toFixed(1)} ${y1.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`,
      head: `M${x2.toFixed(1)} ${y2.toFixed(1)}L${(bx + w * Math.sin(a)).toFixed(1)} ${(by - w * Math.cos(a)).toFixed(1)}L${(bx - w * Math.sin(a)).toFixed(1)} ${(by + w * Math.cos(a)).toFixed(1)}Z`,
    };
  }
  function vec(now: { x: number; y: number; vx: number; vy: number }) {
    const bx = X(now.x), by = Y(now.y), hx = bx + now.vx * vs, vy = by - now.vy * vs;
    return { h: arrow(bx, by, hx, by), v: arrow(bx, by, bx, vy), r: arrow(bx, by, hx, vy), hx, vy, bx, by };
  }

  /* the launcher */
  const lx = $derived(X(0)), ly = $derived(Y(launch.h));
  const cliffW = $derived(ML - 8);
  const uArrow = $derived(arrow(lx, ly, lx + 62 * Math.cos(rad(launch.deg)), ly - 62 * Math.sin(rad(launch.deg)), 9));
  const arcR = 30;
  const arc = $derived.by(() => {
    const a = rad(launch.deg), ex = lx + arcR * Math.cos(a), ey = ly - arcR * Math.sin(a);
    return `M${lx + arcR} ${ly}A${arcR} ${arcR} 0 0 ${launch.deg >= 0 ? 0 : 1} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  });

  function dimLine(d: Dim) {
    const o = d.off ?? 0, vert = d.a[0] === d.b[0];
    const x1 = X(d.a[0]) + (vert ? o : 0), y1 = Y(d.a[1]) + (vert ? 0 : o), x2 = X(d.b[0]) + (vert ? o : 0), y2 = Y(d.b[1]) + (vert ? 0 : o);
    const a1 = arrow((x1 + x2) / 2, (y1 + y2) / 2, x1, y1, 7), a2 = arrow((x1 + x2) / 2, (y1 + y2) / 2, x2, y2, 7);
    return { a1, a2, mx: (x1 + x2) / 2, my: (y1 + y2) / 2, vert, x1, y1, x2, y2 };
  }
  const tw = (t: string) => t.length * 7.4 + 14;
</script>

<div class="scene" bind:clientWidth={cw}>
<svg viewBox="0 0 {W} {H}" width={W} height={H} role="img" aria-label={label} class:phone>
  <defs>
    <clipPath id="{id}c"><rect x="0" y="0" width={W} height={H} /></clipPath>
    <pattern id="{id}r" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" class="hatch" />
    </pattern>
  </defs>
  <g clip-path="url(#{id}c)">
    <!-- grid in metres -->
    {#each gx as v (v)}<line class="gl" x1={X(v)} x2={X(v)} y1={MT - 20} y2={Y(0)} />{/each}
    {#each gy as v (v)}<line class="gl" x1={lx} x2={W} y1={Y(v)} y2={Y(v)} />{/each}
    {#each gy as v (v)}<text class="tk" x={W - 6} y={Y(v) - 6} text-anchor="end">{num(v)}</text>{/each}

    <!-- ground -->
    <rect class="earth" x="0" y={Y(0)} width={W} height={MB + 2} />
    <line class="groundline" x1="0" x2={W} y1={Y(0)} y2={Y(0)} />
    {#each gx as v (v)}<text class="tk" x={X(v)} y={Y(0) + 17} text-anchor="middle">{num(v)}</text>{/each}
    <text class="tk unit" x={W - 6} y={Y(0) + 29} text-anchor="end">metres</text>

    <!-- target and wall -->
    {#if wall}
      <rect class="wall" x={X(wall.x) - Math.max(3, 0.4 * s)} y={Y(wall.h)} width={Math.max(6, 0.8 * s)} height={Y(0) - Y(wall.h)} />
    {/if}
    {#if target}
      {@const tx1 = X(target.x - target.w / 2)}
      {@const tx2 = X(target.x + target.w / 2)}
      {@const ty = Y(target.y)}
      {#if target.y > 0}<rect class="plat" x={tx1} y={ty} width={tx2 - tx1} height={Y(0) - ty} />{/if}
      <rect class="tzone" x={tx1} y={ty - 3} width={tx2 - tx1} height="6" rx="3" />
      <path class="pole" d="M{tx2} {ty} V{ty - 34}" />
      <path class="flag" d="M{tx2} {ty - 34} l-16 6 l16 6 Z" />
    {/if}

    <!-- cliff and launcher -->
    {#if launch.h > 0}
      <rect class="cliff" x={lx - cliffW} y={ly} width={cliffW} height={Y(0) - ly} />
      <rect fill="url(#{id}r)" x={lx - cliffW} y={ly} width={cliffW} height={Y(0) - ly} />
      <line class="cliffedge" x1={lx - cliffW} x2={lx} y1={ly} y2={ly} />
      <line class="cliffedge" x1={lx} x2={lx} y1={ly} y2={Y(0)} />
    {/if}

    <!-- paths -->
    {#each shots as sh, i (i)}
      <path class="trail" style:stroke={sh.color} d={path(sh.f.pts)} />
      <circle class="landed" cx={X(sh.f.end.x)} cy={Y(sh.f.end.y)} r="3.5" style:fill={sh.color} />
    {/each}
    {#if preview}<path class="aim" d={path(preview.pts)} />{/if}

    {#each live as b, bi (bi)}
      {#if shadows}
        {#each b.flashes as p, i (i)}
          <circle class="shadow h" cx={X(p.x)} cy={Y(0)} r="3.2" />
          <circle class="shadow v" cx={lx} cy={Y(p.y)} r="3.2" />
        {/each}
        <line class="drop" x1={X(b.now.x)} y1={Y(b.now.y)} x2={X(b.now.x)} y2={Y(0)} />
        <line class="drop" x1={X(b.now.x)} y1={Y(b.now.y)} x2={lx} y2={Y(b.now.y)} />
        <circle class="shadow h now" cx={X(b.now.x)} cy={Y(0)} r="5" />
        <circle class="shadow v now" cx={lx} cy={Y(b.now.y)} r="5" />
      {/if}
      <path class="trail live" style:stroke={b.color} d={path(upTo(b.f, b.t))} />
      {#if strobe}
        {#each b.flashes as p, i (i)}<circle class="ghost" cx={X(p.x)} cy={Y(p.y)} r="5.5" style:stroke={b.color} />{/each}
      {/if}
    {/each}

    <!-- launcher on top of the paths -->
    <g class="launcher">
      <rect x={lx - 3} y={ly - 5} width="34" height="10" rx="5" transform="rotate({-launch.deg} {lx} {ly})" />
      <circle cx={lx} cy={ly} r="8" />
    </g>
    {#if annot}
      {#if annot.u}
        <path class="ua" d={uArrow.line} /><path class="uah" d={uArrow.head} />
        <text class="alab" x={lx + 70 * Math.cos(rad(launch.deg)) + 6} y={ly - 70 * Math.sin(rad(launch.deg)) - 4}>{annot.u}</text>
      {/if}
      {#if annot.deg && launch.deg !== 0}
        <line class="ref" x1={lx} x2={lx + arcR + 16} y1={ly} y2={ly} />
        <path class="arc" d={arc} />
        <text class="alab sm" x={lx + arcR + 6} y={ly + (launch.deg > 0 ? -7 : 16)}>{annot.deg}</text>
      {/if}
      {#if annot.h && launch.h > 0}
        {@const d = dimLine({ a: [0, 0], b: [0, launch.h], label: annot.h })}
        <g transform="translate({-cliffW / 2} 0)">
          <path class="dim" d={d.a1.line + d.a2.line} /><path class="dimh" d={d.a1.head + d.a2.head} />
          <rect class="dlab" x={d.mx - tw(annot.h) / 2} y={d.my - 11} width={tw(annot.h)} height="22" rx="11" />
          <text class="dtext" x={d.mx} y={d.my + 1} text-anchor="middle">{annot.h}</text>
        </g>
      {/if}
    {/if}

    {#each dims as dm, i (i)}
      {@const d = dimLine(dm)}
      <g class="dimg">
        <path class="dim" d={d.a1.line + d.a2.line} /><path class="dimh" d={d.a1.head + d.a2.head} />
        <rect class="dlab" x={d.mx - tw(dm.label) / 2} y={d.my - 11} width={tw(dm.label)} height="22" rx="11" />
        <text class="dtext" x={d.mx} y={d.my + 1} text-anchor="middle">{dm.label}</text>
      </g>
    {/each}

    {#each live as b, bi (bi)}
      {#if vectors}
        {@const v = vec(b.now)}
        <path class="va r" d={v.r.line} /><path class="vh r" d={v.r.head} />
        <path class="va h" d={v.h.line} /><path class="vh h" d={v.h.head} />
        <path class="va v" d={v.v.line} /><path class="vh v" d={v.v.head} />
        {#if Math.abs(v.hx - v.bx) > 14}<text class="vlab h" x={v.hx + 5} y={v.by + 14}>v<tspan dy="3" font-size="9">H</tspan></text>{/if}
        {#if Math.abs(v.vy - v.by) > 14}<text class="vlab v" x={v.bx - 8} y={v.vy + (b.now.vy > 0 ? -4 : 12)} text-anchor="end">v<tspan dy="3" font-size="9">V</tspan></text>{/if}
      {/if}
      <circle class="ball" cx={X(b.now.x)} cy={Y(b.now.y)} r="7" style:fill={b.color} />
    {/each}
  </g>
</svg>
</div>

<style>
  .scene{width:100%;min-width:0;line-height:0}
  svg{display:block;max-width:100%;height:auto;overflow:hidden;font-family:var(--f-mono)}
  .gl{stroke:color-mix(in srgb,var(--ink) 7%,transparent);stroke-width:1}
  .tk{font:500 10.5px var(--f-mono);fill:var(--muted);font-variant-numeric:tabular-nums}
  .tk.unit{font-size:9.5px;letter-spacing:.08em;text-transform:uppercase}
  .earth{fill:color-mix(in srgb,var(--ink) 6%,transparent)}
  .groundline{stroke:var(--ink);stroke-width:1.8;opacity:.75}
  .cliff{fill:var(--solid)}
  
  .hatch{stroke:color-mix(in srgb,var(--ink) 16%,transparent);stroke-width:1.4}
  .cliffedge{stroke:var(--ink);stroke-width:1.8;opacity:.75}
  .wall{fill:var(--solid);stroke:var(--ink);stroke-width:1.6;stroke-opacity:.7}
  .plat{fill:var(--solid);stroke:var(--ink);stroke-width:1.6;stroke-opacity:.6}
  .tzone{fill:var(--acidbase)}
  .pole{stroke:var(--ink);stroke-width:1.6;opacity:.7}
  .flag{fill:var(--acidbase)}
  .trail{fill:none;stroke-width:2.4;stroke-linejoin:round;stroke-linecap:round;opacity:.5}
  .trail.live{opacity:1;stroke-width:2.8}
  .landed{opacity:.7}
  .aim{fill:none;stroke:var(--ink);stroke-opacity:.45;stroke-width:1.8;stroke-dasharray:6 6}
  .ghost{fill:var(--solid);stroke-width:2;opacity:.75}
  .shadow.h{fill:var(--accent);opacity:.55} .shadow.v{fill:var(--redox);opacity:.55}
  .shadow.now{opacity:1}
  .drop{stroke:var(--ink);stroke-opacity:.3;stroke-width:1.2;stroke-dasharray:3 4}
  .launcher rect{fill:var(--ink);opacity:.85}
  .launcher circle{fill:var(--solid);stroke:var(--ink);stroke-width:2.4}
  .ball{stroke:var(--solid);stroke-width:2.2}
  .va{fill:none;stroke-width:2.6;stroke-linecap:round}
  .va.h,.vh.h{stroke:var(--accent)} .vh.h,.vlab.h{fill:var(--accent)}
  .va.v,.vh.v{stroke:var(--redox)} .vh.v,.vlab.v{fill:var(--redox)}
  .va.r{stroke:var(--ink);stroke-dasharray:5 4} .vh.r{fill:var(--ink)}
  .vh{stroke:none}
  .vlab{font:700 12px var(--f-mono)}
  .ua{stroke:var(--accent);stroke-width:2.4;fill:none;stroke-linecap:round} .uah{fill:var(--accent)}
  .ref{stroke:var(--ink);stroke-opacity:.45;stroke-width:1.3;stroke-dasharray:4 4}
  .arc{fill:none;stroke:var(--amph);stroke-width:2}
  .alab{font:700 13px var(--f-mono);fill:var(--ink);paint-order:stroke;stroke:var(--bg);stroke-width:4px;stroke-linejoin:round}
  .alab.sm{font-size:12px;fill:var(--amph)}
  .dim{fill:none;stroke:var(--amph);stroke-width:1.8}
  .dimh{fill:var(--amph)}
  .dlab{fill:var(--solid);stroke:var(--amph);stroke-width:1.5}
  .dtext{font:700 12px var(--f-mono);fill:var(--ink);dominant-baseline:central;font-variant-numeric:tabular-nums}
  .dimg{animation:popin .35s var(--spring) backwards}
  .phone .tk{font-size:9.5px}
</style>
