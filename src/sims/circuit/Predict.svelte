<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number }
</script>

<script lang="ts">
  /* Predict: a generated circuit with its meters hidden and one question. Answer, then the meters come alive,
     the charge starts moving and the working is shown. */
  import Board, { type Flow } from './Board.svelte';
  import { solve } from './solve';
  import { newQuestion, type Question } from './predict';

  let { score, flow, hidden: off = false }: { score: PScore; flow: Flow; hidden?: boolean } = $props();

  let q = $state<Question>(newQuestion());
  let picked = $state<string | null>(null);
  const sol = $derived(solve(q.c));
  const ok = $derived(picked === q.answer);

  function answer(o: string) {
    if (picked) return;
    picked = o;
    score.total++;
    if (o === q.answer) { score.right++; score.streak++; score.best = Math.max(score.best, score.streak); } else score.streak = 0;
  }
  function next() { q = newQuestion(); picked = null; }
</script>

<main class="layout predict" hidden={off}>
  <section class="panel stage" aria-label="Circuit">
    <div class="stage-head">
      <div class="label-chip"><small>Circuit</small><span>{q.c.parts.filter((p) => p.kind !== 'ammeter' && p.kind !== 'voltmeter').map((p) => p.name).join(' · ')}</span></div>
      <div class="stage-tools"><button class="btn" type="button" onclick={next}>{picked ? 'Next circuit' : 'Skip'}</button></div>
    </div>
    <div class="board-box">
      <Board fit c={q.c} {sol} flow={picked ? flow : 'off'} hide={picked ? [] : q.hide} focus={q.ask} label="Question circuit" />
    </div>
    <p class="board-note">Meters are ideal: ammeters have no resistance, voltmeters infinite resistance.{q.c.parts.some((p) => p.kind === 'cell' && (p.p.r ?? 0) > 0) ? ' The cell’s internal resistance is shown as r.' : ''}</p>
  </section>

  <section class="panel qpanel" aria-label="Question">
    {#key q}
      <div class="qbody swap">
        <h4>Predict</h4>
        <p class="qprompt">{q.prompt}</p>
        <div class="opts">
          {#each q.options as o (o)}
            <button type="button" disabled={!!picked} class:right={!!picked && o === q.answer} class:wrong={picked === o && o !== q.answer} onclick={() => answer(o)}>{o}</button>
          {/each}
        </div>
        {#if picked}
          <div class="reveal">
            <p class="verdict {ok ? 'ok' : 'no'}">{ok ? 'Correct.' : `Not quite: it’s ${q.answer}.`}</p>
            {#each q.working as w, i (i)}<div class="eq">{w}</div>{/each}
            <p class="why">{q.why}</p>
            <button class="btn primary big" type="button" onclick={next}>Next circuit</button>
          </div>
        {/if}
      </div>
    {/key}
  </section>
</main>
