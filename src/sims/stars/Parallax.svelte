<script lang="ts" module>
  export interface PxPrefs { star: string; d: number; month: number }
</script>

<script lang="ts">
  /* Parallax: the Earth goes round the Sun; a nearby star seems to shift against the far-away background stars. Left,
     the view from above (angles hugely exaggerated); right, what the telescope sees in January and July. The
     parallax angle p is the angle the radius of the Earth's orbit (1 AU) makes at the star, so d = 1 AU / tan p,
     or, in parsecs, d = 1/p with p in arcseconds. */
  import { onDestroy } from 'svelte';
  import { STARS, starById, short, sci, plain, AU, PC, LY, bbCss } from './data';
  import { RM } from '../../lib/util';
  import { frameReady } from '../../lib/perf';

  let { prefs, hidden: off = false }: { prefs: PxPrefs; hidden?: boolean } = $props();

  const near = STARS.filter((s) => s.d > 0).sort((a, b) => a.d - b.d);
  const custom = $derived(prefs.star === 'custom');
  const d = $derived(custom ? prefs.d : starById(prefs.star)?.d ?? 1.3);   // pc
  const p = $derived(1 / d);                                                   // arcseconds
  const pRad = $derived((p / 3600) * (Math.PI / 180));
  const name = $derived(custom ? 'The star' : starById(prefs.star)?.name ?? 'The star');
  const T = $derived(custom ? 5000 : starById(prefs.star)?.T ?? 5000);

  /* ---------- the orbit ---------- */
  let playing = $state(false);
  let raf = 0, last = 0;
  function loop(t: number) {
    const g = frameReady(t, last);
    if (g !== 'go') { if (g === 'hidden') last = t; raf = requestAnimationFrame(loop); return; }
    const dt = Math.min(0.05, (t - last) / 1000); last = t;
    prefs.month = (prefs.month + dt * 1.6) % 12;
    raf = requestAnimationFrame(loop);
  }
  function toggle() {
    if (playing) { playing = false; cancelAnimationFrame(raf); return; }
    if (RM) { prefs.month = prefs.month < 6 ? 6 : 0; return; }
    playing = true; last = performance.now(); raf = requestAnimationFrame(loop);
  }
  export function setOrbiting(on: boolean) {
    if (on === playing) return;
    toggle();
  }
  export function isOrbiting() { return playing; }
  $effect(() => { if (off && playing) { playing = false; cancelAnimationFrame(raf); } });
  onDestroy(() => cancelAnimationFrame(raf));

  // view from above, not to scale: the star is drawn far closer than it is, so the shift is visible at all
  const W = 520, H = 460, cx = 260, cy = 360, R0 = 70;
  const sy = $derived(cy - (150 + 55 * Math.log10(d + 1)));     // the star's height on the drawing
  const BGY = 26;                                                // the background stars' line
  const theta = $derived(((prefs.month - 3) / 12) * Math.PI * 2); // Jan on the left, Jul on the right
  const ex = $derived(cx + R0 * Math.cos(theta + Math.PI)), ey = $derived(cy + R0 * Math.sin(theta + Math.PI) * 0.55);
  // where the line from the Earth through the star meets the background
  const proj = (x: number, y: number) => x + ((cx - x) * (BGY - y)) / (sy - y);
  const hit = $derived(proj(ex, ey));
  const jan = $derived(proj(cx - R0, cy)), jul = $derived(proj(cx + R0, cy));
  const angleDraw = $derived(Math.atan2(R0, cy - sy)); // the drawn half-angle at the star (exaggerated)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const BG = [[40, 12], [92, 30], [150, 8], [205, 26], [300, 14], [352, 32], [410, 10], [470, 24], [500, 6], [20, 30], [255, 34], [130, 40]];

  /* ---------- the telescope view: shift ∝ p, scaled so Proxima moves a good way ---------- */
  const shift = $derived(Math.cos(theta + Math.PI) * -1);   // -1 in Jan … +1 in Jul
  const amp = $derived(Math.max(6, Math.min(120, 150 * p)));
  const fmtP = (x: number) => (x >= 0.01 ? `${plain(x)}″` : `${plain(x * 1000)} mas`);
  const limit = $derived(p < 1e-5 ? 'too small even for Gaia' : p < 0.01 ? 'needs a space telescope such as Gaia' : 'measurable from the ground');
</script>

<div class="dgrid px" hidden={off}>
  <section class="panel stage" aria-label="Parallax">
    <div class="stage-head">
      <div class="label-chip"><small>Seen from above</small><span>Angles exaggerated · not to scale</span></div>
      <div class="stage-tools">
        <button class="btn" type="button" onclick={toggle}>{playing ? 'Pause' : 'Orbit'}</button>
      </div>
    </div>
    <div class="pxwrap">
      <svg class="pxsvg" viewBox="0 0 {W} {H}" role="img" aria-label="The Earth’s orbit, the nearby star and the background stars">
        <!-- background stars -->
        <rect x="0" y="0" width={W} height="46" fill="color-mix(in srgb, var(--ink) 4%, transparent)" />
        {#each BG as [x, y], i (i)}<circle cx={x} cy={y} r={i % 3 ? 1.8 : 2.6} fill="var(--muted)" />{/each}
        <text class="lab muted" x={W - 8} y="58" text-anchor="end">very distant stars (they don’t appear to move)</text>
        <!-- sight lines in January and July -->
        <path d="M{cx - R0} {cy} L{jan} {BGY}" class="sight jan" />
        <path d="M{cx + R0} {cy} L{jul} {BGY}" class="sight jul" />
        <circle cx={jan} cy={BGY} r="5" class="ghost jan" />
        <circle cx={jul} cy={BGY} r="5" class="ghost jul" />
        <!-- now -->
        <path d="M{ex} {ey} L{hit} {BGY}" class="sight now" />
        <!-- baseline and the parallax angle -->
        <path d="M{cx} {cy} L{cx} {sy}" class="base" />
        <path d="M{cx} {cy} H{cx + R0}" class="au" />
        <text class="lab amph" x={cx + R0 / 2} y={cy + 16} text-anchor="middle">1 AU</text>
        <path d="M{cx} {sy + 34} A34 34 0 0 0 {cx + 34 * Math.sin(angleDraw)} {sy + 34 * Math.cos(angleDraw)}" class="ang" />
        <text class="lab amph" x={cx + 12} y={sy + 54}>p</text>
        <text class="lab" x={cx - 10} y={(cy + sy) / 2} text-anchor="end">d</text>
        <!-- orbit, Sun, Earth, star -->
        <ellipse cx={cx} cy={cy} rx={R0} ry={R0 * 0.55} class="orbit" />
        <circle cx={cx} cy={cy} r="11" fill={bbCss(5772)} class="sun" />
        <circle cx={cx - R0} cy={cy} r="3" class="mark" /><text class="lab muted" x={cx - R0 - 8} y={cy + 4} text-anchor="end">Jan</text>
        <circle cx={cx + R0} cy={cy} r="3" class="mark" /><text class="lab muted" x={cx + R0 + 8} y={cy + 4}>Jul</text>
        <circle cx={ex} cy={ey} r="6.5" class="earth" />
        <circle cx={cx} cy={sy} r="7" fill={bbCss(T)} class="star" />
        <text class="lab" x={cx + 12} y={sy - 8}>{name}</text>
      </svg>
    </div>
    <div class="playbar">
      <span class="ctl-l month">{MONTHS[Math.floor(prefs.month) % 12]}</span>
      <input class="slider scrub" type="range" min="0" max="11.99" step="0.01" bind:value={prefs.month} aria-label="Time of year" />
    </div>
  </section>

  <aside class="side">
    <section class="panel ctlpanel" aria-label="The star">
      <div class="ph"><h2>The star</h2></div>
      <div class="ctls">
        <label class="ctl"><span class="ctl-l">Star</span>
          <select class="sel" bind:value={prefs.star}>
            {#each near as s (s.id)}<option value={s.id}>{s.name} · {short(s.d)} pc</option>{/each}
            <option value="custom">Choose a distance…</option>
          </select></label>
        {#if custom}
          <label class="ctl"><span class="ctl-l">Distance <b>{short(prefs.d)} pc</b></span>
            <input class="slider" type="range" min="0" max="4" step="0.01" value={Math.log10(prefs.d)} oninput={(e) => (prefs.d = Number((10 ** +e.currentTarget.value).toPrecision(2)))} /></label>
        {/if}
      </div>
    </section>

    <section class="panel tele" aria-label="Telescope view">
      <div class="ph"><h2>Through the telescope</h2></div>
      <svg viewBox="0 0 300 120" class="tscope" role="img" aria-label="The star shifting against the background between January and July">
        <rect x="2" y="2" width="296" height="116" rx="14" class="field" />
        {#each [[30, 30], [80, 92], [140, 20], [210, 70], [260, 30], [120, 104], [280, 100], [50, 60]] as [x, y], i (i)}<circle cx={x} cy={y} r="1.8" fill="#cdd3e6" />{/each}
        <circle cx={150 - amp / 2} cy="60" r="4" class="ghost jan" />
        <circle cx={150 + amp / 2} cy="60" r="4" class="ghost jul" />
        <circle cx={150 + (shift * amp) / 2} cy="60" r="5.5" fill={bbCss(T)} />
        <path d="M{150 - amp / 2} 84 H{150 + amp / 2}" class="span" />
        <text x="150" y="100" class="lab amph" text-anchor="middle">2p</text>
      </svg>
      <p class="why pad2">Over six months the star shifts by 2p against the background. Shift drawn to a common scale: the nearer the star, the bigger the shift.</p>
    </section>

    <section class="panel" aria-label="Working">
      <div class="ph"><h2>Working</h2></div>
      <dl class="reads pad">
        <div><dt>Parallax p</dt><dd>{fmtP(p)}</dd></div>
        <div><dt>Distance</dt><dd>{short(d)} pc</dd></div>
        <div><dt>In metres</dt><dd>{sci(d * PC)} m</dd></div>
        <div><dt>Light-years</dt><dd>{short((d * PC) / LY)} ly</dd></div>
      </dl>
      <div class="work pad2">
        <div class="eq">p = {sci(p / 3600, 3)}° = {sci(pRad)} rad</div>
        <div class="eq">d = 1 AU ÷ tan p = {sci(AU)} ÷ tan({sci(p / 3600, 3)}°) = {sci(AU / Math.tan(pRad))} m</div>
        <div class="eq">or d / pc = 1 ÷ p / arcsec = 1 ÷ {plain(p)} = {short(d)} pc</div>
      </div>
      <p class="why pad2">A parallax of {fmtP(p)} is {limit}. Beyond a few thousand parsecs the angle is too small to measure, so astronomers switch to standard candles.</p>
    </section>
  </aside>
</div>
