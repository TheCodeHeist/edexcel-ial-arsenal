<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number }
</script>

<script lang="ts">
  /* Predict: a generated exam-style question with the set-up drawn to scale. Answer, then the ball flies, the
     answer is measured on the drawing and the working is shown. */
  import Scene from './Scene.svelte';
  import { newQuestion, type Question } from './predict';
  import { Player } from './player.svelte';

  let { score, hidden: off = false }: { score: PScore; hidden?: boolean } = $props();

  let q = $state<Question>(newQuestion());
  let picked = $state<string | null>(null);
  const player = new Player();
  const ok = $derived(picked === q.answer);
  const end = $derived(q.stopAt ?? q.f.T);
  const landed = $derived(!!picked && !player.playing);

  function answer(o: string) {
    if (picked) return;
    picked = o;
    score.total++;
    if (o === q.answer) { score.right++; score.streak++; score.best = Math.max(score.best, score.streak); } else score.streak = 0;
    player.play(end);
  }
  function next() { player.reset(); q = newQuestion(); picked = null; }
</script>

<main class="layout predict" hidden={off}>
  <section class="panel stage" aria-label="Set-up">
    <div class="stage-head">
      <div class="label-chip"><small>Set-up</small><span>To scale · g = 9.81 m s⁻² · no air resistance</span></div>
      <div class="stage-tools">
        {#if picked}<button class="btn" type="button" onclick={() => player.play(end)}>Replay</button>{/if}
        <button class="btn" type="button" onclick={next}>{picked ? 'Next question' : 'Skip'}</button>
      </div>
    </div>
    <div class="sky">
      <Scene snug launch={q.L} fit={{ x: q.f.R, y: q.f.H }} annot={landed ? null : q.annot}
        balls={picked ? [{ f: q.f, t: player.t, color: 'var(--ch1)' }] : []} strobe vectors={q.stopAt !== undefined}
        dims={landed ? q.dims : []} label="The question’s set-up, drawn to scale" />
    </div>
    <p class="board-note">{picked ? 'Strobe images are at equal time intervals.' : 'The flight appears once you answer.'}</p>
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
            <button class="btn primary big" type="button" onclick={next}>Next question</button>
          </div>
        {/if}
      </div>
    {/key}
  </section>
</main>
