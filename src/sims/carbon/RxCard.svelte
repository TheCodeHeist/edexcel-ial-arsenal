<script lang="ts">
  /* One reaction in the codex. With self-test on, the product, equation and notes hide until you answer. */
  import { chem } from '../../lib/chem';
  import QuizBox from '../../components/ui/QuizBox.svelte';
  import CopyButton from '../../components/ui/CopyButton.svelte';
  import { CP, RG, FAM, rxPlain, rxQuizOptions, productNames, needText, type Reaction } from './data';
  import { useCarbon } from './app.svelte';
  import Mol from './Mol.svelte';

  let { r, i }: { r: Reaction; i: number } = $props();
  const app = useCarbon();
  let options = $state<string[] | null>(null), result = $state<boolean | null>(null);
  function open() { if (app.cx.quiz && !options) options = rxQuizOptions(r); }
  function answered(ok: boolean) { result = ok; app.score.cxTotal++; if (ok) app.score.cxRight++; }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
<article class="rxc f-{r.fam}" class:asking={!!options && result === null} class:show={result !== null} class:ok={result === true} class:no={result === false} style:--i={Math.min(i, 14)} onclick={open}>
  <div class="rxc-vis">
    <span class="m"><Mol id={r.a} /></span>
    {#if CP[r.b]}<span class="pl">+</span><span class="m"><Mol id={r.b} /></span>{/if}
    <span class="ar"><span>{@html RG[r.b] ? chem(RG[r.b].f) : r.need ? needText(r.need) : ''}</span><svg width="58" height="10" viewBox="0 0 58 10" aria-hidden="true"><path d="M1 5h52M48 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg><small>{@html CP[r.b] ? '' : chem(RG[r.b].n)}</small></span>
    <span class="m out">{#each r.p as p, k (p)}{#if k}<span class="pl">+</span>{/if}<Mol id={p} />{/each}<span class="mq">?</span></span>
  </div>
  <div class="rxc-top"><span class="e-r">{CP[r.a].n}{CP[r.b] ? ' + ' + CP[r.b].n : ''} → <span class="pname">{productNames(r)}</span></span><span class="badge f-{r.fam}">{FAM[r.fam][0]}</span><CopyButton text={() => rxPlain(r)} label="Copy reaction as text" /></div>
  <div class="eq">{@html r.eq.map(chem).join('<br>')}</div>
  <p class="why"><b>{r.mech}</b> · {@html chem(r.cond)}{r.note ? ' — ' + r.note : ''}</p>
  {#if options}<QuizBox prompt="What forms?" {options} answer={productNames(r)} onanswer={answered} />{/if}
</article>
