<script lang="ts">
  /* One reaction in the atlas: start → reagent → result, the equation and why. With self-test on, the result is
     hidden until the card is answered. "Run on the bench" replays it in the test tube. */
  import { chem, ox } from '../../lib/chem';
  import QuizBox from '../../components/ui/QuizBox.svelte';
  import MiniTube from './MiniTube.svelte';
  import Swatch from './Swatch.svelte';
  import { SP, TY, rxReagent, rxNote, quizOptions, speciesForLook, type Transition } from './data';
  let { t, quiz, onscore, onrun }: { t: Transition; quiz: boolean; onscore: (ok: boolean) => void; onrun: (t: Transition) => void } = $props();

  const F = $derived(SP[t.f]), S = $derived(SP[t.t]), ty = $derived(TY[t.ty]), note = $derived(rxNote(t));
  let options = $state<string[] | null>(null);
  let result = $state<boolean | null>(null);
  function open(e: MouseEvent) {
    if ((e.target as Element).closest('[data-run]') || !quiz || options) return;
    options = quizOptions(S.look, F.m, F.look);
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="rx {ty.cls}" class:asking={!!options && result === null} class:show={result !== null} class:ok={result === true} class:no={result === false} onclick={open}>
  <div class="rx-vis">
    <span class="slot"><MiniTube S={F} /></span>
    <span class="rx-arrow"><span>{@html chem(rxReagent(t))}</span>
      <svg width="46" height="10" viewBox="0 0 46 10" aria-hidden="true"><path d="M1 5h40M36 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg>
      {#if note}<small>{note}</small>{/if}</span>
    <span class="slot out"><MiniTube {S} /><span class="q">?</span></span>
  </div>
  <div class="rx-body">
    <div class="rx-top"><span class="e-r">{@html chem(F.f)} → {@html chem(S.f)}</span><span class="badge {ty.cls}">{ty.l}</span></div>
    <p class="rx-looks"><Swatch S={F} /><span>{F.look}</span><span aria-hidden="true">→</span><span class="to-sw"><Swatch {S} /></span><span class="to">{S.look}</span>
      {#if F.ox !== S.ox}<span class="chip">{F.m} {ox(F.ox)} → {ox(S.ox)}</span>{/if}</p>
    <div class="eq">{@html chem(t.eq)}</div>
    <p class="why">{t.why}</p>
    <span class="qhint">Tap the card to answer</span>
    <button type="button" class="btn rx-run" data-run onclick={() => onrun(t)}>Run on the bench</button>
    {#if options}
      <QuizBox prompt="What do you see at the end?" {options} answer={S.look} onanswer={(ok) => { result = ok; onscore(ok); }}>
        {#snippet swatch(o)}{@const L = speciesForLook(o)}{#if L}<Swatch S={L} />{/if}{/snippet}
      </QuizBox>
    {/if}
  </div>
</article>
