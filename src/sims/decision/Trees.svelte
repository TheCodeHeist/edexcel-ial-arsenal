<script lang="ts" module>
  export interface TreePrefs { algo: 'kruskal' | 'prim' | 'matrix'; net: string; seed: number; start: string; quiz: boolean }
  export const TREE_PREFS: TreePrefs = { algo: 'kruskal', net: 'town', seed: 1, start: 'A', quiz: false };
</script>

<script lang="ts">
  /* D1.2 minimum spanning trees: Kruskal (arcs in order, reject cycles), Prim on the network, Prim on the matrix. */
  import Seg from '../../components/ui/Seg.svelte';
  import StepBar from './StepBar.svelte';
  import GraphView from './GraphView.svelte';
  import { NETS, graphFor, kruskalSteps, primSteps, primMatrixSteps, arcName, totalWeight, type Graph, type TreeState, type MatrixState } from './graph';
  import type { Step } from './util';

  let { prefs, hidden = false, stats = $bindable([]), onscore, customGraph = null }: {
    prefs: TreePrefs; hidden?: boolean; stats?: [string, string | number][]; onscore: (ok: boolean) => void; customGraph?: Graph | null;
  } = $props();

  let i = $state(0);
  const g = $derived(prefs.net === 'custom' && customGraph ? customGraph : graphFor(prefs.net, prefs.seed));
  const netOpts = $derived(customGraph ? ([...NETS, ['custom', 'Custom']] as const) : NETS);
  const start = $derived(g.v.some((v) => v.id === prefs.start) ? prefs.start : g.v[0].id);
  const steps = $derived<Step<TreeState | MatrixState>[]>(prefs.algo === 'kruskal' ? kruskalSteps(g) : prefs.algo === 'prim' ? primSteps(g, start) : primMatrixSteps(g, start));
  $effect(() => { void prefs.algo; void prefs.net; void prefs.seed; void prefs.start; void customGraph; i = 0; });
  const cur = $derived(steps[Math.min(i, steps.length - 1)].s);
  const ts = $derived(prefs.algo === 'matrix' ? null : (cur as TreeState));
  const ms = $derived(prefs.algo === 'matrix' ? (cur as MatrixState) : null);
  const treeArcs = $derived(ts ? ts.tree.map(arcName) : ms ? ms.circled.map(([a, b]) => [a, b].sort().join('')) : []);
  const weight = $derived(ts ? totalWeight(ts.tree) : ms ? ms.circled.reduce((t, [a, b]) => t + (ms.m[ms.ids.indexOf(a)][ms.ids.indexOf(b)] ?? 0), 0) : 0);
  $effect(() => { stats = [['Arcs', `${treeArcs.length}/${g.v.length - 1}`], ['Weight', weight], ['Vertices', g.v.length]]; });
  function newNet() { prefs.net = 'random'; prefs.seed = (Math.random() * 1e9) | 0; }
  export function getStep() { return { i, total: steps.length }; }
  export function setStep(idx: number) { i = Math.max(0, Math.min(steps.length - 1, idx)); }
  export function getGraph() { return { g, start }; }
</script>

<main class="layout dec-two" {hidden}>
  <section class="panel stage">
    <div class="stage-head">
      <Seg label="Algorithm" options={[['kruskal', 'Kruskal'], ['prim', 'Prim (network)', 'Prim'], ['matrix', 'Prim (matrix)', 'Matrix']]} bind:value={prefs.algo} />
    </div>
    <div class="dec-board">
      {#if ms}
        <div class="mx-wrap">
          <table class="mx">
            <thead><tr><th></th>{#each ms.ids as c (c)}<th class:num={ms.numbered.includes(c)}>{#if ms.numbered.includes(c)}<small>{ms.numbered.indexOf(c) + 1}</small>{/if}{c}</th>{/each}</tr></thead>
            <tbody>
              {#each ms.ids as r, ri (r)}
                <tr class:del={ms.deleted.includes(r)}>
                  <th>{r}</th>
                  {#each ms.ids as c, ci (c)}
                    {@const circ = ms.circled.some(([a, b]) => a === r && b === c)}
                    <td class:circ class:last={ms.last?.[0] === r && ms.last?.[1] === c} class:colon={ms.numbered.includes(c)}>{ms.m[ri][ci] ?? '–'}</td>
                  {/each}
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="dec-key"><span>Column numbers show the order vertices join.</span><span><i class="k del"></i>deleted row</span><span><i class="k circ"></i>circled entry</span></div>
      {:else if ts}
        <GraphView {g} tree={treeArcs} rejected={ts.rejected.map(arcName)} focus={ts.considering ? arcName(ts.considering) : undefined} inTree={ts.inTree} />
        <div class="dec-key"><span><i class="k tree"></i>in the tree</span><span><i class="k rej"></i>rejected</span><span><i class="k focus"></i>this step</span></div>
      {/if}
    </div>
    <StepBar {steps} bind:i bind:quiz={prefs.quiz} {onscore} />
  </section>

  <aside class="panel side">
    <div class="ph"><h2>Network</h2></div>
    <div class="ctls">
      <Seg label="Network" options={netOpts} bind:value={prefs.net} />
      <button class="btn" type="button" onclick={newNet}>New random network</button>
      {#if prefs.algo !== 'kruskal'}
        <label class="ctl"><span class="ctl-l">Start vertex</span>
          <select class="inp" bind:value={prefs.start}>{#each g.v as v (v.id)}<option value={v.id}>{v.id}</option>{/each}</select></label>
      {/if}
    </div>
    {#if ts?.order && prefs.algo === 'kruskal'}
      <div class="ph"><h2>Arcs in order</h2></div>
      <div class="arcs pad">
        {#each ts.order as e (arcName(e))}
          {@const n = arcName(e)}
          <span class="chip" class:tree={treeArcs.includes(n)} class:rej={ts.rejected.some((x) => arcName(x) === n)}>{n} {e.w}</span>
        {/each}
      </div>
    {/if}
    <div class="ph"><h2>Your working</h2></div>
    <p class="why pad">Order of arcs: <b>{treeArcs.join(', ') || '…'}</b>. Weight so far: <b>{weight}</b>.</p>
    <p class="why pad">
      {#if prefs.algo === 'kruskal'}Kruskal works on arcs: take them in order of weight and reject any that would make a cycle. Stop when there are n − 1 arcs.
      {:else if prefs.algo === 'prim'}Prim grows one tree: from the vertices already in it, always add the shortest arc to a vertex not yet in it. Cycles never come up.
      {:else}On a matrix: number the start column 1 and delete its row. Find the smallest undeleted entry in the numbered columns, circle it, number its row's column and delete that row. Repeat.{/if}
    </p>
  </aside>
</main>
