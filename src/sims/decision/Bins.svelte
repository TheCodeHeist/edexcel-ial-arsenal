<script lang="ts" module>
  export interface BinPrefs { method: 'ff' | 'ffd' | 'full'; items: number[]; cap: number; quiz: boolean }
  export const BIN_PREFS: BinPrefs = { method: 'ff', items: [8, 7, 14, 9, 6, 9, 5, 15, 6, 7, 8], cap: 20, quiz: false };
</script>

<script lang="ts">
  /* D1.1 bin packing: first-fit, first-fit decreasing and full-bin, drawn as bins filling up, with the lower bound. */
  import Seg from '../../components/ui/Seg.svelte';
  import StepBar from './StepBar.svelte';
  import { binSteps, lowerBound, randomBinItems } from './bins';
  import { rng, sum } from './util';

  let { prefs, hidden = false, stats = $bindable([]), onscore }: {
    prefs: BinPrefs; hidden?: boolean; stats?: [string, string | number][]; onscore: (ok: boolean) => void;
  } = $props();

  let text = $state(prefs.items.join(', '));
  let i = $state(0);
  function apply() {
    const l = text.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x) && x > 0 && x <= prefs.cap).slice(0, 16);
    if (l.length) { prefs.items = l; i = 0; }
    text = prefs.items.join(', ');
  }
  function fresh() { const { cap, items } = randomBinItems(rng()); prefs.cap = cap; prefs.items = items; text = items.join(', '); i = 0; }

  const steps = $derived(binSteps(prefs.items, prefs.cap, prefs.method));
  $effect(() => { void prefs.method; void prefs.cap; i = 0; });
  const cur = $derived(steps[Math.min(i, steps.length - 1)].s);
  const lb = $derived(lowerBound(prefs.items, prefs.cap));
  const BIN_H = 180;
  $effect(() => { stats = [['Bins', cur.bins.length], ['Lower bound', lb], ['Total', sum(prefs.items)]]; });
</script>

<main class="layout dec-two" {hidden}>
  <section class="panel stage">
    <div class="stage-head">
      <Seg label="Method" options={[['ff', 'First-fit', 'FF'], ['ffd', 'First-fit decreasing', 'FFD'], ['full', 'Full-bin', 'Full']]} bind:value={prefs.method} />
      <span class="label-chip"><small>Capacity</small>{prefs.cap}</span>
    </div>
    <div class="dec-board">
      <div class="queue" aria-label="Items still to pack">
        {#each cur.queue as v, k (k)}<span class="cell sm">{v}</span>{:else}<span class="muted">All items packed.</span>{/each}
      </div>
      <div class="bins">
        {#each cur.bins as b, k (k)}
          <div class="bin" class:into={cur.into === k} class:full={sum(b) === prefs.cap}>
            <div class="bin-box" style="height:{BIN_H}px">
              {#each b as v, j (j)}
                <span class="item" class:new={cur.into === k && j === b.length - 1} style="height:{(v / prefs.cap) * BIN_H}px">{v}</span>
              {/each}
            </div>
            <small>Bin {k + 1}<br />{sum(b)}/{prefs.cap}</small>
          </div>
        {/each}
      </div>
    </div>
    <StepBar {steps} bind:i bind:quiz={prefs.quiz} {onscore} />
  </section>

  <aside class="panel side">
    <div class="ph"><h2>The items</h2></div>
    <div class="ctls">
      <label class="ctl"><span class="ctl-l">Items (comma-separated)</span><input class="inp" type="text" bind:value={text} onchange={apply} /></label>
      <label class="ctl"><span class="ctl-l">Bin capacity <b>{prefs.cap}</b></span>
        <input class="slider" type="range" min="5" max="40" bind:value={prefs.cap} onchange={apply} /></label>
      <button class="btn" type="button" onclick={fresh}>New random items</button>
    </div>
    <div class="ph"><h2>Lower bound</h2></div>
    <div class="eq pad">⌈{sum(prefs.items)} ÷ {prefs.cap}⌉ = ⌈{(sum(prefs.items) / prefs.cap).toFixed(2)}⌉ = {lb} bins</div>
    <p class="why pad">No packing can use fewer bins than this. If a method reaches it, that packing is optimal; if not, it might still be the best possible.</p>
    <div class="ph"><h2>The rule</h2></div>
    <p class="why pad">
      {#if prefs.method === 'ff'}Take the items in the given order. Each goes into the first bin with enough room; open a new bin only if none has room.
      {:else if prefs.method === 'ffd'}Sort the items into decreasing order (say which sort you used), then apply first-fit.
      {:else}Use inspection to find combinations that fill bins exactly, then pack whatever is left by first-fit.{/if}
    </p>
  </aside>
</main>
