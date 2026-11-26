<script lang="ts" module>
  import type { Shape } from './light';
  export interface LightPrefs {
    mode: 'refract' | 'polar' | 'intensity';
    shape: Shape; mat: string; nCustom: number; outer: 'air' | 'water'; angle: number; white: boolean; nClad: number;
    src: 'light' | 'radio' | 'sound'; pol: boolean; ana: boolean; polA: number; anaA: number;
    lamp: 'bulb' | 'laser'; P: number; r: number; A: number;     // W (bulb) or mW (laser), m, cm²
  }
  export const LIGHT: LightPrefs = {
    mode: 'refract', shape: 'semi', mat: 'glass', nCustom: 1.6, outer: 'air', angle: 35, white: false, nClad: 1.46,
    src: 'light', pol: true, ana: true, polA: 0, anaA: 30,
    lamp: 'bulb', P: 60, r: 2, A: 25,
  };
</script>

<script lang="ts">
  /* Light: refraction, total internal reflection and the critical angle on a 3D optics bench (spec 45–47, 55), how to
     measure the refractive index of a block (48), plane polarisation (49) and intensity I = P/A (44). The ray tracer
     is in light.ts, the 3D in light3d.ts; everything shown here is worked out from the same trace. */
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import Plot from '../circuit/Plot.svelte';
  import type { LLook } from './light3d';
  import { MATERIALS, SHAPES, MAX_ANGLE, trace, critical, keyInterface, deg, type V2, type Setup, RECT, SEMI_R, PRISM, CORE, CLAD, TANK, BOX } from './light';
  import { C, sci, plain, short } from './consts';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: LightPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });
  let playing = $state(!RM);

  /* ---------- refraction ---------- */
  const mat = $derived(MATERIALS.find((m) => m.id === prefs.mat) ?? MATERIALS[2]);
  const nBlock = $derived(prefs.shape === 'tank' ? 1.33 : mat.id === 'custom' ? prefs.nCustom : mat.n);
  const nOut = $derived(prefs.shape === 'tank' ? 1.0 : prefs.outer === 'water' ? 1.33 : 1.0);
  $effect.pre(() => { const mx = MAX_ANGLE[prefs.shape]; if (prefs.angle > mx) prefs.angle = mx; });
  const setup = $derived<Setup>({ shape: prefs.shape, n: nBlock, B: prefs.shape === 'tank' ? 0.0031 : mat.B, nOut, nClad: Math.min(prefs.nClad, nBlock - 0.005), angle: prefs.angle });
  const tr = $derived(trace(setup));
  const key = $derived(keyInterface(setup));
  const Ck = $derived(critical(key.from, key.to));
  const willTir = $derived(Ck !== null && key.theta !== null && key.theta > Ck);
  const outName = $derived(nOut > 1.01 ? 'water' : 'air');
  const matName = $derived(prefs.shape === 'tank' ? 'water' : mat.id === 'custom' ? 'the block' : mat.name.toLowerCase());
  const shapeName = $derived(SHAPES.find((s) => s[0] === prefs.shape)![1]);
  const ANGLE_L: Record<Shape, string> = {
    rect: 'Angle of incidence', semi: 'Angle at the flat face (ray aimed at the centre)', prism: 'Angle of incidence on the first face',
    fibre: 'Angle of the ray into the fibre end', tank: 'Lamp beam, angle from the vertical',
  };
  const FACE: Record<Shape, string> = { rect: 'the bottom face', semi: 'the flat face', prism: 'the second face', fibre: 'the core–cladding boundary', tank: 'the water surface' };
  const firstReal = $derived(tr.hits.find((h) => h.i > 0.05 || h.tir) ?? tr.hits[0]);
  const vIn = $derived(C / nBlock);
  const fibreAccept = $derived(prefs.shape === 'fibre' && nBlock > setup.nClad ? deg(Math.asin(Math.min(1, Math.sqrt(nBlock ** 2 - setup.nClad ** 2) / nOut))) : null);

  // the main path as a polyline (for the 2D diagram's arcs)
  const mainPts = $derived.by(() => {
    const pts: V2[] = [tr.ray.p];
    const main = tr.segs.filter((s) => s.main && s.nm === 589);
    let cur = tr.ray.p;
    for (let g = 0; g < 80; g++) {
      const i = main.findIndex((s) => Math.hypot(s.a[0] - cur[0], s.a[1] - cur[1]) < 1e-6);
      if (i < 0) break;
      cur = main[i].b; pts.push(cur); main.splice(i, 1);
    }
    return pts;
  });

  /* ---------- the 2D ray diagram (to scale, cm) ---------- */
  const PX = 20;
  const X = (p: V2) => p[0] * PX, Y = (p: V2) => -p[1] * PX;
  const vb = `${BOX[0] * PX} ${-BOX[3] * PX} ${(BOX[2] - BOX[0]) * PX} ${(BOX[3] - BOX[1]) * PX}`;
  const polyD = (pts: V2[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)} ${Y(p).toFixed(1)}`).join('') + 'Z';
  const outline = $derived.by(() => {
    switch (prefs.shape) {
      case 'rect': return [polyD(RECT)];
      case 'prism': return [polyD(PRISM)];
      case 'semi': return [`M${-SEMI_R * PX} 0 L${SEMI_R * PX} 0 A${SEMI_R * PX} ${SEMI_R * PX} 0 0 1 ${-SEMI_R * PX} 0Z`];
      case 'fibre': return [polyD([[CORE.x0, -CLAD], [CORE.x1, -CLAD], [CORE.x1, CLAD], [CORE.x0, CLAD]]), polyD([[CORE.x0, -CORE.h], [CORE.x1, -CORE.h], [CORE.x1, CORE.h], [CORE.x0, CORE.h]])];
      case 'tank': return [polyD([[TANK.x0, TANK.y0], [TANK.x1, TANK.y0], [TANK.x1, TANK.y1], [TANK.x0, TANK.y1]])];
    }
  });
  function arc(p: V2, u: V2, v: V2, r: number) {
    const a = [X(p) + u[0] * r, Y(p) - u[1] * r], b = [X(p) + v[0] * r, Y(p) - v[1] * r];
    const cross = u[0] * v[1] - u[1] * v[0];
    return `M${a[0].toFixed(1)} ${a[1].toFixed(1)} A${r} ${r} 0 0 ${cross > 0 ? 0 : 1} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  }
  /** An angle for display: 3 s.f., and exactly 0 when the ray meets the face along the normal. */
  const ang = (x: number | null) => (x === null || x < 0.05 ? '0' : plain(x, 3));
  const unit = (a: V2, b: V2): V2 => { const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / L, (b[1] - a[1]) / L]; };
  const arcs = $derived.by(() => {
    const out: { d: string; lx: number; ly: number; text: string; cls: string }[] = [];
    tr.hits.slice(0, prefs.shape === 'fibre' ? 2 : 3).forEach((h, k) => {
      if (mainPts.length < k + 3 || (h.i < 0.3 && !h.tir)) return;
      const p = h.p, back = unit(p, mainPts[k]), fwd = unit(p, mainPts[k + 2]);
      const nIn: V2 = h.nrm, nOutv: V2 = [-h.nrm[0], -h.nrm[1]];
      const r1 = 34, r2 = 46;
      const mid1: V2 = unit([0, 0], [nIn[0] + back[0], nIn[1] + back[1]]);
      out.push({ d: arc(p, nIn, back, r1), lx: X(p) + mid1[0] * (r1 + 14), ly: Y(p) - mid1[1] * (r1 + 14), text: `${plain(h.i, 3)}°`, cls: 'ai' });
      if (h.tir) {
        const mid: V2 = unit([0, 0], [nIn[0] + fwd[0], nIn[1] + fwd[1]]);
        out.push({ d: arc(p, nIn, fwd, r2), lx: X(p) + mid[0] * (r2 + 14), ly: Y(p) - mid[1] * (r2 + 14), text: 'TIR', cls: 'at' });
      } else if (h.t !== null && h.t > 0.3) {
        const mid: V2 = unit([0, 0], [nOutv[0] + fwd[0], nOutv[1] + fwd[1]]);
        out.push({ d: arc(p, nOutv, fwd, r2), lx: X(p) + mid[0] * (r2 + 14), ly: Y(p) - mid[1] * (r2 + 14), text: `${plain(h.t, 3)}°`, cls: 'ar' });
      }
    });
    return out;
  });

  /* ---------- measuring n (spec 48) ---------- */
  interface Reading { i: number; r: number }
  let readings = $state<Reading[]>([]);
  let iSet = $state(30);
  let readKey = '';
  $effect(() => { const k = `${nBlock}|${nOut}`; if (k !== readKey) { readKey = k; readings = []; } });
  const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); };
  function take() {
    const rTrue = deg(Math.asin((nOut * Math.sin((iSet * Math.PI) / 180)) / nBlock));
    const r = Math.max(0, Math.round(rTrue + gauss() * 0.7));       // protractor read to the nearest degree, traces drawn by hand
    readings = [...readings.filter((x) => x.i !== iSet), { i: iSet, r }].sort((a, b) => a.i - b.i);
  }
  const sinPts = $derived(readings.map((x) => ({ x: Math.sin((x.r * Math.PI) / 180), y: Math.sin((x.i * Math.PI) / 180) })));
  const grad = $derived(sinPts.length ? sinPts.reduce((s, p) => s + p.x * p.y, 0) / sinPts.reduce((s, p) => s + p.x * p.x, 0) : NaN);

  /* ---------- polarisation ---------- */
  const share = $derived.by(() => {
    if (prefs.src === 'sound') return 1;
    const c2 = (d: number) => Math.cos((d * Math.PI) / 180) ** 2;
    if (prefs.src === 'radio') { let I = 1, a = 0; if (prefs.pol) { I *= c2(prefs.polA - a); a = prefs.polA; } if (prefs.ana) I *= c2(prefs.anaA - a); return I; }
    if (prefs.pol && prefs.ana) return 0.5 * c2(prefs.anaA - prefs.polA);
    return prefs.pol || prefs.ana ? 0.5 : 1;
  });
  const delta = $derived(((prefs.anaA - prefs.polA) % 180 + 180) % 180);
  const malusCurve = $derived(Array.from({ length: 181 }, (_, i) => [i, 50 * Math.cos((i * Math.PI) / 180) ** 2] as [number, number]));
  const planeNow = $derived(prefs.src === 'sound' ? 'none (longitudinal)' : prefs.ana ? `${prefs.anaA}° from vertical` : prefs.pol ? `${prefs.polA}° from vertical` : prefs.src === 'radio' ? 'vertical (0°)' : 'every plane (unpolarised)');

  /* ---------- intensity ---------- */
  const laser = $derived(prefs.lamp === 'laser');
  const Pw = $derived(laser ? prefs.P / 1000 : prefs.P);          // W
  const BEAM_D = 1.5e-3, beamA = Math.PI * (BEAM_D / 2) ** 2;
  const sphere = $derived(4 * Math.PI * prefs.r * prefs.r);
  const Iat = $derived(laser ? Pw / beamA : Pw / sphere);
  const Adet = $derived(prefs.A * 1e-4);
  const Pdet = $derived(laser ? Pw : Iat * Adet);
  const iCurve = $derived(Array.from({ length: 80 }, (_, i) => { const r = 0.5 + (i * 4.5) / 79; return [r, laser ? Pw / beamA : Pw / (4 * Math.PI * r * r)] as [number, number]; }));

  /* ---------- the 3D look and the status line ---------- */
  const look = $derived<LLook>({ mode: prefs.mode, setup, white: prefs.white, src: prefs.src, pol: prefs.pol, ana: prefs.ana, polA: prefs.polA, anaA: prefs.anaA, lamp: prefs.lamp, r: prefs.r, playing });
  $effect(() => {
    stats = prefs.mode === 'refract' ? [['n', plain(nBlock, 3)], ['Critical angle', Ck === null ? 'none' : `${plain(Ck, 3)}°`], [FACE[prefs.shape], willTir ? 'TIR' : 'refracts']]
      : prefs.mode === 'polar' ? [['Through', `${plain(share * 100, 3)}%`], ['Plane', planeNow]]
      : [['I', `${sci(Iat)} W m⁻²`], ['Distance', `${plain(prefs.r, 2)} m`]];
  });

  /* Kernel hooks */
  export function kSetPlaying(on: boolean) { playing = on; }
  export function kTakeReading(iDeg?: number) {
    if (iDeg !== undefined) iSet = Math.max(5, Math.min(80, Math.round(iDeg / 5) * 5));
    take();
    return readings[readings.findIndex((x) => x.i === iSet)] ?? null;
  }
  export function kClearReadings() { readings = []; }
  export function kCrossPol() { prefs.pol = true; prefs.ana = true; prefs.anaA = (prefs.polA + 90) % 180; }
  export function kAlignPol() { prefs.pol = true; prefs.ana = true; prefs.anaA = prefs.polA; }
  export function kReadouts() {
    return { playing, nBlock, nOut, vIn, Ck, willTir, key, hits: tr.hits, fibreAccept, readings, grad, iSet, share, delta, planeNow, Iat, sphere, Pdet, laser };
  }
</script>

<main class="layout wv-light" hidden={off}>
  <section class="panel stage" aria-label="Light">
    <div class="stage-head">
      <div class="label-chip"><small>{prefs.mode === 'refract' ? 'Ray box' : prefs.mode === 'polar' ? 'Polaroid filters' : 'I = P/A'}</small>
        <span>{prefs.mode === 'refract' ? `${shapeName}, n = ${plain(nBlock, 3)}` : prefs.mode === 'polar' ? (prefs.src === 'light' ? 'Light from a lamp' : prefs.src === 'radio' ? 'Radio waves from an aerial' : 'Sound from a speaker') : laser ? 'A laser beam' : 'A lamp radiating in all directions'}</span></div>
      <div class="stage-tools">
        <Seg label="View" options={[['refract', 'Refraction', 'Refract'], ['polar', 'Polarisation', 'Polar'], ['intensity', 'Intensity', 'I = P/A']]} bind:value={prefs.mode} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./light3d').then((m) => m.LightScene)} {look}
          label="3D view of the light experiment. Drag to turn it.">
          {#if prefs.mode === 'refract'}
            <div class="hud tl"><b>{willTir ? 'Total internal reflection' : 'Refraction'}</b><span>at {FACE[prefs.shape]}: {plain(key.theta ?? 0, 3)}° {Ck === null ? '(no critical angle)' : `vs C = ${plain(Ck, 3)}°`}</span></div>
            <div class="hud bl">Beam brightness = share of the light. Dots: wave crests; they crowd together where light is slower.</div>
          {:else if prefs.mode === 'polar'}
            <div class="hud tl"><b>{plain(share * 100, 3)}% reaches the screen</b><span>vibrating: {planeNow}</span></div>
            <div class="hud bl">Arrows: the electric field. Lines on each filter: its transmission axis.</div>
          {:else}
            <div class="hud tl"><b>I = {sci(Iat)} W m⁻²</b><span>{laser ? 'the beam keeps its area' : `spread over 4πr² = ${sci(sphere)} m²`}</span></div>
            <div class="hud bl">{laser ? 'A laser beam hardly spreads, so I barely changes with distance.' : 'Wavefronts spread over ever bigger spheres. Panel drawn larger than to scale.'}</div>
          {/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button>
      {#if prefs.mode === 'refract'}
        <label class="ctl scrub"><span class="ctl-l">{ANGLE_L[prefs.shape]} <b>{prefs.angle}°</b></span>
          <input class="slider" type="range" min="0" max={MAX_ANGLE[prefs.shape]} step="1" bind:value={prefs.angle} /></label>
      {/if}
    </div>
  </section>

  <aside class="side">
    {#if prefs.mode === 'refract'}
      <section class="panel" aria-label="Set-up">
        <div class="ph"><h2>Set-up</h2></div>
        <div class="ctls">
          <div class="ctl"><span class="ctl-l">Block</span>
            <div class="picker flat" role="group" aria-label="Block">
              {#each SHAPES as [id, name] (id)}<button type="button" class="fchip" aria-pressed={prefs.shape === id} onclick={() => (prefs.shape = id)}>{name}</button>{/each}
            </div>
          </div>
          {#if prefs.shape !== 'tank'}
            <div class="ctl"><span class="ctl-l">{prefs.shape === 'fibre' ? 'Core' : 'Material'}</span>
              <div class="picker flat" role="group" aria-label="Material">
                {#each MATERIALS.filter((m) => m.id !== 'water' || prefs.shape !== 'fibre') as m (m.id)}<button type="button" class="fchip" aria-pressed={prefs.mat === m.id} onclick={() => (prefs.mat = m.id)}>{m.name}{m.id !== 'custom' ? ` ${m.n.toFixed(2)}` : ''}</button>{/each}
              </div>
            </div>
            {#if prefs.mat === 'custom'}
              <label class="ctl"><span class="ctl-l">Refractive index <b>{plain(prefs.nCustom, 3)}</b></span>
                <input class="slider" type="range" min="1.05" max="2.6" step="0.01" bind:value={prefs.nCustom} /></label>
            {/if}
            <div class="ctl"><span class="ctl-l">Surrounding medium</span>
              <Seg label="Surrounding medium" options={[['air', 'Air, n = 1.00'], ['water', 'Water, n = 1.33']]} bind:value={prefs.outer} /></div>
          {/if}
          {#if prefs.shape === 'fibre'}
            <label class="ctl"><span class="ctl-l">Cladding index <b>{plain(setup.nClad, 3)}</b></span>
              <input class="slider" type="range" min="1.0" max="2.0" step="0.01" bind:value={prefs.nClad} /></label>
          {/if}
          <label class="tick"><input type="checkbox" bind:checked={prefs.white} /> White light (dispersion) <span class="beyond">beyond the spec</span></label>
        </div>
        <dl class="reads pad nocase">
          <div><dt>n of {matName}</dt><dd>{plain(nBlock, 3)}</dd></div>
          <div><dt>v = c/n</dt><dd>{sci(vIn)} m s⁻¹</dd></div>
          <div><dt>λ inside (589 nm in vacuum)</dt><dd>{plain(589 / nBlock, 3)} nm</dd></div>
          <div><dt>Critical angle ({key.fromName} → {key.toName})</dt><dd>{Ck === null ? 'none' : `${plain(Ck, 3)}°`}</dd></div>
          {#if fibreAccept !== null}<div class="wide"><dt>Acceptance angle <span class="beyond">beyond the spec</span></dt><dd>{plain(fibreAccept, 3)}°{fibreAccept >= 89.9 ? ' (any ray)' : ''}</dd></div>{/if}
        </dl>
      </section>

      <section class="panel" aria-label="Will total internal reflection occur?">
        <div class="ph"><h2>Will TIR occur at {FACE[prefs.shape]}?</h2></div>
        <ol class="tirq">
          <li class:ok={key.from > key.to} class:no={key.from <= key.to}>
            <b>Is the light going into a medium with a lower n?</b>
            <span>{key.fromName} n = {plain(key.from, 3)} → {key.toName} n = {plain(key.to, 3)}: {key.from > key.to ? 'yes' : 'no, so TIR is impossible here'}</span>
          </li>
          {#if Ck !== null}
            <li class:ok={willTir} class:no={!willTir}>
              <b>Is the angle of incidence bigger than C?</b>
              <span>sin C = {plain(key.to, 3)}/{plain(key.from, 3)} → C = {plain(Ck, 3)}°; the ray meets it at {plain(key.theta ?? 0, 3)}°: {willTir ? 'yes' : 'no'}</span>
            </li>
          {/if}
        </ol>
        <p class="verdict {willTir ? 'tir' : 'ref'}">{willTir ? 'Yes: all the light is reflected back inside.' : 'No: the ray refracts out (and a little is reflected).'}</p>
      </section>
    {:else if prefs.mode === 'polar'}
      <section class="panel" aria-label="Set-up">
        <div class="ph"><h2>Set-up</h2></div>
        <div class="ctls">
          <div class="ctl"><span class="ctl-l">Source</span>
            <Seg label="Source" options={[['light', 'Lamp (light)', 'Light'], ['radio', 'Aerial (radio)', 'Radio'], ['sound', 'Speaker (sound)', 'Sound']]} bind:value={prefs.src} /></div>
          <label class="tick"><input type="checkbox" bind:checked={prefs.pol} /> Polariser in place</label>
          <label class="ctl"><span class="ctl-l">Polariser axis, from vertical <b>{prefs.polA}°</b></span>
            <input class="slider" type="range" min="0" max="180" step="1" bind:value={prefs.polA} disabled={!prefs.pol} /></label>
          <label class="tick"><input type="checkbox" bind:checked={prefs.ana} /> Analyser in place</label>
          <label class="ctl"><span class="ctl-l">Analyser axis, from vertical <b>{prefs.anaA}°</b></span>
            <input class="slider" type="range" min="0" max="180" step="1" bind:value={prefs.anaA} disabled={!prefs.ana} /></label>
          <div class="picker flat">
            <button class="fchip" type="button" onclick={() => { prefs.pol = true; prefs.ana = true; prefs.anaA = (prefs.polA + 90) % 180; }}>Cross them</button>
            <button class="fchip" type="button" onclick={() => { prefs.pol = true; prefs.ana = true; prefs.anaA = prefs.polA; }}>Line them up</button>
          </div>
        </div>
        <dl class="reads pad nocase">
          <div><dt>Reaching the screen</dt><dd>{plain(share * 100, 3)}%</dd></div>
          <div><dt>Plane of vibration</dt><dd class="txt">{planeNow}</dd></div>
          {#if prefs.pol && prefs.ana && prefs.src !== 'sound'}<div class="wide"><dt>Angle between the axes</dt><dd>{delta}°{delta === 90 ? ': crossed, no light' : delta === 0 ? ': aligned' : ''}</dd></div>{/if}
        </dl>
      </section>
      <section class="panel" aria-label="What is happening">
        <div class="ph"><h2>What is happening</h2></div>
        <div class="work">
          {#if prefs.src === 'sound'}
            <div class="eq">Sound is longitudinal: the air vibrates along the direction the wave travels, so there is no plane across the wave to pick out. Sound cannot be polarised; the filters change nothing.</div>
          {:else if prefs.src === 'radio'}
            <div class="eq">A vertical aerial radiates radio waves that are already plane-polarised (vertically). A receiving aerial must be lined up with the plane, or the signal drops.</div>
          {:else}
            <div class="eq">The lamp’s light is unpolarised: its oscillations happen in every plane at right angles to its direction of travel.</div>
            {#if prefs.pol}<div class="eq">The polariser lets through only the oscillations along its axis: the light is now plane-polarised, at {prefs.polA}°, with half the intensity.</div>{/if}
          {/if}
          {#if prefs.pol && prefs.ana && prefs.src !== 'sound'}
            <div class="eq">Analyser at {delta}° to the plane: I = I₀cos²θ = {plain(Math.cos((delta * Math.PI) / 180) ** 2 * 100, 3)}% of what reaches it <span class="beyond">Malus’s law, beyond the spec</span></div>
          {/if}
        </div>
        <div class="plotbox">
          <Plot xr={[0, 180]} yr={[0, 55]} xLabel="angle between axes / °" yLabel="I through / %" curve={malusCurve} trace h={220}
            now={prefs.src === 'light' && prefs.pol && prefs.ana ? { x: delta, y: share * 100 } : null} label="Intensity through two polarisers against the angle between their axes" />
        </div>
      </section>
    {:else}
      <section class="panel" aria-label="Set-up">
        <div class="ph"><h2>Set-up</h2></div>
        <div class="ctls">
          <div class="ctl"><span class="ctl-l">Source</span>
            <Seg label="Source" options={[['bulb', 'Lamp (all directions)', 'Lamp'], ['laser', 'Laser beam', 'Laser']]} bind:value={prefs.lamp} onchange={(v) => (prefs.P = v === 'laser' ? 1 : 60)} /></div>
          <label class="ctl"><span class="ctl-l">Power P <b>{prefs.P} {laser ? 'mW' : 'W'}</b></span>
            <input class="slider" type="range" min={laser ? 0.5 : 5} max={laser ? 5 : 200} step={laser ? 0.5 : 5} bind:value={prefs.P} /></label>
          <label class="ctl"><span class="ctl-l">Distance r <b>{plain(prefs.r, 2)} m</b></span>
            <input class="slider" type="range" min="0.5" max="5" step="0.1" bind:value={prefs.r} /></label>
          <label class="ctl"><span class="ctl-l">Detector area <b>{prefs.A} cm²</b></span>
            <input class="slider" type="range" min="1" max="100" step="1" bind:value={prefs.A} /></label>
        </div>
        <dl class="reads pad nocase">
          <div><dt>{laser ? 'Beam area (1.5 mm across)' : 'Sphere area 4πr²'}</dt><dd>{sci(laser ? beamA : sphere)} m²</dd></div>
          <div><dt>Intensity I = P/A</dt><dd>{sci(Iat)} W m⁻²</dd></div>
          <div class="wide"><dt>Power on the detector</dt><dd>{laser ? `${sci(Pdet)} W (the whole beam fits on it)` : `I × A = ${sci(Pdet)} W`}</dd></div>
        </dl>
      </section>
      <section class="panel" aria-label="Working">
        <div class="ph"><h2>Working</h2></div>
        <div class="work">
          {#if laser}
            <div class="eq">I = P/A = {sci(Pw)} W ÷ {sci(beamA)} m² = {sci(Iat)} W m⁻²</div>
            <div class="eq">The beam’s area stays the same, so I does not fall with distance (until the beam spreads).</div>
          {:else}
            <div class="eq">The power spreads over a sphere: A = 4πr² = 4π × {plain(prefs.r, 2)}² = {sci(sphere)} m²</div>
            <div class="eq">I = P/4πr² = {prefs.P} ÷ {sci(sphere)} = {sci(Iat)} W m⁻²</div>
            <div class="eq">Double r → 4× the area → ¼ of the intensity (inverse square law).</div>
          {/if}
        </div>
        <div class="plotbox">
          <Plot xr={[0.5, 5]} yr={[0, iCurve[0][1] * 1.08]} xLabel="r / m" yLabel="I / W m⁻²" curve={iCurve} trace h={220} now={{ x: prefs.r, y: Iat }} label="Intensity against distance" />
        </div>
      </section>
    {/if}
  </aside>

  {#if prefs.mode === 'refract'}
    <section class="panel full" aria-label="Ray diagram and interfaces">
      <div class="ph"><h2>Ray diagram, from above (to scale)</h2></div>
      <div class="cols2">
        <div>
          <svg class="raydia" viewBox={vb} role="img" aria-label="Top view of the ray through the {shapeName}, with the normals and angles">
            {#each outline as d, i (i)}<path {d} class="blk" class:core={prefs.shape === 'fibre' && i === 1} />{/each}
            {#each tr.segs.filter((s) => s.I > 0.012) as s, i (i)}
              <line x1={X(s.a)} y1={Y(s.a)} x2={X(s.b)} y2={Y(s.b)} class="ray" class:main={s.main} style:opacity={Math.min(1, 0.18 + Math.sqrt(s.I))} />
            {/each}
            {#each tr.hits.slice(0, prefs.shape === 'fibre' ? 3 : 4) as h, i (i)}
              <line x1={X(h.p) + h.nrm[0] * 60} y1={Y(h.p) - h.nrm[1] * 60} x2={X(h.p) - h.nrm[0] * 60} y2={Y(h.p) + h.nrm[1] * 60} class="nrm" />
            {/each}
            {#each arcs as a, i (i)}<path d={a.d} class="arc {a.cls}" /><text x={a.lx} y={a.ly} class="atx {a.cls}">{a.text}</text>{/each}
            {#if prefs.shape === 'tank'}<circle cx={X(tr.ray.p)} cy={Y(tr.ray.p)} r="7" class="lamp" />{:else}<rect x={X(tr.ray.p) - 10} y={Y(tr.ray.p) - 6} width="20" height="12" rx="2" class="rbox" transform="rotate({-deg(Math.atan2(tr.ray.d[1], tr.ray.d[0]))} {X(tr.ray.p)} {Y(tr.ray.p)})" />{/if}
          </svg>
          <p class="why">Solid line: the main ray; faint lines: the partial reflections (their share of the light sets how bright they are). Dashed: normals. Blue arcs: angles of incidence; orange: angles of refraction.</p>
        </div>
        <div>
          <h3 class="gh">Interface by interface</h3>
          <div class="ifaces">
            {#each tr.hits.slice(0, 6) as h, i (i)}
              <div class="iface" class:tir={h.tir}>
                <b>{i + 1}. {h.m1} → {h.m2}</b>
                <span>θ₁ = {ang(h.i)}°{h.tir ? ' > C: totally internally reflected' : `, θ₂ = ${ang(h.t)}°`}{h.i < 0.05 && !h.tir ? ' (along the normal: no bending)' : ''}</span>
                <small>{h.tir ? 'reflected 100%' : `transmitted ${plain((1 - h.R) * 100, 3)}%, reflected ${plain(h.R * 100, 2)}%`}</small>
              </div>
            {/each}
            {#if tr.hits.length > 6}<small class="more">… and {tr.hits.length - 6} more as the ray bounces along</small>{/if}
          </div>
          {#if firstReal && !firstReal.tir}
            <h3 class="gh">Snell’s law at interface {tr.hits.indexOf(firstReal) + 1}</h3>
            <div class="work flat">
              <div class="eq">n₁ sin θ₁ = n₂ sin θ₂</div>
              <div class="eq">{plain(firstReal.n1, 3)} × sin {plain(firstReal.i, 3)}° = {plain(firstReal.n2, 3)} × sin θ₂</div>
              <div class="eq">sin θ₂ = {plain((firstReal.n1 * Math.sin((firstReal.i * Math.PI) / 180)) / firstReal.n2, 3)} → θ₂ = {plain(firstReal.t ?? 0, 3)}°</div>
            </div>
          {/if}
          <p class="why">Reflected shares come from the Fresnel equations <span class="beyond">beyond the spec</span>. The spec point: at every interface a wave is partly transmitted and partly reflected.</p>
        </div>
      </div>
    </section>

    <section class="panel full" aria-label="Measuring the refractive index of a block">
      <div class="ph"><h2>Measuring the refractive index of a glass block</h2></div>
      <div class="cols2">
        <div>
          <ol class="method">
            <li>Put the rectangular block on paper and draw round it. Draw a normal where the ray will enter.</li>
            <li>Shine a narrow ray from a ray box at the block, at angle i to the normal. Mark the ray where it goes in and where it comes out with small crosses.</li>
            <li>Remove the block and join the crosses: this line is the ray inside the block. Measure r with a protractor.</li>
            <li>Repeat for i from 10° to 70°. Plot sin i against sin r: a straight line through the origin with gradient n.</li>
          </ol>
          <div class="ctls row">
            <label class="ctl"><span class="ctl-l">Angle of incidence i <b>{iSet}°</b></span>
              <input class="slider" type="range" min="5" max="80" step="5" bind:value={iSet} /></label>
            <button class="btn primary" type="button" onclick={take}>Take reading</button>
            <button class="btn" type="button" onclick={() => (readings = [])} disabled={!readings.length}>Clear</button>
          </div>
          <table class="rtab">
            <thead><tr><th>i / °</th><th>r / °</th><th>sin i</th><th>sin r</th></tr></thead>
            <tbody>
              {#each readings as x (x.i)}
                <tr><td>{x.i}</td><td>{x.r}</td><td>{Math.sin((x.i * Math.PI) / 180).toFixed(3)}</td><td>{Math.sin((x.r * Math.PI) / 180).toFixed(3)}</td></tr>
              {:else}
                <tr><td colspan="4" class="empty">No readings yet. Pick an angle and take a reading.</td></tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div>
          <div class="plotbox">
            <Plot xr={[0, 1]} yr={[0, 1]} xLabel="sin r" yLabel="sin i" points={sinPts} line={sinPts.length >= 2 ? { m: grad, c: 0 } : null} h={300} label="sin i against sin r, with a line of best fit through the origin" />
          </div>
          <dl class="reads pad nocase">
            <div><dt>Gradient = n{outName === 'water' ? ' (relative to water)' : ''}</dt><dd>{sinPts.length >= 2 ? plain(grad, 3) : '–'}</dd></div>
            <div><dt>True value</dt><dd>{plain(nBlock / nOut, 3)}</dd></div>
          </dl>
          <p class="why">Each r is read to the nearest degree from traces drawn by hand, so the points scatter. Large angles give the most precise values; a thin, sharp ray and a sharp pencil help. With a semicircular block, increase the angle until the ray just grazes the flat face: that angle is C, and n = 1/sin C.</p>
        </div>
      </div>
    </section>
  {/if}

  <section class="panel full explain" aria-label="Key facts">
    <div class="ex-body">
      {#if prefs.mode === 'refract'}
        <h3>Refraction and total internal reflection <small>spec 45–48, 55</small></h3>
        <div class="cols2 bare">
          <p>Light slows down in a denser medium: n = c/v. The frequency is set by the source and never changes, so the wavelength shrinks by the same factor (λ = v/f). When a wave meets the boundary at an angle, one side of each wavefront slows first and the wavefront turns: refraction. Going into a medium with a larger n, the ray bends towards the normal; into a smaller n, away from it.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>n₁ sin θ₁ = n₂ sin θ₂, angles measured from the normal.</li>
            <li>Refractive index n = c/v: {mat.id !== 'custom' && prefs.shape !== 'tank' ? `${mat.name.toLowerCase()} ${mat.n.toFixed(2)}, so light travels at ${sci(C / mat.n)} m s⁻¹ in it.` : `water 1.33, glass about 1.5.`}</li>
            <li>Critical angle: sin C = 1/n (into air); in general sin C = n₂/n₁.</li>
            <li>TIR needs both: going into a lower n, and an angle of incidence greater than C.</li>
            <li>Optical fibres: the cladding has a lower n than the core, so light stays in by TIR; it also protects the core’s surface.</li>
          </ul></div>
        </div>
      {:else if prefs.mode === 'polar'}
        <h3>Plane polarisation <small>spec 49</small></h3>
        <div class="cols2 bare">
          <p>A transverse wave oscillates at right angles to its direction of travel, in any of many planes. Plane-polarised waves oscillate in one plane only. Only transverse waves can be polarised: that is how polarisation shows light is a transverse wave, and why sound (longitudinal) cannot be.</p>
          <div class="facts"><b>Uses and examples</b><ul>
            <li>Light reflected from water or a road is partly polarised; Polaroid sunglasses block that plane and cut the glare.</li>
            <li>Stress analysis: clear plastic between crossed polarisers shows coloured fringes where it is strained.</li>
            <li>Radio and TV transmitters send polarised waves; the receiving aerial must be lined up with them.</li>
            <li>LCD screens use polarising filters on each side of the liquid crystal.</li>
            <li>Crossed polarisers (axes at 90°) let no light through.</li>
          </ul></div>
        </div>
      {:else}
        <h3>Intensity <small>spec 44</small></h3>
        <div class="cols2 bare">
          <p>Intensity is the power per unit area at right angles to the direction the wave travels: I = P/A, in W m⁻². From a small source radiating equally in every direction, the power spreads over a sphere of area 4πr², so I = P/4πr²: double the distance, a quarter of the intensity.</p>
          <div class="facts"><b>Key facts</b><ul>
            <li>I = P/A; unit W m⁻².</li>
            <li>Point source: I ∝ 1/r² (an inverse square law).</li>
            <li>A laser beam keeps nearly the same area, so its intensity hardly falls with distance; that is why even a 1 mW laser is dangerous to the eye.</li>
            <li>Sunlight at the Earth: about 1.4 kW m⁻² above the atmosphere; a solar panel of area A collects about I × A × its efficiency.</li>
          </ul></div>
        </div>
      {/if}
    </div>
  </section>
</main>
