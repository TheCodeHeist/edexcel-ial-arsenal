<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number; by?: Record<string, [number, number]> }
</script>

<script lang="ts">
  /* Practice: generated WCH14 & WCH13 acid–base questions with SVG diagrams and step-by-step working. */
  import { newQuestion, TOPICS, TOPIC_NAME, SPEC, type Question, type Topic } from './practice';

  let { score, topic = $bindable('all'), hidden: off = false }: {
    score: PScore; topic?: Topic | 'all'; hidden?: boolean;
  } = $props();

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
    if (o === q.answer) { score.right++; score.streak++; score.best = Math.max(score.best, score.streak); }
    else score.streak = 0;
  }
  function next() { q = newQuestion(topic); picked = null; }
  const ok = $derived(picked === q.answer);
</script>

<main class="layout practice ac-practice" hidden={off}>
  <nav class="panel topics" aria-label="Practice topics">
    <div class="ph"><h2>Topics</h2></div>
    <label class="topicsel"><span class="sr">Topic</span>
      <select class="sel" bind:value={topic}>
        {#each TOPICS as [t, name] (t)}<option value={t}>{name}</option>{/each}
      </select>
    </label>
    <ul class="tlist">
      {#each TOPICS as [t, name] (t)}
        {@const [r, n] = tally(t)}
        <li>
          <button type="button" class="titem" aria-pressed={topic === t} onclick={() => { if (topic === t) next(); else topic = t; }}>
            <span class="tn">{name}</span>
            <span class="tm"><span>{SPEC[t]}</span>{#if n}<b>{r}/{n}</b>{/if}</span>
          </button>
        </li>
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
            <p class="verdict {ok ? 'ok' : 'no'}">{ok ? 'Correct.' : `Not quite: it’s ${q.answer}.`}</p>
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
    {#if q.figure?.kind === 'curve'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="acfig" role="img" aria-label="Titration curve sketch">
        <line class="ax" x1="28" x2="215" y1="140" y2="140" /><line class="ax" x1="28" x2="28" y1="20" y2="140" />
        <text class="ft" x="8" y="14">pH</text>
        <text class="ft" x="215" y="158" text-anchor="end">V(base) →</text>
        {#if f.kindId === 'wa_sb'}
          <rect x="28" y="42" width="187" height="18" fill="var(--cond)" fill-opacity="0.18" />
          <path class="curve" d="M30 116 Q72 100 115 92 L122 36 Q160 28 210 26" />
          <circle cx="74" cy="99" r="3.5" fill="var(--amph)" />
          <text class="ft" x="46" y="92">pH = pKa</text>
        {:else}
          <path class="curve" d="M30 116 Q80 98 118 82 T210 54" />
        {/if}
      </svg>
    {:else if q.figure?.kind === 'buffer'}
      {@const f = q.figure}
      {@const mx = Math.max(f.ha, f.a, 0.5)}
      <svg viewBox="0 0 230 165" class="acfig" role="img" aria-label="Buffer reservoir bars">
        <line class="ax" x1="30" x2="205" y1="136" y2="136" />
        <rect x="58" y={136 - (f.ha / mx) * 90} width="42" height={(f.ha / mx) * 90} rx="5" fill="var(--amph)" fill-opacity="0.7" />
        <rect x="130" y={136 - (f.a / mx) * 90} width="42" height={(f.a / mx) * 90} rx="5" fill="var(--accent)" fill-opacity="0.7" />
        <text class="ft mid" x="79" y="152">[HA] = {f.ha.toFixed(2)}</text>
        <text class="ft mid" x="151" y="152">[A⁻] = {f.a.toFixed(2)}</text>
      </svg>
    {:else}
      <div class="fig-q">
        <div class="big-glyph">pH</div>
        <small>{TOPIC_NAME[q.topic]}</small>
      </div>
    {/if}
  </aside>
</main>
