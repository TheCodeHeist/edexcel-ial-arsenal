<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number }
</script>

<script lang="ts">
  /* Practice: generated questions, four options, the working once you answer, and a figure where one helps (a track
     in a magnetic field, the quarks of a hadron, the reaction written out, the α-scattering set-up). */
  import Sym from './Sym.svelte';
  import { newQuestion, TOPIC_NAME, type Question, type Topic } from './practice';
  import { get, qText } from './data';

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

  /* the track figure: enters from the left, curving up (anticlockwise) or down */
  /** An α particle's path past a nucleus at (120, 80): repelled by an inverse-square force, integrated in small steps. */
  function alphaPath(b: number) {
    let x = 6, y = 80 + b, vx = 1, vy = 0;
    const k = 260, pts = [`M${x} ${y.toFixed(1)}`];
    for (let i = 0; i < 900; i++) {
      const dx = x - 120, dy = y - 80, r2 = Math.max(16, dx * dx + dy * dy), r = Math.sqrt(r2);
      vx += (k * dx) / (r2 * r) * 0.5; vy += (k * dy) / (r2 * r) * 0.5;
      const v = Math.hypot(vx, vy); vx /= v; vy /= v;   // speed is the same far away: keep the step length fixed
      x += vx * 0.5; y += vy * 0.5;
      if (x < 2 || x > 218 || y < 2 || y > 158) break;
      if (i % 4 === 0) pts.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }
  function trackPath(up: boolean, spiral: boolean) {
    // step along the path, turning by ds/r each step (up: anticlockwise on screen); a spiral's radius shrinks
    let x = 10, y = 100, th = 0, r = spiral ? 70 : 150;
    const pts = [`M${x} ${y}`];
    for (let k = 0; k < (spiral ? 420 : 140); k++) {
      const ds = 1.5;
      th += (up ? -1 : 1) * (ds / r);
      x += ds * Math.cos(th); y += ds * Math.sin(th);
      if (spiral) r = Math.max(4, r * 0.993);
      if (x > 196 || y < 4 || y > 196) break;
      pts.push(`L${x.toFixed(1)} ${y.toFixed(1)}`);
    }
    return pts.join(' ');
  }
</script>

<main class="layout practice" hidden={off}>
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
    {#if q.figure?.kind === 'track'}
      {@const f = q.figure}
      {@const up = (f.sign === 1) === (f.B === 'in')}
      <svg viewBox="0 0 200 200" class="pfig" role="img" aria-label="A particle track in a magnetic field">
        {#each Array.from({ length: 25 }, (_, k) => k) as k (k)}
          {@const x = 20 + (k % 5) * 40}{@const y = 20 + Math.floor(k / 5) * 40}
          {#if f.B === 'in'}<path d="M{x - 4} {y - 4} L{x + 4} {y + 4} M{x + 4} {y - 4} L{x - 4} {y + 4}" class="bmark" />{:else}<circle cx={x} cy={y} r="4" class="bmark" /><circle cx={x} cy={y} r="1.2" class="bdot" />{/if}
        {/each}
        <path d={trackPath(up, !!f.spiral)} class="trk" />
        <path d="M10 100 h18 m-6 -5 l6 5 l-6 5" class="trk arr" />
        <text x="196" y="194" class="ft">B {f.B === 'in' ? 'into' : 'out of'} the page</text>
      </svg>
    {:else if q.figure?.kind === 'quarks'}
      <div class="fig-q">
        <div class="qs">{#each q.figure.q as x, i (i)}<span class="qball big" class:aq={x.startsWith('-')}>{qText(x)}</span>{/each}</div>
        <small>{q.figure.q.length === 2 ? 'quark + antiquark' : 'three (anti)quarks'} · dashed: antiquark</small>
      </div>
    {:else if q.figure?.kind === 'reaction'}
      <div class="fig-r">
        {#each q.figure.lhs as id, i (i)}{#if i}<span class="plus">+</span>{/if}<Sym s={get(id).sym} size="34px" />{/each}
        <span class="arrow">→</span>
        {#each q.figure.rhs as id, i (i)}{#if i}<span class="plus">+</span>{/if}<Sym s={get(id).sym} size="34px" />{/each}
      </div>
    {:else if q.figure?.kind === 'scatter'}
      <svg viewBox="0 0 220 160" class="pfig" role="img" aria-label="α particles passing a gold nucleus">
        <circle cx="120" cy="80" r="5" class="nuc" />
        {#each [-64, -40, -22, -11, -4, 0.0001, 5, 13, 26, 46, 66] as b (b)}<path d={alphaPath(b)} class="apath" class:back={Math.abs(b) < 6} />{/each}
        <text x="120" y="98" class="ft mid">gold nucleus</text>
      </svg>
    {:else}
      <div class="fig-q"><span class="big-glyph">?</span><small>No figure for this one.</small></div>
    {/if}
  </aside>
</main>

<style>
  .pfig{width:100%;max-width:300px;height:auto;font-family:var(--f-mono)}
  .bmark{stroke:var(--muted);stroke-width:1.4;fill:none;opacity:.6}
  .bdot{fill:var(--muted);opacity:.6}
  .trk{fill:none;stroke:var(--accent);stroke-width:3;stroke-linecap:round}
  .trk.arr{stroke-width:2.4}
  .ft{font-size:9.5px;fill:var(--muted);text-anchor:end}
  .ft.mid{text-anchor:middle}
  .nuc{fill:var(--amph)}
  .apath{fill:none;stroke:var(--redox);stroke-width:1.6;opacity:.8}
  .apath.back{stroke-dasharray:3 3}
  .fig-q{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center}
  .fig-q small{color:var(--muted);font-size:12px}
  .qs{display:flex;gap:10px}
  .big-glyph{font:700 64px var(--f-display);color:var(--muted);opacity:.4}
  .fig-r{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:6px 10px}
  .fig-r .plus{font:600 22px var(--f-mono);color:var(--muted)}
  .fig-r .arrow{font:700 28px var(--f-mono)}
</style>
