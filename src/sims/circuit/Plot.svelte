<script lang="ts">
  /* A small physics graph: axes through the origin when it is in range, tidy ticks, recorded points as crosses,
     an optional true curve, an optional best-fit line and a ringed “now” marker.
     probe: hover, or press and drag (touch slides sideways; the page still scrolls up and down), to put a cursor
     on the graph that reads every trace at that x. It stays where it was left until the pointer leaves. */
  let { xr, yr, xLabel, yLabel, points = [], curve = null, line = null, now = null, label, h = 360, trace = false, series = [], probe = false }: {
    xr: [number, number]; yr: [number, number]; xLabel: string; yLabel: string;
    points?: { x: number; y: number }[]; curve?: [number, number][] | null; line?: { m: number; c: number } | null;
    now?: { x: number; y: number } | null; label: string;
    h?: number;          // drawing height (width is always 520)
    trace?: boolean;     // draw the curve as a solid live trace instead of the dashed “true curve”
    series?: { color: string; pts: [number, number][]; name?: string }[];   // extra solid traces, each in its own colour (oscilloscope)
    probe?: boolean;     // read values with a cursor
  } = $props();

  const W = 520, ML = 54, MR = 18, MT = 18, MB = 42;

  /* ---------- the probe cursor ---------- */
  let svg = $state<SVGSVGElement>();
  let cx = $state<number | null>(null);   // cursor position in data units
  const traces = $derived([...series, ...(curve && trace ? [{ color: 'var(--ch1)', pts: curve, name: '' }] : [])]);
  const unit = $derived(yLabel.split(' / ')[1] ?? '');
  const xunit = $derived(xLabel.split(' / ')[1] ?? '');
  /** The trace's value at x, interpolated between its two nearest samples (null outside its samples). */
  function at(pts: [number, number][], x: number): number | null {
    if (pts.length < 2 || x < pts[0][0] || x > pts[pts.length - 1][0]) return null;
    let lo = 0, hi = pts.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m][0] <= x) lo = m; else hi = m; }
    const [x0, y0] = pts[lo], [x1, y1] = pts[hi];
    return x1 > x0 ? y0 + ((y1 - y0) * (x - x0)) / (x1 - x0) : y0;
  }
  function aim(e: PointerEvent) {
    if (!probe || !svg || (e.pointerType !== 'mouse' && e.buttons === 0 && e.type === 'pointermove')) return;
    const m = svg.getScreenCTM(); if (!m) return;
    const px = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse()).x;
    const x = xr[0] + ((px - ML) / (W - ML - MR)) * (xr[1] - xr[0]);
    cx = x < xr[0] || x > xr[1] ? null : x;
  }
  const readout = $derived.by(() => {
    if (cx === null) return null;
    const x = cx;
    const rows = traces.map((t) => ({ color: t.color, name: t.name ?? '', y: at(t.pts, x) }));
    const lines = [`${xLabel.split(' / ')[0]} = ${fmtv(x)} ${xunit}`, ...rows.map((r) => `${r.name ? r.name + '  ' : ''}${r.y === null ? '—' : fmtv(r.y) + ' ' + unit}`)];
    const w = Math.max(...lines.map((l) => l.length)) * 7 + 18, hgt = lines.length * 15 + 10;
    const left = sx(x) + w + 14 > W - MR;
    return { x, rows, lines, w, hgt, bx: left ? sx(x) - w - 8 : sx(x) + 8 };
  });
  const fmtv = (v: number) => { const a = Math.abs(v); return a !== 0 && (a < 1e-3 || a >= 1e5) ? v.toExponential(2) : String(Number(v.toPrecision(3))); };
  const H = $derived(h);
  const ok = $derived(isFinite(xr[0]) && isFinite(xr[1]) && xr[1] > xr[0] && isFinite(yr[0]) && isFinite(yr[1]) && yr[1] > yr[0]);
  const sx = (x: number) => ML + ((x - xr[0]) / (xr[1] - xr[0])) * (W - ML - MR);
  const sy = (y: number) => H - MB - ((y - yr[0]) / (yr[1] - yr[0])) * (H - MT - MB);
  // tolerances scale with the axis, so a tiny range (or a huge one) behaves the same as an ordinary one
  const inX = (x: number) => { const e = (xr[1] - xr[0]) * 1e-6; return x >= xr[0] - e && x <= xr[1] + e; };
  const inY = (y: number) => { const e = (yr[1] - yr[0]) * 1e-6; return y >= yr[0] - e && y <= yr[1] + e; };

  function ticks([a, b]: [number, number]) {
    // an empty or invalid range would make the loop below run for ever: no ticks instead
    if (!isFinite(a) || !isFinite(b) || b - a <= 0) return [];
    const raw = (b - a) / 6, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = ([1, 2, 2.5, 5, 10].find((k) => k * p >= raw) ?? 10) * p;
    const out: number[] = [];
    for (let v = Math.ceil(a / step - 1e-6) * step; v <= b + step * 1e-6 && out.length < 40; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return out;
  }
  const fmt = (v: number) => { const a = Math.abs(v); return a !== 0 && (a < 1e-3 || a >= 1e5) ? v.toExponential(1).replace('e', '×10^') : String(Number(v.toPrecision(3))); };
  const ox = $derived(inX(0) ? sx(0) : sx(xr[0]));
  const oy = $derived(inY(0) ? sy(0) : sy(yr[0]));
  const toPath = (pts: [number, number][]) => pts.filter(([x, y]) => inX(x) && inY(y)).map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join('');
  const path = $derived(curve ? toPath(curve) : '');
  const fitSeg = $derived.by(() => {
    if (!line) return null;
    // clip y = m x + c to the plot box
    const pts: [number, number][] = [];
    for (const x of xr) { const y = line.m * x + line.c; if (inY(y)) pts.push([x, y]); }
    if (line.m !== 0) for (const y of yr) { const x = (y - line.c) / line.m; if (inX(x)) pts.push([x, y]); }
    pts.sort((a, b) => a[0] - b[0]);
    return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<svg class="plot" class:probe bind:this={svg} viewBox="0 0 {W} {H}" role="img" aria-label={label}
  onpointermove={aim} onpointerdown={aim} onpointerleave={(e) => { if (e.pointerType === 'mouse') cx = null; }}>
{#if ok}
  {#each ticks(xr) as t (t)}
    <line class="gl" x1={sx(t)} x2={sx(t)} y1={MT} y2={H - MB} />
    <text class="tk" x={sx(t)} y={Math.min(H - MB, oy) + 16} text-anchor="middle">{t === 0 && inY(0) && inX(0) ? '' : fmt(t)}</text>
  {/each}
  {#each ticks(yr) as t (t)}
    <line class="gl" x1={ML} x2={W - MR} y1={sy(t)} y2={sy(t)} />
    <text class="tk" x={Math.max(ML, ox) - 7} y={sy(t)} text-anchor="end">{t === 0 && inY(0) && inX(0) ? '0' : fmt(t)}</text>
  {/each}
  <line class="ax" x1={ML} x2={W - MR} y1={oy} y2={oy} />
  <line class="ax" x1={ox} x2={ox} y1={MT} y2={H - MB} />
  <text class="al" x={W - MR} y={H - 8} text-anchor="end">{xLabel}</text>
  <text class="al" x={12} y={MT + 2} transform="rotate(-90 12 {MT + 2})" text-anchor="end">{yLabel}</text>

  {#if path}<path class="curve" class:trace d={path} />{/if}
  {#each series as s, i (i)}<path class="curve trace" style:stroke={s.color} d={toPath(s.pts)} />{/each}
  {#if fitSeg}<line class="fit" x1={sx(fitSeg[0][0])} y1={sy(fitSeg[0][1])} x2={sx(fitSeg[1][0])} y2={sy(fitSeg[1][1])} />{/if}
  {#each points as p, i (i)}
    {#if inX(p.x) && inY(p.y)}<path class="pt" d="M{sx(p.x) - 5} {sy(p.y) - 5}l10 10m0 -10l-10 10" />{/if}
  {/each}
  {#if now && inX(now.x) && inY(now.y)}<circle class="now" cx={sx(now.x)} cy={sy(now.y)} r="7" />{/if}
  {#if readout}
    <g class="cursor" aria-hidden="true">
      <line x1={sx(readout.x)} x2={sx(readout.x)} y1={MT} y2={H - MB} />
      {#each readout.rows as r, i (i)}
        {#if r.y !== null && inY(r.y)}<circle cx={sx(readout.x)} cy={sy(r.y)} r="4.5" style:fill={r.color} />{/if}
      {/each}
      <rect x={readout.bx} y={MT + 2} width={readout.w} height={readout.hgt} rx="7" />
      {#each readout.lines as l, i (i)}
        <text x={readout.bx + 9} y={MT + 16 + i * 15} style:fill={i ? readout.rows[i - 1].color : undefined}>{l}</text>
      {/each}
    </g>
  {/if}
{/if}
</svg>

<style>
  .plot.probe{cursor:crosshair;touch-action:pan-y}
  .cursor line{stroke:var(--ink);stroke-width:1.2;stroke-dasharray:4 4;opacity:.7}
  .cursor circle{stroke:var(--solid);stroke-width:2}
  .cursor rect{fill:var(--solid);stroke:var(--rim);stroke-width:1}
  .cursor text{font:600 11.5px var(--f-mono);fill:var(--ink);dominant-baseline:middle;font-variant-numeric:tabular-nums}
  .plot{display:block;width:100%;height:auto;overflow:visible}
  .gl{stroke:color-mix(in srgb,var(--ink) 8%,transparent);stroke-width:1}
  .ax{stroke:var(--ink);stroke-width:1.6}
  .tk{font:500 11px var(--f-mono);fill:var(--muted);dominant-baseline:central;font-variant-numeric:tabular-nums}
  .al{font:700 12px var(--f-mono);fill:var(--ink);letter-spacing:.04em}
  .curve{fill:none;stroke:color-mix(in srgb,var(--accent) 45%,transparent);stroke-width:2.4;stroke-dasharray:7 6;stroke-linejoin:round}
  .curve.trace{stroke:var(--accent);stroke-dasharray:none;stroke-width:2.6}
  .fit{stroke:var(--redox);stroke-width:2.2}
  .pt{stroke:var(--ink);stroke-width:2.2;stroke-linecap:round}
  .now{fill:var(--accent-soft);stroke:var(--accent);stroke-width:2.2;transition:cx .25s var(--ease-out),cy .25s var(--ease-out)}
</style>
