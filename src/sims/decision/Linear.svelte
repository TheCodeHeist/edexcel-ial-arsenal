<script lang="ts" module>
  import { LPS, type LP } from './lp';
  export interface LpPrefs { lp: LP; k: number; shade: 'unwanted' | 'feasible'; ints: boolean }
  export const LP_PREFS: LpPrefs = { lp: structuredClone(LPS[0]), k: 0.6, shade: 'unwanted', ints: true };
</script>

<script lang="ts">
  /* D1.5 linear programming: draw the constraints, find R, then the ruler method (slide the objective line) and the
     vertex method (test every vertex), and integer solutions when only whole numbers make sense. */
  import Seg from '../../components/ui/Seg.svelte';
  import { vertices, optimum, integerOptimum, range, regionPolygon, objective, feasible, fmt, conText, type Con, type Pt } from './lp';

  let { prefs, hidden = false, stats = $bindable([]) }: { prefs: LpPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  const lp = $derived(prefs.lp);
  const rg = $derived(range(lp));
  const opt = $derived(optimum(lp));
  const vs = $derived(vertices(lp));
  const poly = $derived(regionPolygon(lp, rg.xmax, rg.ymax));
  const intOpt = $derived(lp.integer ? integerOptimum(lp, rg.xmax, rg.ymax) : null);
  const optIsInt = $derived(!!opt && Math.abs(opt.best[0] - Math.round(opt.best[0])) < 1e-6 && Math.abs(opt.best[1] - Math.round(opt.best[1])) < 1e-6);

  // drawing box
  const W = 560, H = 420, L = 46, B = 36, T = 14, Rm = 16;
  const sx = (x: number) => L + (x / rg.xmax) * (W - L - Rm);
  const sy = (y: number) => H - B - (y / rg.ymax) * (H - B - T);
  const pts = (ps: Pt[]) => ps.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ');
  function segment(k: Con | { a: number; b: number; c: number }): [Pt, Pt] | null {
    const cand: Pt[] = [];
    if (k.b !== 0) { cand.push([0, k.c / k.b], [rg.xmax, (k.c - k.a * rg.xmax) / k.b]); }
    if (k.a !== 0) { cand.push([k.c / k.a, 0], [(k.c - k.b * rg.ymax) / k.a, rg.ymax]); }
    const inBox = cand.filter(([x, y]) => x >= -1e-9 && y >= -1e-9 && x <= rg.xmax + 1e-9 && y <= rg.ymax + 1e-9);
    return inBox.length >= 2 ? [inBox[0], inBox.find((p) => Math.hypot(p[0] - inBox[0][0], p[1] - inBox[0][1]) > 1e-6) ?? inBox[1]] : null;
  }
  // objective line: k runs over the objective's range across the box
  const kmax = $derived(objective(lp, [rg.xmax, rg.ymax]));
  const kVal = $derived(prefs.k * kmax);
  const objSeg = $derived(segment({ a: lp.obj.p, b: lp.obj.q, c: kVal }));
  const touching = $derived(poly.length > 0 && poly.some((p) => objective(lp, p) <= kVal + 1e-9) && poly.some((p) => objective(lp, p) >= kVal - 1e-9));
  const lattice = $derived.by(() => {
    if (!prefs.ints || !lp.integer) return [];
    const out: Pt[] = [];
    for (let x = 0; x <= rg.xmax; x++) for (let y = 0; y <= rg.ymax; y++) if (feasible(lp, [x, y])) out.push([x, y]);
    return out.length < 600 ? out : [];
  });
  const xticks = $derived(Array.from({ length: rg.xmax + 1 }, (_, k) => k).filter((k) => k % (rg.xmax <= 12 ? 1 : rg.xmax <= 30 ? 2 : 5) === 0));
  const yticks = $derived(Array.from({ length: rg.ymax + 1 }, (_, k) => k).filter((k) => k % (rg.ymax <= 12 ? 1 : rg.ymax <= 30 ? 2 : 5) === 0));

  $effect(() => { stats = [['Vertices', vs.length], [lp.obj.sense === 'max' ? 'Max' : 'Min', opt ? fmt(opt.value) : '–'], ['At', opt ? `(${fmt(opt.best[0])}, ${fmt(opt.best[1])})` : '–']]; });

  function load(k: number) { prefs.lp = structuredClone(LPS[k]); prefs.k = lp.obj.sense === 'max' ? 0.2 : 0.8; }
  function addCon() { if (lp.cons.length < 5) lp.cons.push({ a: 1, b: 1, op: '<=', c: 10 }); }
  const isOpt = (v: Pt) => !!opt?.ties.some((u) => Math.abs(u[0] - v[0]) < 1e-6 && Math.abs(u[1] - v[1]) < 1e-6);
  const presetIx = $derived(LPS.findIndex((x) => x.name === lp.name));
</script>

<main class="layout dec-two" {hidden}>
  <section class="panel stage">
    <div class="stage-head">
      <Seg label="Shading" options={[['unwanted', 'Shade unwanted'], ['feasible', 'Shade R']]} bind:value={prefs.shade} />
      {#if lp.integer}<label class="sb-quiz"><input type="checkbox" bind:checked={prefs.ints} /> Show whole-number points</label>{/if}
    </div>
    <div class="dec-board">
      <svg class="lp" viewBox="0 0 {W} {H}" role="img" aria-label="Feasible region">
        <defs>
          <pattern id="lp-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="7" class="hatch" /></pattern>
          <clipPath id="lp-box"><rect x={sx(0)} y={sy(rg.ymax)} width={sx(rg.xmax) - sx(0)} height={sy(0) - sy(rg.ymax)} /></clipPath>
        </defs>
        {#each xticks as k (k)}<line class="grid" x1={sx(k)} x2={sx(k)} y1={sy(0)} y2={sy(rg.ymax)} /><text class="tl" x={sx(k)} y={sy(0) + 16}>{k}</text>{/each}
        {#each yticks as k (k)}<line class="grid" y1={sy(k)} y2={sy(k)} x1={sx(0)} x2={sx(rg.xmax)} /><text class="tl" x={sx(0) - 8} y={sy(k) + 4} text-anchor="end">{k}</text>{/each}
        <g clip-path="url(#lp-box)">
          {#if prefs.shade === 'unwanted'}
            <path class="unwanted" fill-rule="evenodd" d="M{sx(0)} {sy(0)} H{sx(rg.xmax)} V{sy(rg.ymax)} H{sx(0)} Z {poly.length ? 'M' + pts(poly).replaceAll(' ', ' L') + ' Z' : ''}" />
          {:else if poly.length}
            <polygon class="feas" points={pts(poly)} />
          {/if}
          {#each lp.cons as k, j (j)}
            {@const s = segment(k)}
            {#if s}
              {@const f = 0.18 + 0.2 * (j % 3)}
              <line class="con" x1={sx(s[0][0])} y1={sy(s[0][1])} x2={sx(s[1][0])} y2={sy(s[1][1])} />
              <text class="clab" x={sx(s[0][0] + f * (s[1][0] - s[0][0])) + 6} y={sy(s[0][1] + f * (s[1][1] - s[0][1])) - 7}>{conText(k)}</text>
            {/if}
          {/each}
          {#each lattice as [x, y] (x * 1000 + y)}<circle class="lat" class:best={intOpt && intOpt[0] === x && intOpt[1] === y} cx={sx(x)} cy={sy(y)} r={intOpt && intOpt[0] === x && intOpt[1] === y ? 5 : 2} />{/each}
          {#if objSeg}<line class="obj" class:touch={touching} x1={sx(objSeg[0][0])} y1={sy(objSeg[0][1])} x2={sx(objSeg[1][0])} y2={sy(objSeg[1][1])} />{/if}
        </g>
        <line class="axis" x1={sx(0)} y1={sy(0)} x2={sx(rg.xmax)} y2={sy(0)} /><line class="axis" x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(rg.ymax)} />
        <text class="axl" x={sx(rg.xmax)} y={sy(0) + 30} text-anchor="end">x ({lp.x})</text>
        <text class="axl" x={sx(0) + 6} y={sy(rg.ymax) + 12}>y ({lp.y})</text>
        {#each vs as v, j (j)}<circle class="vert" class:opt={isOpt(v)} cx={sx(v[0])} cy={sy(v[1])} r="5" />{/each}
        {#if poly.length}
          {@const cx = poly.reduce((a, p) => a + p[0], 0) / poly.length}
          {@const cy = poly.reduce((a, p) => a + p[1], 0) / poly.length}
          <text class="rlab" x={sx(cx)} y={sy(cy)}>R</text>
        {/if}
      </svg>
    </div>
    <div class="ctls">
      <label class="ctl"><span class="ctl-l">Objective line {lp.obj.p}x + {lp.obj.q}y = <b>{fmt(kVal)}</b></span>
        <input class="slider" type="range" min="0" max="1" step="0.002" bind:value={prefs.k} /></label>
      <p class="why">Ruler method: slide the objective line parallel to itself. {lp.obj.sense === 'max' ? 'The last' : 'The first'} vertex of R it touches is optimal{opt ? `: (${fmt(opt.best[0])}, ${fmt(opt.best[1])}), where ${lp.obj.sense === 'max' ? 'P' : 'C'} = ${fmt(opt.value)}` : ''}.</p>
    </div>
  </section>

  <aside class="panel side">
    <div class="ph"><h2>Problem</h2></div>
    <div class="ctls">
      <select class="inp" value={presetIx} onchange={(e) => load(+(e.currentTarget as HTMLSelectElement).value)}>
        {#each LPS as x, k (k)}<option value={k}>{x.name}</option>{/each}
        {#if presetIx < 0}<option value={-1} disabled>Edited</option>{/if}
      </select>
      <p class="why">{lp.story}</p>
    </div>
    <div class="ph"><h2>Formulation</h2></div>
    <div class="ctls form">
      <div class="lprow">
        <select class="inp xs" bind:value={lp.obj.sense} onchange={() => (lp.name = 'Edited')}><option value="max">Maximise</option><option value="min">Minimise</option></select>
        <input class="inp xs" type="number" bind:value={lp.obj.p} onchange={() => (lp.name = 'Edited')} />x +
        <input class="inp xs" type="number" bind:value={lp.obj.q} onchange={() => (lp.name = 'Edited')} />y
      </div>
      <small class="muted">subject to</small>
      {#each lp.cons as k, j (j)}
        <div class="lprow">
          <input class="inp xs" type="number" bind:value={k.a} onchange={() => (lp.name = 'Edited')} />x +
          <input class="inp xs" type="number" bind:value={k.b} onchange={() => (lp.name = 'Edited')} />y
          <select class="inp xs" bind:value={k.op} onchange={() => (lp.name = 'Edited')}><option value="<=">≤</option><option value=">=">≥</option></select>
          <input class="inp xs" type="number" bind:value={k.c} onchange={() => (lp.name = 'Edited')} />
          <button class="btn sm" type="button" aria-label="Remove constraint" onclick={() => { lp.cons.splice(j, 1); lp.name = 'Edited'; }} disabled={lp.cons.length <= 1}>✕</button>
        </div>
      {/each}
      <div class="lprow"><button class="btn sm" type="button" onclick={addCon} disabled={lp.cons.length >= 5}>+ constraint</button><span class="muted">x, y ≥ 0</span>
        <label class="sb-quiz"><input type="checkbox" bind:checked={lp.integer} /> whole numbers only</label></div>
    </div>
    <div class="ph"><h2>Vertex method</h2></div>
    <div class="mx-wrap pad">
      <table class="mx">
        <thead><tr><th>Vertex</th><th>{lp.obj.p}x + {lp.obj.q}y</th></tr></thead>
        <tbody>{#each vs as v, j (j)}<tr class:critrow={isOpt(v)}><td>({fmt(v[0])}, {fmt(v[1])})</td><td>{fmt(objective(lp, v))}</td></tr>{:else}<tr><td colspan="2">No feasible region.</td></tr>{/each}</tbody>
      </table>
    </div>
    {#if lp.integer && opt}
      <div class="ph"><h2>Whole numbers</h2></div>
      <p class="why pad">
        {#if optIsInt}The optimal vertex already has whole-number coordinates.
        {:else if intOpt}The vertex ({fmt(opt.best[0])}, {fmt(opt.best[1])}) isn't whole, so test the whole-number points near it inside R. Best: <b>({intOpt[0]}, {intOpt[1]})</b>, giving {fmt(objective(lp, intOpt))}. Rounding the vertex isn't enough: always check the point is in R.
        {:else}No whole-number point lies in R.{/if}
      </p>
    {/if}
  </aside>
</main>
