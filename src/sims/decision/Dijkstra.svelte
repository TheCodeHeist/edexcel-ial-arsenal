<script lang="ts" module>
  export interface DijPrefs { net: string; seed: number; from: string; to: string; quiz: boolean }
  export const DIJ_PREFS: DijPrefs = { net: 'town', seed: 1, from: 'A', to: 'G', quiz: false };
</script>

<script lang="ts">
  /* D1.2 Dijkstra, filled in on the exam's boxes: vertex | order of labelling | final value, working values below. */
  import Seg from '../../components/ui/Seg.svelte';
  import StepBar from './StepBar.svelte';
  import GraphView from './GraphView.svelte';
  import { NETS, graphFor, dijkstraSteps } from './graph';

  let { prefs, hidden = false, stats = $bindable([]), onscore }: {
    prefs: DijPrefs; hidden?: boolean; stats?: [string, string | number][]; onscore: (ok: boolean) => void;
  } = $props();

  let i = $state(0);
  const g = $derived(graphFor(prefs.net, prefs.seed));
  const ids = $derived(g.v.map((v) => v.id));
  const from = $derived(ids.includes(prefs.from) ? prefs.from : ids[0]);
  const to = $derived(ids.includes(prefs.to) && prefs.to !== from ? prefs.to : ids.at(-1)!);
  const steps = $derived(dijkstraSteps(g, from, to));
  $effect(() => { void prefs.net; void prefs.seed; void prefs.from; void prefs.to; i = 0; });
  const cur = $derived(steps[Math.min(i, steps.length - 1)].s);
  const routeArcs = $derived(cur.route ? cur.route.slice(1).map((v, k) => [cur.route![k], v].sort().join('')) : []);
  const permanent = $derived(Object.values(cur.box).filter((b) => b.final !== undefined).length);
  $effect(() => { stats = [['Permanent', `${permanent}/${ids.length}`], ['Shortest', cur.done ? cur.box[to].final ?? '–' : '–']]; });
  function newNet() { prefs.net = 'random'; prefs.seed = (Math.random() * 1e9) | 0; }
</script>

<main class="layout dec-two" {hidden}>
  <section class="panel stage">
    <div class="stage-head">
      <span class="label-chip"><small>Shortest path</small>{from} → {to}</span>
      <div class="dec-boxkey" aria-label="Key to the boxes"><span>Vertex</span><span>Order</span><span>Final</span><em>Working values</em></div>
    </div>
    <div class="dec-board">
      <GraphView {g} boxes={cur.box} latest={cur.latest} routes={routeArcs.length ? [{ arcs: routeArcs, cls: 'route' }] : []} />
    </div>
    <StepBar {steps} bind:i bind:quiz={prefs.quiz} {onscore} />
  </section>

  <aside class="panel side">
    <div class="ph"><h2>Network</h2></div>
    <div class="ctls">
      <Seg label="Network" options={NETS} bind:value={prefs.net} />
      <button class="btn" type="button" onclick={newNet}>New random network</button>
      <div class="row2">
        <label class="ctl"><span class="ctl-l">From</span><select class="inp" bind:value={prefs.from}>{#each ids as v (v)}<option value={v}>{v}</option>{/each}</select></label>
        <label class="ctl"><span class="ctl-l">To</span><select class="inp" bind:value={prefs.to}>{#each ids as v (v)}<option value={v} disabled={v === from}>{v}</option>{/each}</select></label>
      </div>
    </div>
    <div class="ph"><h2>The rule</h2></div>
    <ol class="rule pad">
      <li>Give the start order 1 and final value 0.</li>
      <li>From the vertex just made permanent, write a working value at each vertex joined to it: its final value + the arc. Only write it if it beats the last working value there.</li>
      <li>The smallest working value anywhere becomes permanent, with the next order number.</li>
      <li>Repeat until the destination is permanent, then trace back: an arc is on the route when the final values at its ends differ by its weight.</li>
    </ol>
    <p class="why pad">Show every working value, even ones later beaten (they're struck through here). Examiners look for them.</p>
  </aside>
</main>
