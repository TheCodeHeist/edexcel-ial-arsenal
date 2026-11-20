<script lang="ts">
  /* Black-body radiation curves: intensity against wavelength (Planck), with the visible band shaded in its colours
     and each curve's peak marked (Wien's law). "Same scale" compares the power from each square metre of surface, so
     a hotter star's curve is taller as well as further left; "Each to its peak" compares only the shapes. */
  import { planck, peak, nmColor, plain } from './data';

  let { curves, norm = false, h = 260, label }: {
    curves: { T: number; color: string; name: string; dashed?: boolean }[]; norm?: boolean; h?: number; label: string;
  } = $props();
  const uid = $props.id();

  const W = 520, ML = 46, MR = 14, MT = 14, MB = 40;
  const xmax = $derived(Math.min(3000, Math.max(1200, 2.6 * Math.max(...curves.map((c) => peak(c.T) * 1e9)))));
  const sx = (nm: number) => ML + (nm / xmax) * (W - ML - MR);
  const sy = (f: number) => h - MB - f * (h - MT - MB) * 0.92;
  const N = 220;
  const data = $derived.by(() => {
    const raw = curves.map((c) => Array.from({ length: N + 1 }, (_, k) => { const nm = 5 + (k / N) * (xmax - 5); return [nm, planck(nm * 1e-9, c.T)] as [number, number]; }));
    const peaks = raw.map((r) => Math.max(...r.map((p) => p[1])));
    const top = Math.max(...peaks);
    return raw.map((r, i) => r.map(([nm, v]) => [nm, v / (norm ? peaks[i] : top)] as [number, number]));
  });
  const xticks = $derived([0, 500, 1000, 1500, 2000, 2500, 3000].filter((t) => t <= xmax));
  const band = Array.from({ length: 38 }, (_, k) => 380 + k * 10);
</script>

<svg class="bb" viewBox="0 0 {W} {h}" role="img" aria-label={label}>
  <defs>
    <linearGradient id="vis-{uid}" x1="0" x2="1">
      {#each band as nm (nm)}<stop offset={(nm - 380) / 370} stop-color={nmColor(nm)} />{/each}
    </linearGradient>
  </defs>
  <rect x={sx(380)} y={MT} width={sx(750) - sx(380)} height={h - MT - MB} fill="url(#vis-{uid})" opacity=".16" />
  <rect x={sx(380)} y={h - MB - 6} width={sx(750) - sx(380)} height="6" fill="url(#vis-{uid})" />
  <text class="vl" x={(sx(380) + sx(750)) / 2} y={MT + 12}>visible</text>
  {#if xmax > 900}<text class="vl" x={(sx(750) + sx(Math.min(xmax, 2400))) / 2} y={MT + 12}>infrared</text>{/if}
  <text class="vl" x={ML + (sx(380) - ML) / 2} y={MT + 12}>UV</text>

  {#each data as d, i (i)}
    {@const c = curves[i]}
    {@const lp = peak(c.T) * 1e9}
    <path class="curve" d={d.map(([nm, f], k) => `${k ? 'L' : 'M'}${sx(nm).toFixed(1)} ${sy(f).toFixed(1)}`).join('')}
      stroke={c.color} stroke-dasharray={c.dashed ? '6 5' : undefined} />
    {#if lp < xmax}
      {@const fy = d.reduce((m, p) => (p[1] > m ? p[1] : m), 0)}
      <path class="pk" d="M{sx(lp)} {sy(fy)} V{h - MB}" stroke={c.color} />
      <text class="pl" x={sx(lp) + 4} y={sy(fy) - 6} fill={c.color}>{c.name} {plain(lp)} nm</text>
    {/if}
  {/each}

  <path class="axis" d="M{ML} {MT} V{h - MB} H{W - MR}" />
  {#each xticks as t (t)}
    <path class="tick" d="M{sx(t)} {h - MB} v5" />
    <text class="tl" x={sx(t)} y={h - MB + 17}>{t}</text>
  {/each}
  <text class="axl" x={(ML + W - MR) / 2} y={h - 5}>wavelength λ / nm</text>
  <text class="axl" transform="translate(16 {(MT + h - MB) / 2}) rotate(-90)">intensity{norm ? ' (each to its peak)' : ''}</text>
</svg>

<style>
  .bb{width:100%;height:auto;display:block;font-family:var(--f-mono)}
  .axis{fill:none;stroke:var(--ink);stroke-opacity:.6;stroke-width:1.4}
  .tick{stroke:var(--ink);stroke-opacity:.5}
  .tl{font-size:10.5px;fill:var(--muted);text-anchor:middle}
  .axl{font-size:11px;fill:var(--muted);text-anchor:middle}
  .vl{font-size:9.5px;fill:var(--muted);text-anchor:middle;text-transform:uppercase;letter-spacing:.08em}
  .curve{fill:none;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
  .pk{stroke-width:1.2;stroke-dasharray:2 4;opacity:.7}
  .pl{font-size:10.5px;font-weight:700;paint-order:stroke;stroke:var(--solid);stroke-width:3px}
</style>
