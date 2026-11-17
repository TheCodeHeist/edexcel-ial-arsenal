<script lang="ts">
  /* One species in the colour atlas. With self-test on, the colour is hidden until the card is answered. */
  import { chem, ox } from '../../lib/chem';
  import QuizBox from '../../components/ui/QuizBox.svelte';
  import MiniTube from './MiniTube.svelte';
  import Swatch from './Swatch.svelte';
  import { SP, howMade, quizOptions, speciesForLook } from './data';
  let { id, quiz, onscore }: { id: string; quiz: boolean; onscore: (ok: boolean) => void } = $props();

  const S = $derived(SP[id]);
  let options = $state<string[] | null>(null);
  let result = $state<boolean | null>(null);

  function open() { if (quiz && !options) options = quizOptions(S.look, S.m); }
</script>

<div class="at" class:asking={!!options && result === null} class:show={result !== null} class:ok={result === true} class:no={result === false}
  tabindex="0" role="button" aria-disabled={!quiz} aria-label={S.n}
  onclick={open} onkeydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); open(); } }}>
  <span class="mt"><MiniTube {S} /><span class="q">?</span></span>
  <span style="min-width:0">
    <span class="af">{@html chem(S.f)}</span>
    <p class="al">{S.look}</p>
    <span class="ah">{ox(S.ox)} · {@html howMade(id)}</span>
    <span class="qhint">Tap to answer</span>
  </span>
  {#if options}
    <QuizBox prompt="What colour is it?" {options} answer={S.look} onanswer={(ok) => { result = ok; onscore(ok); }}>
      {#snippet swatch(o)}{@const L = speciesForLook(o)}{#if L}<Swatch S={L} />{/if}{/snippet}
    </QuizBox>
  {/if}
</div>
