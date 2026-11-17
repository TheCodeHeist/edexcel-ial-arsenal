<script lang="ts">
  /* The self-test block that opens inside a card: a prompt and four options; after a pick the right answer is
     highlighted, a wrong pick is struck through, and the prompt becomes the verdict (design book §9). */
  import type { Snippet } from 'svelte';
  import { onMount } from 'svelte';
  let { prompt, options, answer, onanswer, swatch }: {
    prompt: string; options: string[]; answer: string; onanswer: (ok: boolean) => void; swatch?: Snippet<[string]>;
  } = $props();

  let picked = $state<string | null>(null);
  let box: HTMLElement;
  onMount(() => box.querySelector('button')?.focus({ preventScroll: true }));

  function choose(o: string, e: Event) {
    e.stopPropagation();
    if (picked) return;
    picked = o;
    onanswer(o === answer);
  }
</script>

<div class="qz" bind:this={box}>
  <p>
    {#if picked}<span class="verdict {picked === answer ? 'ok' : 'no'}">{picked === answer ? 'Correct.' : 'Not quite. The answer is highlighted.'}</span>
    {:else}{prompt}{/if}
  </p>
  <div class="qo">
    {#each options as o (o)}
      <button type="button" disabled={!!picked} class:right={!!picked && o === answer} class:wrong={picked === o && o !== answer}
        onclick={(e) => choose(o, e)}>{#if swatch}{@render swatch(o)}{/if}<span>{o}</span></button>
    {/each}
  </div>
</div>
