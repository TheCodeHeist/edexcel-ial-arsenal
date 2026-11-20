<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number }
</script>

<script lang="ts">
  /* Practice: generated exam-style questions with four options, the working once you answer, and a small figure
     (the star in its colour, the shifted spectrum, or the HR diagram). */
  import HRPlot from './HRPlot.svelte';
  import { newQuestion, type Question, type Topic } from './practice';
  import { bbCss, nmColor, LINES, STARS, lumOf } from './data';

  let { score, topic, hidden: off = false }: { score: PScore; topic: Topic | 'all'; hidden?: boolean } = $props();

  let q = $state<Question>(newQuestion('all'));
  let picked = $state<string | null>(null);
  let lastTopic: Topic | 'all' = 'all';
  $effect(() => { if (topic !== lastTopic) { lastTopic = topic; next(); } });

  function answer(o: string) {
    if (picked) return;
    picked = o;
    score.total++;
    if (o === q.answer) { score.right++; score.streak++; score.best = Math.max(score.best, score.streak); } else score.streak = 0;
  }
  function next() { q = newQuestion(topic); picked = null; }
  const ok = $derived(picked === q.answer);

  const dots = STARS.map((s) => ({ id: s.id, T: s.T, L: lumOf(s), R: s.R, group: s.group }));
  const lo = 370, hi = 790, sx = (nm: number) => 6 + ((nm - lo) / (hi - lo)) * 288;
</script>

<main class="layout practice" hidden={off}>
  <section class="panel qpanel" aria-label="Question">
    {#key q}
      <div class="qbody swap">
        <h4>{({ bb: 'Black-body radiation', dist: 'Astronomical distances', cosmo: 'Redshift and Hubble’s law', life: 'HR diagram and life cycle', binary: 'Binary stars' } as const)[q.topic]}</h4>
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
    {#if q.figure?.kind === 'star'}
      <div class="fig-star">
        <span class="ball big" style:background={bbCss(q.figure.T)} style:box-shadow="0 0 40px 8px {bbCss(q.figure.T)}"></span>
        <p>{q.figure.name}</p>
        <small>Its colour is the colour of a black body at its temperature.</small>
      </div>
    {:else if q.figure?.kind === 'spectrum'}
      {@const z = q.figure.z}
      <svg viewBox="0 0 300 120" class="mini-spec" role="img" aria-label="Laboratory and galaxy spectra">
        <defs><linearGradient id="prainbow" x1="0" x2="1">{#each Array.from({ length: 43 }, (_, k) => lo + k * 10) as nm (nm)}<stop offset={(nm - lo) / (hi - lo)} stop-color={nmColor(nm)} />{/each}</linearGradient></defs>
        <text x="6" y="12" class="sl">Laboratory</text>
        <rect x="6" y="16" width="288" height="30" rx="5" fill="url(#prainbow)" />
        {#each LINES as l (l.name)}<rect x={sx(l.nm) - 1} y="16" width="2" height="30" fill="#08080c" />{/each}
        <text x="6" y="66" class="sl">Galaxy</text>
        <rect x="6" y="70" width="288" height="30" rx="5" fill="url(#prainbow)" />
        {#each LINES as l (l.name)}{#if l.nm * (1 + z) < hi}<rect x={sx(l.nm * (1 + z)) - 1} y="70" width="2" height="30" fill="#08080c" />{/if}{/each}
        <text x="294" y="116" class="tk end">longer λ →</text>
      </svg>
    {:else}
      <div class="fig-hr">
        <HRPlot compact h={260} tr={[50000, 2400]} lr={[1e-5, 1e6]} radii={false} labels={!picked ? false : true} classes={false}
          stars={dots.filter((d) => !q.figure || q.figure.kind !== 'hr' || !q.figure.mark || picked ? true : d.group !== q.figure.mark)} label="HR diagram" />
      </div>
    {/if}
  </aside>
</main>
