<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number; by?: Record<string, [number, number]> }
</script>

<script lang="ts">
  /* Practice: generated WCH12/WCH14 energetics & entropy questions with SVG figures and step-by-step working. */
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

<main class="layout practice en-practice" hidden={off}>
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
    {#if q.figure?.kind === 'cooling'}
      <svg viewBox="0 0 230 165" class="enfig" role="img" aria-label="Cooling curve sketch">
        <line class="ax" x1="28" x2="215" y1="140" y2="140" /><line class="ax" x1="28" x2="28" y1="20" y2="140" />
        <text class="ft" x="6" y="14">T / °C</text>
        <text class="ft" x="215" y="158" text-anchor="end">time / min</text>
        <line x1="94" x2="94" y1="26" y2="140" stroke="var(--amph)" stroke-dasharray="3 3" />
        <path class="curve" d="M36 116 L84 116 M112 50 L205 76" />
        <line x1="94" y1="45" x2="205" y2="76" stroke="var(--redox)" stroke-width="1.8" stroke-dasharray="4 3" />
        <line x1="94" y1="116" x2="94" y2="45" stroke="var(--redox)" stroke-width="2" />
        <text class="ft" x="98" y="84" fill="var(--redox)">ΔT</text>
      </svg>
    {:else if q.figure?.kind === 'hess'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="enfig" role="img" aria-label="Hess cycle triangle">
        <rect x="12" y="20" width="66" height="28" rx="6" fill="var(--solid)" stroke="var(--line)" />
        <text class="ft mid" x="45" y="38">Reactants</text>
        <rect x="152" y="20" width="66" height="28" rx="6" fill="var(--solid)" stroke="var(--line)" />
        <text class="ft mid" x="185" y="38">Products</text>
        <rect x="65" y="124" width="100" height="28" rx="6" fill="var(--solid)" stroke="var(--line)" />
        <text class="ft mid" x="115" y="142">{f.dir === 'up' ? 'Elements' : 'CO₂ + H₂O'}</text>
        <line x1="80" y1="34" x2="148" y2="34" stroke="var(--accent)" stroke-width="2" />
        <line x1="48" y1="50" x2="95" y2="120" stroke="var(--muted)" stroke-width="1.8" />
        <line x1="182" y1="50" x2="135" y2="120" stroke="var(--muted)" stroke-width="1.8" />
        <text class="ft mid" x="115" y="27">ΔrH = ?</text>
        <text class="ft" x="20" y="96">{f.dh1}</text>
        <text class="ft" x="172" y="96">{f.dh2}</text>
      </svg>
    {:else if q.figure?.kind === 'dg'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="enfig" role="img" aria-label="ΔG against T">
        <line class="ax" x1="28" x2="215" y1="84" y2="84" stroke-dasharray="4 3" />
        <line class="ax" x1="28" x2="28" y1="20" y2="144" />
        <text class="ft" x="6" y="14">ΔG</text>
        <text class="ft" x="215" y="158" text-anchor="end">T / K</text>
        <line x1="34" y1={f.dh > 0 ? 34 : 132} x2="208" y2={f.ds > 0 ? 132 : 34} stroke="var(--accent)" stroke-width="2.5" />
        <text class="ft" x="150" y="78">ΔG = 0</text>
      </svg>
    {:else}
      <div class="fig-q">
        <div class="big-glyph">ΔH</div>
        <small>{TOPIC_NAME[q.topic]}</small>
      </div>
    {/if}
  </aside>
</main>
