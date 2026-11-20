<script lang="ts" module>
  export interface LifePrefs { M: number; x: number; speed: number; spin: boolean }
</script>

<script lang="ts">
  /* Life: pick a starting mass, then play or scrub its life from nebula to remnant. The 3D view shows the stage; the
     timeline is split into stages (not to scale, or the main sequence would swallow everything; the strip under it
     IS to scale); the side shows the numbers, the path on the HR diagram and what is going on. */
  import { onDestroy } from 'svelte';
  import Space from './Space.svelte';
  import HRPlot from './HRPlot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import { track, at, bounds, hrPath, PRESETS, massAt, posOf, FATE_NAME, FATE_END, type Visual } from './evolve';
  import { bbCss, sci, plain, short, years, LSUN, RSUN, peak, STARS, lumOf, spectral, TSUN } from './data';
  import type { Look } from './cosmos';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false }: { prefs: LifePrefs; hidden?: boolean } = $props();

  const tr = $derived(track(prefs.M));
  const now = $derived(at(tr, prefs.x));
  const bnds = $derived(bounds(tr));
  const runs = $derived(hrPath(tr));
  // the biggest it ever gets as a giant or supergiant: where an expanding shell starts
  const giantR = $derived(Math.max(0, ...tr.stages.flatMap((s, i) => s.visual !== 'giant' ? [] :
    [0.3, 0.6, 0.85, 0.999].map((u) => at(tr, bnds[i][0] + (bnds[i][1] - bnds[i][0]) * u).R))));
  const look = $derived<Look>({ visual: now.stage.visual, u: now.u, T: now.T, R: now.R, M: prefs.M, fate: tr.fate, giantR });

  /* ---------- playing ---------- */
  let playing = $state(false);
  let raf = 0, last = 0;
  const SECONDS = 70; // the whole bar at ×1
  function step(t: number) {
    const dt = Math.min(0.05, (t - last) / 1000);
    last = t;
    prefs.x = Math.min(1, prefs.x + (dt * prefs.speed) / SECONDS);
    if (prefs.x >= 1) { playing = false; return; }
    raf = requestAnimationFrame(step);
  }
  function play() {
    if (playing) { playing = false; cancelAnimationFrame(raf); return; }
    if (prefs.x >= 0.999) prefs.x = 0;
    playing = true; last = performance.now(); raf = requestAnimationFrame(step);
  }
  function stop() { playing = false; cancelAnimationFrame(raf); }
  function jump(i: number) { stop(); prefs.x = bnds[i][0] + 0.0005; }
  $effect(() => { if (off) stop(); });
  onDestroy(stop);

  function setMass(M: number) { prefs.M = M; }

  /* every path, by starting mass: each chip is a stage id, so the current one lights up */
  const LANES: { range: string; M: number; chips: [string, string][] }[] = [
    { range: 'below 0.08 M☉', M: 0.05, chips: [['cloud', 'Nebula'], ['protostar', 'Protostar'], ['bdw', 'Brown dwarf']] },
    { range: '0.08–0.5 M☉', M: 0.2, chips: [['cloud', 'Nebula'], ['protostar', 'Protostar'], ['ms', 'Main sequence (red dwarf)'], ['wd', 'White dwarf']] },
    { range: '0.5–3 M☉', M: 1, chips: [['cloud', 'Nebula'], ['protostar', 'Protostar'], ['ms', 'Main sequence'], ['giant', 'Red giant'], ['pn', 'Planetary nebula'], ['wd', 'White dwarf'], ['bd', 'Black dwarf']] },
    { range: '3–8 M☉', M: 5, chips: [['cloud', 'Nebula'], ['protostar', 'Protostar'], ['ms', 'Main sequence'], ['giant', 'Red giant'], ['cep', 'Cepheid'], ['giant2', 'Red giant'], ['pn', 'Planetary nebula'], ['wd', 'White dwarf'], ['bd', 'Black dwarf']] },
    { range: '8–25 M☉', M: 15, chips: [['cloud', 'Nebula'], ['protostar', 'Protostar'], ['ms', 'Main sequence'], ['bsg', 'Blue supergiant'], ['cep', 'Cepheid*'], ['rg', 'Red giant'], ['rsg', 'Red supergiant'], ['sn', 'Supernova (type II)'], ['ns', 'Neutron star']] },
    { range: 'above 25 M☉', M: 40, chips: [['cloud', 'Nebula'], ['protostar', 'Protostar'], ['ms', 'Main sequence'], ['bsg', 'Blue supergiant'], ['rg', 'Red giant'], ['rsg', 'Red supergiant'], ['sn', 'Supernova (type II)'], ['bh', 'Black hole']] },
  ];
  const laneOf = (M: number) => (M < 0.08 ? 0 : M < 0.5 ? 1 : M < 3 ? 2 : M < 8 ? 3 : M < 25 ? 4 : 5);
  function goTo(lane: number, id: string) {
    stop();
    if (laneOf(prefs.M) !== lane) prefs.M = LANES[lane].M;
    const t = track(prefs.M), b = bounds(t), i = t.stages.findIndex((x) => x.id === id);
    if (i >= 0) prefs.x = b[i][0] + 0.0005;
  }

  /* ---------- what to show ---------- */
  const SEG: Record<Visual, string> = {
    cloud: '#8f63d2', protostar: bbCss(2600), star: '', giant: bbCss(3500), bluegiant: bbCss(14000), cepheid: '#f2c14e', browndwarf: '#8a4b3a', nebula: '#2fbfa8', whitedwarf: bbCss(16000),
    blackdwarf: '#3b3b44', supernova: '#ffb347', neutron: '#8fb5ff', blackhole: '#14141a',
  };
  const segColor = (v: Visual) => (v === 'star' ? bbCss(tr.stages[2].keys[0][1]) : SEG[v]);
  const hasT = $derived(isFinite(now.T) && now.stage.visual !== 'cloud');
  const lifeTotal = $derived(tr.stages.reduce((s, x) => s + x.dur, 0));
  // the to-scale strip: each stage's share of the star's lifetime (remnants and the far future left out)
  const lifeStages = $derived(tr.stages.filter((s) => !['whitedwarf', 'blackdwarf', 'neutron', 'blackhole'].includes(s.visual)));
  const MERCURY = 0.39, R_AU = 0.00465;
  function size(R: number, v: Visual): string {
    if (v === 'blackhole') return `an event horizon ${Math.round(2 * (tr.remnant.Rkm ?? 0))} km across`;
    if (v === 'neutron') return 'about 20 km across: the size of a city';
    if (v === 'cloud') return 'a clump a light-year or so across';
    if (v === 'browndwarf') return 'about the size of Jupiter';
    if (R < 0.02) return `about ${short(R / 0.00917, 2)} × the Earth’s radius`;
    const au = R * R_AU;
    if (au > 1.52) return `out past the orbit of Mars (${short(au, 2)} AU)`;
    if (au > 1) return `out past the Earth’s orbit (${short(au, 2)} AU)`;
    if (au > 0.72) return 'out past the orbit of Venus';
    if (au > MERCURY) return 'out past the orbit of Mercury';
    return `${short(R, 3)} × the Sun’s radius`;
  }
  const like = $derived.by(() => {
    if (!now.onHR) return null;
    let best = null as null | { name: string; d: number };
    for (const s of STARS) {
      const d = Math.hypot((Math.log10(s.T) - Math.log10(now.T)) * 6, Math.log10(lumOf(s)) - Math.log10(now.L));
      if (d < 0.7 && (!best || d < best.d)) best = { name: s.name, d };
    }
    return best?.name ?? null;
  });
  const massive = $derived(tr.fate === 'neutron' || tr.fate === 'blackhole');
  const onion = $derived(massive && ((now.stage.id === 'rsg' && now.u > 0.35) || (now.stage.id === 'sn' && now.u < 0.1)));
  /* a Cepheid's light curve: a fast rise and a slow fall, over three periods */
  const lightCurve = (P: number) => {
    const pts: string[] = [];
    for (let i = 0; i <= 150; i++) {
      const ph = ((i / 150) * 3 + 0.65) % 1;
      const f = ph < 0.18 ? Math.sin((ph / 0.18) * (Math.PI / 2)) : 1 - (ph - 0.18) / 0.82;
      pts.push(`${i === 0 ? 'M' : 'L'}${(14 + (i / 150) * 196).toFixed(1)} ${(78 - f * 56).toFixed(1)}`);
    }
    return pts.join('');
  };
  const ONION: [string, string][] = [['H', '#e87b6b'], ['He', '#e8a65b'], ['C', '#d8cf68'], ['O, Ne', '#7fc98a'], ['Si', '#6ab4d8'], ['Fe', '#8c8c9c']];
  const hrNote = $derived(now.stage.visual === 'supernova' && now.u > 0.05 ? 'Supernova: ~10⁹ L☉, off the top' : !now.onHR && now.stage.off ? `Off the diagram: ${now.stage.off}` : '');
  const ageLabel = $derived(now.stage.future ? `${years(now.age)} (in the far future)` : years(now.age));
</script>

<main class="layout life" hidden={off}>
  <section class="panel stage" aria-label="The star">
    <div class="stage-head">
      <div class="label-chip"><small>{FATE_NAME[tr.fate]} · {short(prefs.M, 2)} M☉</small><span>{now.stage.name}</span></div>
      <div class="stage-tools">
        <button type="button" class="fchip" aria-pressed={prefs.spin} onclick={() => (prefs.spin = !prefs.spin)}>Turn slowly</button>
      </div>
    </div>
    <div class="spacebox">
      <Space {look} spin={prefs.spin}>
        <div class="hud tl">
          <b>{now.stage.name}</b>
          <span>age {ageLabel}</span>
        </div>
        <div class="hud bl">Sizes not to scale · drag to turn{RM ? '' : ' · click, then scroll to zoom'}</div>
        {#if now.stage.future}<div class="hud tr future">No star has reached this yet</div>{/if}
      </Space>
    </div>

    <div class="timeline" role="group" aria-label="Stages">
      {#each tr.stages as s, i (s.id)}
        <button type="button" class="seg-s" class:on={now.i === i} class:past={now.i > i} style:flex-grow={s.weight} style:--sc={segColor(s.visual)}
          onclick={() => jump(i)} title={s.name}>
          <i></i><span>{s.name}</span>
        </button>
      {/each}
      <span class="head" style:left="{prefs.x * 100}%"></span>
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={play}>
        {#if playing}
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>Pause
        {:else}
          <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14l12-7z" /></svg>{prefs.x >= 0.999 ? 'Replay' : 'Play'}
        {/if}
      </button>
      <input class="slider scrub" type="range" min="0" max="1" step="0.0005" bind:value={prefs.x} oninput={stop} aria-label="Point in the star’s life" />
      <Seg label="Playback speed" options={[['0.5', '×½'], ['1', '×1'], ['3', '×3']]} value={String(prefs.speed)} onchange={(v) => (prefs.speed = +v)} />
    </div>
    <div class="truescale">
      <small>To scale: {years(tr.life)} from cloud to {massive ? 'explosion' : tr.fate === 'browndwarf' ? 'a cold brown dwarf' : 'white dwarf'}</small>
      <div class="ts-bar">
        {#each lifeStages as s (s.id)}
          <span style:flex-grow={Math.max(s.dur / tr.life, 0.0008)} style:--sc={segColor(s.visual)} title="{s.name}: {years(s.dur)}" class:on={now.stage.id === s.id}></span>
        {/each}
      </div>
      <small class="ts-note">{tr.msLife ? `Main sequence: ${Math.round((tr.msLife / tr.life) * 100)}% of its life.` : 'It never reaches the main sequence.'}{tr.stages.some((s) => s.visual === 'supernova') ? ' The supernova itself is over in months.' : ''}</small>
    </div>
  </section>

  <aside class="side">
    <section class="panel ctlpanel" aria-label="Starting mass">
      <div class="ph"><h2>Starting mass</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Mass <b>{short(prefs.M, 2)} M☉</b></span>
          <input class="slider" type="range" min="0" max="1" step="0.002" value={posOf(prefs.M)} oninput={(e) => setMass(massAt(+e.currentTarget.value))} /></label>
        <div class="presets" role="group" aria-label="Presets">
          {#each PRESETS as p (p.M)}
            <button type="button" class="fchip" aria-pressed={prefs.M === p.M} title={p.like} onclick={() => setMass(p.M)}>{p.label} M☉</button>
          {/each}
        </div>
        <p class="fate"><span class="fdot" style:background={segColor(tr.stages[tr.stages.length - 1].visual === 'blackdwarf' ? 'whitedwarf' : tr.stages[tr.stages.length - 1].visual)}></span>
          <span>Ends as a <b>{FATE_END[tr.fate]}</b></span><small>{tr.msLife ? `Main sequence lasts ${years(tr.msLife)}` : 'Too light ever to start hydrogen fusion'}</small></p>
      </div>
    </section>

    <section class="panel" aria-label="Readings">
      <div class="ph"><h2>Right now</h2></div>
      <dl class="reads pad">
        {#if hasT}
          <div><dt>Surface temperature</dt><dd>{sci(now.T)} K</dd></div>
          <div><dt>Luminosity</dt><dd>{sci(now.L)} L☉</dd></div>
          <div><dt>Radius</dt><dd>{sci(now.R)} R☉</dd></div>
          <div><dt>Peak wavelength</dt><dd>{now.T > 1e5 ? sci(peak(now.T) * 1e9) : plain(peak(now.T) * 1e9)} nm</dd></div>
          {#if now.stage.period}<div class="wide"><dt>Pulsation period</dt><dd>{plain(now.stage.period, 2)} days (shown sped up)</dd></div>{/if}
        {:else if now.stage.visual === 'cloud'}
          <div><dt>Temperature</dt><dd>{Math.round(now.T)} K</dd></div>
          <div><dt>Peak wavelength</dt><dd>{plain(peak(now.T) * 1e6)} µm</dd></div>
        {:else}
          <div><dt>Mass</dt><dd>{short(tr.remnant.M, 2)} M☉</dd></div>
          <div><dt>{now.stage.visual === 'blackhole' ? 'Event horizon radius' : 'Radius'}</dt><dd>{Math.round(tr.remnant.Rkm ?? 0)} km</dd></div>
        {/if}
        <div class="wide"><dt>Size</dt><dd class="txt">{size(now.R, now.stage.visual)}</dd></div>
        {#if hasT}
          <div class="wide"><dt>Colour</dt><dd class="txt"><i class="swatch" style:background={bbCss(now.T)}></i><span>{now.T > 9000 ? 'blue-white' : now.T > 7000 ? 'white' : now.T > 5500 ? 'yellow-white' : now.T > 4300 ? 'orange' : 'red'} · class {spectral(now.T)}{like ? ` · looks like ${like}` : ''}</span></dd></div>
        {/if}
      </dl>
      {#if hasT}
        <p class="why pad2">L = {sci(now.L * LSUN)} W from L = σ4πr²T⁴ with r = {sci(now.R * RSUN)} m. Peak from λ<sub>max</sub>T = 2.898 × 10⁻³ m K.</p>
      {/if}
    </section>

    <section class="panel" aria-label="HR diagram">
      <div class="ph"><h2>Its path on the HR diagram</h2></div>
      <div class="hrbox">
        <HRPlot compact h={300} tr={[200000, 2000]} lr={[1e-5, 1e7]} radii={false} labels label="This star's path on the HR diagram"
          tracks={[...runs.map((pts) => ({ pts, color: 'var(--accent)', width: 2.2 }))]}
          stars={[{ id: 'sun', T: TSUN, L: 1, R: 1, label: 'Sun' }]}
          now={now.onHR ? { T: now.T, L: now.L, color: bbCss(now.T) } : null} nowNote={hrNote} />
      </div>
    </section>
  </aside>

  <section class="panel paths" aria-label="Every path">
    <div class="ph"><h2>Every path, by starting mass</h2></div>
    <div class="lanes">
      {#each LANES as ln, li (ln.range)}
        <div class="lane" class:on={laneOf(prefs.M) === li}>
          <button type="button" class="lrange" onclick={() => setMass(ln.M)}>{ln.range}</button>
          <div class="lchips">
            {#each ln.chips as [id, name], ci (ci)}
              {#if ci}<span class="arr" aria-hidden="true">→</span>{/if}
              <button type="button" class="lchip" class:now={laneOf(prefs.M) === li && now.stage.id === id} onclick={() => goTo(li, id)}>{name}</button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
    <p class="why pad2">* Stars of about 8–20 M☉ pulsate as Cepheids while crossing the instability strip. A core left below 1.4 M☉ becomes a white dwarf, 1.4–3 M☉ a neutron star, above 3 M☉ a black hole. Click any stage to jump there.</p>
  </section>

  <section class="panel explain" aria-label="What is happening">
    {#key now.stage.id + tr.fate}
      <div class="ex-body swap">
        <div class="ex-text">
          <h3>{now.stage.name}<small>lasts {now.stage.visual === 'blackhole' || now.stage.visual === 'blackdwarf' ? 'indefinitely' : years(now.stage.dur)}</small></h3>
          <p>{now.stage.what}</p>
          <p class="why">{now.stage.why}</p>
          {#if now.stage.facts.length}
            <div class="facts">
              <b>Key facts</b>
              <ul>{#each now.stage.facts as f (f)}<li>{f}</li>{/each}</ul>
            </div>
          {/if}
        </div>
        {#if now.stage.period}
          {@const P = now.stage.period}
          <figure class="lcurve">
            <svg viewBox="0 0 220 112" aria-label="Light curve of the Cepheid: luminosity rising quickly and falling slowly, repeating every {plain(P, 2)} days">
              <path d="M14 8 V82 H212" class="lc-ax" />
              <path d={lightCurve(P)} class="lc-line" />
              {#each [0, 1, 2, 3] as k (k)}<path d="M{14 + (k * 196) / 3} 82 v4" class="lc-ax" /><text x={14 + (k * 196) / 3} y="97" class="lc-t">{Math.round(k * P)}</text>{/each}
              <text x="212" y="110" class="lc-t end">t / days</text>
              <text x="18" y="14" class="lc-t start">L</text>
            </svg>
            <figcaption>Brightness against time: a quick rise, a slow fall, repeating every {plain(P, 2)} days.</figcaption>
          </figure>
        {/if}
        {#if onion}
          <figure class="onion">
            <svg viewBox="-70 -70 140 140" aria-label="The layers of a supergiant’s core: hydrogen outside, then helium, carbon, oxygen and neon, silicon, and iron at the centre">
              {#each ONION as [el, c], k (el)}
                <circle r={62 - k * 10.5} fill={c} stroke="var(--solid)" stroke-width="1.5" />
              {/each}
              {#each ONION as [el], k (el)}
                <text x="0" y={-62 + k * 10.5 + 8} class="ol">{el}</text>
              {/each}
            </svg>
            <figcaption>Shells of fusion, heaviest at the centre. Nothing fuses beyond iron.</figcaption>
          </figure>
        {/if}
      </div>
    {/key}
  </section>
</main>
