<script lang="ts">
  /* Steps through an algorithm run. With "Quiz me" on, a step that carries a question is asked before it is shown:
     predict it, see the verdict, then continue. Each answer counts towards the lab score. */
  import QuizBox from '../../components/ui/QuizBox.svelte';
  import type { Ask } from './util';

  let { steps, i = $bindable(0), quiz = $bindable(false), onscore, stops }: {
    steps: { say: string; ask?: Ask }[]; i?: number; quiz?: boolean; onscore?: (ok: boolean) => void;
    stops?: number[];   // optional coarser stops (e.g. the end of each bubble-sort pass) for the big buttons
  } = $props();

  let asking = $state<Ask | null>(null);
  let answered = $state(false);
  let target = 0;
  $effect(() => { if (i > steps.length - 1) i = Math.max(0, steps.length - 1); });
  // a new run (different steps) drops any open question
  $effect(() => { void steps; asking = null; answered = false; });

  function go(to: number) {
    to = Math.max(0, Math.min(steps.length - 1, to));
    if (to <= i || !quiz) { asking = null; i = to; return; }
    // stop at the first question between here and the destination
    for (let k = i + 1; k <= to; k++) if (steps[k].ask) {
      target = k; asking = steps[k].ask!; answered = false;
      // show the board as it was before the asked step; with coarse stops, as it was at the previous stop, since the
      // frames in between already give the answer away
      i = stops ? Math.max(i, [...stops].reverse().find((s) => s < k) ?? 0) : k - 1;
      return;
    }
    i = to;
  }
  const nextStop = () => (stops ? stops.find((s) => s > i) ?? steps.length - 1 : i + 1);
  const prevStop = () => (stops ? [...stops].reverse().find((s) => s < i) ?? 0 : i - 1);
  function cont() { i = target; asking = null; }
</script>

<div class="stepbar">
  <div class="sb-btns">
    <button class="btn sm" type="button" onclick={() => go(0)} disabled={i === 0} aria-label="Back to the start">⏮</button>
    <button class="btn sm" type="button" onclick={() => go(prevStop())} disabled={i === 0} aria-label="Back">◀</button>
    <button class="btn sm primary" type="button" onclick={() => go(nextStop())} disabled={i >= steps.length - 1 || !!asking}>{stops ? 'Next pass' : 'Next step'} ▶</button>
    {#if stops}<button class="btn sm" type="button" onclick={() => go(i + 1)} disabled={i >= steps.length - 1 || !!asking}>One comparison</button>{/if}
    <button class="btn sm" type="button" onclick={() => go(steps.length - 1)} disabled={i >= steps.length - 1 || !!asking} aria-label="Run to the end">⏭</button>
    <span class="sb-count">{i + 1} / {steps.length}</span>
    <label class="sb-quiz"><input type="checkbox" bind:checked={quiz} onchange={() => (asking = null)} /> Quiz me</label>
  </div>
  {#if asking}
    <div class="sb-ask">
      {#key asking}
        <QuizBox prompt={asking.q} options={asking.options} answer={asking.answer} onanswer={(ok) => { answered = true; onscore?.(ok); }} />
      {/key}
      {#if answered}<button class="btn sm primary" type="button" onclick={cont}>Show the step ▶</button>{/if}
    </div>
  {:else}
    <p class="sb-say" aria-live="polite">{steps[i]?.say}</p>
  {/if}
</div>
