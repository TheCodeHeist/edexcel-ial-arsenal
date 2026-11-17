<script lang="ts">
  /* A small physics graph: axes through the origin when it is in range, tidy ticks, recorded points as crosses,
     an optional true curve, an optional best-fit line and a ringed “now” marker. */
  let { xr, yr, xLabel, yLabel, points = [], curve = null, line = null, now = null, label, h = 360, trace = false }: {
    xr: [number, number]; yr: [number, number]; xLabel: string; yLabel: string;
    points?: { x: number; y: number }[]; curve?: [number, number][] | null; line?: { m: number; c: number } | null;
    now?: { x: number; y: number } | null; label: string;
    h?: number;          // drawing height (width is always 520)
    trace?: boolean;     // draw the curve as a solid live trace instead of the dashed “true curve”
  } = $props();

  const W = 520, ML = 54, MR = 18, MT = 18, MB = 42;
  const H = $derived(h);
  const sx = (x: number) => ML + ((x - xr[0]) / (xr[1] - xr[0])) * (W - ML - MR);
  const sy = (y: number) => H - MB - ((y - yr[0]) / (yr[1] - yr[0])) * (H - MT - MB);
  const inX = (x: number) => x >= xr[0] - 1e-9 && x <= xr[1] + 1e-9;
  const inY = (y: number) => y >= yr[0] - 1e-9 && y <= yr[1] + 1e-9;

  function ticks([a, b]: [number, number]) {
    const raw = (b - a) / 6, p = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = ([1, 2, 2.5, 5, 10].find((k) => k * p >= raw) ?? 10) * p;
    const out: number[] = [];
    for (let v = Math.ceil(a / step - 1e-9) * step; v <= b + 1e-9; v += step) out.push(Math.abs(v) < step * 1e-6 ? 0 : v);
    return out;
  }
  const fmt = (v: number) => String(Number(v.toPrecision(3)));
  const ox = $derived(inX(0) ? sx(0) : sx(xr[0]));
  const oy = $derived(inY(0) ? sy(0) : sy(yr[0]));
  const path = $derived(curve ? curve.filter(([x, y]) => inX(x) && inY(y)).map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(y).toFixed(1)}`).join('') : '');
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

<svg class="plot" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
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
  {#if fitSeg}<line class="fit" x1={sx(fitSeg[0][0])} y1={sy(fitSeg[0][1])} x2={sx(fitSeg[1][0])} y2={sy(fitSeg[1][1])} />{/if}
  {#each points as p, i (i)}
    {#if inX(p.x) && inY(p.y)}<path class="pt" d="M{sx(p.x) - 5} {sy(p.y) - 5}l10 10m0 -10l-10 10" />{/if}
  {/each}
  {#if now && inX(now.x) && inY(now.y)}<circle class="now" cx={sx(now.x)} cy={sy(now.y)} r="7" />{/if}
</svg>

<style>
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
