<script lang="ts" module>
  export interface CandlePrefs { kind: 'cepheid' | 'sn'; seed: number; solved: number }
</script>

<script lang="ts">
  /* Standard candles: an object whose luminosity we know. Measure the intensity we receive, and the inverse-square
     law gives the distance: I = L / 4πd², so d = √(L / 4πI).
     A Cepheid's luminosity comes from its period (the period–luminosity law, calibrated with Cepheids close enough
     for parallax); a type Ia supernova always peaks at about the same luminosity. A mystery object is generated:
     read the light curve, find L, work out d, and check. */
  import Plot from '../circuit/Plot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import { cepheidL, SN_IA_L, LSUN, PC, MPC, sci, short, plain, parseNum, close, seeded, sup, STARS } from './data';

  let { prefs, hidden: off = false }: { prefs: CandlePrefs; hidden?: boolean } = $props();

  /* ---------- the mystery object ---------- */
  const obj = $derived.by(() => {
    const r = seeded(prefs.seed * 7919 + (prefs.kind === 'sn' ? 1 : 0));
    const cep = prefs.kind === 'cepheid';
    const P = cep ? Number((3 * (50 / 3) ** r()).toPrecision(2)) : 0;
    const L = cep ? cepheidL(P) : SN_IA_L;
    const d = cep ? 10 ** (3.3 + r() * 3.8) : 10 ** (7.2 + r() * 1.9);        // pc
    const I = (L * LSUN) / (4 * Math.PI * (d * PC) ** 2);
    const name = `Galaxy ${String.fromCharCode(65 + Math.floor(r() * 26))}-${10 + Math.floor(r() * 90)}`;
    return { cep, P, L, d, I, name };
  });

  /* the light curve, in units of 10^k W m⁻² so the axis reads cleanly */
  const k = $derived(Math.floor(Math.log10(obj.I)));
  const curve = $derived.by(() => {
    const pts: [number, number][] = [];
    if (obj.cep) {
      const span = obj.P * 3.2;
      for (let i = 0; i <= 400; i++) {
        const t = (i / 400) * span, ph = (t / obj.P + 0.6) % 1;
        // a fast rise and a slow fall: the classic Cepheid shape
        const f = ph < 0.18 ? Math.sin((ph / 0.18) * (Math.PI / 2)) : 1 - (ph - 0.18) / 0.82;
        pts.push([t, (obj.I * (0.7 + 0.6 * f)) / 10 ** k]);
      }
    } else {
      for (let i = 0; i <= 300; i++) {
        const t = (i / 300) * 100;
        const f = t < 18 ? (t / 18) ** 2 : Math.exp(-(t - 18) / 22);
        pts.push([t, (obj.I * f) / 10 ** k]);
      }
    }
    return pts;
  });
  const yTop = $derived(Math.max(...curve.map((p) => p[1])) * 1.12);

  /* ---------- answers ---------- */
  let pIn = $state(''), dIn = $state(''), unit = $state<'pc' | 'Mpc'>('Mpc');
  let shown = $state(false);
  const pVal = $derived(parseNum(pIn));
  const pOk = $derived(close(pVal, obj.P, 0.08));
  const dVal = $derived(parseNum(dIn) * (unit === 'Mpc' ? 1e6 : 1));
  let checked = $state<null | boolean>(null);
  function check() {
    checked = close(dVal, obj.d, 0.08);
    if (checked) prefs.solved++;
  }
  function next() { prefs.seed = Math.floor(Math.random() * 1e6); pIn = ''; dIn = ''; checked = null; shown = false; }
  $effect(() => { void prefs.kind; pIn = ''; dIn = ''; checked = null; shown = false; });
  $effect(() => { unit = obj.d > 1e5 ? 'Mpc' : 'pc'; });

  const Lw = $derived(obj.L * LSUN);
  const usedL = $derived(obj.cep ? cepheidL(pOk ? pVal : obj.P) : SN_IA_L);
  const fmtD = (pc: number) => (pc >= 1e5 ? `${short(pc / 1e6)} Mpc` : pc >= 1e3 ? `${short(pc / 1e3)} kpc` : `${short(pc)} pc`);

  /* ---------- period–luminosity chart ---------- */
  const PW = 300, PH = 220, pl = 44, pr = 10, pt = 10, pb = 34;
  const lpx = (P: number) => pl + (Math.log10(P) / 2) * (PW - pl - pr);                 // 1–100 days
  const lpy = (L: number) => PH - pb - ((Math.log10(L) - 2) / 3.5) * (PH - pt - pb);     // 10²–10^5.5 L☉
  const CEPS = STARS.filter((s) => s.cepheid);

  /* ---------- the distance ladder ---------- */
  const LAD: [string, number, number, string][] = [
    ['Radar', -6, -4.3, 'the Solar System'],
    ['Parallax', -4.3, 4, 'nearby stars (Gaia: to about 10 kpc)'],
    ['Cepheids', 2.5, 7.6, 'to about 40 Mpc'],
    ['Type Ia supernovae', 7, 10, 'across the universe'],
    ['Hubble’s law', 7.3, 10.2, 'from redshift, once H₀ is known'],
  ];
  const LX = (e: number) => 8 + ((e + 6) / 16.5) * 504;
</script>

<div class="dgrid candles" hidden={off}>
  <section class="panel stage" aria-label="Mystery object">
    <div class="stage-head">
      <div class="label-chip"><small>{obj.name}</small><span>{obj.cep ? 'A Cepheid variable star' : 'A type Ia supernova'}</span></div>
      <div class="stage-tools">
        <Seg label="Candle" options={[['cepheid', 'Cepheid'], ['sn', 'Type Ia supernova', 'Ia SN']]} bind:value={prefs.kind} />
        <button class="btn" type="button" onclick={next}>New object</button>
      </div>
    </div>
    <div class="plotbox">
      <Plot xr={[0, obj.cep ? obj.P * 3.2 : 100]} yr={[0, yTop]} xLabel="t / days" yLabel="I / 10{sup(k)} W m⁻²" probe h={280}
        series={[{ color: 'var(--ch1)', pts: curve, name: obj.name }]} label="Light curve of the object" />
    </div>
    <p class="board-note">{obj.cep ? 'Hover or drag on the graph to read times. The period is the time between one peak and the next.' : 'A type Ia supernova rises to its peak in about three weeks, then fades. Read the peak intensity.'}</p>

    <div class="steps">
      {#if obj.cep}
        <div class="stepq">
          <b>1</b>
          <label>Period <input class="num wide" inputmode="decimal" bind:value={pIn} placeholder="days" aria-label="Period in days" /> days</label>
          {#if pIn}<span class="tag {pOk ? 'ok' : 'no'}">{pOk ? 'Yes' : 'Look again'}</span>{/if}
        </div>
        <div class="stepq"><b>2</b><span>Read L from the period–luminosity graph{pOk ? `: ${sci(cepheidL(pVal))} L☉` : ''}.</span></div>
        <div class="stepq"><b>3</b><span>Mean intensity received: <span class="m">I = {sci(obj.I)} W m⁻²</span></span></div>
      {:else}
        <div class="stepq"><b>1</b><span>Peak luminosity of every type Ia: <span class="m">L ≈ {sci(SN_IA_L)} L☉ = {sci(SN_IA_L * LSUN)} W</span></span></div>
        <div class="stepq"><b>2</b><span>Peak intensity received: <span class="m">I = {sci(obj.I)} W m⁻²</span></span></div>
      {/if}
      <div class="stepq">
        <b>{obj.cep ? 4 : 3}</b>
        <label>Distance <input class="num wide" inputmode="decimal" bind:value={dIn} placeholder="e.g. 2.5e6" aria-label="Distance" /></label>
        <Seg label="Unit" options={[['pc', 'pc'], ['Mpc', 'Mpc']]} bind:value={unit} />
        <button class="btn primary" type="button" disabled={!isFinite(dVal)} onclick={check}>Check</button>
        <button class="btn" type="button" onclick={() => (shown = !shown)}>{shown ? 'Hide working' : 'Show working'}</button>
      </div>
      {#if checked !== null}
        <p class="verdict {checked ? 'ok' : 'no'}">{checked ? `Correct: ${fmtD(obj.d)}.` : 'Not quite. Check your powers of ten and the square root, or show the working.'}</p>
      {/if}
      {#if shown || checked}
        <div class="work swap">
          {#if obj.cep}<div class="eq">P = {obj.P} days → L = {sci(cepheidL(obj.P))} L☉ = {sci(Lw)} W</div>{/if}
          <div class="eq">I = L ÷ 4πd²  ⇒  d = √(L ÷ 4πI)</div>
          <div class="eq">d = √({sci(Lw)} ÷ (4π × {sci(obj.I)})) = {sci(obj.d * PC)} m</div>
          <div class="eq">d = {sci(obj.d * PC)} ÷ {sci(PC)} = {sci(obj.d)} pc = {fmtD(obj.d)}</div>
        </div>
      {/if}
    </div>
  </section>

  <aside class="side">
    {#if obj.cep}
      <section class="panel" aria-label="Period–luminosity law">
        <div class="ph"><h2>Period–luminosity law</h2></div>
        <svg viewBox="0 0 {PW} {PH}" class="plsvg" role="img" aria-label="Luminosity against period for Cepheids, both on log scales">
          {#each [1, 3, 10, 30, 100] as P (P)}
            <path d="M{lpx(P)} {pt} V{PH - pb}" class="gl" /><text x={lpx(P)} y={PH - pb + 15} class="tk mid">{P}</text>
          {/each}
          {#each [2, 3, 4, 5] as e (e)}
            <path d="M{pl} {lpy(10 ** e)} H{PW - pr}" class="gl" /><text x={pl - 5} y={lpy(10 ** e) + 4} class="tk end">10{sup(e)}</text>
          {/each}
          <path d="M{lpx(1)} {lpy(cepheidL(1))} L{lpx(100)} {lpy(cepheidL(100))}" class="pline" />
          {#each CEPS as c (c.id)}
            <circle cx={lpx(c.cepheid!)} cy={lpy(cepheidL(c.cepheid!))} r="4" class="cal" />
            <text x={lpx(c.cepheid!) + 6} y={lpy(cepheidL(c.cepheid!)) + 14} class="tk">{c.name}</text>
          {/each}
          {#if pOk}
            <path d="M{lpx(pVal)} {PH - pb} V{lpy(cepheidL(pVal))} H{pl}" class="read" />
            <circle cx={lpx(pVal)} cy={lpy(cepheidL(pVal))} r="5" class="you" />
          {/if}
          <text x={(pl + PW - pr) / 2} y={PH - 4} class="tk mid">period / days</text>
          <text transform="translate(11 {(pt + PH - pb) / 2}) rotate(-90)" class="tk mid">L / L☉</text>
        </svg>
        <p class="why pad2">Brighter Cepheids pulse more slowly. The line is fixed using Cepheids near enough for parallax, such as Polaris and Delta Cephei, which is why each rung of the ladder rests on the one below.</p>
      </section>
    {:else}
      <section class="panel" aria-label="Why type Ia supernovae">
        <div class="ph"><h2>Why every type Ia is alike</h2></div>
        <p class="why pad2">A white dwarf in a binary pulls gas from its companion. When it reaches 1.4 M☉ (the Chandrasekhar limit) it blows itself apart. Every one explodes at the same mass, so every one peaks at about the same luminosity, around {sci(SN_IA_L)} L☉: bright enough to see across the universe.</p>
      </section>
    {/if}

    <section class="panel" aria-label="The distance ladder">
      <div class="ph"><h2>The distance ladder</h2></div>
      <svg viewBox="0 0 520 {LAD.length * 30 + 40}" class="ladder" role="img" aria-label="Ranges of the distance methods, on a log scale of distance">
        {#each [-4, -2, 0, 2, 4, 6, 8, 10] as e (e)}
          <path d="M{LX(e)} 4 V{LAD.length * 30 + 10}" class="gl" />
          <text x={LX(e)} y={LAD.length * 30 + 26} class="tk mid">10{sup(e)}</text>
        {/each}
        {#each LAD as [n, a, b, note], i (n)}
          <rect x={LX(a)} y={8 + i * 30} width={LX(b) - LX(a)} height="20" rx="10" class="rung r{i}" />
          <text x={LX(a) + 8} y={22 + i * 30} class="rl">{n}</text>
          <title>{n}: {note}</title>
        {/each}
        <path d="M{LX(Math.log10(obj.d))} 2 V{LAD.length * 30 + 12}" class="here" />
        <text x="512" y={LAD.length * 30 + 38} class="tk end">distance / pc (log scale)</text>
      </svg>
      <p class="why pad2">The orange line is {obj.name}, at {fmtD(obj.d)}. Each method’s range overlaps the next, so one calibrates the next.</p>
    </section>
  </aside>
</div>
