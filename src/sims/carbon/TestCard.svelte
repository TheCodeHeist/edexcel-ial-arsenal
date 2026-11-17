<script lang="ts">
  /* One identification test in the codex, shown on its example compound. Self-test: what is it positive for? */
  import { chem } from '../../lib/chem';
  import QuizBox from '../../components/ui/QuizBox.svelte';
  import { TEST_EX, testQuizOptions, type Test } from './data';
  import { useCarbon } from './app.svelte';
  import TestTube from './TestTube.svelte';

  let { t, i }: { t: Test; i: number } = $props();
  const app = useCarbon();
  let options = $state<string[] | null>(null), result = $state<boolean | null>(null);
  function open() { if (app.cx.quiz && !options) options = testQuizOptions(t); }
  function answered(ok: boolean) { result = ok; app.score.cxTotal++; if (ok) app.score.cxRight++; }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="tcx" class:asking={!!options && result === null} class:show={result !== null} class:ok={result === true} class:no={result === false} style:--i={i} onclick={open}>
  <div class="tv"><TestTube cid={TEST_EX[t.id]} tid={t.id} caption={false} /></div>
  <div>
    <h4>{t.n}</h4><p class="tf">{@html chem(t.f)}</p>
    <p><span class="lbl">Do</span>{t.proc}</p><p><span class="lbl">See</span>{@html chem(t.obs)}</p><p><span class="lbl">For</span><span class="posfor">{@html chem(t.pos)}</span></p>
  </div>
  {#if options}<QuizBox prompt="Positive for…" {options} answer={t.pos} onanswer={answered} />{/if}
</article>
