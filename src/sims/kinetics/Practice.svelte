<script lang="ts" module>
  export interface PScore { right: number; total: number; streak: number; best: number; by?: Record<string, [number, number]> }
</script>

<script lang="ts">
  /* Practice: generated questions on every kinetics and equilibria statement (Topics 9, 11, 13), four options, the
     working once you answer, and a figure where one helps (Maxwell–Boltzmann curves, reaction profiles,
     concentration–time and rate–concentration graphs, a tangent, an Arrhenius plot, a results table). */
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

  /* ---------- figure helpers (plot box: x 30–215, y 15–140) ---------- */
  const X0 = 30, X1 = 215, Y0 = 140, Y1 = 15;
  const path = (f: (u: number) => number, n = 120) =>
    Array.from({ length: n + 1 }, (_, i) => { const u = i / n, y = f(u); return `${i ? 'L' : 'M'}${(X0 + u * (X1 - X0)).toFixed(1)} ${(Y0 - y * (Y0 - Y1)).toFixed(1)}`; }).join(' ');
  /** Maxwell–Boltzmann shape on E in 0–8 (energy units), temperature factor T; normalised so area is the same for all T. */
  const EMAX = 8;
  const mb = (E: number, T: number) => (2 / Math.sqrt(Math.PI)) * Math.sqrt(E) * T ** -1.5 * Math.exp(-E / T);
  const MBTOP = 0.5;                                  // y scale: the T = 1 peak (≈0.48) nearly fills the box
  const mbPath = (T: number) => path((u) => mb(u * EMAX, T) / MBTOP);
  const exX = (E: number) => X0 + (E / EMAX) * (X1 - X0);
  function mbShade(T: number, from: number) {
    const pts: string[] = [`M${exX(from).toFixed(1)} ${Y0}`];
    for (let E = from; E <= EMAX; E += 0.05) pts.push(`L${exX(E).toFixed(1)} ${(Y0 - (mb(E, T) / MBTOP) * (Y0 - Y1)).toFixed(1)}`);
    pts.push(`L${X1} ${Y0} Z`);
    return pts.join(' ');
  }
  /** one hump from level a to level b peaking at pk, s in 0–1 */
  const hump = (a: number, b: number, pk: number, s: number) => { const base = a + (b - a) * s * s * (3 - 2 * s); return base + (pk - base) * Math.sin(Math.PI * s) ** 2; };
  /** reaction profile: flat reactants at r, a peak, flat products at p (fractions of the box height) */
  const profile = (r: number, peak: number, p: number) => path((u) => (u < 0.15 ? r : u > 0.85 ? p : hump(r, p, peak, (u - 0.15) / 0.7)));
  /** the catalysed route: two lower humps with an intermediate at mid between them */
  const profileCat = (r: number, peak: number, p: number, mid: number) => path((u) => {
    if (u < 0.15) return r;
    if (u > 0.85) return p;
    const s = (u - 0.15) / 0.7;
    return s < 0.5 ? hump(r, mid, peak, s / 0.5) : hump(mid, p, peak * 0.93 + mid * 0.07, (s - 0.5) / 0.5);
  });
  const yOf = (v: number) => Y0 - v * (Y0 - Y1);
  /** concentration–time for order n, c0 = 1, scaled so about 3 half-lives (first order) fit */
  const ct = (n: 0 | 1 | 2, u: number) => (n === 0 ? Math.max(0, 1 - 1.1 * u) : n === 1 ? Math.exp(-2.4 * u) : 1 / (1 + 7 * u));
  const halfT = (n: 1 | 2, k: number) => (n === 1 ? (k * Math.LN2) / 2.4 : (2 ** k - 1) / 7);   // time of the k-th half-life
</script>

<main class="layout practice kn-practice" hidden={off}>
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
    {#if q.figure?.kind === 'mb'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="kfig" role="img" aria-label="Maxwell–Boltzmann distribution">
        {#if f.shade !== undefined}<path class="shade" d={mbShade(f.curves[0].T, f.shade)} />{/if}
        {#each f.curves as c, i (i)}
          <path class="curve" class:c2={i === 1} d={mbPath(c.T)} />
          {#if c.label}
            {@const Ep = c.T / 2}
            <text class="ft lab" class:c2={i === 1} x={exX(Ep) + 4} y={yOf(mb(Ep, c.T) / MBTOP) - 5}>{c.label}</text>
          {/if}
        {/each}
        {#each f.ea as e, i (i)}
          <line class="ea" class:c2={i === 1} x1={exX(e.E)} x2={exX(e.E)} y1={Y1 + 10} y2={Y0} />
          <text class="ft mid" x={exX(e.E)} y={Y1 + 6 + i * 0}>{e.label}</text>
        {/each}
        <line class="ax" x1={X0} x2={X1 + 5} y1={Y0} y2={Y0} /><line class="ax" x1={X0} x2={X0} y1={Y1 - 5} y2={Y0} />
        <text class="ft" x={X1} y="156" text-anchor="end">energy →</text>
        <text class="ft" x="6" y="12">number of molecules</text>
      </svg>
    {:else if q.figure?.kind === 'profile'}
      {@const f = q.figure}
      {@const r = f.dH < 0 ? 0.55 : 0.2}
      {@const p = r + f.dH * 0.55}
      {@const peak = 0.95}
      <svg viewBox="0 0 230 165" class="kfig" role="img" aria-label="Reaction profile">
        <path class="curve" d={profile(r, peak, p)} />
        {#if f.cat !== undefined}<path class="curve c2" d={profileCat(r, r + (peak - r) * f.cat, p, Math.min(r, p) + 0.12)} />
          <text class="ft lab c2" x="122" y={yOf(Math.min(r, p) + 0.12) + 14} text-anchor="middle">with catalyst</text>{/if}
        <path class="lvl" d="M{X0} {yOf(r)} H{X0 + 40} M{X1 - 40} {yOf(p)} H{X1}" />
        <text class="ft" x={X0 + 2} y={yOf(r) - 4}>reactants</text>
        <text class="ft" x={X1 - 2} y={yOf(p) - 4} text-anchor="end">products</text>
        {#if f.marks}
          <path class="dim" d="M{X0 + 30} {yOf(r)} V{yOf(peak)}" /><text class="ft" x={X0 + 34} y={yOf((r + peak) / 2)}>Ea</text>
          <path class="dim" d="M{X1 - 30} {yOf(r)} V{yOf(p)}" /><text class="ft" x={X1 - 34} y={yOf((r + p) / 2)} text-anchor="end">ΔH</text>
          <path class="lvl faint" d="M{X0 + 30} {yOf(r)} H{X1 - 26}" />
        {/if}
        <line class="ax" x1={X0} x2={X1 + 5} y1={Y0} y2={Y0} /><line class="ax" x1={X0} x2={X0} y1={Y1 - 5} y2={Y0} />
        <text class="ft" x={X1} y="156" text-anchor="end">progress of reaction →</text>
        <text class="ft" x="6" y="12">energy</text>
      </svg>
    {:else if q.figure?.kind === 'ct'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="kfig" role="img" aria-label="Concentration against time">
        <path class="curve" d={path((u) => ct(f.order, u) * 0.9)} />
        {#if f.halves && f.order !== 0}
          {#each [1, 2, 3] as k (k)}
            {@const u = halfT(f.order, k)}
            {#if u < 1}
              <path class="guide" d="M{X0} {yOf(0.9 / 2 ** k)} H{X0 + u * (X1 - X0)} V{Y0}" />
              <text class="ft mid" x={X0 + u * (X1 - X0)} y={Y0 + 10}>t{k === 1 ? '½' : `${k}×½`}</text>
            {/if}
          {/each}
        {/if}
        <line class="ax" x1={X0} x2={X1 + 5} y1={Y0} y2={Y0} /><line class="ax" x1={X0} x2={X0} y1={Y1 - 5} y2={Y0} />
        <text class="ft" x={X1} y="160" text-anchor="end">{f.xl} →</text>
        <text class="ft" x="6" y="12">{f.yl}</text>
      </svg>
    {:else if q.figure?.kind === 'rc'}
      {@const f = q.figure}
      <svg viewBox="0 0 230 165" class="kfig" role="img" aria-label="Rate against concentration">
        <path class="curve" d={path((u) => (f.order === 0 ? 0.5 : f.order === 1 ? 0.9 * u : 0.9 * u * u))} />
        <line class="ax" x1={X0} x2={X1 + 5} y1={Y0} y2={Y0} /><line class="ax" x1={X0} x2={X0} y1={Y1 - 5} y2={Y0} />
        <text class="ft" x={X1} y="156" text-anchor="end">concentration →</text>
        <text class="ft" x="6" y="12">initial rate</text>
      </svg>
    {:else if q.figure?.kind === 'tangent'}
      {@const f = q.figure}
      {@const tmax = f.X * 3}
      {@const vmax = f.Y * 1.05}
      {@const tau = (vmax * f.X) / f.Y}
      {@const V = (t: number) => vmax * (1 - Math.exp(-t / tau))}
      {@const top = vmax * 1.6}
      <svg viewBox="0 0 230 165" class="kfig" role="img" aria-label="Volume of gas against time with a tangent at the start">
        <path class="curve" d={path((u) => V(u * tmax) / top)} />
        <path class="tan" d="M{X0} {Y0} L{X0 + (f.X / tmax) * (X1 - X0)} {yOf(f.Y / top)}" />
        <path class="guide" d="M{X0} {yOf(f.Y / top)} H{X0 + (f.X / tmax) * (X1 - X0)} V{Y0}" />
        <text class="ft mid" x={X0 + (f.X / tmax) * (X1 - X0)} y={Y0 + 11}>{f.X}</text>
        <text class="ft" x={X0 - 3} y={yOf(f.Y / top) + 3} text-anchor="end">{f.Y}</text>
        <line class="ax" x1={X0} x2={X1 + 5} y1={Y0} y2={Y0} /><line class="ax" x1={X0} x2={X0} y1={Y1 - 5} y2={Y0} />
        <text class="ft" x={X1} y="162" text-anchor="end">{f.xl}</text>
        <text class="ft" x="6" y="12">{f.yl}</text>
      </svg>
    {:else if q.figure?.kind === 'arrh'}
      {@const f = q.figure}
      {@const xs = f.pts.map((p) => p[0])}
      {@const ys = f.pts.map((p) => p[1])}
      {@const xa = Math.min(...xs) - 0.05}
      {@const xb = Math.max(...xs) + 0.05}
      {@const ya = Math.min(...ys) - 0.3}
      {@const yb = Math.max(...ys) + 0.3}
      {@const px = (x: number) => X0 + ((x - xa) / (xb - xa)) * (X1 - X0)}
      {@const py = (y: number) => Y0 - ((y - ya) / (yb - ya)) * (Y0 - Y1)}
      <svg viewBox="0 0 230 165" class="kfig" role="img" aria-label="Arrhenius plot: ln k against 1/T">
        <path class="tan" d="M{px(xa)} {py(f.pts[0][1] - (f.pts[0][0] - xa) * ((ys[ys.length - 1] - ys[0]) / (xs[xs.length - 1] - xs[0])))} L{px(xb)} {py(ys[ys.length - 1] + (xb - xs[xs.length - 1]) * ((ys[ys.length - 1] - ys[0]) / (xs[xs.length - 1] - xs[0])))}" />
        {#each f.pts as p, i (i)}<circle class="pt" cx={px(p[0])} cy={py(p[1])} r="3.2" />{/each}
        <line class="ax" x1={X0} x2={X1 + 5} y1={Y0} y2={Y0} /><line class="ax" x1={X0} x2={X0} y1={Y1 - 5} y2={Y0} />
        <text class="ft" x={X1} y="156" text-anchor="end">{f.xl} →</text>
        <text class="ft" x="6" y="12">{f.yl}</text>
      </svg>
    {:else if q.figure?.kind === 'table'}
      {@const f = q.figure}
      <table class="ktab">
        <thead><tr>{#each f.head as h, i (i)}<th>{h}</th>{/each}</tr></thead>
        <tbody>{#each f.rows as row, i (i)}<tr>{#each row as c, j (j)}<td>{c}</td>{/each}</tr>{/each}</tbody>
      </table>
    {:else}
      <div class="fig-q"><span class="big-glyph">?</span><small>No figure for this one.</small></div>
    {/if}
  </aside>
</main>
