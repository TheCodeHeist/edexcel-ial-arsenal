<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number; by?: Record<string, [number, number]> }
</script>

<script lang="ts">
  /* Practice: generated WPH14 / WPH15 fields exam-style questions with SVG figures and step-by-step working. */
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

<main class="layout practice fl-practice" hidden={off}>
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
    {#if q.figure?.kind === 'plates'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="flfig" role="img" aria-label="Parallel plates">
        <rect x="35" y="28" width="160" height="8" rx="2" fill="var(--redox)" />
        <rect x="35" y="128" width="160" height="8" rx="2" fill="var(--accent)" />
        <text class="ft mid" x="115" y="20">+{f.v} V</text>
        <text class="ft mid" x="115" y="152">0 V (d = {f.d} cm)</text>
        {#each [60, 95, 130, 165] as x (x)}
          <line x1={x} y1="42" x2={x} y2="120" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="3 3" />
        {/each}
      </svg>
    {:else if q.figure?.kind === 'orbit'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="flfig" role="img" aria-label="Circular magnetic track">
        <circle cx="115" cy="82" r="48" fill="none" stroke="var(--accent)" stroke-width="2.4" />
        <circle cx="163" cy="82" r="5" fill="var(--amph)" />
        <line x1="163" y1="82" x2="128" y2="82" stroke="var(--good)" stroke-width="2.2" />
        <line x1="163" y1="82" x2="163" y2="48" stroke="var(--amph)" stroke-width="2.2" />
        <text class="ft mid" x="115" y="150">{f.rText}</text>
      </svg>
    {:else if q.figure?.kind === 'flux'}
      <svg viewBox="0 0 230 165" class="flfig" role="img" aria-label="Flux linkage and emf waveforms">
        <line class="ax" x1="24" x2="215" y1="84" y2="84" /><line class="ax" x1="24" x2="24" y1="22" y2="146" />
        <text class="ft" x="8" y="15">NΦ / ε</text>
        <path fill="none" stroke="var(--accent)" stroke-width="2.2" d="M24 38 Q72 38 118 84 T212 130" />
        <path fill="none" stroke="var(--redox)" stroke-width="2.2" stroke-dasharray="4 3" d="M24 84 Q72 30 118 84 T212 84" />
      </svg>
    {:else if q.figure?.kind === 'invsq'}
      <svg viewBox="0 0 230 165" class="flfig" role="img" aria-label="Inverse square law curve">
        <line class="ax" x1="28" x2="215" y1="140" y2="140" /><line class="ax" x1="28" x2="28" y1="20" y2="140" />
        <text class="ft" x="8" y="14">E or g</text>
        <text class="ft" x="215" y="158" text-anchor="end">r →</text>
        <path class="curve" d="M44 28 Q68 112 208 134" />
      </svg>
    {:else}
      <div class="fig-q">
        <div class="big-glyph">F</div>
        <small>{TOPIC_NAME[q.topic]}</small>
      </div>
    {/if}
  </aside>
</main>
