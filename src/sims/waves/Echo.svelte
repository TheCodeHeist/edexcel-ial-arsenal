<script lang="ts" module>
  export interface EchoPrefs {
    sc: 'body' | 'sea';
    fBody: number; fSea: number;      // MHz, kHz
    gBody: number; gSea: number;      // gap between the two small reflectors: mm, m
    cyc: number;                      // pulse duration in cycles
    speed: '0.25' | '1' | '4';
  }
  export const ECHO: EchoPrefs = { sc: 'body', fBody: 3.5, fSea: 50, gBody: 2, gSea: 0.3, cyc: 3, speed: '1' };
</script>

<script lang="ts">
  /* Pulse–echo (spec 55, 56). A pulse goes down into layered material; every boundary sends part of it back. The
     A-scan (echo strength against time) draws itself as the echoes reach the transducer, in step with the 3D view.
     Two small reflectors close together show the limits: a long pulse (or a long wavelength) blurs them into one. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { EchoLook } from './echo3d';
  import { SCENARIOS, echoes, received, resolved, dB, layerAt, type Echo } from './echo';
  import { niceTicks } from './standing';
  import { plain, short } from './consts';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: EchoPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const sc = $derived(SCENARIOS.find((s) => s.id === prefs.sc) ?? SCENARIOS[0]);
  const body = $derived(sc.id === 'body');
  const fDisp = $derived(body ? prefs.fBody : prefs.fSea);
  const gDisp = $derived(body ? prefs.gBody : prefs.gSea);
  const f = $derived(fDisp * sc.fScale);
  const gap = $derived(gDisp * sc.gScale);
  const tau = $derived(prefs.cyc / f);
  const list = $derived<Echo[]>(echoes(sc, f, gap));
  const total = $derived(sc.layers[sc.layers.length - 1].bot);
  const tend = $derived(Math.max(...list.map((e) => e.t)) * 1.08);
  const pairLayer = $derived(layerAt(sc, sc.pair.depth));
  const lam = $derived(pairLayer.v / f);
  const plen = $derived(prefs.cyc * lam);
  const res = $derived(resolved(list, f, tau));
  const pairDt = $derived((2 * gap) / pairLayer.v);

  const fmtT = (t: number) => `${plain(t / sc.tScale, 3)} ${sc.tUnit}`;
  const fmtD = (d: number) => `${plain(d / sc.dScale, 3)} ${sc.dUnit}`;
  const fmtL = (x: number) => (x < 0.01 ? `${plain(x * 1000, 3)} mm` : x < 1 ? `${plain(x * 100, 3)} cm` : `${plain(x, 3)} m`);

  /* ---------- the clock: one pulse takes about 4 s on screen at ×1, then the next is sent ---------- */
  let ts = $state(0);
  let playing = $state(!RM);
  let raf = 0, last = 0, hold = 0;
  function step(t: number) {
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (playing) {
      if (ts >= tend) { hold += dt; if (hold > 0.9) { hold = 0; ts = 0; } }
      else ts = Math.min(tend, ts + (dt * tend * Number(prefs.speed)) / 4);
    }
    raf = off ? 0 : requestAnimationFrame(step);
  }
  function kick() { if (!raf && !off) { last = performance.now(); raf = requestAnimationFrame(step); } }
  $effect(() => { if (!off) kick(); });
  onDestroy(() => cancelAnimationFrame(raf));
  // a new set-up sends a fresh pulse
  let key = '';
  $effect(() => { const k = `${prefs.sc}|${f}|${gap}|${prefs.cyc}`; if (k !== key) { if (key.split('|')[0] !== prefs.sc) { c1 = NaN; c2 = NaN; } key = k; ts = 0; hold = 0; } });
  function send() { ts = 0; hold = 0; playing = true; }

  /* ---------- the A-scan: echo strength (dB) against time ---------- */
  const AW = 980, AH = 300, AL = 50, AR = 14, AT = 22, AB = 40, DBMIN = -90;
  const ax = (t: number) => AL + (t / tend) * (AW - AL - AR);
  const ay = (d: number) => AT + (Math.max(DBMIN, Math.min(0, d)) / DBMIN) * (AH - AT - AB);
  const scan = $derived.by(() => {
    const N = 1400;
    let p = '';
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * tend;
      const e = received(list, f, tau, t).E;
      const noise = 10 ** (-82 / 20) * (0.6 + 0.4 * Math.sin(i * 12.9898) * Math.sin(i * 0.731));
      p += `${i ? 'L' : 'M'}${ax(t).toFixed(1)} ${ay(dB(e + noise)).toFixed(1)}`;
    }
    return p;
  });
  const sweepX = $derived(ax(Math.min(ts, tend)));

  // two cursors to read times off the trace
  let c1 = $state(NaN), c2 = $state(NaN);
  let svgEl = $state<SVGSVGElement>();
  let dragging: 1 | 2 | 0 = 0;
  function tAt(e: PointerEvent) {
    const r = svgEl!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * AW;
    return Math.max(0, Math.min(tend, ((x - AL) / (AW - AL - AR)) * tend));
  }
  function down(e: PointerEvent) {
    const t = tAt(e);
    if (!Number.isFinite(c1)) { c1 = t; dragging = 1; }
    else if (!Number.isFinite(c2)) { c2 = t; dragging = 2; }
    else dragging = Math.abs(t - c1) < Math.abs(t - c2) ? 1 : 2;
    if (dragging === 1) c1 = t; else c2 = t;
    svgEl!.setPointerCapture(e.pointerId);
  }
  function move(e: PointerEvent) { if (dragging) { const t = tAt(e); if (dragging === 1) c1 = t; else c2 = t; } }
  function up() { dragging = 0; }
  /** snap a cursor to the nearest echo peak */
  function snap(which: 1 | 2) {
    const t = which === 1 ? c1 : c2;
    if (!Number.isFinite(t)) return;
    const near = list.reduce((a, e) => (Math.abs(e.t - t) < Math.abs(a.t - t) ? e : a), list[0]);
    if (which === 1) c1 = near.t; else c2 = near.t;
  }

  // the close-up round the pair: raw r.f. signal and its envelope
  const ZW = 640, ZH = 200, ZL = 50, ZR = 14, ZT = 12, ZB = 36;
  const pair = $derived(list.filter((e) => e.pair));
  const zw = $derived<[number, number]>([pair[0].t - 1.6 * tau, pair[1].t + 1.6 * tau]);
  const zAmp = $derived(Math.abs(pair[0].A) * 2.1);
  const zx = (t: number) => ZL + ((t - zw[0]) / (zw[1] - zw[0])) * (ZW - ZL - ZR);
  const zy = (v: number) => ZT + (ZH - ZT - ZB) / 2 - (v / zAmp) * ((ZH - ZT - ZB) / 2);
  const zoom = $derived.by(() => {
    const N = 900;
    let rf = '', en = '';
    for (let i = 0; i <= N; i++) {
      const t = zw[0] + (i / N) * (zw[1] - zw[0]);
      const r = received(pair, f, tau, t, false);
      rf += `${i ? 'L' : 'M'}${zx(t).toFixed(1)} ${zy(r.rf).toFixed(1)}`;
      en += `${i ? 'L' : 'M'}${zx(t).toFixed(1)} ${zy(r.E).toFixed(1)}`;
    }
    return { rf, en };
  });
  const zTicks = $derived(niceTicks(zw[0] / sc.tScale, zw[1] / sc.tScale, 5).filter((t) => t * sc.tScale >= zw[0] && t * sc.tScale <= zw[1]));

  const look = $derived<EchoLook>({ sc: prefs.sc, f, gap, cycles: prefs.cyc, ts });
  $effect(() => { stats = [['f', `${fDisp} ${sc.fUnit}`], ['λ', fmtL(lam)], ['The pair', res.ok ? 'resolved' : 'one blur']]; });

  const arrived = $derived(list.filter((e) => e.t <= ts).length);
  const maxPRF = $derived(1 / (2 * (Math.max(...list.map((e) => e.t)) / 2)));
</script>

<main class="layout wv-echo" hidden={off}>
  <section class="panel stage" aria-label="Pulse–echo">
    <div class="stage-head">
      <div class="label-chip"><small>Pulse–echo</small><span>{sc.name}</span></div>
      <div class="stage-tools">
        <Seg label="Scene" options={[['body', 'Ultrasound scan', 'Body'], ['sea', 'Sonar', 'Sonar']]} bind:value={prefs.sc} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./echo3d').then((m) => m.EchoScene)} {look}
          label="3D cut-away of the material under the transducer, with the pulse going down and echoes coming back. Drag to turn it.">
          <div class="hud tl"><b>t = {fmtT(Math.min(ts, tend))}</b><span>{arrived} of {list.length} echoes back</span></div>
          <div class="hud tr"><span class="k dn">▼ pulse going down</span><span class="k upk">▲ echoes coming back</span></div>
          <div class="hud bl">Depth to scale. Each band is as long as the pulse really is (at least a hairline).</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing ? (playing = false) : send())}>{playing ? 'Pause' : 'Send a pulse'}</button>
      <Seg label="Speed" options={[['0.25', 'Slow', 'Slow'], ['1', 'Normal', '×1'], ['4', 'Fast', '×4']]} bind:value={prefs.speed} />
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="The pulse">
      <div class="ph"><h2>The pulse</h2></div>
      <div class="ctls">
        {#if body}
          <label class="ctl"><span class="ctl-l">Frequency <b>{prefs.fBody} MHz</b></span>
            <input class="slider" type="range" min={sc.fMin} max={sc.fMax} step={sc.fStep} bind:value={prefs.fBody} /></label>
        {:else}
          <label class="ctl"><span class="ctl-l">Frequency <b>{prefs.fSea} kHz</b></span>
            <input class="slider" type="range" min={sc.fMin} max={sc.fMax} step={sc.fStep} bind:value={prefs.fSea} /></label>
        {/if}
        <label class="ctl"><span class="ctl-l">Pulse duration <b>{prefs.cyc} cycle{prefs.cyc > 1 ? 's' : ''} = {fmtT(tau)}</b></span>
          <input class="slider" type="range" min="1" max="20" step="1" bind:value={prefs.cyc} /></label>
        {#if body}
          <label class="ctl"><span class="ctl-l">Gap between the {sc.pair.name} <b>{plain(prefs.gBody, 2)} mm</b></span>
            <input class="slider" type="range" min={sc.gMin} max={sc.gMax} step={sc.gStep} bind:value={prefs.gBody} /></label>
        {:else}
          <label class="ctl"><span class="ctl-l">Gap between the {sc.pair.name} <b>{plain(prefs.gSea * 100, 3)} cm</b></span>
            <input class="slider" type="range" min={sc.gMin} max={sc.gMax} step={sc.gStep} bind:value={prefs.gSea} /></label>
        {/if}
      </div>
      <dl class="reads pad">
        <div><dt>Wavelength ({pairLayer.name})</dt><dd>{fmtL(lam)}</dd></div>
        <div><dt>Pulse length in space</dt><dd>{fmtL(plen)}</dd></div>
        <div><dt>Echoes of the pair arrive</dt><dd>{fmtT(pairDt)} apart</dd></div>
        <div><dt>The pair</dt><dd class:okc={res.ok} class:badc={!res.ok}>{res.ok ? 'two echoes' : 'one blurred echo'}</dd></div>
        <div class="wide"><dt>Deepest echo is back after</dt><dd>{fmtT(Math.max(...list.map((e) => e.t)))} <span class="beyond">so at most {short(maxPRF, 3)} pulses per second</span></dd></div>
      </dl>
    </section>
    <section class="panel" aria-label="Working">
      <div class="ph"><h2>Depth from an echo</h2></div>
      <div class="work">
        {#if Number.isFinite(c1)}
          <div class="eq">Cursor 1: t = {fmtT(c1)}</div>
          <div class="eq">d = vt/2 = {sc.vAssumed} × {short(c1, 3)} ÷ 2 = <b>{fmtD((sc.vAssumed * c1) / 2)}</b></div>
          {#if Number.isFinite(c2)}
            <div class="eq">Cursor 2: t = {fmtT(c2)} → d = {fmtD((sc.vAssumed * c2) / 2)}</div>
            <div class="eq">Between them: Δt = {fmtT(Math.abs(c2 - c1))}, Δd = vΔt/2 = {fmtD((sc.vAssumed * Math.abs(c2 - c1)) / 2)}</div>
          {/if}
        {:else}
          <div class="eq">Click the A-scan to put a cursor on an echo.</div>
        {/if}
        <p class="why">Halve it: the time is for the trip there and back. The machine assumes v = {sc.vAssumed} m s⁻¹ everywhere{body ? ' (an average for soft tissue), so depths beyond bone come out wrong.' : ' (sea water).'}</p>
      </div>
    </section>
  </aside>

  <section class="panel full" aria-label="A-scan">
    <div class="ph phwrap"><h2>A-scan: echo strength against time</h2>
      <div class="fine">
        <button class="btn sm" type="button" disabled={!Number.isFinite(c1)} onclick={() => snap(1)}>Snap 1 to peak</button>
        <button class="btn sm" type="button" disabled={!Number.isFinite(c2)} onclick={() => snap(2)}>Snap 2 to peak</button>
        <button class="btn sm" type="button" disabled={!Number.isFinite(c1)} onclick={() => { c1 = NaN; c2 = NaN; }}>Clear cursors</button>
      </div>
    </div>
    <div class="plotbox ascan-wrap">
      <svg class="plot ascan" viewBox="0 0 {AW} {AH}" bind:this={svgEl} role="img" aria-label="Echo strength in decibels against time; click to place cursors"
        onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}>
        <defs><clipPath id="sweepclip"><rect x="0" y="0" width={playing || ts < tend ? Math.max(0, sweepX) : AW} height={AH} /></clipPath></defs>
        {#each [0, -20, -40, -60, -80] as d (d)}<line class="gl" x1={AL} x2={AW - AR} y1={ay(d)} y2={ay(d)} /><text class="tk" x={AL - 6} y={ay(d)} text-anchor="end">{d}</text>{/each}
        {#each niceTicks(0, tend / sc.tScale, 7) as t (t)}<line class="gl" x1={ax(t * sc.tScale)} x2={ax(t * sc.tScale)} y1={AT} y2={AH - AB} /><text class="tk" x={ax(t * sc.tScale)} y={AH - AB + 14} text-anchor="middle">{t}</text>{/each}
        <line class="ax" x1={AL} x2={AW - AR} y1={AH - AB} y2={AH - AB} /><line class="ax" x1={AL} x2={AL} y1={AT} y2={AH - AB} />
        <path class="scan" d={scan} clip-path="url(#sweepclip)" />
        {#if ts < tend}<line class="sweep" x1={sweepX} x2={sweepX} y1={AT} y2={AH - AB} />{/if}
        {#each list as e (e.what)}
          {#if e.t <= ts || ts >= tend}<text class="elab" x={ax(e.t)} y={ay(dB(Math.abs(e.A))) - 8} text-anchor="middle">{e.pair ? (e.what.endsWith('first') ? 'pair' : '') : e.what.split(' → ')[1]}</text>{/if}
        {/each}
        {#each [[1, c1], [2, c2]] as [n, c] (n)}
          {#if Number.isFinite(c)}<line class="cursor" x1={ax(c)} x2={ax(c)} y1={AT} y2={AH - AB} /><text class="cl" x={ax(c) + 4} y={AT + 10}>{n}</text>{/if}
        {/each}
        <text class="al" x={AW - AR} y={AH - 6} text-anchor="end">t / {sc.tUnit}</text>
        <text class="al" x={12} y={AT} transform="rotate(-90 12 {AT})" text-anchor="end">echo / dB</text>
        <text class="tk" x={AL + 6} y={ay(-4)}>sent</text>
      </svg>
    </div>
    <p class="why pad2">The first spike is the pulse being sent. Then one echo per boundary: its time gives the depth; its size shows how different the two materials are{body ? ' (the bone echo is big: most of the pulse is reflected there)' : ' (the seabed sends back the strongest echo)'}. The axis is in decibels (each 20 dB is ten times smaller in amplitude): deep echoes are weak because the wave is absorbed on the way.</p>
  </section>

  <section class="panel full" aria-label="Close-up of the pair">
    <div class="cols2">
      <div>
        <h3 class="gh">Close-up: the {sc.pair.name}, {fmtL(gap)} apart</h3>
        <svg class="plot" viewBox="0 0 {ZW} {ZH}" role="img" aria-label="The received signal around the two close echoes, with its envelope">
          <line class="ax" x1={ZL} x2={ZW - ZR} y1={zy(0)} y2={zy(0)} />
          {#each zTicks as t (t)}<line class="gl" x1={zx(t * sc.tScale)} x2={zx(t * sc.tScale)} y1={ZT} y2={ZH - ZB} /><text class="tk" x={zx(t * sc.tScale)} y={ZH - ZB + 14} text-anchor="middle">{short(t, 4)}</text>{/each}
          <path class="rf" d={zoom.rf} />
          <path class="envl" d={zoom.en} />
          {#each pair as e (e.what)}<line class="pmark" x1={zx(e.t)} x2={zx(e.t)} y1={ZT} y2={ZH - ZB} />{/each}
          <text class="al" x={ZW - ZR} y={ZH - 4} text-anchor="end">t / {sc.tUnit}</text>
          <text class="verd" class:okc={res.ok} class:badc={!res.ok} x={ZL + 8} y={ZT + 14}>{res.ok ? 'Two separate echoes: resolved' : 'The echoes overlap: seen as one'}</text>
        </svg>
        <p class="why">Grey: the signal the transducer receives. Line: its envelope, which is what a scanner displays. Dashed: when each echo arrives. The echoes are {fmtT(pairDt)} apart; each lasts about {fmtT(tau)}.</p>
      </div>
      <div class="facts">
        <b>What limits the detail</b>
        <ul>
          <li><b>Pulse duration.</b> Two reflectors give separate echoes only if the echoes don’t overlap: the gap must be more than about half the pulse length (the echo from the far one travels 2 × gap further). Here: pulse {fmtL(plen)}, gap {fmtL(gap)}, so {res.ok ? 'resolved' : 'blurred into one'}. Shorter pulses give finer detail.</li>
          <li><b>Wavelength.</b> Objects much smaller than λ hardly reflect a clear echo (the wave diffracts round them), and a pulse can’t be shorter than about one wavelength. Here λ = {fmtL(lam)}.</li>
          <li><b>The trade-off.</b> A higher frequency gives a shorter λ and shorter pulses, so finer detail, but it is absorbed more, so it can’t see as deep. Try {body ? '15 MHz: the bone echo nearly vanishes' : '200 kHz against 10 kHz'}.</li>
          <li><b>Waiting for echoes</b> <span class="beyond">beyond the spec</span>. The next pulse can’t be sent until the deepest echo is back, or the echoes would be mixed up: at most {short(maxPRF, 3)} pulses per second here.</li>
        </ul>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="Echoes and key facts">
    <div class="cols2">
      <div class="tscroll">
        <h3 class="gh">Every echo</h3>
        <table class="rtab">
          <thead><tr><th>boundary</th><th>t / {sc.tUnit}</th><th>vt/2 / {sc.dUnit}</th><th>true / {sc.dUnit}</th><th>dB</th></tr></thead>
          <tbody>
            {#each list as e (e.what)}
              <tr><td class="lft">{e.what}</td><td>{plain(e.t / sc.tScale, 3)}</td><td>{plain((sc.vAssumed * e.t) / 2 / sc.dScale, 3)}</td><td>{plain(e.depth / sc.dScale, 3)}</td><td>{plain(dB(Math.abs(e.A)), 2)}</td></tr>
            {/each}
          </tbody>
        </table>
        <p class="why">At every boundary part of the wave is reflected and part transmitted (spec 55); the bigger the change in material, the more is reflected. The fraction uses acoustic impedance Z = ρv: r = (Z₂ − Z₁)/(Z₂ + Z₁) <span class="beyond">beyond the spec</span>.</p>
      </div>
      <div class="facts">
        <b>Key facts</b>
        <ul>
          <li>Pulse–echo: send a short pulse, time the echo. Distance to the reflector d = vt/2, because the pulse goes there and back.</li>
          <li>Ultrasound (above 20 kHz, here 1–15 MHz) for scans; sonar for depth and fish; radar uses radio waves the same way.</li>
          <li>The transducer sends, then listens: a pulse, not a continuous wave, so each echo can be timed.</li>
          <li>Detail is limited by the pulse duration and the wavelength. Higher frequency: finer detail, less depth.</li>
          <li>Ultrasound needs gel between probe and skin: almost all of it would reflect at an air gap.</li>
        </ul>
      </div>
    </div>
  </section>
</main>
