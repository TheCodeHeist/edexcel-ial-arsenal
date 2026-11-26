<script lang="ts" module>
  export interface SortPrefs { algo: 'bubble' | 'quick' | 'binary'; order: 'asc' | 'desc'; list: number[]; target: number; quiz: boolean }
  export const SORT_PREFS: SortPrefs = { algo: 'bubble', order: 'asc', list: [56, 23, 87, 12, 45, 67, 34], target: 45, quiz: false };
</script>

<script lang="ts">
  /* D1.1: bubble sort pass by pass, quick sort with middle-item pivots, binary search with ⌈(first + last)/2⌉. */
  import Seg from '../../components/ui/Seg.svelte';
  import StepBar from './StepBar.svelte';
  import { bubbleSteps, quickSteps, binarySteps, randomList, type BubbleState, type QuickState, type BinState } from './sorting';
  import type { Step } from './util';

  let { prefs, hidden = false, stats = $bindable([]), onscore }: {
    prefs: SortPrefs; hidden?: boolean; stats?: [string, string | number][]; onscore: (ok: boolean) => void;
  } = $props();

  let text = $state(prefs.list.join(', '));
  let i = $state(0);
  const parse = (t: string) => t.split(/[\s,]+/).map(Number).filter((x) => Number.isFinite(x)).slice(0, 14);
  function apply() { const l = parse(text); if (l.length >= 2) { prefs.list = l; i = 0; } text = prefs.list.join(', '); }
  function fresh() { prefs.list = randomList(prefs.algo === 'binary' ? 11 : 8); text = prefs.list.join(', '); i = 0; if (prefs.algo === 'binary') prefs.target = [...prefs.list].sort((a, b) => a - b)[Math.floor(Math.random() * 11)]; }

  const sorted = $derived([...prefs.list].sort((a, b) => a - b));
  const bubble = $derived(prefs.algo === 'bubble' ? bubbleSteps(prefs.list, prefs.order) : null);
  const steps = $derived<Step<unknown>[]>(prefs.algo === 'bubble' ? bubble!.steps : prefs.algo === 'quick' ? quickSteps(prefs.list, prefs.order) : binarySteps(sorted, prefs.target));
  $effect(() => { void prefs.algo; void prefs.order; void prefs.target; i = 0; });

  const cur = $derived(steps[Math.min(i, steps.length - 1)]);
  // the working so far: the list at the end of each pass reached
  const history = $derived.by(() => {
    if (prefs.algo === 'bubble') return bubble!.passEnds.filter((k) => k > 0 && k <= i).map((k) => ({ label: `Pass ${(steps[k].s as BubbleState).pass}`, items: (steps[k].s as BubbleState).list.map(String) }));
    if (prefs.algo === 'quick') return steps.slice(1, i + 1).filter((_, k) => k % 2 === 1).map((st) => ({ label: `Pass ${(st.s as QuickState).pass}`, items: (st.s as QuickState).subs.map((s) => s.items.join(' ')) }));
    return [];
  });

  $effect(() => {
    const s = cur.s as Partial<BubbleState & BinState>;
    stats = prefs.algo === 'bubble' ? [['Comparisons', s.cmp ?? 0], ['Swaps', s.swaps ?? 0], ['Pass', s.pass ?? 0]]
      : prefs.algo === 'quick' ? [['Pass', (cur.s as QuickState).pass], ['Items', prefs.list.length]]
      : [['Target', prefs.target], ['Compared', steps.slice(1, i + 1).filter((x) => (x.s as BinState).mid !== undefined).length]];
  });
</script>

<main class="layout dec-two" {hidden}>
  <section class="panel stage">
    <div class="stage-head">
      <Seg label="Algorithm" options={[['bubble', 'Bubble sort'], ['quick', 'Quick sort'], ['binary', 'Binary search']]} bind:value={prefs.algo} />
      {#if prefs.algo !== 'binary'}<Seg label="Order" options={[['asc', 'Ascending'], ['desc', 'Descending']]} bind:value={prefs.order} />{/if}
    </div>

    <div class="dec-board">
      {#if prefs.algo === 'bubble'}
        {@const s = cur.s as BubbleState}
        <div class="cells">
          {#each s.list as v, k (k)}
            <span class="cell" class:cmp={s.compare?.includes(k)} class:swap={s.justSwapped && s.compare?.includes(k)} class:fixed={s.done || k >= s.list.length - s.fixed}>{v}</span>
          {/each}
        </div>
      {:else if prefs.algo === 'quick'}
        {@const s = cur.s as QuickState}
        <div class="cells subs">
          {#each s.subs as sub, j (j)}
            <span class="sub" class:placed={sub.placed && sub.items.length === 1}>
              {#each sub.items as v, k (k)}<span class="cell" class:pivot={sub.pivot === k} class:fixed={sub.placed}>{v}</span>{/each}
            </span>
          {/each}
        </div>
      {:else}
        {@const s = cur.s as BinState}
        <div class="cells">
          {#each sorted as v, k (k)}
            <span class="cell" class:gone={s.gone[k]} class:mid={s.mid === k} class:found={s.found === k}>{v}<small>{k + 1}</small></span>
          {/each}
        </div>
      {/if}
      <div class="dec-key">
        {#if prefs.algo === 'bubble'}<span><i class="k cmp"></i>being compared</span><span><i class="k swap"></i>swapped</span><span><i class="k fixed"></i>in place</span>
        {:else if prefs.algo === 'quick'}<span><i class="k pivot"></i>pivot</span><span><i class="k fixed"></i>in place</span><span>Sublists are spaced apart.</span>
        {:else}<span><i class="k mid"></i>middle item</span><span><i class="k found"></i>found</span><span><i class="k gone"></i>discarded</span>{/if}
      </div>
    </div>

    <StepBar {steps} bind:i bind:quiz={prefs.quiz} {onscore} stops={prefs.algo === 'bubble' ? bubble!.passEnds : undefined} />
  </section>

  <aside class="panel side">
    <div class="ph"><h2>The list</h2></div>
    <div class="ctls">
      <label class="ctl"><span class="ctl-l">Items (comma-separated, up to 14)</span>
        <input class="inp" type="text" bind:value={text} onchange={apply} /></label>
      {#if prefs.algo === 'binary'}
        <label class="ctl"><span class="ctl-l">Search for</span><input class="inp" type="number" bind:value={prefs.target} /></label>
        <p class="why">Binary search needs an ordered list, so the items are shown sorted.</p>
      {/if}
      <button class="btn" type="button" onclick={fresh}>New random list</button>
    </div>
    {#if history.length}
      <div class="ph"><h2>Your working</h2></div>
      <ol class="work">
        <li><b>Start</b><span>{prefs.list.join('  ')}</span></li>
        {#each history as h}<li><b>{h.label}</b><span>{h.items.join(prefs.algo === 'quick' ? '  |  ' : '  ')}</span></li>{/each}
      </ol>
    {/if}
    <div class="ph"><h2>The rule</h2></div>
    <p class="why pad">
      {#if prefs.algo === 'bubble'}Compare each adjacent pair from the left and swap if out of order. After pass k the last k items are fixed. Stop after a pass with no swaps, and say so.
      {:else if prefs.algo === 'quick'}Pivot: the middle item, or the one right of the middle in an even-length sublist. Write the items {prefs.order === 'asc' ? 'smaller' : 'larger'} than it before it, in their original order, then the pivot, then the rest. Repeat in every sublist.
      {:else}Middle = ⌈(first + last) ÷ 2⌉. Compare the target with it; discard it and the half the target can't be in. Stop when found, or when the list is empty.{/if}
    </p>
  </aside>
</main>
