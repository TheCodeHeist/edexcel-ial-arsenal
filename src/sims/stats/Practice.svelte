<script lang="ts" module>
  export interface PScore {
    right: number;
    total: number;
    streak: number;
    best: number;
    by?: Record<string, [number, number]>;
  }
</script>

<script lang="ts">
  /* Practice: procedurally generated S1–S3 exam questions with Pearson-table working and visual figures. */
  import TopicLinks from './TopicLinks.svelte';
  import {
    newQuestion, TOPICS, TOPIC_NAME, SPEC, TOPIC_SPEC_LINKS, normalPdf,
    type Question, type Topic,
  } from './practice';
  import { binomPmf, poissonPmf, fmtTrim } from './math';

  let { score, topic = $bindable('all'), hidden: off = false }: {
    score: PScore;
    topic?: Topic | 'all';
    hidden?: boolean;
  } = $props();

  const tally = (t: Topic | 'all'): [number, number] =>
    t === 'all' ? [score.right, score.total] : score.by?.[t] ?? [0, 0];

  let q = $state<Question>(newQuestion('all'));
  let picked = $state<string | null>(null);
  let lastTopic: Topic | 'all' = 'all';

  $effect(() => {
    if (topic !== lastTopic) {
      lastTopic = topic;
      next();
    }
  });

  function answer(o: string) {
    if (picked) return;
    picked = o;
    score.total++;
    const k = q.topic;
    const was = score.by?.[k] ?? [0, 0];
    const hit = o === q.answer;
    score.by = { ...(score.by ?? {}), [k]: [was[0] + (hit ? 1 : 0), was[1] + 1] };
    if (hit) {
      score.right++;
      score.streak++;
      score.best = Math.max(score.best, score.streak);
    } else {
      score.streak = 0;
    }
  }

  function next() {
    q = newQuestion(topic);
    picked = null;
  }

  const ok = $derived(picked === q.answer);
</script>

<main class="layout st-practice" hidden={off}>
  <nav class="panel topics" aria-label="Practice topics">
    <div class="ph"><h2>Topics</h2></div>
    <label class="topicsel">
      <span class="sr">Topic</span>
      <select class="inp" bind:value={topic}>
        {#each TOPICS as [t, name] (t)}<option value={t}>{name}</option>{/each}
      </select>
    </label>
    <ul class="tlist">
      {#each TOPICS as [t, name] (t)}
        {@const [r, n] = tally(t)}
        <li>
          <button
            type="button"
            class="titem"
            aria-pressed={topic === t}
            onclick={() => { if (topic === t) next(); else topic = t; }}
          >
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
            <button
              type="button"
              disabled={!!picked}
              class:right={!!picked && o === q.answer}
              class:wrong={picked === o && o !== q.answer}
              onclick={() => answer(o)}
            >{o}</button>
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

  <aside class="panel figure" aria-label="Question figure & links">
    {#if q.figure?.kind === 'normal'}
      {@const f = q.figure}
      {@const xmin = f.mu - 3.4 * f.sigma}
      {@const xmax = f.mu + 3.4 * f.sigma}
      {@const sx = (x: number) => 20 + ((x - xmin) / (xmax - xmin)) * 300}
      {@const sy = (y: number) => 156 - (y / (normalPdf(f.mu, f.mu, f.sigma) * 1.15)) * 126}
      {@const curvePts = Array.from({ length: 81 }, (_, i) => {
        const x = xmin + ((xmax - xmin) * i) / 80;
        return `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(normalPdf(x, f.mu, f.sigma)).toFixed(1)}`;
      }).join(' ')}
      {@const a = Math.max(xmin, f.lo)}
      {@const b = Math.min(xmax, f.hi)}
      {@const areaPts = b > a ? `M${sx(a).toFixed(1)},${sy(0).toFixed(1)} ` + Array.from({ length: 45 }, (_, i) => {
        const x = a + ((b - a) * i) / 44;
        return `L${sx(x).toFixed(1)},${sy(normalPdf(x, f.mu, f.sigma)).toFixed(1)}`;
      }).join(' ') + ` L${sx(b).toFixed(1)},${sy(0).toFixed(1)} Z` : ''}
      <svg class="st-svg" viewBox="0 0 340 190" role="img" aria-label="Normal sketch">
        {#if areaPts}<path class="area" d={areaPts} />{/if}
        <path class="curve" d={curvePts} />
        <line class="mean-line" x1={sx(f.mu)} y1="24" x2={sx(f.mu)} y2="156" />
        <line class="axis" x1="16" y1="156" x2="324" y2="156" />
        <text class="tick-t" x={sx(f.mu)} y="172" text-anchor="middle">μ = {f.mu}</text>
        <text class="ax-lab" x="170" y="16" text-anchor="middle">{f.label}</text>
      </svg>

    {:else if q.figure?.kind === 'bars'}
      {@const f = q.figure}
      {@const mean = f.dist === 'binomial' ? (f.n! * f.p!) : f.lambda!}
      {@const sd = Math.sqrt(f.dist === 'binomial' ? f.n! * f.p! * (1 - f.p!) : f.lambda!)}
      {@const kMin = Math.max(0, Math.floor(mean - 3.2 * sd))}
      {@const kMax = f.dist === 'binomial' ? Math.min(f.n!, Math.ceil(mean + 3.2 * sd)) : Math.ceil(mean + 3.5 * sd)}
      {@const ks = Array.from({ length: Math.max(1, kMax - kMin + 1) }, (_, i) => kMin + i)}
      {@const ps = ks.map((k) => (f.dist === 'binomial' ? binomPmf(f.n!, f.p!, k) : poissonPmf(f.lambda!, k)))}
      {@const maxP = Math.max(0.05, ...ps) * 1.15}
      {@const bw = Math.max(5, Math.min(20, 290 / Math.max(1, ks.length) * 0.72))}
      <svg class="st-svg" viewBox="0 0 340 185" role="img" aria-label="Discrete bar sketch">
        {#each ks as k, idx (k)}
          {@const cx = 25 + ((idx + 0.5) / ks.length) * 290}
          {@const h = (ps[idx] / maxP) * 124}
          <rect class="bar" class:on={k >= f.lo && k <= f.hi} x={cx - bw / 2} y={152 - h} width={bw} height={Math.max(1, h)} rx="2" />
        {/each}
        <line class="axis" x1="20" y1="152" x2="320" y2="152" />
        <text class="tick-t" x="28" y="170">{kMin}</text>
        <text class="tick-t" x="312" y="170" text-anchor="end">{kMax}</text>
      </svg>

    {:else if q.figure?.kind === 'venn'}
      {@const f = q.figure}
      <svg class="st-svg" viewBox="0 0 320 175" role="img" aria-label="Venn diagram">
        <rect x="12" y="10" width="296" height="155" rx="10" fill="var(--surf)" stroke="var(--ink)" stroke-opacity=".45" stroke-width="1.6" />
        <circle cx="122" cy="88" r="56" fill="color-mix(in srgb, var(--cond) 14%, transparent)" stroke="var(--cond)" stroke-width="2" />
        <circle cx="198" cy="88" r="56" fill="color-mix(in srgb, var(--accent) 14%, transparent)" stroke="var(--accent)" stroke-width="2" />
        <text class="tick-t" x="86" y="34" font-weight="700">A</text>
        <text class="tick-t" x="234" y="34" font-weight="700">B</text>
        <text x="92" y="92" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="13" fill="var(--ink)">{f.onlyA}</text>
        <text x="160" y="92" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="13" fill="var(--ink)">{f.both}</text>
        <text x="228" y="92" text-anchor="middle" font-family="var(--f-mono)" font-weight="700" font-size="13" fill="var(--ink)">{f.onlyB}</text>
        <text x="292" y="152" text-anchor="end" font-family="var(--f-mono)" font-size="11" fill="var(--muted)">{fmtTrim(f.neither, 2)}</text>
      </svg>

    {:else if q.figure?.kind === 'box'}
      {@const f = q.figure}
      {@const lo = Math.min(f.sorted[0], f.lowFence) - 3}
      {@const hi = Math.max(f.sorted.at(-1)!, f.highFence) + 3}
      {@const sx = (x: number) => 20 + ((x - lo) / (hi - lo)) * 300}
      <svg class="st-svg" viewBox="0 0 340 140" role="img" aria-label="Box plot sketch">
        <line x1={sx(f.lowFence)} y1="30" x2={sx(f.lowFence)} y2="94" stroke="var(--redox)" stroke-dasharray="3 3" stroke-width="1.4" />
        <line x1={sx(f.highFence)} y1="30" x2={sx(f.highFence)} y2="94" stroke="var(--redox)" stroke-dasharray="3 3" stroke-width="1.4" />
        <rect x={sx(f.q1)} y="42" width={Math.max(2, sx(f.q3) - sx(f.q1))} height="38" rx="3" fill="var(--accent-soft)" stroke="var(--accent)" stroke-width="2" />
        <line x1={sx(f.q2)} y1="42" x2={sx(f.q2)} y2="80" stroke="var(--ink)" stroke-width="2.5" />
        <line class="axis" x1="16" y1="108" x2="324" y2="108" />
        <text class="tick-t" x={sx(f.q1)} y="124" text-anchor="middle">Q₁={f.q1}</text>
        <text class="tick-t" x={sx(f.q3)} y="124" text-anchor="middle">Q₃={f.q3}</text>
      </svg>

    {:else if q.figure?.kind === 'table'}
      <div class="mx-wrap">
        <table class="mx">
          <thead><tr>{#each q.figure.head as h, i (i)}<th>{h}</th>{/each}</tr></thead>
          <tbody>
            {#each q.figure.rows as row, i (i)}
              <tr>{#each row as cell, j (j)}{#if j === 0}<th>{cell}</th>{:else}<td>{cell}</td>{/if}{/each}</tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="why pad">Work it out with the Formula Booklet first, then pick an answer.</p>
    {/if}

    <TopicLinks items={TOPIC_SPEC_LINKS[q.topic]} />
  </aside>
</main>
