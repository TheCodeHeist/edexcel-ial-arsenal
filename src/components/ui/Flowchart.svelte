<script lang="ts" module>
  export interface FlowEdge {
    from: string; to: string;
    color: string;          // CSS colour, usually a family token: 'var(--redox)'
    label: string;          // HTML (already formatted with chem())
    sub?: string;           // HTML, shown small under the label
    title?: string;
    dim?: boolean;          // faded by a filter
  }
  export interface FlowSize { w: number; h: number; cs: number; rs: number; pad: number }
  let uid = 0;
</script>

<script lang="ts">
  /* A reaction map (design book §7, §9): boxes on a grid, arrows between them coloured by family, a label on each
     arrow. Below 760px the map is transposed so chains run downwards; it scales to fit (never below 74%) and shows a
     "scroll sideways" hint if it is still too wide.
     edges="curve": reciprocal pairs bow apart (d-Block); edges="straight": reciprocal pairs run side by side. */
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';

  let { title, tip, nodes, edges, size, narrowSize, shape = 'curve', box, boxClass, boxLabel, onbox, cls = '' }: {
    title: string; tip?: string;
    nodes: Record<string, readonly [number, number]>;
    edges: FlowEdge[];
    size: FlowSize; narrowSize?: FlowSize;
    shape?: 'curve' | 'straight';
    box: Snippet<[string]>;
    boxClass?: (id: string) => string; boxLabel?: (id: string) => string; onbox?: (id: string) => void;
    cls?: string;
  } = $props();

  const me = ++uid;
  let narrow = $state(false);
  let scroller: HTMLElement;
  let k = $state(1), avail = $state(0);

  const S = $derived(narrow && narrowSize ? narrowSize : size);
  const pos = $derived(Object.fromEntries(Object.entries(nodes).map(([id, [c, r]]) => [id, narrow ? [r, c] : [c, r]])) as Record<string, [number, number]>);
  const W = $derived(Math.max(...Object.values(pos).map((p) => p[0])) * S.cs + S.w + S.pad * 2);
  const H = $derived(Math.max(...Object.values(pos).map((p) => p[1])) * S.rs + S.h + S.pad * 2);
  const ctr = (id: string): [number, number] => [S.pad + pos[id][0] * S.cs + S.w / 2, S.pad + pos[id][1] * S.rs + S.h / 2];

  function exit(cx: number, cy: number, dx: number, dy: number, bw: number, bh: number): [number, number] {
    const t = Math.min(dx ? bw / 2 / Math.abs(dx) : Infinity, dy ? bh / 2 / Math.abs(dy) : Infinity);
    return [cx + dx * t, cy + dy * t];
  }

  const colors = $derived([...new Set(edges.map((e) => e.color))]);
  const drawn = $derived.by(() => {
    const pairs = new Set(edges.map((e) => e.from + '>' + e.to));
    return edges.filter((e) => pos[e.from] && pos[e.to]).map((e) => {
      const [x1, y1] = ctr(e.from), [x2, y2] = ctr(e.to);
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len;
      const both = pairs.has(e.to + '>' + e.from);
      let d: string, lx: number, ly: number;
      if (shape === 'curve') {
        const bend = both ? 46 : 0, cx = (x1 + x2) / 2 + nx * bend, cy = (y1 + y2) / 2 + ny * bend;
        const [sx, sy] = exit(x1, y1, cx - x1, cy - y1, S.w + 8, S.h + 8);
        const [ex, ey] = exit(x2, y2, cx - x2, cy - y2, S.w + 8, S.h + 8);
        const qx = 2 * cx - (sx + ex) / 2, qy = 2 * cy - (sy + ey) / 2;
        d = `M${sx.toFixed(1)},${sy.toFixed(1)} Q${qx.toFixed(1)},${qy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
        lx = 0.25 * sx + 0.5 * qx + 0.25 * ex; ly = 0.25 * sy + 0.5 * qy + 0.25 * ey;
      } else {
        const off = both ? 16 : 0, ux = dx / len, uy = dy / len;
        const [sx, sy] = exit(x1 + nx * off, y1 + ny * off, ux, uy, S.w + 6, S.h + 6);
        const [ex, ey] = exit(x2 + nx * off, y2 + ny * off, -ux, -uy, S.w + 14, S.h + 14);
        d = `M${sx.toFixed(1)} ${sy.toFixed(1)} L${ex.toFixed(1)} ${ey.toFixed(1)}`;
        lx = (sx + ex) / 2 + nx * (both ? 12 : 0); ly = (sy + ey) / 2 + ny * (both ? 12 : 0);
      }
      return { e, d, lx, ly, m: colors.indexOf(e.color) };
    });
  });

  function fit() {
    if (!scroller) return;
    avail = scroller.clientWidth - 20;
    if (avail > 0) k = Math.max(narrow ? 0.74 : 0.82, Math.min(1, avail / W));
  }
  $effect(() => { void W; fit(); });

  onMount(() => {
    const mq = matchMedia('(max-width: 759.98px)');
    const set = () => { narrow = mq.matches; };
    set(); mq.addEventListener('change', set);
    const ro = new ResizeObserver(fit); ro.observe(scroller);
    return () => { mq.removeEventListener('change', set); ro.disconnect(); };
  });
</script>

<section class="flow {cls}" class:scrolls={W * k > avail + 1}>
  <div class="flow-h"><h3>{title}</h3></div>
  {#if tip}<p class="flow-tip">{@html tip}</p>{/if}
  <p class="scroll-hint">Scroll sideways to see the whole map →</p>
  <div class="flow-scroll" bind:this={scroller}>
    <div class="fsizer" style:width="{W * k}px" style:height="{H * k}px">
      <div class="fcanvas" style:width="{W}px" style:height="{H}px" style:transform={k < 1 ? `scale(${k})` : ''}>
        <svg width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
          <defs>
            {#each colors as c, i}
              <marker id="ah-{me}-{i}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" style:fill={c} /></marker>
            {/each}
          </defs>
          {#each drawn as p, i}
            <path pathLength="1" class="e" class:dim={p.e.dim} style:--i={Math.min(i, 20)} style:stroke={p.e.color} d={p.d} marker-end="url(#ah-{me}-{p.m})" />
          {/each}
        </svg>
        {#each Object.keys(pos) as id, i (id)}
          <div class="fbox {boxClass?.(id) ?? ''}" role="button" tabindex={onbox ? 0 : -1} aria-disabled={!onbox} aria-label={boxLabel?.(id)}
            style:left="{S.pad + pos[id][0] * S.cs}px" style:top="{S.pad + pos[id][1] * S.rs}px" style:width="{S.w}px" style:height="{S.h}px" style:--bi={Math.min(i, 10)}
            onclick={() => onbox?.(id)} onkeydown={(e) => { if (onbox && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onbox(id); } }}>
            {@render box(id)}
          </div>
        {/each}
        {#each drawn as p, i}
          <div class="elab" class:dim={p.e.dim} style:--tc={p.e.color} style:--i={Math.min(i, 20)} style:left="{p.lx.toFixed(1)}px" style:top="{p.ly.toFixed(1)}px" title={p.e.title}>
            {@html p.e.label}{#if p.e.sub}<small>{@html p.e.sub}</small>{/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
</section>
