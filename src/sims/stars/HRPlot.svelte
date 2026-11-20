<script lang="ts" module>
  export interface HRDot { id: string; T: number; L: number; R: number; label?: string; group?: string; la?: [dx: number, dy: number, anchor?: 'start' | 'end'] }
</script>

<script lang="ts">
  /* A Hertzsprung–Russell diagram: luminosity (L☉, log scale) up, surface temperature (K, log scale) across with hot
     stars on the LEFT, as the course draws it. Optional layers: the regions (main sequence, giants, supergiants,
     white dwarfs), lines of constant radius (L = σ4πR²T⁴), the spectral classes along the top, named stars as dots
     in their own colour, evolutionary tracks and a ringed "now" marker. */
  import { bbCss, CLASSES, sup, TSUN, short } from './data';
  import { msLum, msTemp } from './evolve';

  let {
    tr = [50000, 2400], lr = [1e-5, 1e7], h = 420, stars = [], sel = null, onpick, tracks = [], now = null, nowNote = '',
    regions = true, radii = true, classes = true, labels = true, label, compact = false, strip = true,
  }: {
    tr?: [number, number]; lr?: [number, number]; h?: number; stars?: HRDot[]; sel?: string | null; onpick?: (id: string) => void;
    tracks?: { pts: [number, number][]; color: string; dashed?: boolean; width?: number }[];
    now?: { T: number; L: number; color: string } | null; nowNote?: string;
    regions?: boolean; radii?: boolean; classes?: boolean; labels?: boolean; label: string; compact?: boolean; strip?: boolean;
  } = $props();

  const uid = $props.id();
  const W = 520;
  const ML = $derived(compact ? 46 : 56), MR = 14, MT = $derived(classes ? 30 : 14), MB = $derived(compact ? 36 : 44);
  const lx = (T: number) => Math.log10(T), ly = (L: number) => Math.log10(L);
  const sx = (T: number) => ML + ((lx(tr[0]) - lx(T)) / (lx(tr[0]) - lx(tr[1]))) * (W - ML - MR);
  const sy = (L: number) => h - MB - ((ly(L) - ly(lr[0])) / (ly(lr[1]) - ly(lr[0]))) * (h - MT - MB);
  const inside = (T: number, L: number) => T <= tr[0] && T >= tr[1] && L >= lr[0] && L <= lr[1];

  // temperature ticks: keep each one at least 44 units clear of the last, so wide ranges don't crowd
  const tTicks = $derived.by(() => {
    const out: number[] = [];
    for (const t of [100000, 50000, 40000, 30000, 20000, 10000, 6000, 5000, 4000, 3000, 2500]) {
      if (t > tr[0] || t < tr[1]) continue;
      if (out.length && sx(t) - sx(out[out.length - 1]) < 44) continue;
      out.push(t);
    }
    return out;
  });
  const lTicks = $derived.by(() => {
    const out: number[] = [];
    const a = Math.ceil(ly(lr[0])), b = Math.floor(ly(lr[1]));
    const step = b - a > 8 ? 2 : 1;
    for (let e = a; e <= b; e += step) out.push(e);
    return out;
  });
  const fmtT = (t: number) => (t >= 1000 ? `${t / 1000} 000` : String(t));
  const tFmt = (t: number) => fmtT(t).replace(' 000', ' 000');

  const path = (pts: [number, number][]) => pts.map(([T, L], i) => `${i ? 'L' : 'M'}${sx(T).toFixed(1)} ${sy(L).toFixed(1)}`).join('');

  /* the main sequence as a band */
  const msPts = $derived.by(() => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 60; k++) { const M = 0.1 * 500 ** (k / 60); pts.push([msTemp(M), msLum(M)]); }
    return pts.filter(([T, L]) => inside(T, L));
  });
  /* constant-radius lines, clipped to the plot */
  const RADII = [0.001, 0.01, 0.1, 1, 10, 100, 1000];
  const radLines = $derived(RADII.map((R) => {
    const pts: [number, number][] = [];
    for (let k = 0; k <= 40; k++) {
      const T = tr[1] * (tr[0] / tr[1]) ** (k / 40);
      const L = R * R * (T / TSUN) ** 4;
      if (L >= lr[0] && L <= lr[1]) pts.push([T, L]);
    }
    return { R, pts };
  }).filter((x) => x.pts.length > 1));

  const r = (d: HRDot) => Math.max(2.6, Math.min(9, 4 + 1.3 * Math.log10(Math.max(d.R, 1e-3))));
  const cls = $derived(CLASSES.map(([c, lo, hi]) => ({ c, a: sx(Math.min(hi, tr[0])), b: sx(Math.max(lo, tr[1])), T: Math.sqrt(lo * hi) })).filter((k) => k.b > k.a + 2));
</script>

<svg class="hr" class:compact viewBox="0 0 {W} {h}" role="img" aria-label={label}>
  <defs>
    <clipPath id="clip-{uid}"><rect x={ML} y={MT} width={W - ML - MR} height={h - MT - MB} /></clipPath>
    <linearGradient id="sky-{uid}" x1="0" x2="1">
      <stop offset="0" stop-color={bbCss(tr[0])} stop-opacity=".1" />
      <stop offset=".5" stop-color={bbCss(6000)} stop-opacity=".04" />
      <stop offset="1" stop-color={bbCss(tr[1])} stop-opacity=".1" />
    </linearGradient>
  </defs>
  <rect class="sky" x={ML} y={MT} width={W - ML - MR} height={h - MT - MB} fill="url(#sky-{uid})" />

  {#if classes}
    {#each cls as k (k.c)}
      <rect x={k.a} y={MT - 18} width={k.b - k.a - 1} height="12" rx="3" fill={bbCss(k.T)} opacity=".85" />
      <text class="cls" x={(k.a + k.b) / 2} y={MT - 9}>{k.c}</text>
    {/each}
  {/if}

  <g clip-path="url(#clip-{uid})">
    {#if radii}
      {#each radLines as rl (rl.R)}
        {@const end = rl.pts[rl.pts.length - 1]}
        <path class="rad" d={path(rl.pts)} />
        {#if !compact && sy(end[1]) > MT + 30}<text class="radl" x={sx(end[0]) - 3} y={sy(end[1]) + 11}>{short(rl.R)} R☉</text>{/if}
      {/each}
    {/if}
    {#if regions}
      <path class="msband" d={path(msPts)} />
      <ellipse class="region" cx={sx(4300)} cy={sy(150)} rx={(sx(3300) - sx(5600)) / 2} ry={(sy(15) - sy(1500)) / 2} />
      <rect class="region" x={sx(tr[0] * 0.9)} y={sy(1e6)} width={sx(3200) - sx(tr[0] * 0.9)} height={sy(1.5e4) - sy(1e6)} rx="14" />
      <ellipse class="region" cx={sx(14000)} cy={sy(2e-3)} rx={(sx(5500) - sx(40000)) / 2} ry={(sy(1.5e-4) - sy(3e-2)) / 2} />
      {#if labels}
        <text class="rlab" x={sx(9000)} y={sy(12)} transform="rotate({compact ? 30 : 32} {sx(9000)} {sy(12)})">Main sequence</text>
        <text class="rlab" x={sx(4300)} y={sy(1500) - 6}>Red giants</text>
        <text class="rlab" x={sx(Math.min(tr[0] * 0.7, 30000))} y={sy(1e6) + 15}>Blue supergiants</text>
        <text class="rlab" x={sx(3900)} y={sy(1e6) + 15}>Red supergiants</text>
        <text class="rlab" x={sx(14000)} y={sy(1.5e-4) + 16}>White dwarfs</text>
      {/if}
    {/if}
    {#if strip && regions}
      <!-- the instability strip: where giants and supergiants pulsate as Cepheid variables -->
      <path class="strip" d="M{sx(7600)} {sy(60)} L{sx(6300)} {sy(1.5e5)} L{sx(5000)} {sy(1.5e5)} L{sx(5900)} {sy(60)} Z" />
      {#if labels}
        <text class="rlab slab2" x={sx(6300)} y={sy(400)} transform="rotate(-62 {sx(6300)} {sy(400)})">Cepheids</text>
      {/if}
    {/if}
    {#each tracks as t, i (i)}
      <path class="track" d={path(t.pts)} stroke={t.color} stroke-width={t.width ?? 2.4} stroke-dasharray={t.dashed ? '5 5' : undefined} />
    {/each}
    {#each stars as d (d.id)}
      {#if inside(d.T, d.L)}
        {#snippet body()}
          <circle cx={sx(d.T)} cy={sy(d.L)} r={r(d) + 7} class="hit" />
          {#if sel === d.id}<circle cx={sx(d.T)} cy={sy(d.L)} r={r(d) + 4.5} class="ring" />{/if}
          <circle cx={sx(d.T)} cy={sy(d.L)} r={r(d)} fill={bbCss(d.T)} class="body" />
          {#if d.label && labels}
            {@const [dx, dy, an] = d.la ?? [0, 0, 'start']}
            <text class="slab" text-anchor={an ?? 'start'} x={sx(d.T) + (an === 'end' ? -(r(d) + 4) : r(d) + 4) + dx} y={sy(d.L) + 4 + dy}>{d.label}</text>
          {/if}
        {/snippet}
        {#if onpick}
          <g class="dot pick" class:sel={sel === d.id} role="button" tabindex="0" aria-label={d.label ?? d.id}
            onclick={() => onpick(d.id)} onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onpick(d.id); } }}>
            {@render body()}
          </g>
        {:else}
          <g class="dot" class:sel={sel === d.id}>{@render body()}</g>
        {/if}
      {/if}
    {/each}
    {#if now && inside(now.T, now.L)}
      <circle class="now-halo" cx={sx(now.T)} cy={sy(now.L)} r="13" fill={now.color} />
      <circle class="now" cx={sx(now.T)} cy={sy(now.L)} r="6.5" fill={now.color} />
    {/if}
  </g>
  {#if nowNote}<text class="note" x={W - MR - 6} y={MT + 16}>{nowNote}</text>{/if}

  <!-- axes -->
  <path class="axis" d="M{ML} {MT} V{h - MB} H{W - MR}" />
  {#each tTicks as t (t)}
    <path class="tick" d="M{sx(t)} {h - MB} v5" />
    <text class="tl" x={sx(t)} y={h - MB + 17}>{tFmt(t)}</text>
  {/each}
  {#each lTicks as e (e)}
    <path class="tick" d="M{ML - 5} {sy(10 ** e)} h5" />
    <text class="ll" x={ML - 8} y={sy(10 ** e) + 4}>10{sup(e)}</text>
  {/each}
  <text class="axl" x={(ML + W - MR) / 2} y={h - 6}>surface temperature / K  ←  hotter</text>
  <text class="axl" transform="translate({compact ? 12 : 14} {(MT + h - MB) / 2}) rotate(-90)">luminosity / L☉</text>
</svg>

<style>
  .hr{width:100%;height:auto;display:block;font-family:var(--f-mono);overflow:visible}
  .sky{stroke:var(--rim)}
  .axis{fill:none;stroke:var(--ink);stroke-opacity:.6;stroke-width:1.4}
  .tick{stroke:var(--ink);stroke-opacity:.5}
  .tl,.ll{font-size:10.5px;fill:var(--muted);font-variant-numeric:tabular-nums}
  .tl{text-anchor:middle} .ll{text-anchor:end}
  .axl{font-size:11px;fill:var(--muted);text-anchor:middle;letter-spacing:.04em}
  .cls{font-size:9.5px;font-weight:700;text-anchor:middle;fill:#111}
  .rad{fill:none;stroke:var(--ink);stroke-opacity:.16;stroke-dasharray:2 5}
  .radl{font-size:9.5px;fill:var(--muted);text-anchor:end;opacity:.8}
  .msband{fill:none;stroke:var(--accent);stroke-opacity:.16;stroke-width:22;stroke-linecap:round;stroke-linejoin:round}
  .compact .msband{stroke-width:16}
  .strip{fill:#e0a82e;fill-opacity:.14;stroke:#e0a82e;stroke-opacity:.5;stroke-dasharray:3 3}
  .slab2{fill:#b07d10}
  :global([data-mode="dark"]) .slab2{fill:#f2c14e}
  .region{fill:var(--ink);fill-opacity:.045;stroke:var(--ink);stroke-opacity:.14;stroke-dasharray:3 4}
  .rlab{font-size:10.5px;fill:var(--muted);text-anchor:middle;font-weight:600;letter-spacing:.06em;text-transform:uppercase}
  .compact .rlab{font-size:9.5px}
  .track{fill:none;stroke-linecap:round;stroke-linejoin:round;opacity:.9}
  .dot .hit{fill:transparent}
  .dot.pick{cursor:pointer}
  .dot .body{stroke:color-mix(in srgb,var(--ink) 55%,transparent);stroke-width:1}
  .dot .ring{fill:none;stroke:var(--accent);stroke-width:2.2}
  .dot.pick:hover .body,.dot.pick:focus-visible .body{stroke:var(--accent);stroke-width:2}
  .dot:focus{outline:none}
  .slab{font-size:10.5px;fill:var(--ink);font-family:var(--f-body);paint-order:stroke;stroke:var(--solid);stroke-width:3px;stroke-linejoin:round}
  .dot.sel .slab{font-weight:700}
  .now{stroke:var(--ink);stroke-width:1.5}
  .now-halo{opacity:.3;animation:hrpulse 1.8s ease-in-out infinite}
  .note{font-size:10.5px;fill:var(--amph);text-anchor:end;font-weight:700}
  @keyframes hrpulse{50%{opacity:.08}}
  @media (prefers-reduced-motion: reduce){ .now-halo{animation:none} }
</style>
