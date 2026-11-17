<script lang="ts">
  /* One identification test in a tube on the white tile. With animate, the tube rises in and its colour change,
     precipitate, mirror, bubbles or fumes play out; `replay` bumps to play the rise again. */
  import { onMount } from 'svelte';
  import { RM } from '../../lib/util';
  import { chem } from '../../lib/chem';
  import { TESTS, testResult } from './data';
  import { tubeSVG } from './art';
  let { cid, tid, animate = false, replay = 0, caption = true }: { cid: string; tid: string; animate?: boolean; replay?: number; caption?: boolean } = $props();

  const res = $derived(testResult(cid, tid));
  const T = $derived(TESTS.find((t) => t.id === tid)!);
  let el: HTMLElement;
  let go = $state(false), rising = $state(false);

  // set before the first paint: a static tube shows its result at once; a new one rises in, then reacts
  onMount(() => {
    if (!animate) { go = true; return; }
    rising = true;
    requestAnimationFrame(() => requestAnimationFrame(() => (go = true)));
    el.scrollIntoView({ block: 'nearest', behavior: RM ? 'auto' : 'smooth' });
  });
  let seen: number | undefined;
  $effect(() => {
    const n = replay;
    if (seen !== undefined && n !== seen) { el.classList.remove('in'); void el.offsetWidth; el.classList.add('in'); }
    seen = n;
  });
</script>

<figure class="tt" class:in={rising} class:go class:pos={res.pos} style="margin:0" bind:this={el}>
  {@html tubeSVG(tid, res)}
  {#if caption}<figcaption><div class="tl">{@html chem(T.f)}</div><div class="to">{res.obs}</div></figcaption>{/if}
</figure>
