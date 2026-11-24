<script lang="ts" module>
  export interface ScatPrefs {
    view: 'exp' | 'zoom';
    model: 'nuclear' | 'thomson';
    target: string;
    mev: number;       // α kinetic energy / MeV
    t: number;         // foil thickness / μm
    rate: string;      // '1' | '100' | '10000'
    det: number;       // microscope angle / degrees
  }
  export const SCAT: ScatPrefs = { view: 'exp', model: 'nuclear', target: 'au', mev: 7.7, t: 0.4, rate: '100', det: 45 };
</script>

<script lang="ts">
  /* Nucleus: Geiger and Marsden's α-scattering experiment and Rutherford's explanation. Every α fired is sampled from
     Rutherford's law for the chosen foil (scatter.ts), counted in 5° bins and compared with the 1/sin⁴(θ/2)
     prediction; a sample of them (and every strongly deflected one) is flown in the 3D view. */
  import { onDestroy } from 'svelte';
  import View3D from './View3D.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { SLook, ScatterScene } from './scatter3d';
  import type { Stage3D } from './gl';
  import { TARGETS, ALPHA, closest, nucRadius, touches, pMore, perSr, thomsonRms, sample, BIN, NBIN, shell, fm } from './scatter';
  import { E, K, MEV, sci, plain, short } from './data';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false, stats = $bindable([]) }: { prefs: ScatPrefs; hidden?: boolean; stats?: [string, string | number][] } = $props();

  let seen = $state(false);
  $effect(() => { if (!off) seen = true; });

  const tg = $derived(TARGETS.find((x) => x.id === prefs.target) ?? TARGETS[0]);
  const nuclear = $derived(prefs.model === 'nuclear');
  const d = $derived(closest(tg, prefs.mev));
  const nt = $derived(tg.n * prefs.t * 1e-6);
  const rnuc = $derived(nucRadius(tg.A));
  const touch = $derived(touches(tg, prefs.mev));
  const rms = $derived(thomsonRms(tg, prefs.mev, prefs.t * 1e-6));
  const p90 = $derived(nuclear ? pMore(Math.PI / 2, d, nt) : 0);

  /* ---------- firing ---------- */
  const RATE: Record<string, number> = { '1': 12, '100': 1200, '10000': 120000 };
  let counts = $state<number[]>(Array(NBIN).fill(0));
  let fired = $state(0);
  let over90 = $state(0);
  let back = $state(0);           // > 150°
  let playing = $state(!RM);
  let scene: ScatterScene | null = null;
  let carry = 0, drawCarry = 0, bigCarry = 0;

  function reset() { counts = Array(NBIN).fill(0); fired = 0; over90 = 0; back = 0; carry = 0; scene?.clear(); }
  // a different foil, energy or model is a different experiment: start the count again
  let key = '';
  $effect(() => { const k = `${prefs.target}|${prefs.mev}|${prefs.t}|${prefs.model}`; if (k !== key) { key = k; reset(); } });

  let raf = 0, last = 0;
  function step(t: number) {
    const g = frameReady(t, last);
    if (g !== 'go') { if (g === 'hidden') last = t; raf = off ? 0 : requestAnimationFrame(step); return; }
    const dt = Math.min(0.1, (t - last) / 1000); last = t;
    if (playing && prefs.view === 'exp') fireSome(dt);
    raf = off ? 0 : requestAnimationFrame(step);
  }
  function fireSome(dt: number) {
    carry += RATE[prefs.rate] * dt;
    const n = Math.floor(carry);
    carry -= n;
    if (!n) return;
    const c = counts.slice();
    let o90 = 0, b150 = 0;
    const show: { th: number; big: boolean }[] = [];
    drawCarry += Math.min(n, 14 * dt + (prefs.rate === '1' ? n : 0));
    bigCarry = Math.min(bigCarry + 5 * dt, 3);
    for (let i = 0; i < n; i++) {
      const th = sample(nuclear, d, nt, rms);
      const deg = (th * 180) / Math.PI;
      c[Math.min(NBIN - 1, Math.floor(deg / BIN))]++;
      if (deg > 90) o90++;
      if (deg > 150) b150++;
      if (deg > 10 && (deg > 90 || bigCarry >= 1)) { if (deg <= 90) bigCarry--; show.push({ th, big: true }); }
      else if (drawCarry >= 1) { drawCarry--; show.push({ th, big: false }); }
    }
    counts = c; fired += n; over90 += o90; back += b150;
    scene?.fire(show.slice(0, 40));
  }
  function kick() { if (!raf && !off) { last = performance.now(); raf = requestAnimationFrame(step); } }
  $effect(() => { if (!off) kick(); });
  onDestroy(() => cancelAnimationFrame(raf));

  const look = $derived<SLook>({ view: prefs.view, nuclear, rn: rnuc / d, det: prefs.det, touch, playing, speed: 1 });
  function onscene(s: Stage3D<SLook> | null) { scene = s as ScatterScene | null; }

  $effect(() => { stats = [['α fired', short(fired, 3)], ['Over 90°', over90], ['Foil', `${tg.sym}, ${plain(prefs.t, 2)} μm`]]; });

  /* ---------- the graph: counts per steradian against θ, log scale ---------- */
  const W = 520, H = 280, ML = 58, MR = 16, MT = 16, MB = 42, X0 = 10;
  const sx = (deg: number) => ML + ((deg - X0) / (180 - X0)) * (W - ML - MR);
  const pred = $derived(Array.from({ length: 86 }, (_, i) => { const deg = X0 + i * 2; return [deg, perSr((deg * Math.PI) / 180, d, nt, Math.max(fired, 1))] as [number, number]; }));
  const obs = $derived(counts.map((n, i) => ({ deg: i * BIN + BIN / 2, n, v: n / shell(i * BIN, (i + 1) * BIN) })).filter((o) => o.deg > X0 && o.n > 0));
  const yr = $derived.by((): [number, number] => {
    const vals = [...obs.map((o) => o.v), ...(nuclear ? [pred[0][1], pred[pred.length - 1][1]] : [])].filter((v) => v > 0);
    if (!vals.length) return [0, 4];
    const lo = Math.floor(Math.log10(Math.min(...vals)) - 0.3), hi = Math.ceil(Math.log10(Math.max(...vals)) + 0.2);
    return [Math.max(lo, hi - 12), Math.max(hi, lo + 2)];
  });
  const sy = (v: number) => { const l = Math.log10(Math.max(v, 1e-30)); return H - MB - ((l - yr[0]) / (yr[1] - yr[0])) * (H - MT - MB); };
  const predPath = $derived(nuclear ? pred.filter(([, v]) => { const l = Math.log10(v); return l >= yr[0] && l <= yr[1]; }).map(([x, v], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)} ${sy(v).toFixed(1)}`).join('') : '');
  const decades = $derived(Array.from({ length: yr[1] - yr[0] + 1 }, (_, i) => yr[0] + i));
  const supN = (n: number) => String(n).replace('-', '⁻').split('').map((ch) => '⁰¹²³⁴⁵⁶⁷⁸⁹'['0123456789'.indexOf(ch)] ?? ch).join('');

  /* the microscope's reading */
  const binAt = $derived(Math.min(NBIN - 1, Math.floor(prefs.det / BIN)));
  const atObs = $derived(counts[binAt]);
  const atPred = $derived(nuclear && prefs.det >= BIN ? fired * (pMore((binAt * BIN * Math.PI) / 180, d, nt) - pMore(((binAt + 1) * BIN * Math.PI) / 180, d, nt)) : NaN);

  const rate = (p: number) => (p <= 0 ? 'never' : p >= 0.5 ? `${plain(p * 100, 2)}%` : `1 in ${short(1 / p, 2)}`);
  const ek = $derived(prefs.mev * MEV);
</script>

<main class="layout" hidden={off}>
  <section class="panel stage" aria-label="The α-scattering experiment">
    <div class="stage-head">
      <div class="label-chip"><small>{prefs.view === 'exp' ? 'Geiger–Marsden experiment' : 'Close-up'}</small><span>{prefs.view === 'exp' ? `α particles on ${tg.name} foil` : nuclear ? `One ${tg.name} nucleus` : 'One plum-pudding atom'}</span></div>
      <div class="stage-tools">
        <Seg label="View" options={[['exp', 'The experiment', 'Experiment'], ['zoom', 'Zoom into one atom', 'Close-up']]} bind:value={prefs.view} />
      </div>
    </div>
    <div class="spacebox">
      {#if seen}
        <View3D load={() => import('./scatter3d').then((m) => m.ScatterScene)} {look} {onscene}
          label="3D view of α particles fired at a thin gold foil, with a zinc-sulphide screen and microscope round it. Drag to turn it.">
          {#if prefs.view === 'exp'}
            <div class="hud tl"><b>{short(fired, 3)} α fired</b><span>{over90} bounced back by more than 90°</span></div>
            <div class="hud bl">Every α is counted; a sample is drawn, plus every one deflected by more than 10°. Nuclei not to scale.</div>
          {:else if nuclear}
            <div class="hud tl"><b>d = {fm(d)}</b><span>{tg.name} nucleus: radius ≈ {fm(rnuc)} · atom ≈ {sci(tg.R)} m</span></div>
            <div class="hud bl">Paths are the true Coulomb hyperbolas, to scale with d (slow motion)</div>
          {:else}
            <div class="hud tl"><b>Plum-pudding atom</b><span>deflection per atom ≈ {sci((d / tg.R) * 57.3, 2)}°</span></div>
            <div class="hud bl">The charge is spread over the whole atom, so its field is weak everywhere</div>
          {/if}
          {#if touch && nuclear}<div class="hud tr warn"><b>Touching the nucleus</b><span>the strong force acts: Coulomb law alone fails</span></div>{/if}
        </View3D>
      {:else}
        <div class="space"></div>
      {/if}
    </div>
    <div class="playbar">
      <button class="btn primary big playbtn" type="button" onclick={() => (playing = !playing)}>{playing ? 'Pause' : prefs.view === 'exp' ? 'Fire' : 'Play'}</button>
      <Seg label="Rate" options={[['1', '12 α/s', '×1'], ['100', '1200 α/s', '×100'], ['10000', '120 000 α/s', '×10⁴']]} bind:value={prefs.rate} />
      <button class="btn" type="button" onclick={reset}>Clear counts</button>
    </div>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Set-up">
      <div class="ph"><h2>Set-up</h2></div>
      <div class="ctls">
        <div class="ctl">
          <span class="ctl-l">Model of the atom</span>
          <Seg label="Model" options={[['nuclear', 'Nuclear (Rutherford)', 'Nuclear'], ['thomson', 'Plum pudding (Thomson)', 'Pudding']]} bind:value={prefs.model} />
        </div>
        <div class="ctl">
          <span class="ctl-l">Foil</span>
          <div class="picker flat" role="group" aria-label="Foil">
            {#each TARGETS as x (x.id)}
              <button type="button" class="fchip" aria-pressed={prefs.target === x.id} onclick={() => (prefs.target = x.id)}>{x.name} ({x.sym}, Z = {x.Z})</button>
            {/each}
          </div>
        </div>
        <label class="ctl"><span class="ctl-l">α kinetic energy <b>{plain(prefs.mev, 2)} MeV</b></span>
          <input class="slider" type="range" min="4" max="8" step="0.1" bind:value={prefs.mev} /></label>
        <label class="ctl"><span class="ctl-l">Foil thickness <b>{plain(prefs.t, 2)} μm ≈ {short(prefs.t * 1e-6 / (2 * tg.R), 2)} atoms</b></span>
          <input class="slider" type="range" min="0.2" max="2" step="0.1" bind:value={prefs.t} /></label>
        <label class="ctl"><span class="ctl-l">Microscope at <b>θ = {prefs.det}°</b></span>
          <input class="slider" type="range" min="0" max="180" step="1" bind:value={prefs.det} /></label>
      </div>
      <dl class="reads pad">
        <div><dt>Counted at {binAt * BIN}–{(binAt + 1) * BIN}°</dt><dd>{atObs}</dd></div>
        <div><dt>{nuclear ? 'Rutherford' : 'Thomson'} predicts</dt><dd>{prefs.det < BIN ? 'in the beam' : nuclear ? plain(atPred, 2) : '≈ 0'}</dd></div>
        <div><dt>Over 90°, observed</dt><dd>{fired ? rate(over90 / fired) : '–'}</dd></div>
        <div><dt>Over 90°, predicted</dt><dd>{nuclear ? rate(p90) : 'never'}</dd></div>
        <div><dt>Closest approach d</dt><dd>{sci(d)} m</dd></div>
        <div><dt>{nuclear ? 'Nucleus radius' : 'Typical deflection'}</dt><dd>{nuclear ? `${sci(rnuc, 2)} m` : `${plain((rms * 180) / Math.PI, 2)}°`}</dd></div>
      </dl>
    </section>
    <section class="panel" aria-label="Working">
      <div class="ph"><h2>Closest approach</h2></div>
      <div class="work">
        <div class="eq">Head-on, the α stops where all its Eₖ has become electric potential energy: Eₖ = kQq/d</div>
        <div class="eq">Eₖ = {plain(prefs.mev, 2)} MeV × 1.60 × 10⁻¹³ J MeV⁻¹ = {sci(ek)} J</div>
        <div class="eq">d = kQq/Eₖ = 8.99 × 10⁹ × ({tg.Z} × 1.60 × 10⁻¹⁹) × (2 × 1.60 × 10⁻¹⁹) ÷ {sci(ek)} = {sci((K * tg.Z * E * 2 * E) / ek)} m</div>
        <div class="eq">The nucleus must be smaller than this: about {short(tg.R / d, 2)} times smaller than the atom ({sci(tg.R, 2)} m).</div>
        <div class="eq">Nuclear radius r = r₀A^⅓ = 1.2 × 10⁻¹⁵ × {tg.A}^⅓ = {sci(rnuc, 2)} m <span class="beyond">beyond the spec</span></div>
      </div>
    </section>
  </aside>

  <section class="panel full" aria-label="Results">
    <div class="ph"><h2>Counts against angle</h2></div>
    <div class="cols2">
      <div>
        <svg class="logplot" viewBox="0 0 {W} {H}" role="img" aria-label="Number of α particles per steradian against scattering angle, logarithmic scale, with Rutherford's prediction">
          {#each decades as dk (dk)}
            <line class="gl" x1={ML} x2={W - MR} y1={sy(10 ** dk)} y2={sy(10 ** dk)} />
            <text class="tk" x={ML - 6} y={sy(10 ** dk)} text-anchor="end">10{supN(dk)}</text>
          {/each}
          {#each [10, 30, 60, 90, 120, 150, 180] as t (t)}
            <line class="gl" x1={sx(t)} x2={sx(t)} y1={MT} y2={H - MB} />
            <text class="tk" x={sx(t)} y={H - MB + 15} text-anchor="middle">{t}°</text>
          {/each}
          <line class="ax" x1={ML} x2={W - MR} y1={H - MB} y2={H - MB} />
          <line class="ax" x1={ML} x2={ML} y1={MT} y2={H - MB} />
          <text class="al" x={W - MR} y={H - 6} text-anchor="end">scattering angle θ</text>
          <text class="al" x={12} y={MT + 2} transform="rotate(-90 12 {MT + 2})" text-anchor="end">α per steradian (log scale)</text>
          {#if predPath}<path class="pred" d={predPath} />{/if}
          {#each obs as o (o.deg)}
            {#if Math.log10(o.v) >= yr[0]}<path class="pt" d="M{sx(o.deg) - 4.5} {sy(o.v) - 4.5}l9 9m0 -9l-9 9" />{/if}
          {/each}
          <line class="det" x1={sx(Math.max(X0, prefs.det))} x2={sx(Math.max(X0, prefs.det))} y1={MT} y2={H - MB} />
          {#if nuclear && !fired}<text class="msg" x={(ML + W - MR) / 2} y={MT + 22} text-anchor="middle">Dashed: the prediction per α fired. Press Fire to count.</text>{/if}
          {#if !nuclear}<text class="msg" x={(ML + W - MR) / 2} y={(MT + H - MB) / 2} text-anchor="middle">Plum pudding: nothing beyond a few degrees</text>{/if}
        </svg>
        <p class="why lg">Crosses: what has been counted. {nuclear ? 'Dashed: Rutherford’s prediction, ∝ 1/sin⁴(θ/2).' : ''} Each step up the axis is ten times as many: the count falls by about 10⁴ from 10° to 180°. Below 10° (off the graph) the α hardly notice the foil.</p>
      </div>
      <div class="concl">
        <h3 class="gh">What the results show</h3>
        <ol>
          <li><b>Most α go straight through, barely deflected.</b><span>The atom is mostly empty space.</span></li>
          <li><b>A few are deflected through large angles.</b><span>The positive charge is concentrated in a tiny region (the α, also positive, is repelled by it); a spread-out charge could never turn an α so far.</span></li>
          <li><b>A very few (about {nuclear ? rate(p90) : '1 in tens of thousands'} here) bounce back by more than 90°.</b><span>The nucleus is tiny, positive and contains most of the atom’s mass: it barely recoils.</span></li>
        </ol>
        <p class="why">Rutherford, 1911: “It was quite the most incredible event that has ever happened to me in my life. It was almost as incredible as if you fired a 15-inch shell at a piece of tissue paper and it came back and hit you.”</p>
      </div>
    </div>
  </section>

  <section class="panel full" aria-label="Nuclide notation and key facts">
    <div class="cols2 ncols">
      <div>
        <h3 class="gh">Nuclide notation</h3>
        <div class="nuclides">
          {#each [{ A: tg.A, Z: tg.Z, X: tg.sym, name: `${tg.name}-${tg.A}` }, { A: ALPHA.A, Z: ALPHA.Z, X: ALPHA.sym, name: 'α particle (helium-4 nucleus)' }] as n (n.name)}
            <div class="nuc">
              <span class="nsym"><span class="az"><span class="a">{n.A}</span><span class="z">{n.Z}</span></span>{n.X}</span>
              <dl>
                <div><dt>A, nucleon (mass) number</dt><dd>{n.A}</dd></div>
                <div><dt>Z, proton (atomic) number</dt><dd>{n.Z}</dd></div>
                <div><dt>N = A − Z, neutrons</dt><dd>{n.A - n.Z}</dd></div>
              </dl>
              <small>{n.name}</small>
            </div>
          {/each}
        </div>
        <p class="why">Isotopes: the same proton number Z (so the same element, with the same chemistry) but different numbers of neutrons, so different nucleon numbers A. {tg.iso}</p>
      </div>
      <div class="facts">
        <b>Key facts</b>
        <ul>
          <li>An α particle is a helium nucleus, ⁴₂He: two protons and two neutrons, charge +2e.</li>
          <li>The experiment is done in a vacuum: α particles are stopped by a few centimetres of air.</li>
          <li>The foil must be very thin, so each α is deflected by (at most) one nucleus.</li>
          <li>Closest approach: Eₖ = kQq/d. Doubling the α’s energy halves d, so faster α probe closer to the nucleus.</li>
          <li>The results ruled out Thomson’s plum-pudding model and gave the nuclear model: a tiny, dense, positive nucleus (about 10⁻¹⁵–10⁻¹⁴ m) inside an atom about 10⁻¹⁰ m across, with electrons around it.</li>
        </ul>
      </div>
    </div>
  </section>
</main>
