<script lang="ts" module>
  export interface DetPrefs {
    det: 'cloud' | 'bubble' | 'collider';
    srcs: string[]; together: boolean; cosmic: boolean; radon: boolean; info: string;
    field: boolean; ev: number; neutral: boolean; speed: number;
    bmode: 'classic' | 'collide';
    beam: string; pb: number; target: 'p' | 'd' | 'beam'; beam2: string; pb2: number; chan: string; heavy: boolean;
  }
  export const DET: DetPrefs = {
    det: 'bubble', srcs: ['am241'], together: false, cosmic: true, radon: true, info: 'am241',
    field: false, ev: 0, neutral: false, speed: 1,
    bmode: 'collide', beam: 'anti-pi+', pb: 2000, target: 'p', beam2: 'p', pb2: 2000, chan: 'auto', heavy: false,
  };
</script>

<script lang="ts">
  /* Detectors: a cloud chamber (any mix of real sources), a bubble chamber (classic events, and a collision lab where
     any particle can be fired at a proton, a deuteron or a second beam) and, beyond the spec, a collider detector.
     Every track is computed from r = p/BQ and the energy the particle loses by ionising the medium (detect.ts), so
     clicking a track and measuring its radius gives back the particle's real momentum. */
  import View3D from './View3D.svelte';
  import Sym from './Sym.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { DetectScene, DLook, Picked } from './detect3d';
  import type { Stage3D } from './gl';
  import { bubbleEvents, CSOURCES, csource, alphaRange, CLOUD_B, BUBBLE_B, COLLIDER_B, LAYERS, SHOTS, type Shot } from './detect';
  import { collide, channels, sqrtS, BEAMS, HEAVY, HYDROGEN, type Result } from './collide';
  import { get, sci, thirds, signed, E, C, MEV } from './data';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: DetPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  const EVENTS = bubbleEvents();
  const ev = $derived(EVENTS[Math.max(0, Math.min(EVENTS.length - 1, prefs.ev))]);

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  let playing = $state(!RM);
  let run = $state(0);
  let fire = $state(SHOTS.map((s) => ({ id: s.id as Shot, n: 0 })));
  let scene: DetectScene | null = null;
  let picked = $state<Picked | null>(null);

  // older saved settings may lack the newer fields
  $effect.pre(() => { if (!Array.isArray(prefs.srcs)) prefs.srcs = ['am241']; if (!prefs.bmode) prefs.bmode = 'collide'; });

  /* ---------- the collision lab ---------- */
  let result = $state<Result | null>(null);
  let ckey = $state(0);
  let history = $state<{ label: string; seed: number; set: Omit<DetPrefs, 'det'> }[]>([]);
  const headOn = $derived(prefs.target === 'beam');
  const struck = $derived(prefs.target === 'beam' ? prefs.beam2 : 'p');
  const W = $derived(sqrtS(prefs.beam, prefs.pb, struck, prefs.pb2, headOn));
  const chans = $derived(channels(prefs.beam, struck, W, !headOn));
  function fireCollision(seed = Math.floor(Math.random() * 1e9)) {
    const r = collide({ beam: prefs.beam, pb: prefs.pb, target: prefs.target, beam2: prefs.beam2, pb2: prefs.pb2, chan: prefs.chan, heavy: prefs.heavy, seed });
    result = r;
    ckey++;
    picked = null;
    scene?.showCollision(r.ev, ckey);
    playing = true;
    const label = r.channel ? r.channel.label : `${get(prefs.beam).sym.b}: nothing`;
    history = [{ label, seed, set: { ...$state.snapshot(prefs) } }, ...history].slice(0, 6);
  }
  function replayHistory(h: (typeof history)[number]) {
    Object.assign(prefs, h.set);
    const r = collide({ beam: h.set.beam, pb: h.set.pb, target: h.set.target, beam2: h.set.beam2, pb2: h.set.pb2, chan: h.set.chan, heavy: h.set.heavy, seed: h.seed });
    result = r; ckey++; picked = null; scene?.showCollision(r.ev, ckey); playing = true;
  }
  const PMIN = Math.log10(30), PMAX = Math.log10(30000);
  const pText = (p: number, id: string) => (id === 'gamma' ? (p >= 1000 ? `${(p / 1000).toPrecision(3)} GeV` : `${p.toPrecision(3)} MeV`) : p >= 1000 ? `${(p / 1000).toPrecision(3)} GeV/c` : `${p.toPrecision(3)} MeV/c`);
  const gev = (m: number) => (m >= 1000 ? `${(m / 1000).toPrecision(3)} GeV` : `${m.toPrecision(3)} MeV`);
  const firstFire = $derived(prefs.det === 'bubble' && prefs.bmode === 'collide' && !result);
  $effect(() => { if (firstFire && seen && !off) fireCollision(12345); });

  const look = $derived<DLook>({
    det: prefs.det, srcs: prefs.srcs, together: prefs.together, cosmic: prefs.cosmic, radon: prefs.radon,
    field: prefs.field, ev: prefs.ev, playing, run, speed: prefs.speed, neutral: prefs.neutral, fire, bmode: prefs.bmode, ckey,
  });

  function onscene(s: Stage3D<DLook> | null) {
    scene = s as DetectScene | null;
    if (scene && result) scene.showCollision(result.ev, ckey);
  }
  function choose(d: DetPrefs['det']) { if (prefs.det !== d) { prefs.det = d; picked = null; } }
  function chooseEv(i: number) { prefs.ev = i; picked = null; run++; playing = true; }
  function replay() { picked = null; scene?.clearPick(); run++; playing = true; }
  function clear() { picked = null; if (prefs.det === 'cloud') scene?.clearCloud(); else scene?.clearShots(); }
  function shoot(id: Shot) { const f = fire.find((x) => x.id === id); if (f) f.n++; playing = true; }
  function shootAll() { for (const f of fire) f.n++; playing = true; }
  function toggleSrc(id: string) {
    prefs.srcs = prefs.srcs.includes(id) ? prefs.srcs.filter((x) => x !== id) : [...prefs.srcs, id];
    prefs.info = id;
  }
  const MIXES: [string, string[]][] = [['α + β + γ', ['am241', 'sr90', 'co60']], ['β⁻ vs β⁺', ['sr90', 'na22']], ['All the chains', ['ra226', 'th232', 'u238']], ['Background only', []]];

  /* a click (not a drag) picks the nearest track */
  let down: [number, number] | null = null;
  function pdown(e: PointerEvent) { down = [e.clientX, e.clientY]; }
  function pup(e: PointerEvent) {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) { down = null; return; }
    down = null;
    if (!(e.target instanceof HTMLCanvasElement)) return;
    picked = scene?.pick(e.clientX, e.clientY) ?? null;
  }

  const fired = $derived(fire.reduce((a, f) => a + f.n, 0));
  $effect(() => {
    stats = prefs.det === 'cloud' ? [['Sources', prefs.srcs.length ? prefs.srcs.map((id) => csource(id).label).join(' + ') : 'background'], ['Field', prefs.field ? `${CLOUD_B} T` : 'off']]
      : prefs.det === 'bubble' ? (prefs.bmode === 'collide' ? [['√s', gev(W)], ['B', `${BUBBLE_B} T`]] : [['Event', `${prefs.ev + 1}/${EVENTS.length}`], ['B', `${BUBBLE_B} T`]])
      : [['Fired', fired], ['B', `${COLLIDER_B} T`]];
  });

  /* ---------- the picked track ---------- */
  const tr = $derived(picked?.track ?? null);
  const pt = $derived(picked && tr ? tr.pts[Math.min(picked.k, tr.pts.length - 1)] : null);
  const part = $derived(tr && tr.pid !== 'alpha' ? get(tr.pid) : null);
  const curved = $derived(!!tr && tr.B > 0 && !!pt && isFinite(pt.r));
  const rM = $derived(pt ? pt.r / 100 : 0);
  const Q = $derived(tr ? Math.abs(tr.q) * E : E);
  const pSI = $derived(tr ? tr.B * Q * rM : 0);
  const pMeV = $derived((pSI * C) / MEV);
  const rText = (cm: number) => (cm >= 100 ? `${(cm / 100).toPrecision(3)} m` : `${cm.toPrecision(3)} cm`);
  const signText = $derived(!tr ? '' : tr.q > 0 ? `+${tr.q === 1 ? '' : tr.q}e (positive)` : tr.q < 0 ? `−${tr.q === -1 ? '' : -tr.q}e (negative)` : 'neutral');

  const FACTS: Record<DetPrefs['det'], string[]> = {
    cloud: [
      'A charged particle ionises the air: it knocks electrons out of molecules all along its path, leaving a trail of ions.',
      'The alcohol vapour is supersaturated (cooled below the point where it would normally condense), so droplets form on the ions: the track.',
      'The more strongly a particle ionises, the thicker its track: an α (charge +2e, slow) makes a thick one; a β (charge ±e, fast and light) a thin one.',
      'α particles from one nuclide all have the same energy, so the same range (several sources: several lengths). β particles share their energy with a neutrino, so their energies, and lengths, vary.',
      'Neutral particles (γ-ray photons, neutrons, neutrinos) ionise very little or not at all, so they leave no track of their own.',
      'In a magnetic field the tracks curve: the direction gives the sign of the charge (β⁺ and β⁻ curl opposite ways), the radius gives the momentum, r = p/BQ.',
    ],
    bubble: [
      'Liquid hydrogen is held just below its boiling point under pressure; the pressure is suddenly dropped so it is superheated, ready to boil.',
      'A charged particle ionises the liquid; tiny bubbles grow on the ions along its path and are photographed a few milliseconds later.',
      'The direction a track curves gives the sign of the charge (Fleming’s left-hand rule); its radius gives the momentum: r = p/BQ.',
      'A spiral means the particle is losing energy. The magnetic force is always at right angles to the motion, so it does no work: only the liquid slows the particle.',
      'Thicker tracks: more ionisation per cm, from a slower particle or a bigger charge.',
      'Neutral particles leave gaps: you see only where they were made and where they decayed (a V). Conservation of charge, energy and momentum at each vertex tells you what happened.',
      'High energies make new particles (ΔE = c²Δm): a reaction is possible only if the energy available, √s, is at least the total rest energy of what it makes.',
    ],
    collider: [
      'Modern detectors are built in layers around the collision point; each layer catches different particles.',
      'Tracker: ionisation in layers of silicon gives each charged particle’s path; its curvature in the magnetic field gives the momentum and the sign of the charge.',
      'Calorimeters stop particles and measure their energy: electrons and photons in the electromagnetic one, hadrons in the hadron one.',
      'Muons ionise only lightly and go through everything; neutrinos escape completely and are found from missing momentum.',
    ],
  };
  const NAME: Record<DetPrefs['det'], [string, string]> = {
    cloud: ['Cloud chamber', 'alcohol vapour over a cold plate'],
    bubble: ['Bubble chamber', 'superheated liquid hydrogen'],
    collider: ['Collider detector', 'layers round the beam pipe'],
  };
  const CLOUD_ROWS = [
    ['α particle', 'very strong (about 10⁴ ion pairs per cm)', 'a few cm: R ≈ 0.318E^1.5 cm (4 cm at 5.5 MeV, 8 cm at 8.8 MeV)', 'short, thick, straight; one length per energy', 'barely bends (large p)'],
    ['β⁻ particle (electron)', 'weak (about 100 ion pairs per cm)', 'up to metres; varies (continuous energies)', 'thin, faint, wiggly', 'curls tightly, the opposite way to α'],
    ['β⁺ particle (positron)', 'weak', 'like β⁻; ends by annihilating', 'thin, faint, wiggly', 'curls the opposite way to β⁻'],
    ['γ-ray photon', 'very weak (it is uncharged)', 'no definite range', 'no track; only short electron tracks it knocks out in mid-air', 'the photon is not deflected'],
    ['cosmic-ray muon', 'weak (fast, charge ±e)', 'passes right through', 'long, thin, dead straight', 'hardly bends (several GeV/c)'],
  ];
  const STOP: Record<string, string> = { tracker: 'Tracker', ecal: 'EM calorimeter', hcal: 'Hadron calorimeter', escapes: 'escapes' };
  const info = $derived(csource(prefs.info));
  const infoAlphas = $derived(info.mix.filter(([, e]) => e.k === 'alpha').map(([, e]) => (e.k === 'alpha' ? e.E : 0)));

  /* ---------- the collision's tables ---------- */
  const fmtRow = (unit: string, x: number) => (unit === 'thirds' ? thirds(x) : signed(x));
  const termsOf = (ids: string[], key: string, unit: string) => ids.map((id) => {
    const p = get(id);
    const v = key === 'Q' ? p.q3 : key === 'B' ? p.b3 : key === 'L' ? p.L[0] + p.L[1] + p.L[2] : key === 'Le' ? p.L[0] : key === 'Lmu' ? p.L[1] : key === 'Ltau' ? p.L[2] : p.S;
    return unit === 'thirds' ? thirds(v) : signed(v);
  }).join(' ') || '0';
  const hasLepton = $derived(!!result && [...result.initial, ...result.final].some((id) => get(id).family === 'lepton'));
  const shownRows = $derived(result ? result.rows.filter((r) => !['Le', 'Lmu', 'Ltau'].includes(r.key) || (hasLepton && (r.left !== 0 || r.right !== 0))) : []);
  const pFmt = (x: number) => (Math.abs(x) < 0.005 ? '0' : Math.abs(x) >= 1000 ? `${(x / 1000).toFixed(3)} GeV/c` : `${x.toFixed(1)} MeV/c`);
</script>

{#snippet bchip(id: string, on: boolean, click: () => void)}
  <button type="button" class="fchip pchip" aria-pressed={on} onclick={click} title={get(id).name}><Sym s={get(id).sym} size="17px" /></button>
{/snippet}

<main class="layout det" hidden={off}>
  <section class="panel stage" aria-label="Detector">
    <div class="stage-head">
      <div class="label-chip"><small>Detector</small><span>{NAME[prefs.det][0]}</span></div>
      {#if prefs.det === 'bubble'}
        <div class="stage-tools">
          <Seg label="Bubble chamber mode" options={[['collide', 'Collision lab', 'Collide'], ['classic', 'Classic events', 'Classic']]} value={prefs.bmode} onchange={(x) => { prefs.bmode = x as DetPrefs['bmode']; picked = null; }} />
        </div>
      {/if}
    </div>
    <div class="picker" role="group" aria-label="Detector">
      <button type="button" class="fchip" aria-pressed={prefs.det === 'cloud'} onclick={() => choose('cloud')}>Cloud chamber</button>
      <button type="button" class="fchip" aria-pressed={prefs.det === 'bubble'} onclick={() => choose('bubble')}>Bubble chamber</button>
      <button type="button" class="fchip" aria-pressed={prefs.det === 'collider'} onclick={() => choose('collider')}>Collider detector <span class="beyond">beyond the spec</span></button>
    </div>
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="spacebox" onpointerdown={pdown} onpointerup={pup}>
      {#if seen}
        <View3D load={() => import('./detect3d').then((m) => m.DetectScene)} {look} {onscene}
          label="3D view of the {NAME[prefs.det][0].toLowerCase()}. Drag to turn it; click a track to identify it.">
          <div class="hud tl">
            <b>{prefs.det === 'bubble' ? (prefs.bmode === 'collide' ? (result?.channel?.label ?? 'Collision lab') : ev.name) : NAME[prefs.det][0]}</b>
            <span>{prefs.det === 'cloud' ? (prefs.srcs.length ? prefs.srcs.map((id) => csource(id).label).join(' + ') : 'background only') : prefs.det === 'bubble' && prefs.bmode === 'collide' ? `√s = ${gev(result?.W ?? W)} · ${prefs.heavy ? 'heavy liquid' : 'liquid hydrogen'}` : NAME[prefs.det][1]}</span>
          </div>
          <div class="hud tr">
            {#if prefs.det === 'cloud'}
              <span>{prefs.field ? `B = ${CLOUD_B} T, upwards` : 'No magnetic field'}</span>
            {:else if prefs.det === 'bubble'}
              <span>B = {BUBBLE_B} T out of the screen ⊙</span>
              <span class="mut">+ curves clockwise, − anticlockwise</span>
            {:else}
              <span>B = {COLLIDER_B} T along the beams</span>
            {/if}
          </div>
          <div class="hud bl">Click a track to identify it and measure its radius · drag to turn</div>
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      {#if prefs.det === 'bubble' && prefs.bmode === 'collide'}
        <button class="btn primary" type="button" onclick={() => fireCollision()}>Fire again</button>
        <button class="btn" type="button" onclick={replay}>Replay</button>
      {:else if prefs.det === 'bubble'}
        <button class="btn" type="button" onclick={replay}>Replay the event</button>
      {:else}
        <button class="btn" type="button" onclick={clear}>Clear</button>
      {/if}
      <Seg label="Speed" options={[['0.25', '×¼'], ['0.5', '×½'], ['1', '×1'], ['2', '×2']]} value={String(prefs.speed)} onchange={(x) => (prefs.speed = +x)} />
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Controls">
      {#if prefs.det === 'cloud'}
        <div class="ph"><h2>Sources <small class="ph-s">pick any mix</small></h2></div>
        <div class="srcs" role="group" aria-label="Sources">
          {#each CSOURCES as s (s.id)}
            <button type="button" class="fchip" aria-pressed={prefs.srcs.includes(s.id)} onclick={() => toggleSrc(s.id)}>{s.label}</button>
          {/each}
        </div>
        <div class="mixes"><small>Quick mixes:</small>{#each MIXES as [n, ids] (n)}<button type="button" class="linkish" onclick={() => { prefs.srcs = [...ids]; if (ids[0]) prefs.info = ids[0]; }}>{n}</button>{/each}</div>
        <div class="ctls">
          <div class="ctl">
            <span class="ctl-l">Placing the sources</span>
            <Seg label="Placing" options={[['apart', 'Each on its own holder', 'Apart'], ['one', 'All on one holder', 'Together']]} value={prefs.together ? 'one' : 'apart'} onchange={(x) => (prefs.together = x === 'one')} />
          </div>
          <div class="ctl">
            <span class="ctl-l">Background</span>
            <div class="toggles">
              <label class="tog"><input type="checkbox" bind:checked={prefs.cosmic} /> Cosmic rays (muons, showers)</label>
              <label class="tog"><input type="checkbox" bind:checked={prefs.radon} /> Radon in the air</label>
            </div>
          </div>
          <div class="ctl">
            <span class="ctl-l">Magnet</span>
            <Seg label="Magnetic field" options={[['off', 'Off'], ['on', `${CLOUD_B} T`]]} value={prefs.field ? 'on' : 'off'} onchange={(x) => (prefs.field = x === 'on')} />
          </div>
        </div>
      {:else if prefs.det === 'bubble' && prefs.bmode === 'classic'}
        <div class="ph"><h2>Classic events</h2></div>
        <div class="evlist" role="group" aria-label="Events">
          {#each EVENTS as e, i (e.id)}
            <button type="button" class="fchip" aria-pressed={prefs.ev === i} onclick={() => chooseEv(i)}><b>{i + 1}</b> {e.name}</button>
          {/each}
        </div>
        <div class="ctls">
          <div class="ctl">
            <span class="ctl-l">Neutral particles</span>
            <Seg label="Neutral particles" options={[['off', 'Invisible (as photographed)', 'Invisible'], ['on', 'Show as dashes', 'Dashed']]} value={prefs.neutral ? 'on' : 'off'} onchange={(x) => (prefs.neutral = x === 'on')} />
          </div>
        </div>
      {:else if prefs.det === 'bubble'}
        <div class="ph"><h2>Collision lab</h2></div>
        <div class="ctls coll">
          <div class="ctl">
            <span class="ctl-l">Beam</span>
            <div class="bchips">{#each BEAMS as id (id)}{@render bchip(id, prefs.beam === id, () => { prefs.beam = id; prefs.chan = 'auto'; })}{/each}</div>
          </div>
          <label class="ctl"><span class="ctl-l">{prefs.beam === 'gamma' ? 'Photon energy' : 'Beam momentum'} <b>{pText(prefs.pb, prefs.beam)}</b></span>
            <input class="slider" type="range" min={PMIN} max={PMAX} step="0.005" value={Math.log10(prefs.pb)} oninput={(e) => { prefs.pb = Math.round(10 ** +e.currentTarget.value); prefs.chan = 'auto'; }} aria-label="Beam momentum" /></label>
          <div class="ctl">
            <span class="ctl-l">Target</span>
            <Seg label="Target" options={[['p', 'Proton (liquid H₂)', 'H₂'], ['d', 'Deuteron (liquid D₂)', 'D₂'], ['beam', 'Head-on beam', 'Beam']]} value={prefs.target} onchange={(x) => { prefs.target = x as DetPrefs['target']; prefs.chan = 'auto'; }} />
          </div>
          {#if headOn}
            <div class="ctl">
              <span class="ctl-l">Second beam (from the right)</span>
              <div class="bchips">{#each BEAMS as id (id)}{@render bchip(id, prefs.beam2 === id, () => { prefs.beam2 = id; prefs.chan = 'auto'; })}{/each}</div>
            </div>
            <label class="ctl"><span class="ctl-l">Its momentum <b>{pText(prefs.pb2, prefs.beam2)}</b></span>
              <input class="slider" type="range" min={PMIN} max={PMAX} step="0.005" value={Math.log10(prefs.pb2)} oninput={(e) => { prefs.pb2 = Math.round(10 ** +e.currentTarget.value); prefs.chan = 'auto'; }} aria-label="Second beam momentum" /></label>
          {/if}
          <dl class="reads">
            <div><dt>√s available</dt><dd>{gev(W)}</dd></div>
            <div><dt>Reactions open</dt><dd>{chans.open.length}</dd></div>
          </dl>
          <label class="ctl"><span class="ctl-l">Outcome</span>
            <select class="sel" bind:value={prefs.chan} aria-label="Which reaction">
              <option value="auto">Random, weighted by how likely each is</option>
              {#each chans.open.slice(0, 40) as c (c.key)}<option value={c.key}>{c.label} ({c.w >= 0.001 ? (c.w * 100).toPrecision(2) : '<0.1'}%)</option>{/each}
            </select>
          </label>
          <div class="ctl">
            <span class="ctl-l">Liquid</span>
            <Seg label="Liquid" options={[['h', 'Hydrogen'], ['f', 'Heavy (freon)']]} value={prefs.heavy ? 'f' : 'h'} onchange={(x) => (prefs.heavy = x === 'f')} />
            {#if prefs.heavy}<small class="why">Freon is dense: particles lose energy faster ({HEAVY.loss} MeV/cm) and photons convert within about {((9 / 7) * HEAVY.X0).toFixed(0)} cm, against {((9 / 7) * HYDROGEN.X0 / 100).toFixed(1)} m in hydrogen. <span class="beyond">beyond the spec</span></small>{/if}
          </div>
          <div class="ctl">
            <span class="ctl-l">Neutral particles</span>
            <Seg label="Neutral particles" options={[['off', 'Invisible (as photographed)', 'Invisible'], ['on', 'Show as dashes', 'Dashed']]} value={prefs.neutral ? 'on' : 'off'} onchange={(x) => (prefs.neutral = x === 'on')} />
          </div>
          <button class="btn primary big" type="button" onclick={() => fireCollision()}>Fire</button>
          {#if history.length > 1}
            <div class="hist"><small>Recent:</small>{#each history.slice(1) as h (h.seed)}<button type="button" class="fchip" onclick={() => replayHistory(h)}>{h.label}</button>{/each}</div>
          {/if}
        </div>
      {:else}
        <div class="ph"><h2>Fire a particle out from the collision</h2></div>
        <div class="fires">
          {#each SHOTS as s (s.id)}
            <button type="button" class="btn" onclick={() => shoot(s.id)}>{s.label}</button>
          {/each}
          <button type="button" class="btn primary" onclick={shootAll}>One of each</button>
        </div>
      {/if}
    </section>

    {#if prefs.det === 'cloud'}
      <section class="panel" aria-label="About the source">
        {#key info.id}
          <div class="srccard swap">
            <div class="ph"><h2>{info.label}{#if !prefs.srcs.includes(info.id)}<small class="ph-s">not in the chamber</small>{/if}</h2></div>
            <p class="sname">{info.name}</p>
            <dl class="reads pad">
              <div class="wide"><dt>Half-life</dt><dd class="txt">{info.half}</dd></div>
              <div class="wide"><dt>Emits</dt><dd class="txt">{info.emits}</dd></div>
              {#if infoAlphas.length}<div class="wide"><dt>α ranges in air</dt><dd class="txt">{[...new Set(infoAlphas)].sort((a, b) => a - b).map((e) => `${e.toFixed(2)} MeV → ${alphaRange(e).toPrecision(2)} cm`).join(' · ')}</dd></div>{/if}
            </dl>
            <p class="why pad2"><b>Used for:</b> {info.use}</p>
            <p class="why pad2"><b>Safety:</b> {info.safety}</p>
          </div>
        {/key}
        <div class="srcs small" role="group" aria-label="Read about a source">{#each CSOURCES as s (s.id)}<button type="button" class="linkish" class:on={prefs.info === s.id} onclick={() => (prefs.info = s.id)}>{s.label}</button>{/each}</div>
      </section>
    {/if}

    <section class="panel" aria-label="Picked track">
      <div class="ph"><h2>Track</h2></div>
      {#if tr && pt}
        {#key tr}
          <div class="trk swap">
            <p class="trk-h">{#if part}<Sym s={part.sym} size="22px" />{:else if tr.pid === 'alpha'}<span class="psym" style:font-size="22px">α</span>{/if}<span>{tr.name}</span></p>
            <dl class="reads pad">
              <div><dt>Charge</dt><dd class="txt">{signText}</dd></div>
              <div><dt>Radius here</dt><dd>{curved ? rText(pt.r) : 'straight'}</dd></div>
            </dl>
            <p class="why pad2">{tr.why}</p>
            {#if curved}
              <div class="work">
                <div class="eq">p = BQr = {tr.B} × {sci(Q)} × {sci(rM)} = {sci(pSI)} kg m s⁻¹</div>
                <div class="eq">In MeV/c: pc ÷ (1.60 × 10⁻¹³ J) = {sci(pSI)} × 3.00 × 10⁸ ÷ 1.60 × 10⁻¹³ = {sci(pMeV)} MeV/c</div>
                {#if rM > 3}<p class="why">So large a radius means a large momentum: the track looks almost straight.</p>{/if}
              </div>
            {:else if tr.B === 0 && prefs.det === 'cloud'}
              <p class="why pad2">No magnetic field, so no curvature to measure. Switch the magnet on to measure momenta.</p>
            {/if}
          </div>
        {/key}
      {:else}
        <p class="why pad2">Click any track in the view{prefs.det === 'cloud' ? ' (pause first if it fades too fast)' : ''}. You get what it is, the sign of its charge and why, and its momentum from the radius where you clicked.</p>
      {/if}
    </section>

    <section class="panel" aria-label="Key facts">
      <div class="facts pad">
        <b>Key facts</b>
        <ul>{#each FACTS[prefs.det] as f (f)}<li>{f}</li>{/each}</ul>
      </div>
    </section>
  </aside>

  <section class="panel explain full" aria-label="What happened">
    {#if prefs.det === 'bubble' && prefs.bmode === 'collide'}
      {#if result}
        {#key ckey}
          <div class="ex-body swap">
            <h3>{result.channel ? 'What happened' : 'Nothing happened'}<small>√s = {gev(result.W)}{result.channel && result.channel.kind !== 'through' ? ` · products need ${gev(result.thr)}` : ''}</small></h3>
            {#if result.channel && result.channel.kind !== 'through'}
              <div class="reaction">
                {#each result.initial as id, i (i)}{#if i}<span class="plus">+</span>{/if}<Sym s={get(id).sym} size="28px" />{/each}
                <span class="arrow">→</span>
                {#each result.final as id, i (i)}{#if i}<span class="plus">+</span>{/if}<Sym s={get(id).sym} size="28px" />{/each}
                {#if result.channel.beyond}<span class="beyond">beyond the spec</span>{/if}
              </div>
            {/if}
            <div class="eq">{result.ev.equation}</div>
            <ul class="what">{#each result.ev.what as w, i (i)}<li>{w}</li>{/each}</ul>
            {#if result.struck}<p class="why">In deuterium the beam hits one nucleon of the deuteron; √s is worked out for that nucleon at rest.</p>{/if}
            {#if result.channel && result.channel.kind !== 'through'}
              <div class="tscroll">
                <table class="ctab">
                  <thead><tr><th>Conserved</th><th>Before</th><th>After</th><th></th></tr></thead>
                  <tbody>
                    {#each shownRows as r (r.key)}
                      <tr><td class="first">{r.name}{#if r.beyond}<span class="beyond">beyond</span>{/if}</td><td>{termsOf(result.initial, r.key, r.unit)} = <b>{fmtRow(r.unit, r.left)}</b></td><td>{termsOf(result.final, r.key, r.unit)} = <b>{fmtRow(r.unit, r.right)}</b></td><td class="ok">{r.ok ? '✓' : '✗'}</td></tr>
                    {/each}
                    <tr><td class="first">Total energy</td><td><b>{result.Ein.toFixed(1)} MeV</b></td><td><b>{result.Eout.toFixed(1)} MeV</b></td><td class="ok">✓</td></tr>
                    <tr><td class="first">Momentum (x, y)</td><td><b>{pFmt(result.Pin[0])}, {pFmt(result.Pin[1])}</b></td><td><b>{pFmt(result.Pout[0])}, {pFmt(result.Pout[1])}</b></td><td class="ok">✓</td></tr>
                    <tr><td class="first">Rest mass</td><td>{result.initial.map((id) => get(id).mass.toFixed(1)).join(' + ')} MeV/c²</td><td>{gev(result.thr)}/c² ≤ √s = {gev(result.W)}</td><td class="ok">✓</td></tr>
                  </tbody>
                </table>
              </div>
            {/if}
            <p class="why">Strangeness is conserved at the collision itself (strong and electromagnetic interactions); the weak decays afterwards can change it. Everything is drawn as if it moved in the plane of the photograph, so momenta add up exactly in the picture.</p>
          </div>
        {/key}
      {/if}
      <div class="ex-body">
        <h3>Possible outcomes<small>at √s = {gev(W)}</small></h3>
        {#if chans.open.length}
          <ul class="chlist">
            {#each chans.open.slice(0, 10) as c (c.key)}<li><span class="bar" style:width="{Math.max(2, c.w * 100)}%"></span><span class="cl">{c.label}</span><b>{c.w >= 0.001 ? (c.w * 100).toPrecision(2) : '<0.1'}%</b></li>{/each}
          </ul>
          {#if chans.open.length > 10}<p class="why">…and {chans.open.length - 10} more, each less likely. Choose any of them from the Outcome menu.</p>{/if}
        {:else}<p class="why">Not enough energy for any reaction.</p>{/if}
        {#if chans.closed.length}
          <p class="why"><b>Not enough energy yet</b> (needs a larger √s): {chans.closed.slice(0, 5).map((c) => `${c.label.split(' → ')[1]} (√s ≥ ${gev(c.m)})`).join(' · ')}</p>
        {/if}
        <p class="why">The percentages come from a simple model (energy to spare, how many particles share it, and how hard it is to make strange quarks or antibaryons), not from measured cross-sections. <span class="beyond">beyond the spec</span></p>
      </div>
    {:else if prefs.det === 'bubble'}
      {#key ev.id}
        <div class="ex-body swap">
          <h3>{ev.title}<small>event {prefs.ev + 1} of {EVENTS.length}</small></h3>
          <div class="eq">{ev.equation}</div>
          <ul class="what">{#each ev.what as w (w)}<li>{w}</li>{/each}</ul>
          {#if ev.checks.length}
            <div class="tscroll">
              <table class="ctab">
                <thead><tr><th>Conserved</th><th>Before</th><th>After</th><th></th></tr></thead>
                <tbody>{#each ev.checks as c (c.label)}<tr><td>{c.label}</td><td>{c.before}</td><td>{c.after}</td><td class="ok">{c.ok ? '✓' : '✗'}</td></tr>{/each}</tbody>
              </table>
            </div>
          {/if}
          <p><b>Momentum.</b> {ev.momentum}</p>
        </div>
      {/key}
    {:else if prefs.det === 'cloud'}
      <div class="ex-body">
        <h3>Telling the tracks apart<small>ionisation and range</small></h3>
        <div class="tscroll">
          <table class="ctab">
            <thead><tr><th>Particle</th><th>Ionising</th><th>Range in air</th><th>Track</th><th>In a field</th></tr></thead>
            <tbody>{#each CLOUD_ROWS as r (r[0])}<tr>{#each r as c, i (i)}<td class:first={i === 0}>{c}</td>{/each}</tr>{/each}</tbody>
          </table>
        </div>
        <p>α particles are slow (about 5% of the speed of light) and carry charge +2e, so they pull hard on the electrons of every molecule they pass: they lose their energy quickly and stop within a few cm. A source with a decay chain (radium, thorium, uranium) gives α particles of several energies, so tracks of several lengths. A β particle is far faster with half the charge, so it ionises much less and goes much further; it shares the decay energy with a neutrino, so β energies (and track lengths) vary. In a field, an α bends far less than a β even though its charge is bigger: its momentum is over a hundred times larger (r = p/BQ).</p>
      </div>
    {:else}
      <div class="ex-body">
        <h3>Where each particle stops<small>beyond the spec</small></h3>
        <div class="tscroll">
          <table class="ctab">
            <thead><tr><th>Particle</th>{#each LAYERS.filter((l) => l.id !== 'coil') as l (l.id)}<th>{l.name}</th>{/each}<th>Stops in</th></tr></thead>
            <tbody>
              {#each SHOTS as s (s.id)}
                <tr>
                  <td class="first">{s.label}</td>
                  <td>{s.charged ? 'track' : '–'}</td>
                  <td>{s.stops === 'ecal' ? 'shower ●' : s.id === 'pi+' ? 'a little' : s.charged ? 'a little' : '–'}</td>
                  <td>{s.stops === 'hcal' ? 'shower ●' : s.id === 'mu' ? 'a little' : '–'}</td>
                  <td>{s.id === 'mu' ? 'hits ●' : '–'}</td>
                  <td>{STOP[s.stops]}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <ul class="what">{#each LAYERS as l (l.id)}<li><b>{l.name}.</b> {l.what}</li>{/each}</ul>
      </div>
    {/if}
  </section>
</main>
