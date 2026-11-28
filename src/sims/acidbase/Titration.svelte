<script lang="ts" module>
  export interface TitrationPrefs {
    kind: TitrationKind;
    vol: number;       // 0..50 cm³
    ind: 'phenol' | 'methyl' | 'bromo';
  }
  export const TITRATION_PREFS: TitrationPrefs = { kind: 'wa_sb', vol: 12.5, ind: 'phenol' };
</script>

<script lang="ts">
  /* Titration Curves & Indicators: all 4 Edexcel combinations, half-neutralisation pKa & indicator bands (Spec 14.9–14.11). */
  import { TITRATIONS, INDICATORS, titrationPH, indicatorSuitable, type TitrationKind } from './titration';

  let { prefs, hidden: off = false, stats = $bindable([]) }: {
    prefs: TitrationPrefs; hidden?: boolean; stats?: [string, string | number][];
  } = $props();

  const meta = $derived(TITRATIONS[prefs.kind]);
  const ind = $derived(INDICATORS.find((i) => i.id === prefs.ind) ?? INDICATORS[0]);
  const suitable = $derived(indicatorSuitable(prefs.kind, ind));
  const curPH = $derived(titrationPH(prefs.kind, prefs.vol));

  $effect(() => {
    stats = [
      ['Volume', `${prefs.vol.toFixed(1)} cm³`],
      ['pH', curPH.toFixed(2)],
      [ind.name, suitable ? 'Suitable' : 'Not suitable'],
    ];
  });

  // SVG plot (viewBox 0 0 600 320, generous headroom)
  const X0 = 54, X1 = 572, Y0 = 276, Y1 = 34;
  const xV = (v: number) => X0 + (v / 50) * (X1 - X0);
  const yP = (p: number) => Y0 - (p / 14) * (Y0 - Y1);

  const curvePath = $derived((() => {
    const pts: string[] = [];
    // Sample extra densely around equivalence (24..26 cm³) so the vertical jump is razor-sharp!
    const vols: number[] = [];
    for (let v = 0; v <= 23.5; v += 0.5) vols.push(v);
    for (let v = 23.6; v <= 26.4; v += 0.08) vols.push(v);
    for (let v = 26.5; v <= 50; v += 0.5) vols.push(v);
    for (let i = 0; i < vols.length; i++) {
      const v = vols[i], p = Math.max(0, Math.min(14, titrationPH(prefs.kind, v)));
      pts.push(`${i ? 'L' : 'M'}${xV(v).toFixed(1)} ${yP(p).toFixed(1)}`);
    }
    return pts.join(' ');
  })());
</script>

<main class="layout ac-tit" hidden={off}>
  <section class="panel stage" aria-label="Titration curve">
    <div class="stage-head">
      <div class="label-chip">
        <small>Titration curve &amp; indicator choice</small>
        <span>{meta.name}</span>
      </div>
    </div>

    <div class="picker" role="group" aria-label="Choose titration type">
      {#each Object.values(TITRATIONS) as t (t.id)}
        <button type="button" class="chip" class:on={prefs.kind === t.id} onclick={() => (prefs.kind = t.id)}>{t.name}</button>
      {/each}
    </div>

    <div class="plotbox">
      <svg viewBox="0 0 600 320" class="ac-svg" role="img" aria-label="pH against volume of alkali added">
        {#each [2, 4, 6, 7, 8, 10, 12, 14] as p (p)}
          <line class="grid" x1={X0} x2={X1} y1={yP(p)} y2={yP(p)} />
          <text class="axlbl" x={X0 - 8} y={yP(p) + 4} text-anchor="end">{p}</text>
        {/each}
        {#each [0, 10, 20, 25, 30, 40, 50] as v (v)}
          <line class="grid" x1={xV(v)} x2={xV(v)} y1={Y1} y2={Y0} />
          <text class="axlbl" x={xV(v)} y={Y0 + 16} text-anchor="middle">{v}</text>
        {/each}

        <!-- Indicator colour-change pH band -->
        <rect x={X0} y={yP(ind.high)} width={X1 - X0} height={yP(ind.low) - yP(ind.high)}
          fill={ind.bandCss} fill-opacity="0.18" />
        <text class="axlbl" x={X1 - 6} y={yP((ind.low + ind.high) / 2) + 4} text-anchor="end">
          {ind.name} ({ind.low}–{ind.high})
        </text>

        <!-- Axes -->
        <line class="ax" x1={X0} x2={X1} y1={Y0} y2={Y0} />
        <line class="ax" x1={X0} x2={X0} y1={Y1 - 10} y2={Y0} />
        <text class="axlbl" x="12" y="16">pH</text>
        <text class="axlbl" x={X1} y="308" text-anchor="end">Volume of base added / cm³</text>

        <!-- Half-equivalence pH = pKa marker -->
        {#if meta.hasHalfEquiv && meta.pKa}
          <line x1={xV(12.5)} y1={Y0} x2={xV(12.5)} y2={yP(meta.pKa)} stroke="var(--amph)" stroke-width="1.5" stroke-dasharray="4 3" />
          <line x1={X0} y1={yP(meta.pKa)} x2={xV(12.5)} y2={yP(meta.pKa)} stroke="var(--amph)" stroke-width="1.5" stroke-dasharray="4 3" />
          <circle cx={xV(12.5)} cy={yP(meta.pKa)} r="5" fill="var(--amph)" />
          <text class="sym" x={xV(12.5) + 8} y={yP(meta.pKa) - 8}>Half-equiv: pH = pKa ({meta.pKa})</text>
        {/if}

        <!-- Equivalence point dot -->
        <circle cx={xV(25)} cy={yP(meta.eqPH)} r="5.5" fill="var(--redox)" />
        <text class="sym" x={xV(25) + 8} y={yP(meta.eqPH) + 4}>Equivalence (pH {meta.eqPH.toFixed(1)})</text>

        <!-- Titration curve -->
        <path d={curvePath} fill="none" stroke="var(--accent)" stroke-width="2.8" stroke-linejoin="round" />

        <!-- Live volume cursor -->
        <circle cx={xV(prefs.vol)} cy={yP(curPH)} r="6.5" fill="var(--solid)" stroke="var(--ink)" stroke-width="2.4" />
      </svg>
    </div>

    <div class="playbar">
      <label class="ctl scrub">
        <span class="ctl-l">Volume added <b>{prefs.vol.toFixed(1)} cm³</b> (pH {curPH.toFixed(2)})</span>
        <input class="slider" type="range" min="0" max="50" step="0.5" bind:value={prefs.vol} />
      </label>
      {#if meta.hasHalfEquiv}
        <button type="button" class="chip" onclick={() => (prefs.vol = 12.5)}>Half-equiv (12.5)</button>
      {/if}
      <button type="button" class="chip" onclick={() => (prefs.vol = 25.0)}>Equivalence (25.0)</button>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Indicator choice">
      <div class="ph"><h2>Indicator choice</h2></div>
      <div class="picker" role="group" aria-label="Choose an indicator">
        {#each INDICATORS as i (i.id)}
          <button type="button" class="chip" class:on={prefs.ind === i.id} onclick={() => (prefs.ind = i.id)}>{i.name}</button>
        {/each}
      </div>
      <dl class="reads pad">
        <div><dt>pH range</dt><dd>{ind.low} – {ind.high}</dd></div>
        <div><dt>Colour change</dt><dd class="txt">{ind.acidCol} → {ind.baseCol}</dd></div>
        <div class="wide">
          <dt>Verdict for {meta.name}</dt>
          <dd class="txt">{suitable ? 'Suitable — pH range lies completely inside the vertical section.' : 'NOT suitable — pH range misses the sharp vertical section (or there is no vertical section).'}</dd>
        </div>
      </dl>
    </section>

    <section class="panel" aria-label="Key facts">
      <div class="ph"><h2>Setup &amp; key facts</h2></div>
      <p class="note pad"><b>Flask:</b> {meta.analyte}<br /><b>Burette:</b> {meta.titrant}</p>
      <div class="facts pad">
        <b>Exam points</b>
        <ul>
          {#each meta.facts as f, i (i)}<li>{f}</li>{/each}
        </ul>
      </div>
    </section>
  </aside>
</main>
