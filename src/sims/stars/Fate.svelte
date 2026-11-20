<script lang="ts" module>
  export interface FatePrefs { omega: number; lambda: boolean; H0: number; halo: number }
</script>

<script lang="ts">
  /* The age and fate of the universe, and dark matter.
     Left: how the size of the universe changes with time for different densities. Gravity slows the expansion; if
     the density is above the critical density ρc = 3H₀²/8πG it eventually reverses (a Big Crunch), below it the
     expansion goes on for ever. The age (where the curve meets zero) depends on the density as well as on H₀.
     Right: a spiral galaxy's rotation. Newton's laws say v = √(GM/r), so beyond most of the visible stars the speed
     should fall. It stays flat: there must be a lot more mass we cannot see, dark matter. */
  import { onMount, onDestroy } from 'svelte';
  import Plot from '../circuit/Plot.svelte';
  import { G, MSUN, MPC, YEAR, sci, plain, short, PC } from './data';
  import { RM } from '../../lib/util';

  let { prefs, hidden: off = false }: { prefs: FatePrefs; hidden?: boolean } = $props();

  /* ---------- expansion: a'' = −Ωm/(2a²) + ΩΛ a in units of 1/H₀, starting at a = 1, a' = 1 ---------- */
  function history(Om: number, OL: number) {
    const acc = (a: number) => -Om / (2 * a * a) + OL * a;
    const run = (dt: number, tEnd: number) => {
      const out: [number, number][] = [];
      let a = 1, v = 1, t = 0;
      for (let k = 0; k < 6000 && Math.abs(t) < tEnd; k++) {
        out.push([t, a]);
        // RK4 on (a, v)
        const k1a = v, k1v = acc(a);
        const k2a = v + (dt / 2) * k1v, k2v = acc(a + (dt / 2) * k1a);
        const k3a = v + (dt / 2) * k2v, k3v = acc(a + (dt / 2) * k2a);
        const k4a = v + dt * k3v, k4v = acc(a + dt * k3a);
        a += (dt / 6) * (k1a + 2 * k2a + 2 * k3a + k4a);
        v += (dt / 6) * (k1v + 2 * k2v + 2 * k3v + k4v);
        t += dt;
        if (a <= 0.004 || a > 6) { out.push([t, Math.max(0, a)]); break; }
      }
      return out;
    };
    const back = run(-0.002, 3).reverse();
    const fwd = run(0.004, 4);
    return { pts: [...back, ...fwd.slice(1)], age: -back[0][0] };
  }
  const hub = $derived(1 / ((prefs.H0 * 1e3) / MPC) / YEAR / 1e9);       // 1/H₀ in billions of years
  const toG = (pts: [number, number][]) => pts.map(([t, a]) => [t * hub, a] as [number, number]);
  const mine = $derived(history(prefs.omega, prefs.lambda ? 0.7 : 0));
  const REF = $derived([
    { name: 'open (ρ < ρc)', ...history(0.3, 0), color: 'var(--ch3)' },
    { name: 'flat (ρ = ρc)', ...history(1, 0), color: 'var(--ch4)' },
    { name: 'closed (ρ > ρc)', ...history(2.5, 0), color: 'var(--ch2)' },
  ]);
  const series = $derived([
    ...REF.map((r) => ({ color: r.color, pts: toG(r.pts), name: r.name })),
    { color: 'var(--ch1)', pts: toG(mine.pts), name: 'yours' },
  ]);
  const H0si = $derived((prefs.H0 * 1e3) / MPC);
  const rhoC = $derived((3 * H0si * H0si) / (8 * Math.PI * G));
  const crunch = $derived(mine.pts[mine.pts.length - 1][1] < 0.05);
  const verdict = $derived(prefs.lambda
    ? 'Dark energy pushes the expansion to speed up: observations of distant type Ia supernovae in 1998 showed it is accelerating.'
    : crunch ? 'Denser than critical: gravity stops the expansion and pulls it all back together in a Big Crunch.'
    : prefs.omega > 0.97 && prefs.omega < 1.03 ? 'Exactly critical: the expansion slows for ever but never quite stops.'
    : prefs.omega > 1 ? 'Denser than critical: the expansion will stop and reverse.'
    : 'Less dense than critical: the expansion slows but goes on for ever.');

  /* ---------- rotation curve ---------- */
  const KPC = PC * 1e3;
  const MV = 1e11, A = 3;                 // visible mass (M☉) as a Plummer sphere of scale 3 kpc
  const RC = 4, RH = 30, TRUE_HALO = 2.3; // halo core (kpc), normalising radius, the real halo (×10¹¹ M☉ inside 30 kpc)
  const mVis = (r: number) => MV * r ** 3 / (r * r + A * A) ** 1.5;
  const mHalo = (r: number, m: number) => (m * 1e11 * (r - RC * Math.atan(r / RC))) / (RH - RC * Math.atan(RH / RC));
  const speed = (M: number, r: number) => Math.sqrt((G * M * MSUN) / (r * KPC)) / 1e3; // km s⁻¹
  const rs = Array.from({ length: 121 }, (_, i) => 0.2 + i * 0.29);
  const vis = rs.map((r) => [r, speed(mVis(r), r)] as [number, number]);
  const withHalo = $derived(rs.map((r) => [r, speed(mVis(r) + mHalo(r, prefs.halo), r)] as [number, number]));
  // "observed" points: the true halo, with a little scatter
  const obs = [2, 4, 6, 8, 10, 13, 16, 19, 22, 25, 28, 31, 34].map((r, i) => ({ x: r, y: speed(mVis(r) + mHalo(r, TRUE_HALO), r) * (1 + 0.035 * Math.sin(i * 2.7)) }));
  const fitErr = $derived(Math.sqrt(obs.reduce((s, p) => { const v = speed(mVis(p.x) + mHalo(p.x, prefs.halo), p.x); return s + ((v - p.y) / p.y) ** 2; }, 0) / obs.length));
  const darkFrac = $derived((prefs.halo * 1e11) / (prefs.halo * 1e11 + mVis(30)));

  /* ---------- the galaxy, turning at the speeds above ---------- */
  let cv = $state<HTMLCanvasElement>();
  let raf = 0, visible = true, io: IntersectionObserver | null = null;
  const STARS_N = 1400;
  const pts = Array.from({ length: STARS_N }, (_, i) => {
    const bulge = i < 260;
    const r = bulge ? Math.abs(gauss()) * 2.2 + 0.2 : 2 + Math.random() ** 0.8 * 30;
    const arm = i % 2;
    const a0 = bulge ? Math.random() * Math.PI * 2 : arm * Math.PI + Math.log(r / 2) * 1.6 + gauss() * 0.28;
    return { r, a: a0, hue: bulge ? 0 : Math.random() };
  });
  function gauss() { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random()); }
  function draw(dt: number) {
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const w = cv.width, h = cv.height, s = Math.min(w, h) / 2 / 33;
    ctx.fillStyle = '#04050b';
    ctx.fillRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 6 * s);
    glow.addColorStop(0, 'rgba(255,230,190,.55)'); glow.addColorStop(1, 'rgba(255,230,190,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    for (const p of pts) {
      const v = speed(mVis(p.r) + mHalo(p.r, prefs.halo), p.r);       // km s⁻¹
      p.a += (dt * v) / p.r * 0.012;                                   // shown about 10¹⁵ times faster than real
      const x = w / 2 + Math.cos(p.a) * p.r * s, y = h / 2 + Math.sin(p.a) * p.r * s * 0.62;
      ctx.fillStyle = p.r < 2.6 ? 'rgba(255,220,170,.9)' : p.hue > 0.7 ? 'rgba(160,190,255,.9)' : 'rgba(220,225,255,.7)';
      ctx.fillRect(x, y, p.r < 2.6 ? 1.6 : 1.3, p.r < 2.6 ? 1.6 : 1.3);
    }
  }
  let last = 0;
  function frame(t: number) {
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    draw(RM ? 0 : dt);
    raf = visible && !off ? requestAnimationFrame(frame) : 0;
  }
  function kick() { if (!raf && visible && !off) { last = performance.now(); raf = requestAnimationFrame(frame); } }
  onMount(() => {
    if (!cv) return;
    const dpr = Math.min(2, devicePixelRatio);
    const size = () => { if (!cv) return; cv.width = cv.clientWidth * dpr; cv.height = cv.clientHeight * dpr; draw(0); };
    size();
    const ro = new ResizeObserver(size); ro.observe(cv);
    io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; kick(); }); io.observe(cv);
    return () => { ro.disconnect(); io?.disconnect(); };
  });
  $effect(() => { if (!off) kick(); });
  onDestroy(() => cancelAnimationFrame(raf));
</script>

<div class="dgrid fate" hidden={off}>
  <section class="panel stage" aria-label="The fate of the universe">
    <div class="stage-head">
      <div class="label-chip"><small>Size of the universe</small><span>against time from now</span></div>
    </div>
    <div class="plotbox">
      <Plot xr={[-16, 32]} yr={[0, 3]} xLabel="t / billion years" yLabel="relative size" {series} probe h={320}
        label="Relative size of the universe against time for different densities" />
    </div>
    <div class="keys">
      {#each series as s (s.name)}<span><i style:background={s.color}></i>{s.name}</span>{/each}
    </div>
    <div class="ctls row">
      <label class="ctl"><span class="ctl-l">Density ÷ critical density <b>{plain(prefs.omega, 2)}</b></span>
        <input class="slider" type="range" min="0.1" max="3" step="0.05" bind:value={prefs.omega} /></label>
      <label class="ctl"><span class="ctl-l">H₀ <b>{prefs.H0} km s⁻¹ Mpc⁻¹</b></span>
        <input class="slider" type="range" min="60" max="80" step="1" bind:value={prefs.H0} /></label>
      <button type="button" class="fchip" aria-pressed={prefs.lambda} onclick={() => (prefs.lambda = !prefs.lambda)}>Add dark energy</button>
    </div>
    <dl class="reads three">
      <div><dt>1/H₀</dt><dd>{plain(hub)} billion yr</dd></div>
      <div><dt>Actual age</dt><dd>{plain(mine.age * hub)} billion yr</dd></div>
      <div><dt>Critical density</dt><dd>{sci(rhoC)} kg m⁻³</dd></div>
    </dl>
    <p class="why pad2">{verdict} With more matter the expansion was faster in the past, so the universe is younger than 1/H₀. The critical density, ρc = 3H₀²/8πG, is about {short(rhoC / 1.67e-27, 2)} hydrogen atoms per cubic metre.</p>
  </section>

  <aside class="side">
    <section class="panel" aria-label="Dark matter">
      <div class="ph"><h2>Dark matter: a galaxy’s rotation</h2></div>
      <canvas class="galaxy" bind:this={cv} aria-label="A spiral galaxy turning at the speeds in the graph below"></canvas>
      <div class="plotbox">
        <Plot xr={[0, 36]} yr={[0, 300]} xLabel="r / kpc" yLabel="v / km s⁻¹" points={obs} h={260}
          series={[{ color: 'var(--ch2)', pts: vis, name: 'visible only' }, { color: 'var(--ch1)', pts: withHalo, name: 'with dark matter' }]}
          label="Orbital speed of stars against distance from the centre" />
      </div>
      <div class="keys">
        <span><i style:background="var(--ch2)"></i>visible matter only</span>
        <span><i style:background="var(--ch1)"></i>with your dark matter</span>
        <span><i class="x">×</i>measured</span>
      </div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Dark matter inside 30 kpc <b>{plain(prefs.halo, 2)} × 10¹¹ M☉</b></span>
          <input class="slider" type="range" min="0" max="5" step="0.05" bind:value={prefs.halo} /></label>
      </div>
      <p class="why pad2">{fitErr < 0.06
        ? `A good fit: about ${Math.round(darkFrac * 100)}% of this galaxy’s mass is dark. Across the universe there is about five times as much dark matter as ordinary matter.`
        : 'Orbital speed comes from Newton: GMm/r² = mv²/r, so v = √(GM/r). With only the stars we can see, the outer stars should move more slowly. They don’t: add mass until the curve matches the measurements.'}</p>
    </section>
  </aside>
</div>
