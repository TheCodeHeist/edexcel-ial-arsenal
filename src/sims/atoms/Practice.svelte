<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number; by?: Record<string, [number, number]> }
</script>

<script lang="ts">
  /* Practice: generated WCH11 exam-style questions across all six topics, with SVG diagrams and step-by-step working. */
  import { newQuestion, TOPICS, TOPIC_NAME, SPEC, type Question, type Topic } from './practice';
  import { HYDRIDES } from './imf';
  import { chem } from '../../lib/chem';

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

<main class="layout practice ab-practice" hidden={off}>
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
    {#if q.figure?.kind === 'vsepr'}
      {@const f = q.figure}
      <div class="fig-q">
        <div class="big-glyph">{@html chem(f.formula)}</div>
        <small>Think: bonding regions + lone pairs around the central atom</small>
      </div>
    {:else if q.figure?.kind === 'ie_jump'}
      {@const f = q.figure}
      {@const logs = f.vals.map((v) => Math.log10(v))}
      {@const lo = Math.min(...logs) - 0.2}
      {@const hi = Math.max(...logs) + 0.2}
      <svg viewBox="0 0 230 165" class="abfig" role="img" aria-label="Successive ionisation energies">
        <line class="ax" x1="28" x2="215" y1="140" y2="140" /><line class="ax" x1="28" x2="28" y1="16" y2="140" />
        <text class="ft" x="8" y="12">log₁₀(IE)</text>
        <text class="ft" x="215" y="158" text-anchor="end">electron removed</text>
        <path class="curve" d={logs.map((lv, i) => `${i ? 'L' : 'M'}${(38 + (i / Math.max(1, logs.length - 1)) * 165).toFixed(1)} ${(135 - ((lv - lo) / (hi - lo)) * 112).toFixed(1)}`).join(' ')} />
        {#each logs as lv, i (i)}
          {@const cx = 38 + (i / Math.max(1, logs.length - 1)) * 165}
          {@const cy = 135 - ((lv - lo) / (hi - lo)) * 112}
          <circle class="pt" cx={cx} cy={cy} r="3.5" />
          <text class="ft mid" x={cx} y="150">{i + 1}</text>
        {/each}
      </svg>
    {:else if q.figure?.kind === 'spectrum'}
      {@const f = q.figure}
      {@const mn = Math.min(...f.peaks.map((p) => p.mz)) - 3}
      {@const mx = Math.max(...f.peaks.map((p) => p.mz)) + 3}
      {@const mr = Math.max(...f.peaks.map((p) => p.rel), 10)}
      <svg viewBox="0 0 230 165" class="abfig" role="img" aria-label="Mass spectrum">
        <line class="ax" x1="26" x2="215" y1="140" y2="140" /><line class="ax" x1="26" x2="26" y1="16" y2="140" />
        <text class="ft" x="6" y="12">abundance</text>
        <text class="ft" x="215" y="158" text-anchor="end">m/z</text>
        {#each f.peaks as pk (pk.mz)}
          {@const x = 36 + ((pk.mz - mn) / Math.max(1, mx - mn)) * 170}
          {@const y = 140 - (pk.rel / mr) * 114}
          <line x1={x} x2={x} y1="140" y2={y} stroke="var(--accent)" stroke-width="4" stroke-linecap="round" />
          <text class="ft mid" x={x} y="151">{pk.mz}</text>
        {/each}
      </svg>
    {:else if q.figure?.kind === 'hydrides'}
      {@const y0C = 135 - (180 / 300) * 112}
      <svg viewBox="0 0 230 165" class="abfig" role="img" aria-label="Hydride boiling points">
        <line x1="30" x2="215" y1={y0C} y2={y0C} stroke="var(--line)" stroke-dasharray="3 3" stroke-width="1" />
        <text class="ft" x="215" y={y0C - 3} text-anchor="end">0 °C</text>
        <line class="ax" x1="30" x2="215" y1="140" y2="140" /><line class="ax" x1="30" x2="30" y1="16" y2="140" />
        <text class="ft" x="6" y="12">b.p. / °C</text>
        <text class="ft" x="215" y="158" text-anchor="end">Period 2 → 5</text>
        {#each HYDRIDES as s (s.group)}
          <path fill="none" stroke={s.colorVar} stroke-width="2"
            d={s.points.map((pt, i) => `${i ? 'L' : 'M'}${(42 + (pt.period - 2) * 54).toFixed(1)} ${(135 - ((pt.bp + 180) / 300) * 112).toFixed(1)}`).join(' ')} />
          {#each s.points.slice(0, s.group === 'Group 6' ? 2 : 1) as pt (pt.formula)}
            <circle cx={42 + (pt.period - 2) * 54} cy={135 - ((pt.bp + 180) / 300) * 112} r="2.6" fill={s.colorVar} />
          {/each}
        {/each}
        <text class="ft" x="47" y="28">H₂O</text>
        <text class="ft" x="47" y="57">HF</text>
        <text class="ft" x="47" y="83">NH₃</text>
        <text class="ft" x="47" y="131">CH₄</text>
        <text class="ft mid" x="96" y="85">H₂S</text>
      </svg>
    {:else}
      <div class="fig-q">
        <div class="big-glyph">?</div>
        <small>{TOPIC_NAME[q.topic]}</small>
      </div>
    {/if}
  </aside>
</main>
