<script lang="ts" module>
  export interface MechPrefs {
    sn: 'sn2' | 'sn1';
    side: 'back' | 'front';        // SN1: which face the OH⁻ attacks
    ex: string;                    // rate-equation exercise: example id
    exMode: 'pick' | 'write';
    step: number;                  // iodination mechanism step 0–3
  }
  export const MECH: MechPrefs = { sn: 'sn2', side: 'back', ex: 'no2co', exMode: 'pick', step: 0 };
</script>

<script lang="ts">
  /* Mechanisms: how a rate equation is evidence for a mechanism (spec 11.6–11.9). SN2 and SN1 in 3D with curly
     arrows, an energy profile and the rate equations; the acid-catalysed iodination of propanone from its
     initial-rates data to a step-by-step mechanism; and an exercise linking rate equations and slow steps both ways. */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { MLook } from './mechanism3d';
  import { EXAMPLES, IOD_RUNS, IOD_STEPS, IOD_K, iodRate, type Panel } from './mechanism';
  import { sci, plain } from './consts';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: MechPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  /* ---------- SN1 / SN2 player ---------- */
  let p = $state(0);
  let playing = $state(!RM);
  let lastSn = '';
  $effect(() => { const k = prefs.sn + prefs.side; if (k !== lastSn) { lastSn = k; p = 0; if (!RM) playing = true; } });
  $effect(() => {
    if (!playing || off) return;
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.25, (now - last) / 1000); last = now;
      p = Math.min(1, p + dt / 9);
      if (p >= 1) { playing = false; return; }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  });
  function play() { if (p >= 1) p = 0; playing = !playing; }
  const look = $derived<MLook>({ sn: prefs.sn, side: prefs.side, p });

  const stage = $derived.by(() => {
    if (prefs.sn === 'sn2') {
      if (p < 0.22) return ['OH⁻ approaches', 'from the side opposite the bromine (backside attack): Br blocks the front, and the δ+ carbon is exposed at the back.'];
      if (p < 0.6) return ['Transition state', 'one step: the O–C bond forms as the C–Br bond breaks. Five groups round the carbon, two of them partly bonded.'];
      if (p < 0.8) return ['Br⁻ leaves', 'the three other groups flip over like an umbrella in the wind: the configuration is inverted.'];
      return ['Ethanol + Br⁻', 'one step, so both the halogenoalkane and OH⁻ are in the rate-determining step.'];
    }
    if (p < 0.12) return ['2-bromo-2-methylpropane', 'C–Br is polar (δ+ C, δ− Br). The bulky methyl groups block any backside attack.'];
    if (p < 0.45) return ['Step 1 (slow): C–Br breaks', 'heterolytically, on its own: both bonding electrons go to bromine. Only the halogenoalkane is involved.'];
    if (p < 0.6) return ['Tertiary carbocation', 'trigonal planar (120°), stabilised by the electron-releasing (positive inductive) effect of the three methyl groups.'];
    if (p < 0.88) return ['Step 2 (fast): OH⁻ attacks', `from ${prefs.side === 'back' ? 'the face Br did not leave from' : 'the same face Br left from'}: either face is open on a flat carbocation.`];
    return ['2-methylpropan-2-ol + Br⁻', 'OH⁻ joined after the slow step, so it is not in the rate equation.'];
  });

  /* energy profile: cosine interpolation through key points; the marker follows p */
  const KEYS = $derived<[number, number][]>(prefs.sn === 'sn2' ? [[0, 0.18], [0.5, 0.84], [1, 0.02]] : [[0, 0.18], [0.3, 0.88], [0.47, 0.5], [0.58, 0.63], [1, 0.02]]);
  function E(x: number, k: [number, number][]) {
    for (let i = 0; i + 1 < k.length; i++) {
      const [x0, y0] = k[i], [x1, y1] = k[i + 1];
      if (x <= x1 || i + 2 === k.length) { const f = Math.min(1, Math.max(0, (x - x0) / (x1 - x0))); return y0 + (y1 - y0) * (1 - Math.cos(Math.PI * f)) / 2; }
    }
    return 0;
  }
  const xOfP = $derived(prefs.sn === 'sn2' ? p : p < 0.12 ? (p / 0.12) * 0.05 : p < 0.45 ? 0.05 + ((p - 0.12) / 0.33) * 0.42 : p < 0.6 ? 0.47 + ((p - 0.45) / 0.15) * 0.03 : p < 0.85 ? 0.5 + ((p - 0.6) / 0.25) * 0.4 : 0.9 + ((p - 0.85) / 0.15) * 0.1);
  const PX = (x: number) => 30 + x * 270, PY = (y: number) => 150 - y * 120;
  const profile = $derived(Array.from({ length: 121 }, (_, i) => { const x = i / 120; return `${i ? 'L' : 'M'}${PX(x).toFixed(1)} ${PY(E(x, KEYS)).toFixed(1)}`; }).join(' '));

  /* ---------- the rate-equation exercise ---------- */
  const ex = $derived(EXAMPLES.find((e) => e.id === prefs.ex) ?? EXAMPLES[0]);
  /** a fixed shuffle per example so the right answer is not always first */
  const order = $derived(ex.mechs.map((_, i) => i).sort((a, b) => ((a * 7 + ex.id.length) % 5) - ((b * 7 + ex.id.length) % 5)));
  let picked = $state<number | null>(null);
  let guess = $state<number[]>([]);
  let checked = $state(false);
  let exKey = '';
  $effect(() => { const k = ex.id + prefs.exMode; if (k !== exKey) { exKey = k; picked = null; guess = ex.species.map(() => -1); checked = false; } });
  const allSet = $derived(guess.length === ex.species.length && guess.every((g) => g >= 0));
  const allRight = $derived(checked && guess.every((g, i) => g === ex.orders[i]));
  const rateText = (sp: string[], ord: number[]) => 'rate = k' + sp.map((s, i) => (ord[i] === 0 ? '' : ord[i] === 1 ? `[${s}]` : `[${s}]${ord[i] === 2 ? '²' : ord[i]}`)).join('');

  /* ---------- iodination ---------- */
  const iod = $derived(IOD_STEPS[Math.min(3, Math.max(0, prefs.step))]);
  const r = IOD_RUNS.map(iodRate);

  $effect(() => {
    stats = [['Mechanism', prefs.sn === 'sn2' ? 'SN2' : 'SN1'], ['Rate', prefs.sn === 'sn2' ? 'k[RBr][OH⁻]' : 'k[RBr]'], ['Order', prefs.sn === 'sn2' ? '2 overall' : '1 overall']];
  });

  /* SVG helpers for the curly-arrow panels */
  function trim(x1: number, y1: number, x2: number, y2: number, a: number, b: number) {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    return [x1 + (dx / L) * a, y1 + (dy / L) * a, x2 - (dx / L) * b, y2 - (dy / L) * b];
  }
  const pad = (t: string) => (t.length > 1 ? 17 : 9);
  function bonds(P: Panel) {
    return P.bonds.map((b) => {
      const A = P.atoms[b.a], B = P.atoms[b.b];
      const [x1, y1, x2, y2] = trim(A.x, A.y, B.x, B.y, pad(A.t), pad(B.t));
      if (b.n === 1) return [`M${x1} ${y1} L${x2} ${y2}`];
      const L = Math.hypot(x2 - x1, y2 - y1) || 1, ox = (-(y2 - y1) / L) * 3, oy = ((x2 - x1) / L) * 3;
      return [`M${x1 + ox} ${y1 + oy} L${x2 + ox} ${y2 + oy}`, `M${x1 - ox} ${y1 - oy} L${x2 - ox} ${y2 - oy}`];
    }).flat();
  }
</script>

<main class="layout kn-mech" hidden={off}>
  <section class="panel stage" aria-label="SN1 and SN2">
    <div class="stage-head">
      <div class="label-chip"><small>Spec 11.9</small><span>{prefs.sn === 'sn2' ? 'SN2: a primary halogenoalkane' : 'SN1: a tertiary halogenoalkane'}</span></div>
      <div class="stage-tools">
        <Seg label="Mechanism" options={[['sn2', 'SN2 · bromoethane', 'SN2'], ['sn1', 'SN1 · 2-bromo-2-methylpropane', 'SN1']]} bind:value={prefs.sn} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./mechanism3d').then((m) => m.MechScene)} {look} label="3D ball-and-stick model of the substitution mechanism. Drag to turn it.">
          <div class="hud tl"><b>{stage[0]}</b><span class="wrap2">{stage[1]}</span></div>
          <div class="hud tr">{prefs.sn === 'sn2' ? 'rate = k[CH₃CH₂Br][OH⁻]' : 'rate = k[(CH₃)₃CBr]'}</div>
          <div class="hud bl">Grey C, white H, red O, brown Br. Gold: curly arrows (movement of an electron pair). Dashed: bonds partly made or broken.</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={play}>{playing ? 'Pause' : p >= 1 ? 'Replay' : 'Play'}</button>
      <label class="ctl scrub"><span class="ctl-l">Reaction progress <b>{Math.round(p * 100)}%</b></span>
        <input class="slider" type="range" min="0" max="1" step="0.005" bind:value={p} oninput={() => (playing = false)} /></label>
      {#if prefs.sn === 'sn1'}
        <Seg label="OH⁻ attacks" options={[['back', 'From the back'], ['front', 'From the front']]} bind:value={prefs.side} />
      {/if}
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Energy profile">
      <div class="ph"><h2>Energy profile</h2></div>
      <svg class="eprof" viewBox="0 0 320 180" role="img" aria-label={prefs.sn === 'sn2' ? 'One hump: a single transition state' : 'Two humps: the first, higher one is the slow step, with the carbocation intermediate in the dip between'}>
        <line class="ax" x1="30" y1="160" x2="306" y2="160" /><line class="ax" x1="30" y1="160" x2="30" y2="14" />
        <text class="ft" x="32" y="11">energy</text><text class="ft" x="304" y="174" text-anchor="end">progress of reaction →</text>
        <path class="curve" d={profile} />
        {#if prefs.sn === 'sn2'}
          <text class="ft mid" x={PX(0.5)} y={PY(0.84) - 8}>transition state ‡</text>
          <path class="ea" d="M{PX(0.18)} {PY(0.18)} V{PY(0.84)}" /><text class="ft" x={PX(0.18) + 4} y={PY(0.5)}>Ea</text>
        {:else}
          <text class="ft mid" x={PX(0.3)} y={PY(0.88) - 8}>TS 1 (slow)</text>
          <text class="ft mid" x={PX(0.47)} y={PY(0.5) + 16}>R₃C⁺</text>
          <text class="ft mid" x={PX(0.62)} y={PY(0.63) - 8}>TS 2</text>
          <path class="ea" d="M{PX(0.1)} {PY(0.2)} V{PY(0.88)}" /><text class="ft" x={PX(0.1) + 4} y={PY(0.55)}>Ea</text>
        {/if}
        <text class="ft" x="34" y={PY(0.18) + 14}>reactants</text><text class="ft" x="300" y={PY(0.02) - 6} text-anchor="end">products</text>
        <circle class="now" cx={PX(xOfP)} cy={PY(E(xOfP, KEYS))} r="6" />
      </svg>
      <p class="why pad2">{prefs.sn === 'sn2' ? 'One step, one transition state, no intermediate.' : 'Two steps: the first has the higher activation energy, so it is the slow, rate-determining step. The carbocation is an intermediate (a dip, not a peak).'}</p>
    </section>
    <section class="panel" aria-label="Evidence">
      <div class="ph"><h2>The rate equation is the evidence</h2></div>
      <table class="rtab pad">
        <thead><tr><th></th><th>double [RBr]</th><th>double [OH⁻]</th></tr></thead>
        <tbody>
          <tr class:cur={prefs.sn === 'sn2'}><td class="lft">primary (SN2)</td><td>rate ×2</td><td>rate ×2</td></tr>
          <tr class:cur={prefs.sn === 'sn1'}><td class="lft">tertiary (SN1)</td><td>rate ×2</td><td>rate ×1</td></tr>
        </tbody>
      </table>
      <div class="work">
        <div class="eq">primary: rate = k[RBr][OH⁻] → both in the slow step → one step, SN2</div>
        <div class="eq">tertiary: rate = k[RBr] → only RBr in the slow step → OH⁻ joins later, SN1</div>
        <p class="why">S = substitution, N = nucleophilic; the number is how many species are in the rate-determining step (the molecularity).</p>
      </div>
    </section>
  </aside>

  <!-- ===== iodination of propanone ===== -->
  <section class="panel full" aria-label="Iodination of propanone">
    <div class="ph"><h2>The acid-catalysed iodination of propanone</h2></div>
    <div class="cols2">
      <div>
        <p class="eqline">CH₃COCH₃ + I₂ <span class="cat">H⁺</span>→ CH₃COCH₂I + HI</p>
        <table class="rtab">
          <thead><tr><th>run</th><th>[CH₃COCH₃] / M</th><th>[I₂] / M</th><th>[H⁺] / M</th><th>initial rate / mol dm⁻³ s⁻¹</th></tr></thead>
          <tbody>
            {#each IOD_RUNS as run, i (i)}<tr><td>{i + 1}</td><td>{run.P.toFixed(2)}</td><td>{run.I.toFixed(4)}</td><td>{run.H.toFixed(2)}</td><td>{sci(r[i], 3)}</td></tr>{/each}
          </tbody>
        </table>
      </div>
      <div class="work bare">
        <div class="eq">Runs 1 → 2: [propanone] ×2, rate ×{plain(r[1] / r[0], 2)} → first order in propanone</div>
        <div class="eq">Runs 1 → 3: [I₂] ×2, rate ×{plain(r[2] / r[0], 2)} → zero order in iodine</div>
        <div class="eq">Runs 1 → 4: [H⁺] ×2, rate ×{plain(r[3] / r[0], 2)} → first order in H⁺</div>
        <div class="eq">rate = k[CH₃COCH₃][H⁺] → k = {sci(r[0], 3)} ÷ (0.20 × 0.20) = {sci(IOD_K, 3)} dm³ mol⁻¹ s⁻¹</div>
        <p class="why">So the rate-determining step involves propanone and H⁺ (or species made from them) but not iodine: I₂ must react in a fast step after it. H⁺ appears in the rate equation but is regenerated: a catalyst.</p>
      </div>
    </div>
    <div class="steps">
      <div class="picker flat" role="group" aria-label="Mechanism step">
        {#each IOD_STEPS as s, i (i)}<button type="button" class="fchip" aria-pressed={prefs.step === i} onclick={() => (prefs.step = i)}>{i + 1}. {s.speed === 'slow' ? 'slow' : s.speed === 'fast ⇌' ? 'fast ⇌' : 'fast'}</button>{/each}
      </div>
      <div class="mechfig">
        <svg viewBox="0 0 600 200" role="img" aria-label="{iod.title}, drawn with curly arrows">
          <defs><marker id="kn-curl" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="ahd" /></marker></defs>
          {#each [iod.left, iod.right] as P, k (k)}
            {#each bonds(P) as d, j (j)}<path class="bd" d={d} />{/each}
            {#each P.atoms as a, j (j)}
              <text class="at" class:o={a.t === 'O'} class:io={a.t === 'I' || a.t.startsWith('ICH')} x={a.x} y={a.y + 5}>{a.t}</text>
              {#if a.q}<text class="chg" x={a.x + 11} y={a.y - 8}>{a.q}</text>{/if}
              {#if a.lp}<circle class="lp" cx={a.x + a.lp[0] - 3} cy={a.y + a.lp[1]} r="1.8" /><circle class="lp" cx={a.x + a.lp[0] + 3} cy={a.y + a.lp[1]} r="1.8" />{/if}
            {/each}
            {#each P.arrows as c, j (j)}<path class="curl" d="M{c.from[0]} {c.from[1]} Q{c.c[0]} {c.c[1]} {c.to[0]} {c.to[1]}" marker-end="url(#kn-curl)" />{/each}
            {#each P.extra as e, j (j)}<text class="ex {e.cls ?? ''}" x={e.x} y={e.y}>{e.t}</text>{/each}
          {/each}
          <path class="rx" d={iod.speed === 'fast ⇌' ? 'M268 98 H330 M268 106 H330' : 'M268 102 H330'} marker-end="url(#kn-curl)" />
          <text class="spd" class:slow={iod.speed === 'slow'} x="299" y="88">{iod.speed === 'slow' ? 'slow (RDS)' : iod.speed}</text>
        </svg>
      </div>
      <div class="stepsay">
        <h4>{iod.title}</h4>
        <p>{iod.say}</p>
        <div class="row">
          <button class="btn" type="button" disabled={prefs.step === 0} onclick={() => (prefs.step = prefs.step - 1)}>Back</button>
          <button class="btn primary" type="button" disabled={prefs.step === 3} onclick={() => (prefs.step = prefs.step + 1)}>Next step</button>
        </div>
      </div>
    </div>
  </section>

  <!-- ===== the exercise ===== -->
  <section class="panel full" aria-label="Rate equations and slow steps">
    <div class="ph"><h2>Rate equation ⇄ slow step</h2></div>
    <div class="exhead">
      <div class="picker flat" role="group" aria-label="Reaction">
        {#each EXAMPLES as e (e.id)}<button type="button" class="fchip" aria-pressed={prefs.ex === e.id} onclick={() => (prefs.ex = e.id)}>{e.name}</button>{/each}
      </div>
      <Seg label="Direction" options={[['pick', 'Rate equation → mechanism', 'Pick'], ['write', 'Mechanism → rate equation', 'Write']]} bind:value={prefs.exMode} />
    </div>
    <div class="cols2">
      <div>
        <p class="eqline">{ex.overall}</p>
        {#if prefs.exMode === 'pick'}
          <p class="given">Experiment: <b>{ex.rate}</b>. Which mechanism fits?</p>
          <div class="mechs">
            {#each order as i (i)}
              {@const m = ex.mechs[i]}
              <button type="button" class="mopt" class:right={picked !== null && m.ok} class:wrong={picked === i && !m.ok} disabled={picked !== null} onclick={() => (picked = i)}>
                {#each m.steps as [s, sp], j (j)}<span class="st"><span>{s}</span><em class:slow={sp === 'slow'}>{sp}</em></span>{/each}
              </button>
            {/each}
          </div>
        {:else}
          <p class="given">Mechanism (from other evidence):</p>
          <div class="mechs">
            <div class="mopt static">{#each ex.mechs[0].steps as [s, sp], j (j)}<span class="st"><span>{s}</span><em class:slow={sp === 'slow'}>{sp}</em></span>{/each}</div>
          </div>
          <p class="given">Write the rate equation: the order with respect to each reactant.</p>
          <div class="ords">
            {#each ex.species as sp, i (sp)}
              <div class="ord" class:okk={checked && guess[i] === ex.orders[i]} class:bad={checked && guess[i] !== ex.orders[i]}>
                <span class="sp">[{sp}]</span>
                {#each [0, 1, 2] as n (n)}<button type="button" class="fchip" aria-pressed={guess[i] === n} onclick={() => { guess[i] = n; checked = false; }}>{n}</button>{/each}
              </div>
            {/each}
          </div>
          <div class="row"><button class="btn primary" type="button" disabled={!allSet} onclick={() => (checked = true)}>Check</button>
            {#if allSet}<span class="mono">{rateText(ex.species, guess)}</span>{/if}</div>
        {/if}
      </div>
      <div>
        {#if prefs.exMode === 'pick' && picked !== null}
          {@const m = ex.mechs[picked]}
          <p class="verdict {m.ok ? 'ok' : 'no'}">{m.ok ? 'Yes: this fits.' : 'No.'} It predicts <b>{m.predicts}</b>.</p>
          <p class="why">{m.why}</p>
          {#if !m.ok}<p class="why">The accepted mechanism: {ex.mechs[0].steps.map((s) => `${s[0]} (${s[1]})`).join('; ')}. {ex.mechs[0].why}</p>{/if}
          <button class="btn" type="button" onclick={() => (picked = null)}>Try again</button>
        {:else if prefs.exMode === 'write' && checked}
          <p class="verdict {allRight ? 'ok' : 'no'}">{allRight ? 'Correct.' : 'Not quite.'} The experimental rate equation is <b>{ex.rate}</b>.</p>
          <p class="why">{ex.mechs[0].why}</p>
        {:else}
          <div class="facts"><b>How to link them</b><ul>
            <li>The rate equation contains the species in the slow (rate-determining) step, each to the power of how many of it take part.</li>
            <li>A species made in an earlier fast step counts as the reactants that made it.</li>
            <li>A reactant that only appears after the slow step is zero order: it is not in the rate equation.</li>
            <li>A catalyst can be in the rate equation; it is used and regenerated.</li>
            <li>The steps must add up to the overall equation; intermediates cancel.</li>
          </ul></div>
        {/if}
        <p class="why note">{ex.note}</p>
      </div>
    </div>
  </section>

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      <h3>Rate equations and mechanisms <small>spec 11.6–11.9</small></h3>
      <div class="cols2 bare">
        <p>Most reactions happen in a series of simple steps: the mechanism. The slowest step, the <b>rate-determining step</b>, limits the overall rate, just as the narrowest point limits the flow through a pipe. The rate equation can only be found by experiment, never from the balanced equation; but once found, it tells you which particles take part in the slow step, so it is evidence for or against a proposed mechanism. A mechanism can be shown to be wrong, but never proved right: it is the simplest one that fits all the evidence.</p>
        <div class="facts"><b>Key facts</b><ul>
          <li>Orders come from experiment; they need not match the coefficients in the balanced equation.</li>
          <li>Primary halogenoalkanes hydrolyse by SN2: rate = k[RX][OH⁻]. Tertiary by SN1: rate = k[RX].</li>
          <li>SN1 goes through a planar carbocation intermediate; SN2 through a single transition state with inversion.</li>
          <li>Iodination of propanone: rate = k[CH₃COCH₃][H⁺], zero order in I₂: iodine reacts after the slow step.</li>
          <li>Steps with three or more particles colliding at once are very unlikely.</li>
        </ul></div>
      </div>
    </div>
  </section>
</main>
