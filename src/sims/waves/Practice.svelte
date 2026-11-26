<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number; by?: Record<string, [number, number]> }
</script>

<script lang="ts">
  /* Practice: generated questions on every Unit 2 waves and photons statement, four options, the working once you
     answer, and a figure where one helps (a wave graph, a standing wave, a ray at a boundary, energy levels, a grating,
     an oscilloscope screen, an A-scan). */
  import { newQuestion, TOPICS, TOPIC_NAME, type Question, type Topic } from './practice';

  let { score, topic = $bindable('all'), hidden: off = false }: { score: PScore; topic?: Topic | 'all'; hidden?: boolean } = $props();

  /* the spec statements behind each topic, for the sidebar */
  const SPEC: Record<Topic | 'all', string> = {
    all: 'statements 33–63', waves: '33–37', superpose: '39, 40', standing: '41–43 · CP4, CP5', light: '44–49, 55',
    diffract: '50–54 · CP6', echo: '55, 56', photon: '57–63',
  };
  const tally = (t: Topic | 'all'): [number, number] => {
    if (t === 'all') return [score.right, score.total];
    return score.by?.[t] ?? [0, 0];
  };

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

  const rad = (d: number) => (d * Math.PI) / 180;
  /** A sine curve from x0 to x1 with n cycles, amplitude a, about y0. */
  function sine(x0: number, x1: number, y0: number, a: number, n: number, ph = 0) {
    const pts: string[] = [];
    for (let i = 0; i <= 160; i++) { const u = i / 160; pts.push(`${i ? 'L' : 'M'}${(x0 + u * (x1 - x0)).toFixed(1)} ${(y0 - a * Math.sin(2 * Math.PI * n * u + ph)).toFixed(1)}`); }
    return pts.join(' ');
  }
  /** Energy level → y for the levels figure. */
  const lvY = (e: number, lv: number[]) => {
    const lo = Math.min(...lv), ys = lv.map((x) => 28 + Math.pow(x / lo, 0.45) * 122);
    for (let i = 1; i < ys.length; i++) ys[i] = Math.min(ys[i], ys[i - 1] - 13);   // keep labels apart
    return ys[lv.indexOf(e)] ?? 28;
  };

  /* Kernel hooks */
  export function kAnswer(o: string) { answer(o); }
  export function kNext() { next(); }
  export function kSnapshot() { return { q, picked, ok }; }
</script>

<main class="layout practice wv-practice" hidden={off}>
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
    {#if q.figure?.kind === 'wave'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 160" class="wfig" role="img" aria-label="Displacement against {f.axis === 'x' ? 'distance' : 'time'}: {f.cycles} cycles in {f.end}">
        <line class="ax" x1="24" x2="214" y1="80" y2="80" /><line class="ax" x1="24" x2="24" y1="18" y2="142" />
        <path class="curve" d={sine(24, 206, 80, 46, f.cycles)} />
        <line class="tick" x1="206" x2="206" y1="76" y2="88" />
        <text class="ft mid" x="206" y="138">{f.end}</text>
        <line class="tick" x1="206" x2="206" y1="88" y2="130" stroke-dasharray="2 3" />
        <text class="ft" x="218" y="154" text-anchor="end">{f.axis === 'x' ? 'distance' : 'time'} →</text>
        <text class="ft" x="28" y="14">displacement</text>
        <text class="ft mid" x="16" y="84">0</text>
      </svg>
    {:else if q.figure?.kind === 'standing'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 150" class="wfig" role="img" aria-label="A standing wave with {f.loops} loops">
        <rect class="clamp" x="10" y="45" width="8" height="60" rx="2" /><rect class="clamp" x="212" y="45" width="8" height="60" rx="2" />
        <path class="curve" d={Array.from({ length: 161 }, (_, i) => `${i ? 'L' : 'M'}${(18 + (i / 160) * 194).toFixed(1)} ${(75 - 34 * Math.sin(Math.PI * f.loops * (i / 160))).toFixed(1)}`).join(' ')} />
        <path class="curve ghost" d={Array.from({ length: 161 }, (_, i) => `${i ? 'L' : 'M'}${(18 + (i / 160) * 194).toFixed(1)} ${(75 + 34 * Math.sin(Math.PI * f.loops * (i / 160))).toFixed(1)}`).join(' ')} />
        {#each Array.from({ length: f.loops + 1 }, (_, k) => 18 + (k / f.loops) * 194) as x (x)}<text class="ft mid nd" x={x} y="122">N</text>{/each}
        {#each Array.from({ length: f.loops }, (_, k) => 18 + ((k + 0.5) / f.loops) * 194) as x (x)}<text class="ft mid an" x={x} y="30">A</text>{/each}
        {#if f.len}<path class="dim" d="M18 138 H212 M18 133 V143 M212 133 V143" /><text class="ft mid" x="115" y="134">{f.len}</text>{/if}
      </svg>
    {:else if q.figure?.kind === 'ray'}
      {@const f = q.figure}
      {@const P = { x: 115, y: 85 }}
      {@const L = 70}
      <svg viewBox="0 0 230 170" class="wfig" role="img" aria-label="A ray meeting a boundary at {f.i}° to the normal">
        <rect class="med" x="0" y="85" width="230" height="85" />
        <line class="ax" x1="0" x2="230" y1="85" y2="85" />
        <line class="normal" x1="115" x2="115" y1="10" y2="160" />
        <path class="ray" d="M{P.x - L * Math.sin(rad(f.i))} {P.y - L * Math.cos(rad(f.i))} L{P.x} {P.y}" />
        {#if f.r === null}
          <path class="ray" d="M{P.x} {P.y} L{P.x + L * Math.sin(rad(f.i))} {P.y - L * Math.cos(rad(f.i))}" />
          <text class="ft mid" x="170" y="20">totally internally reflected</text>
        {:else}
          <path class="ray" d="M{P.x} {P.y} L{P.x + L * Math.sin(rad(f.r))} {P.y + L * Math.cos(rad(f.r))}" />
          <path class="ray faint" d="M{P.x} {P.y} L{P.x + L * 0.7 * Math.sin(rad(f.i))} {P.y - L * 0.7 * Math.cos(rad(f.i))}" />
        {/if}
        <text class="ft ang" x={P.x - 16} y={P.y - 26} text-anchor="end">{Math.round(f.i)}°</text>
        <text class="ft" x="6" y="78">{f.top}</text>
        <text class="ft" x="6" y="100">{f.bottom}</text>
        <text class="ft mid" x="128" y="166">normal</text>
      </svg>
    {:else if q.figure?.kind === 'levels'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 170" class="wfig" role="img" aria-label="Energy levels with a transition">
        {#each f.levels as e, i (i)}
          <line class="lvl" class:hl={i === f.from || i === f.to} x1="30" x2="170" y1={lvY(e, f.levels)} y2={lvY(e, f.levels)} />
          <text class="ft" x="176" y={lvY(e, f.levels) + 3}>{String(e).replace('-', '−')} eV</text>
        {/each}
        <line class="lvl ion" x1="30" x2="170" y1="12" y2="12" /><text class="ft" x="176" y="15">0</text>
        {#if f.from !== f.to}
          <line class="tr" x1="100" x2="100" y1={lvY(f.levels[f.from], f.levels)} y2={lvY(f.levels[f.to], f.levels) + (f.from > f.to ? 5 : -5)} marker-end="url(#pa)" />
          <path class="squig" d={Array.from({ length: 8 }, (_, k) => `${k ? 'L' : 'M'}${110 + k * 6} ${(lvY(f.levels[f.from], f.levels) + lvY(f.levels[f.to], f.levels)) / 2 + (k % 2 ? -4 : 4)}`).join(' ')} />
        {/if}
        <defs><marker id="pa" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ahd" /></marker></defs>
      </svg>
    {:else if q.figure?.kind === 'grating'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 170" class="wfig" role="img" aria-label="A diffraction grating with the order {f.order} maximum marked">
        <path class="ray" d="M8 85 H70" />
        <rect class="laser" x="4" y="78" width="16" height="14" rx="2" />
        <line class="grate" x1="70" x2="70" y1="30" y2="140" />
        <line class="ax" x1="186" x2="186" y1="10" y2="160" />
        {#each [-2, -1, 0, 1, 2] as n (n)}
          {@const y = 85 - n * 34}
          <path class="ray" class:faint={n !== f.order && n !== 0} d="M70 85 L186 {y}" />
          <text class="ft" x="190" y={y + 3}>n = {n === 0 ? 0 : n > 0 ? n : `−${-n}`}</text>
        {/each}
        <path class="arc" d="M120 85 A50 50 0 0 0 {70 + 50 * Math.cos(Math.atan2(f.order * 34, 116))} {85 - 50 * Math.sin(Math.atan2(f.order * 34, 116))}" />
        <text class="ft ang" x="126" y={85 - f.order * 9}>θ</text>
        <text class="ft mid" x="70" y="154">grating</text>
        <text class="ft mid" x="186" y="168">screen</text>
      </svg>
    {:else if q.figure?.kind === 'scope'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 170" class="wfig" role="img" aria-label="Oscilloscope screen with two traces, one cycle spanning {f.divs} divisions">
        <rect class="scr" x="15" y="10" width="200" height="140" rx="6" />
        {#each Array.from({ length: 11 }, (_, k) => 15 + k * 20) as x (x)}<line class="grid" x1={x} x2={x} y1="10" y2="150" />{/each}
        {#each Array.from({ length: 8 }, (_, k) => 10 + k * 20) as y (y)}<line class="grid" x1="15" x2="215" y1={y} y2={y} />{/each}
        <path class="tr1" d={sine(15, 215, 55, 22, 10 / f.divs)} />
        <path class="tr2" d={sine(15, 215, 110, 14, 10 / f.divs)} />
        <text class="ft mid" x="115" y="166">time base {f.tb}</text>
        <text class="ft lbl" x="20" y="22">speaker</text><text class="ft lbl" x="20" y="140">microphone</text>
      </svg>
    {:else if q.figure?.kind === 'echo'}
      {@const f = q.figure}
      {@const tmax = Math.max(f.t1, f.t2) * 1.25}
      {@const ex = (t: number) => 20 + (t / tmax) * 195}
      <svg viewBox="0 0 230 150" class="wfig" role="img" aria-label="An A-scan: transmitted pulse and echoes against time">
        <line class="ax" x1="20" x2="220" y1="110" y2="110" /><line class="ax" x1="20" x2="20" y1="20" y2="114" />
        <path class="curve" d="M20 110 L22 30 L25 110 L{ex(f.t1) - 3} 110 L{ex(f.t1)} 62 L{ex(f.t1) + 3} 110 {f.t2 ? `L${ex(f.t2) - 3} 110 L${ex(f.t2)} 78 L${ex(f.t2) + 3} 110` : ''} L215 110" />
        <text class="ft mid" x={ex(f.t1)} y="125">{Math.round(f.t1 * 10) / 10}</text>
        {#if f.t2}<text class="ft" x={ex(f.t2) + 4} y="72">{Math.round(f.t2 * 10) / 10}</text>{/if}
        <text class="ft" x="218" y="142" text-anchor="end">time / {f.unit}</text>
        <text class="ft" x="26" y="26">pulse sent</text>
      </svg>
    {:else}
      <div class="fig-q"><span class="big-glyph">?</span><small>No figure for this one.</small></div>
    {/if}
  </aside>
</main>
