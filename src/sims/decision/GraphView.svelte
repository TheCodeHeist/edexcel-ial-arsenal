<script lang="ts">
  /* Draws a weighted network. Arcs can be marked as in the tree, rejected, under consideration or on a route;
     with `boxes`, each vertex is drawn as the exam's Dijkstra box (vertex | order | final value, working values below). */
  import { arcName, type Graph, type DBox } from './graph';

  let { g, tree = [], rejected = [], focus, inTree, routes = [], extra = [], boxes, latest, pick, picked, odd = [], small = false }: {
    g: Graph; tree?: string[]; rejected?: string[]; focus?: string; inTree?: string[];
    routes?: { arcs: string[]; cls: string }[];   // arcs to colour (a route, a tour)
    extra?: { arcs: string[]; cls: string }[];    // arcs drawn again alongside (repeated on an inspection route)
    boxes?: Record<string, DBox>; latest?: string;
    pick?: (v: string) => void; picked?: string[]; odd?: string[]; small?: boolean;
  } = $props();

  const S = 6;
  const PAD = $derived(boxes ? 48 : 26);
  const X = (x: number) => PAD + x * S, Y = (y: number) => PAD + y * S;
  const W = $derived(100 * S + PAD * 2), H = $derived(60 * S + PAD * 2);
  const pos = $derived(Object.fromEntries(g.v.map((v) => [v.id, v])));
  const routeOf = (n: string) => routes.find((r) => r.arcs.includes(n))?.cls;
  const extras = (n: string) => extra.filter((r) => r.arcs.includes(n));
</script>

<svg class="gv" class:small viewBox="0 0 {W} {H}" role="img" aria-label="Network">
  {#each g.e as e (arcName(e) + e.w)}
    {@const a = pos[e.a]}
    {@const b = pos[e.b]}
    {@const n = arcName(e)}
    {@const cls = tree.includes(n) ? 'tree' : rejected.includes(n) ? 'rej' : routeOf(n) ?? ''}
    {@const mx = (X(a.x) + X(b.x)) / 2}
    {@const my = (Y(a.y) + Y(b.y)) / 2}
    {@const dx = Y(b.y) - Y(a.y)}
    {@const dy = X(a.x) - X(b.x)}
    {@const L = Math.hypot(dx, dy) || 1}
    {#each extras(n) as r, k (k)}
      {@const o = 7 * (k + 1)}
      <line class="arc twin {r.cls}" x1={X(a.x) + (dx / L) * o} y1={Y(a.y) + (dy / L) * o} x2={X(b.x) + (dx / L) * o} y2={Y(b.y) + (dy / L) * o} />
    {/each}
    <line class="arc {cls}" class:focus={focus === n} x1={X(a.x)} y1={Y(a.y)} x2={X(b.x)} y2={Y(b.y)} />
    <g class="wt {cls}" class:focus={focus === n} transform="translate({mx} {my})">
      <rect x="-13" y="-10" width="26" height="20" rx="6" /><text>{e.w}</text>
    </g>
  {/each}

  {#each g.v as v (v.id)}
    {@const on = inTree?.includes(v.id)}
    {#if boxes}
      {@const bx = boxes[v.id]}
      <g class="dbox" class:perm={bx?.final !== undefined} class:latest={latest === v.id} transform="translate({X(v.x) - 45} {Y(v.y) - 24})">
        <rect class="frame" width="90" height="48" rx="5" />
        <line x1="0" y1="22" x2="90" y2="22" /><line x1="30" y1="0" x2="30" y2="22" /><line x1="60" y1="0" x2="60" y2="22" />
        <text class="vid" x="15" y="12">{v.id}</text>
        <text class="ord" x="45" y="12">{bx?.order ?? ''}</text>
        <text class="fin" x="75" y="12">{bx?.final ?? ''}</text>
        <text class="work" x="45" y="36">
          {#each bx?.working ?? [] as w, k}<tspan class:struck={k < (bx?.working.length ?? 0) - 1}>{w}</tspan>{k < (bx?.working.length ?? 0) - 1 ? '  ' : ''}{/each}
        </text>
      </g>
    {:else}
      <g class="vx" class:on class:odd={odd.includes(v.id)} class:picked={picked?.includes(v.id)} class:clickable={!!pick}
        transform="translate({X(v.x)} {Y(v.y)})" role={pick ? 'button' : undefined} tabindex={pick ? 0 : undefined}
        onclick={() => pick?.(v.id)} onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && pick?.(v.id)}>
        <circle r="15" /><text>{v.id}</text>
      </g>
    {/if}
  {/each}
</svg>
