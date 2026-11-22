<script lang="ts">
  /* The Maxwell–Boltzmann distribution of molecular energies, drawn the way the exam wants it: starting at the origin,
     no maximum energy (the tail runs on, getting ever closer to the axis without touching it), and the same area
     under every curve (the same number of molecules). Ea lines with the area beyond each shaded; an optional second
     temperature; an optional histogram of the particles in the box; an optional ×10 view of the tail. */
  import { mb, peakE } from './collide';

  let { T, T2 = null, eas = [], hist = null, mag = false, xmax = 20, label = 'Maxwell–Boltzmann distribution' }: {
    T: number; T2?: number | null;
    eas?: { E: number; name: string; tone: 'a' | 'b' }[];
    hist?: number[] | null; mag?: boolean; xmax?: number; label?: string;
  } = $props();

  const W = 520, H = 270, ML = 40, MR = 16, MT = 18, MB = 40;
  const ymax = $derived(1.12 * Math.max(mb(peakE(T), T), T2 ? mb(peakE(T2), T2) : 0));
  const sx = (e: number) => ML + (e / xmax) * (W - ML - MR);
  const sy = (f: number) => H - MB - (Math.min(f, ymax * 1.05) / ymax) * (H - MT - MB);
  const N = 240;
  const curve = (t: number, k = 1, from = 0) => {
    const pts: string[] = [];
    for (let i = 0; i <= N; i++) { const e = from + ((xmax - from) * i) / N; pts.push(`${i ? 'L' : 'M'}${sx(e).toFixed(1)} ${sy(mb(e, t) * k).toFixed(1)}`); }
    return pts.join('');
  };
  const area = (t: number, from: number) => {
    if (from >= xmax) return '';
    const pts: string[] = [`M${sx(from).toFixed(1)} ${sy(0).toFixed(1)}`];
    for (let i = 0; i <= 120; i++) { const e = from + ((xmax - from) * i) / 120; pts.push(`L${sx(e).toFixed(1)} ${sy(mb(e, t)).toFixed(1)}`); }
    pts.push(`L${sx(xmax).toFixed(1)} ${sy(0).toFixed(1)}Z`);
    return pts.join('');
  };
  const bins = $derived.by(() => {
    if (!hist || !hist.length) return [];
    const bw = 0.5, nb = Math.ceil(xmax / bw), c = new Array(nb).fill(0);
    for (const e of hist) { const i = Math.floor(e / bw); if (i >= 0 && i < nb) c[i]++; }
    return c.map((n, i) => ({ x: i * bw, w: bw, f: n / (hist.length * bw) }));
  });
  const ticks = $derived(Array.from({ length: Math.floor(xmax / 5) + 1 }, (_, i) => i * 5));
  const sorted = $derived([...eas].sort((a, b) => a.E - b.E));      // the smaller Ea (larger area) first, the larger over it
  /** the ×10 tail starts where ten times the curve has dropped back inside the plot */
  const tailFrom = $derived.by(() => {
    let e = eas.length ? Math.max(0, Math.min(...eas.map((x) => x.E)) - 3) : xmax * 0.35;
    while (e < xmax && mb(e, T) * 10 > ymax * 0.9) e += 0.1;
    return e;
  });
</script>

<svg class="mbplot" viewBox="0 0 {W} {H}" role="img" aria-label={label}>
  {#each bins as b (b.x)}
    <rect class="bar" x={sx(b.x)} y={sy(b.f)} width={Math.max(0, sx(b.x + b.w) - sx(b.x) - 1)} height={Math.max(0, sy(0) - sy(b.f))} />
  {/each}
  {#each sorted as e (e.name)}
    <path class="shade {e.tone}" d={area(T, e.E)} />
  {/each}
  {#if T2 && eas.length}<path class="shade t2" d={area(T2, Math.max(...eas.map((e) => e.E)))} />{/if}
  <line class="ax" x1={ML} x2={W - MR + 4} y1={sy(0)} y2={sy(0)} />
  <line class="ax" x1={ML} x2={ML} y1={MT - 6} y2={sy(0)} />
  {#each ticks as t (t)}
    <line class="tk" x1={sx(t)} x2={sx(t)} y1={sy(0)} y2={sy(0) + 5} />
    <text class="tl" x={sx(t)} y={sy(0) + 17} text-anchor="middle">{t}</text>
  {/each}
  <text class="al" x={W - MR} y={H - 6} text-anchor="end">energy / kJ mol⁻¹</text>
  <text class="al" x="14" y={MT} transform="rotate(-90 14 {MT})" text-anchor="end">number of molecules with energy E</text>

  {#if T2}<path class="curve t2" d={curve(T2)} />{/if}
  <path class="curve" d={curve(T)} />
  {#if mag}<path class="curve mag" d={curve(T, 10, tailFrom)} /><text class="note" x={sx(xmax * 0.86)} y={Math.max(MT + 10, sy(mb(xmax * 0.86, T) * 10) - 10)} text-anchor="middle">tail ×10</text>{/if}

  <line class="pk" x1={sx(peakE(T))} x2={sx(peakE(T))} y1={sy(mb(peakE(T), T))} y2={sy(0)} />
  <text class="note" x={sx(peakE(T)) + 6} y={sy(mb(peakE(T), T)) - 6}>{T} K</text>
  <text class="note" x={sx(peakE(T)) + 13} y={sy(0) - 8} transform="rotate(-90 {sx(peakE(T)) + 13} {sy(0) - 8})">most probable energy</text>
  {#if T2}<text class="note t2" x={sx(peakE(T2)) + 6} y={sy(mb(peakE(T2), T2)) - 6}>{T2} K</text>{/if}

  {#each eas as e (e.name)}
    {#if e.E < xmax}
      <line class="ea {e.tone}" x1={sx(e.E)} x2={sx(e.E)} y1={MT + 4} y2={sy(0)} />
      <text class="eal {e.tone}" x={sx(e.E) - 6} y={MT + 6} transform="rotate(-90 {sx(e.E) - 6} {MT + 6})" text-anchor="end">{e.name}</text>
    {/if}
  {/each}
</svg>

<style>
  .mbplot{display:block;width:100%;height:auto;overflow:visible;font-family:var(--f-mono)}
  .ax{stroke:var(--ink);stroke-width:1.6}
  .tk{stroke:var(--ink);stroke-width:1.2}
  .tl{font-size:11px;fill:var(--muted)}
  .al{font-size:11.5px;font-weight:700;fill:var(--ink)}
  .curve{fill:none;stroke:var(--accent);stroke-width:2.8;stroke-linejoin:round}
  .curve.t2{stroke:var(--redox);stroke-dasharray:7 5}
  .curve.mag{stroke-width:1.4;stroke-dasharray:2 4;opacity:.8}
  .bar{fill:color-mix(in srgb,var(--ink) 14%,transparent)}
  .shade.a{fill:color-mix(in srgb,var(--redox) 34%,transparent)}
  .shade.b{fill:color-mix(in srgb,var(--acidbase) 30%,transparent)}
  .shade.t2{fill:none;stroke:var(--redox);stroke-width:1.2;stroke-dasharray:3 3;opacity:.8}
  .pk{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:3 4}
  .note{font-size:11px;fill:var(--muted)}
  .note.t2{fill:var(--redox);font-weight:700}
  .ea{stroke-width:2;stroke-dasharray:6 4}
  .ea.a{stroke:var(--redox)}
  .ea.b{stroke:var(--acidbase)}
  .eal{font-size:11.5px;font-weight:700}
  .eal.a{fill:var(--redox)}
  .eal.b{fill:var(--acidbase)}
</style>
