<script lang="ts" module>
  export interface CpaPrefs { project: number; view: 'network' | 'gantt' | 'table'; t: number; quiz: boolean }
  export const CPA_PREFS: CpaPrefs = { project: 0, view: 'network', t: 8.5, quiz: false };
</script>

<script lang="ts">
  /* D1.4 critical path analysis: forward and backward passes on an activity-on-arc network, floats, the critical
     path, the precedence table, a cascade (Gantt) chart with "must be happening at time t", and a workers bound. */
  import Seg from '../../components/ui/Seg.svelte';
  import StepBar from './StepBar.svelte';
  import { PROJECTS, times, activityTable, criticalPaths, precedence, workersLowerBound, mustHappen, passSteps } from './cpa';
  import { sum } from './util';

  let { prefs, hidden = false, stats = $bindable([]), onscore }: {
    prefs: CpaPrefs; hidden?: boolean; stats?: [string, string | number][]; onscore: (ok: boolean) => void;
  } = $props();

  let i = $state(0);
  const p = $derived(PROJECTS[prefs.project] ?? PROJECTS[0]);
  const t = $derived(times(p));
  const rows = $derived(activityTable(p, t));
  const steps = $derived(passSteps(p));
  $effect(() => { void prefs.project; i = 0; });
  const cur = $derived(steps[Math.min(i, steps.length - 1)].s);
  const done = $derived(cur.phase === 'done');
  const crit = $derived(new Set(rows.filter((r) => r.critical).map((r) => r.a.id)));
  const paths = $derived(criticalPaths(p, t));
  const prec = $derived(precedence(p));
  const lbw = $derived(workersLowerBound(p, t));
  const must = $derived(mustHappen(rows, prefs.t));
  $effect(() => { stats = [['Finish', done ? t.T : '–'], ['Activities', rows.length], ['Workers ≥', lbw]]; });

  // drawing
  const S = 6.4, PX = 34, PY = 46;
  const X = (x: number) => PX + x * S, Y = (y: number) => PY + y * S;
  const W = 100 * S + PX * 2, H = 60 * S + PY + 30;
  const evAt = (n: number) => p.ev.find((e) => e.n === n)!;
  function arcGeom(from: number, to: number) {
    const a = evAt(from), b = evAt(to), x1 = X(a.x), y1 = Y(a.y), x2 = X(b.x), y2 = Y(b.y);
    const L = Math.hypot(x2 - x1, y2 - y1), ux = (x2 - x1) / L, uy = (y2 - y1) / L, r = 17;
    return { x1: x1 + ux * r, y1: y1 + uy * r, x2: x2 - ux * (r + 3), y2: y2 - uy * (r + 3), mx: (x1 + x2) / 2 - uy * 12, my: (y1 + y2) / 2 + ux * 12 };
  }
  // Gantt
  const GW = 620, ROW = 24;
  const gx = (v: number) => 46 + (v / t.T) * (GW - 60);
  const ticks = $derived(Array.from({ length: t.T + 1 }, (_, k) => k).filter((k) => t.T <= 24 || k % 2 === 0));
</script>

<main class="layout dec-two" {hidden}>
  <section class="panel stage">
    <div class="stage-head">
      <Seg label="View" options={[['network', 'Network'], ['gantt', 'Cascade chart', 'Gantt'], ['table', 'Tables']]} bind:value={prefs.view} />
      <span class="label-chip"><small>{p.name}</small>{done ? `finishes at ${t.T}` : ''}</span>
    </div>

    {#if prefs.view === 'network'}
      <div class="dec-board">
        <svg class="cpa" viewBox="0 0 {W} {H}" role="img" aria-label="Activity network">
          <defs><marker id="cpa-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerUnits="userSpaceOnUse" markerWidth="13" markerHeight="13" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="context-stroke" /></marker></defs>
          {#each p.acts as a, k (k)}
            {@const gm = arcGeom(a.from, a.to)}
            <line class="act" class:dummy={a.dummy} class:crit={done && (a.dummy ? cur.early[a.from] === cur.late[a.from] && cur.early[a.to] === cur.late[a.to] && (cur.early[a.from] ?? 0) === cur.early[a.to] : crit.has(a.id))}
              x1={gm.x1} y1={gm.y1} x2={gm.x2} y2={gm.y2} marker-end="url(#cpa-arrow)" />
            {#if !a.dummy}<text class="alab" class:crit={done && crit.has(a.id)} x={gm.mx} y={gm.my}>{a.id}({a.d})</text>{/if}
          {/each}
          {#each p.ev as e (e.n)}
            <g class="ev" class:focus={cur.focus === e.n} class:crit={done && t.early[e.n] === t.late[e.n]} transform="translate({X(e.x)} {Y(e.y)})">
              <circle r="16" /><text>{e.n}</text>
              <g transform="translate(-26 -42)">
                <rect class="tbox" width="26" height="20" /><rect class="tbox" x="26" width="26" height="20" />
                <text class="tv early" x="13" y="10">{cur.early[e.n] ?? ''}</text><text class="tv late" x="39" y="10">{cur.late[e.n] ?? ''}</text>
              </g>
            </g>
          {/each}
        </svg>
        <div class="dec-key"><span>Box above each event: <b>early</b> | <b>late</b> event time</span><span><i class="k dummy"></i>dummy</span><span><i class="k crit"></i>critical</span></div>
      </div>
      <StepBar {steps} bind:i bind:quiz={prefs.quiz} {onscore} />
    {:else if prefs.view === 'gantt'}
      <div class="dec-board">
        <svg class="gantt" viewBox="0 0 {GW} {rows.length * ROW + 48}" role="img" aria-label="Cascade chart">
          {#each ticks as k (k)}<line class="tick" x1={gx(k)} x2={gx(k)} y1="22" y2={rows.length * ROW + 26} /><text class="tl" x={gx(k)} y="14">{k}</text>{/each}
          {#each rows as r, k (r.a.id)}
            <text class="gl" x="30" y={34 + k * ROW}>{r.a.id}</text>
            <rect class="bar" class:crit={r.critical} class:must={must.includes(r.a.id)} x={gx(r.es)} y={24 + k * ROW} width={gx(r.ef) - gx(r.es)} height={ROW - 8} rx="3" />
            {#if r.float > 0}<rect class="float" x={gx(r.ef)} y={24 + k * ROW} width={gx(r.lf) - gx(r.ef)} height={ROW - 8} rx="3" />{/if}
          {/each}
          <line class="now" x1={gx(prefs.t)} x2={gx(prefs.t)} y1="18" y2={rows.length * ROW + 30} />
        </svg>
        <div class="dec-key"><span><i class="k crit"></i>critical</span><span><i class="k float"></i>total float</span><span><i class="k must"></i>must be happening at t</span></div>
      </div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Time t <b>{prefs.t}</b></span><input class="slider" type="range" min="0.5" max={t.T - 0.5} step="1" bind:value={prefs.t} /></label>
        <p class="why">At t = {prefs.t}, the activities that <b>must</b> be happening are {must.join(', ') || 'none'}: their latest start is before t and their earliest finish after it, so no float can move them away.</p>
      </div>
    {:else}
      <div class="dec-board">
        <div class="mx-wrap">
          <table class="mx">
            <thead><tr><th>Activity</th><th>Depends on</th><th>Duration</th><th>Earliest start</th><th>Latest finish</th><th>Total float</th></tr></thead>
            <tbody>
              {#each rows as r (r.a.id)}
                <tr class:critrow={r.critical}><th>{r.a.id}</th><td>{prec[r.a.id].join(', ') || '–'}</td><td>{r.a.d}</td><td>{r.es}</td><td>{r.lf}</td><td>{r.lf} − {r.a.d} − {r.es} = <b>{r.float}</b></td></tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}
  </section>

  <aside class="panel side">
    <div class="ph"><h2>Project</h2></div>
    <div class="ctls">
      <select class="inp" bind:value={prefs.project}>{#each PROJECTS as pr, k (k)}<option value={k}>{pr.name}</option>{/each}</select>
      <p class="why">{p.story}</p>
    </div>
    <div class="ph"><h2>Results</h2></div>
    <dl class="reads pad">
      <div><dt>Minimum completion</dt><dd>{done || prefs.view !== 'network' ? t.T : '?'}</dd></div>
      <div><dt>Critical path</dt><dd>{done || prefs.view !== 'network' ? paths.map((x) => x.join('')).join(', ') : '?'}</dd></div>
    </dl>
    <div class="ph"><h2>Workers: lower bound</h2></div>
    <div class="eq pad">⌈sum of durations ÷ critical time⌉ = ⌈{sum(p.acts.map((a) => a.d))} ÷ {t.T}⌉ = {lbw}</div>
    <div class="ph"><h2>The rule</h2></div>
    <p class="why pad">Forward pass: early time = the <b>largest</b> of (early time + duration) over arcs coming in. Backward pass: late time = the <b>smallest</b> of (late time − duration) over arcs going out. Total float = latest finish − duration − earliest start; critical activities have zero float.</p>
  </aside>
</main>
