<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number; by?: Record<string, [number, number]> }
</script>

<script lang="ts">
  /* Practice: generated D1 questions across all five spec areas, with the working the mark scheme expects. */
  import GraphView from './GraphView.svelte';
  import { newQuestion, TOPICS, TOPIC_NAME, SPEC, type Question, type Topic } from './practice';

  let { score, topic = $bindable('all'), hidden: off = false }: { score: PScore; topic?: Topic | 'all'; hidden?: boolean } = $props();

  const tally = (t: Topic | 'all'): [number, number] => (t === 'all' ? [score.right, score.total] : score.by?.[t] ?? [0, 0]);
  let q = $state<Question>(newQuestion('all'));
  let picked = $state<string | null>(null);
  let lastTopic: Topic | 'all' = 'all';
  $effect(() => { if (topic !== lastTopic) { lastTopic = topic; next(); } });

  function answer(o: string) {
    if (picked) return;
    picked = o;
    score.total++;
    const k = q.topic, was = score.by?.[k] ?? [0, 0];
    score.by = { ...(score.by ?? {}), [k]: [was[0] + (o === q.answer ? 1 : 0), was[1] + 1] };
    if (o === q.answer) { score.right++; score.streak++; score.best = Math.max(score.best, score.streak); } else score.streak = 0;
  }
  function next() { q = newQuestion(topic); picked = null; }
  const ok = $derived(picked === q.answer);
</script>

<main class="layout dec-practice" hidden={off}>
  <nav class="panel topics" aria-label="Practice topics">
    <div class="ph"><h2>Topics</h2></div>
    <label class="topicsel"><span class="sr">Topic</span>
      <select class="inp" bind:value={topic}>{#each TOPICS as [t, name] (t)}<option value={t}>{name}</option>{/each}</select>
    </label>
    <ul class="tlist">
      {#each TOPICS as [t, name] (t)}
        {@const [r, n] = tally(t)}
        <li><button type="button" class="titem" aria-pressed={topic === t} onclick={() => { if (topic === t) next(); else topic = t; }}>
          <span class="tn">{name}</span><span class="tm"><span>{SPEC[t]}</span>{#if n}<b>{r}/{n}</b>{/if}</span>
        </button></li>
      {/each}
    </ul>
  </nav>

  <section class="panel qpanel" aria-label="Question">
    {#key q}
      <div class="qbody swap">
        <h4>{TOPIC_NAME[q.topic]}</h4>
        <p class="qprompt">{q.prompt}</p>
        <div class="opts">
          {#each q.options as o (o)}
            <button type="button" disabled={!!picked} class:right={!!picked && o === q.answer} class:wrong={picked === o && o !== q.answer} onclick={() => answer(o)}>{o}</button>
          {/each}
        </div>
        {#if picked}
          <div class="reveal">
            <p class="verdict {ok ? 'ok' : 'no'}">{ok ? 'Correct.' : `Not quite: it's ${q.answer}.`}</p>
            {#each q.working as w, i (i)}<div class="eq">{w}</div>{/each}
            <p class="why">{q.why}</p>
            <button class="btn primary big" type="button" onclick={next}>Next question</button>
          </div>
        {:else}
          <button class="btn" type="button" onclick={next}>Skip</button>
        {/if}
      </div>
    {/key}
  </section>

  <aside class="panel figure" aria-label="Figure">
    {#if q.figure?.kind === 'graph'}
      <GraphView g={q.figure.g} small />
    {:else if q.figure?.kind === 'list'}
      <div class="cells figlist">{#each q.figure.items as v, k (k)}<span class="cell sm">{v}</span>{/each}</div>
    {:else if q.figure?.kind === 'table'}
      <div class="mx-wrap"><table class="mx">
        <thead><tr>{#each q.figure.head as h, k (k)}<th>{h}</th>{/each}</tr></thead>
        <tbody>{#each q.figure.rows as row, k (k)}<tr>{#each row as c, j (j)}{#if j === 0}<th>{c}</th>{:else}<td>{c}</td>{/if}{/each}</tr>{/each}</tbody>
      </table></div>
    {:else}
      <p class="why pad">Work it out on paper first, then pick an answer.</p>
    {/if}
  </aside>
</main>
