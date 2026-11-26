<script lang="ts" module>
  export interface RoutePrefs { mode: 'inspect' | 'tsp'; net: string; seed: number; open: boolean; nnStart: string; del: string; quiz: boolean }
  export const ROUTE_PREFS: RoutePrefs = { mode: 'inspect', net: 'town', seed: 1, open: false, nnStart: 'A', del: 'A', quiz: false };
</script>

<script lang="ts">
  /* D1.3: route inspection (up to four odd vertices, optionally ending elsewhere) and travelling-salesman bounds:
     nearest neighbour for an upper bound, residual minimum spanning tree for a lower bound. */
  import Seg from '../../components/ui/Seg.svelte';
  import StepBar from './StepBar.svelte';
  import GraphView from './GraphView.svelte';
  import { NETS, graphFor, routeInspection, inspectionSteps, pathArcs, distanceTable, nearestNeighbour, lowerBoundTSP, degree } from './graph';

  let { prefs, hidden = false, stats = $bindable([]), onscore }: {
    prefs: RoutePrefs; hidden?: boolean; stats?: [string, string | number][]; onscore: (ok: boolean) => void;
  } = $props();

  let i = $state(0);
  const g = $derived(graphFor(prefs.net, prefs.seed, true));
  const ids = $derived(g.v.map((v) => v.id));
  const res = $derived(routeInspection(g));
  const steps = $derived(inspectionSteps(g, prefs.open));
  $effect(() => { void prefs.net; void prefs.seed; void prefs.open; i = 0; });
  const cur = $derived(steps[Math.min(i, steps.length - 1)].s);
  // repeated arcs: each walk of an arc on a repeated path draws one extra line beside it
  const extra = $derived.by(() => {
    if (!cur.show) return [];
    const out: { arcs: string[]; cls: string }[] = [], seen = new Map<string, number>();
    for (const a of pathArcs(cur.show)) { const k = seen.get(a) ?? 0; seen.set(a, k + 1); (out[k] ??= { arcs: [], cls: 'repeat' }).arcs.push(a); }
    return out;
  });

  const table = $derived(distanceTable(g));
  const nnFrom = $derived(ids.includes(prefs.nnStart) ? prefs.nnStart : ids[0]);
  const delV = $derived(ids.includes(prefs.del) ? prefs.del : ids[0]);
  const nn = $derived(nearestNeighbour(table.ids, table.d, nnFrom));
  const lb = $derived(lowerBoundTSP(table.ids, table.d, delV));
  const bestUpper = $derived(Math.min(...ids.map((v) => nearestNeighbour(table.ids, table.d, v).length)));
  const bestLower = $derived(Math.max(...ids.map((v) => lowerBoundTSP(table.ids, table.d, v).bound)));
  const nnLegs = $derived(nn.tour.slice(1).map((v, k) => [nn.tour[k], v].sort().join('')));

  $effect(() => {
    stats = prefs.mode === 'inspect' ? [['Total', res.total], ['Odd', res.odd.length], ['Route', prefs.open && res.open ? res.open.length : res.length]]
      : [['Upper', nn.length], ['Lower', lb.bound], ['Best range', `${bestLower}–${bestUpper}`]];
  });
  function newNet() { prefs.net = 'random'; prefs.seed = (Math.random() * 1e9) | 0; }
</script>

<main class="layout dec-two" {hidden}>
  <section class="panel stage">
    <div class="stage-head">
      <Seg label="Problem" options={[['inspect', 'Route inspection', 'Inspection'], ['tsp', 'Travelling salesman', 'TSP']]} bind:value={prefs.mode} />
      {#if prefs.mode === 'inspect' && res.odd.length}
        <label class="sb-quiz"><input type="checkbox" bind:checked={prefs.open} /> Start and finish at different vertices</label>
      {/if}
    </div>
    {#if prefs.mode === 'inspect'}
      <div class="dec-board">
        <GraphView {g} odd={cur.phase >= 1 ? res.odd : []} {extra} />
        <div class="dec-key"><span><i class="k odd"></i>odd vertex</span><span><i class="k repeat"></i>arc walked twice</span></div>
      </div>
      {#if cur.phase >= 2 && !prefs.open}
        <div class="pairs pad">
          {#each res.pairings as p, k (k)}
            <span class="chip" class:tree={cur.phase >= 3 && p === res.best}>{p.pairs.map((x) => x.join('')).join(' + ')} = {p.paths.map((x) => x.join('')).join(' + ')} = {p.cost}</span>
          {/each}
        </div>
      {/if}
      <StepBar {steps} bind:i bind:quiz={prefs.quiz} {onscore} />
    {:else}
      <div class="dec-board">
        <GraphView {g} routes={[{ arcs: nnLegs.filter((a) => g.e.some((e) => [e.a, e.b].sort().join('') === a)), cls: 'route' }]} />
        <p class="why pad">The tour is worked on the table of <b>shortest</b> distances (the classical problem). A leg that isn't an arc of the network means "go the shortest way round".</p>
      </div>
      <div class="mx-wrap pad">
        <table class="mx">
          <thead><tr><th></th>{#each table.ids as c (c)}<th>{c}</th>{/each}</tr></thead>
          <tbody>
            {#each table.ids as r, ri (r)}
              <tr class:del={r === delV}><th>{r}</th>{#each table.ids as c, ci (c)}<td class:circ={nnLegs.includes([r, c].sort().join('')) && ri !== ci}>{ri === ci ? '–' : table.d[ri][ci]}</td>{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </section>

  <aside class="panel side">
    <div class="ph"><h2>Network</h2></div>
    <div class="ctls">
      <Seg label="Network" options={NETS} bind:value={prefs.net} />
      <button class="btn" type="button" onclick={newNet}>New random network</button>
    </div>
    {#if prefs.mode === 'inspect'}
      <div class="ph"><h2>Degrees</h2></div>
      <div class="arcs pad">{#each ids as v (v)}<span class="chip" class:odd={degree(g, v) % 2 === 1}>{v}: {degree(g, v)}</span>{/each}</div>
      <p class="why pad">The sum of degrees is twice the number of arcs, so there's always an even number of odd vertices. Pairing them up and repeating the shortest paths between each pair makes every degree even.</p>
    {:else}
      <div class="ph"><h2>Upper bound: nearest neighbour</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Start at</span><select class="inp" bind:value={prefs.nnStart}>{#each ids as v (v)}<option value={v}>{v}</option>{/each}</select></label>
        <div class="eq">{nn.tour.join(' → ')}<br />{nn.legs.join(' + ')} = {nn.length}</div>
      </div>
      <div class="ph"><h2>Lower bound: residual MST</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Delete vertex</span><select class="inp" bind:value={prefs.del}>{#each ids as v (v)}<option value={v}>{v}</option>{/each}</select></label>
        <div class="eq">MST of the rest: {lb.arcs.map(([a, b, w]) => `${a}${b} ${w}`).join(', ')} = {lb.mst}<br />+ two shortest from {delV}: {lb.two.map(([v, w]) => `${delV}${v} ${w}`).join(', ')}<br />= {lb.bound}</div>
      </div>
      <div class="ph"><h2>Best bounds</h2></div>
      <p class="why pad">Try every start and every deleted vertex: the best upper bound is the <b>smallest</b>, {bestUpper}; the best lower bound is the <b>largest</b>, {bestLower}. So {bestLower} ≤ optimal tour ≤ {bestUpper}.</p>
    {/if}
  </aside>
</main>
