<script lang="ts" module>
  let uid = 0;
  export type Flow = 'conv' | 'electron' | 'off';
</script>

<script lang="ts">
  /* The circuit board: a dotted grid with wires, symbols, labels, meter readouts and moving charge.
     With an editor (Build) it is fully editable:
       drag a part to move it (its wires follow) · tap a switch to open or close it
       drag from a terminal, a wire or (mouse) any grid point to draw a wire; it bends once to make an L
       tap a wire or part to select it.
     Without one (Predict, I–V Lab) it only displays; onpick reports a tap on a part. */
  import Symbol from './Symbol.svelte';
  import { KINDS, LAMPS, LEDS, terminals, key, onSeg, same, type CircuitData, type Part, type Pt } from './parts';
  import type { Solution } from './solve';
  import { BW, BH, type Editor } from './editor.svelte';
  import { meter, ohms, num, si } from './format';

  let { c, sol, ed = null, flow = 'conv', values = true, hide = [], mask = [], focus = null, zoom = 1, fit = false, label = 'Circuit diagram', onpick }: {
    c: CircuitData; sol: Solution; ed?: Editor | null; flow?: Flow; values?: boolean;
    hide?: string[];          // part ids whose meter reading shows “?”
    mask?: string[];          // part ids whose value label shows “?” (an unknown cell)
    focus?: string | null;    // a part to ring (Predict: the meter being asked about)
    zoom?: number; label?: string; onpick?: (id: string) => void;
    fit?: boolean;            // crop to the circuit (display boards); on phones its text is also drawn larger
  } = $props();

  const me = ++uid;
  const S = 40, PAD = 0.9;
  let svg: SVGSVGElement;

  // a fitted board on a phone is drawn small, so its labels and readouts are drawn bigger to stay readable
  let small = $state(false);
  $effect(() => {
    const mq = matchMedia('(max-width: 560px)'), set = () => (small = mq.matches);
    set(); mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  });
  const ts = $derived(fit && small ? 1.75 : 1);

  /* ---------- what to draw ---------- */
  const conn = $derived.by(() => {
    const deg = new Map<string, number>(), pts = new Map<string, Pt>();
    const add = (p: Pt, n = 1) => { const k = key(p); deg.set(k, (deg.get(k) ?? 0) + n); pts.set(k, p); };
    for (const p of c.parts) for (const t of terminals(p)) add(t);
    for (const w of c.wires) { add(w.a); add(w.b); }
    for (const [k, p] of pts) for (const w of c.wires) if (!same(p, w.a) && !same(p, w.b) && onSeg(p, w.a, w.b)) deg.set(k, deg.get(k)! + 2);
    const termKeys = new Set(c.parts.flatMap((p) => terminals(p).map(key)));
    return {
      junctions: [...pts].filter(([k]) => deg.get(k)! >= 3).map(([, p]) => p),
      loose: [...pts].filter(([k]) => deg.get(k) === 1 && termKeys.has(k)).map(([, p]) => p),
    };
  });

  const speed = (i: number) => Math.min(170, 18 + 46 * Math.log10(1 + Math.abs(i) / 1e-3)); // px per second
  const dots = $derived.by(() => {
    if (flow === 'off') return [];
    const out: { a: Pt; b: Pt; dur: number }[] = [];
    const push = (a: Pt, b: Pt, i: number) => {
      if (Math.abs(i) < 1e-6 || !isFinite(i)) return;
      const fwd = (i > 0) === (flow === 'conv');
      out.push({ a: fwd ? a : b, b: fwd ? b : a, dur: 22 / speed(i) });
    };
    for (const w of c.wires) for (const f of sol.flows[w.id] ?? []) push(f.a, f.b, f.i);
    for (const p of c.parts) {
      // no charge crosses a capacitor's gap, and a two-way switch's current shows on its wires
      const r = sol.parts[p.id]; if (!r || p.kind === 'pot' || p.kind === 'voltmeter' || p.kind === 'capacitor' || p.kind === 'switch2') continue;
      const [t0, t1] = terminals(p);
      push(t0, t1, p.kind === 'cell' ? -r.i : r.i);
    }
    return out;
  });

  function valueText(p: Part): string {
    const P = p.p;
    switch (p.kind) {
      case 'cell': return `${num(P.emf ?? 0)} V${(P.r ?? 0) > 0 ? `, r = ${ohms(P.r!)}` : ''}`;
      case 'resistor': case 'varres': case 'pot': return ohms(P.R ?? 0);
      case 'thermistor': return `${P.T} °C`;
      case 'ldr': return `${num(P.lux ?? 0, 2)} lx`;
      case 'lamp': return LAMPS[P.rating ?? '6V'].label.split(',')[0];
      case 'led': return LEDS[P.colour ?? 'red'].label;
      case 'capacitor': return si(P.C ?? 0, 'F', 2).replace(/\.0 /, ' ');
      default: return '';
    }
  }
  const big = (p: Part) => (p.kind === 'ldr' ? 8 : p.kind === 'switch2' ? 16 : p.kind === 'switch' || p.kind === 'led' ? 6 : 0);
  /** How far a part's body reaches across its axis (local y), for its grab area and selection ring. */
  const ext = (k: Part['kind']): [number, number] => (k === 'pot' ? [-20, 42] : k === 'ldr' ? [-28, 28] : k === 'switch2' ? [-42, 42] : [-20, 20]);
  const ch = $derived(9.1 * ts); // width of one label character (15px JetBrains Mono, scaled)
  const isMeter = (p: Part) => p.kind === 'ammeter' || p.kind === 'voltmeter';
  const valueOf = (p: Part) => (mask.includes(p.id) ? '?' : values ? valueText(p) : '');
  const readText = (p: Part) => (hide.includes(p.id) ? '?' : meter(sol.parts[p.id]?.reading ?? 0, p.kind === 'ammeter' ? 'A' : 'V'));
  const readW = (p: Part) => (hide.includes(p.id) ? 36 * ts : readText(p).length * ch + 20 * ts);
  function labelAt(p: Part) {
    if (p.rot % 2 === 0) return { x: p.x * S, y: p.y * S - 20 - 9 * ts - big(p), anchor: 'middle' };
    const right = fit || p.x < BW - 3; // a fitted board grows to fit, so labels can always go right
    return { x: p.x * S + (right ? 1 : -1) * (25 + big(p)), y: p.y * S, anchor: right ? 'start' : 'end' };
  }
  /** A meter's reading sits beside its name: stacked above a horizontal meter, after the name for a vertical one. */
  function readoutAt(p: Part, w: number) {
    const L = labelAt(p);
    if (p.rot % 2 === 0) return { x: p.x * S, y: L.y - 25 * ts - 6 };
    const right = L.anchor === 'start', off = 25 + p.name.length * ch + 10 + w / 2;
    return { x: p.x * S + (right ? off : -off), y: p.y * S };
  }

  /** The viewBox: the whole board, or (fit) just the circuit with its labels and readouts. */
  const box = $derived.by((): [number, number, number, number] => {
    if (!fit || !c.parts.length) return [-PAD * S, -PAD * S, (BW + PAD * 2) * S, (BH + PAD * 2) * S];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const inc = (x: number, y: number) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
    for (const w of c.wires) { inc(w.a[0] * S, w.a[1] * S); inc(w.b[0] * S, w.b[1] * S); }
    for (const p of c.parts) {
      const h = p.rot % 2 === 0;
      inc(p.x * S - (h ? 44 : 30), p.y * S - (h ? 30 : 44)); inc(p.x * S + (h ? 44 : 30), p.y * S + (h ? 30 : 44));
      const L = labelAt(p), v = valueOf(p), tw = (p.name.length + (v ? v.length + 1 : 0)) * ch;
      if (L.anchor === 'middle') { inc(L.x - tw / 2, L.y - 12 * ts); inc(L.x + tw / 2, L.y + 12 * ts); }
      else inc(L.x + (L.anchor === 'start' ? tw : -tw), L.y);
      if (isMeter(p)) { const w = readW(p), R = readoutAt(p, w); inc(R.x - w / 2, R.y - 14 * ts); inc(R.x + w / 2, R.y + 14 * ts); }
    }
    const m = 16;
    return [x0 - m, y0 - m, x1 - x0 + 2 * m, y1 - y0 + 2 * m];
  });

  /* ---------- pointer editing ---------- */
  type Drag =
    | { mode: 'part'; id: string; ox: number; oy: number; pid: number }
    | { mode: 'wire'; from: Pt; to: Pt; first: 'h' | 'v' | null; pid: number; wire: string | null; bg: boolean; moved: boolean };
  let drag = $state<Drag | null>(null);

  function world(e: { clientX: number; clientY: number }): [number, number] {
    const m = svg.getScreenCTM(); if (!m) return [0, 0];
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return [p.x / S, p.y / S];
  }
  const snap = ([x, y]: [number, number]): Pt => [Math.max(0, Math.min(BW, Math.round(x))), Math.max(0, Math.min(BH, Math.round(y)))];

  /** The grid point under a screen position, or null when it is off the board (used by drops from the parts bin). */
  export function gridAt(clientX: number, clientY: number): Pt | null {
    const r = svg.getBoundingClientRect();
    if (clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
    return snap(world({ clientX, clientY }));
  }

  function capture(e: PointerEvent) { try { svg.setPointerCapture(e.pointerId); } catch { /* not capturable */ } }

  function partDown(e: PointerEvent, p: Part) {
    if (e.button > 0) return;
    e.stopPropagation();
    if (!ed) { onpick?.(p.id); return; }
    capture(e);
    const [wx, wy] = world(e);
    ed.select({ t: 'part', id: p.id });
    ed.beginDrag(p.id);
    drag = { mode: 'part', id: p.id, ox: wx - p.x, oy: wy - p.y, pid: e.pointerId };
  }
  function wireStart(e: PointerEvent, from: Pt, wire: string | null, bg = false) {
    if (!ed || e.button > 0) return;
    e.stopPropagation();
    capture(e);
    drag = { mode: 'wire', from, to: from, first: null, pid: e.pointerId, wire, bg, moved: false };
  }
  function wireDown(e: PointerEvent, id: string) {
    if (!ed) return;
    wireStart(e, snap(world(e)), id);
  }
  function bgDown(e: PointerEvent) {
    if (!ed) return;
    if (e.pointerType === 'mouse') wireStart(e, snap(world(e)), null, true);
  }
  function move(e: PointerEvent) {
    const d = drag; if (!d || e.pointerId !== d.pid || !ed) return;
    const [wx, wy] = world(e);
    if (d.mode === 'part') { ed.dragTo(Math.round(wx - d.ox), Math.round(wy - d.oy)); return; }
    const to = snap([wx, wy]);
    if (!d.first && Math.hypot(wx - d.from[0], wy - d.from[1]) > 0.45) d.first = Math.abs(wx - d.from[0]) >= Math.abs(wy - d.from[1]) ? 'h' : 'v';
    if (!same(to, d.from)) d.moved = true;
    d.to = to;
  }
  function up(e: PointerEvent) {
    const d = drag; if (!d || e.pointerId !== d.pid || !ed) return;
    drag = null;
    if (d.mode === 'part') {
      const moved = ed.endDrag();
      if (!moved) { const p = c.parts.find((q) => q.id === d.id); if (p?.kind === 'switch' || p?.kind === 'switch2') ed.toggle(p.id); }
      return;
    }
    if (d.moved && !same(d.from, d.to)) ed.addWire(d.from, d.to, d.first ?? 'h');
    else if (d.wire) ed.select({ t: 'wire', id: d.wire });
    else ed.select(null);
  }
  function cancel() { if (drag?.mode === 'part') ed?.endDrag(); drag = null; }

  const draft = $derived.by(() => {
    const d = drag; if (!d || d.mode !== 'wire' || !d.moved) return null;
    const { from: a, to: b } = d;
    const pts: Pt[] = a[0] === b[0] || a[1] === b[1] ? [a, b] : [a, (d.first ?? 'h') === 'h' ? [b[0], a[1]] : [a[0], b[1]], b];
    return pts.map((p) => `${p[0] * S},${p[1] * S}`).join(' ');
  });

  // tapping the empty board on a touch screen clears the selection (a mouse press there starts a wire instead)
  function bgClick(e: MouseEvent) { if (ed && (e as PointerEvent).pointerType !== 'mouse' && !drag) ed.select(null); }

  const sel = $derived(ed?.sel ?? null);
</script>

<div class="board-wrap" class:editable={!!ed} style:--z={zoom}>
  <svg bind:this={svg} class="board" viewBox={box.join(' ')} role="img" aria-label={label}
    onpointermove={move} onpointerup={up} onpointercancel={cancel} onlostpointercapture={() => { if (drag) cancel(); }}>
    <defs>
      <pattern id="grid-{me}" width={S} height={S} patternUnits="userSpaceOnUse" x={-S / 2} y={-S / 2}>
        <circle cx={S / 2} cy={S / 2} r="1.6" class="gdot" />
      </pattern>
    </defs>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <rect class="bg" x={box[0]} y={box[1]} width={box[2]} height={box[3]} fill="url(#grid-{me})"
      onpointerdown={bgDown} onclick={bgClick} />

    <!-- wires -->
    {#each c.wires as w (w.id)}
      <line class="wire" class:sel={sel?.t === 'wire' && sel.id === w.id} x1={w.a[0] * S} y1={w.a[1] * S} x2={w.b[0] * S} y2={w.b[1] * S} />
    {/each}
    {#if draft}<polyline class="wire draft" points={draft} />{/if}

    <!-- moving charge -->
    <g class="flowdots" class:electron={flow === 'electron'} aria-hidden="true">
      {#each dots as d, i (i + ':' + d.a + d.b)}
        <line x1={d.a[0] * S} y1={d.a[1] * S} x2={d.b[0] * S} y2={d.b[1] * S} style:animation-duration="{d.dur.toFixed(3)}s" />
      {/each}
    </g>

    <!-- wire hit areas (above the dots so a wire can be grabbed anywhere) -->
    {#if ed}
      {#each c.wires as w (w.id)}
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <line class="hit" x1={w.a[0] * S} y1={w.a[1] * S} x2={w.b[0] * S} y2={w.b[1] * S} onpointerdown={(e) => wireDown(e, w.id)} />
      {/each}
    {/if}

    {#each conn.junctions as p (key(p))}<circle class="junction" cx={p[0] * S} cy={p[1] * S} r="5.2" />{/each}

    <!-- parts -->
    {#each c.parts as p (p.id)}
      {@const r = sol.parts[p.id]}
      {@const isSel = sel?.t === 'part' && sel.id === p.id}
      {@const [et, eb] = ext(p.kind)}
      <g class="part k-{p.kind}" class:sel={isSel} class:focus={focus === p.id} class:pick={!ed && !!onpick}
        transform="translate({p.x * S} {p.y * S}) rotate({p.rot * 90})">
        {#if isSel || focus === p.id}<rect class="ring" x="-47" y={et - 5} width="94" height={eb - et + 10} rx="10" />{/if}
        <Symbol kind={p.kind} p={p.p} rot={p.rot} bright={r?.bright ?? 0} short={r?.short ?? false} level={p.kind === 'capacitor' ? (r?.v ?? 0) / 12 : 0} />
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <rect class="grab" x="-38" y={et} width="76" height={eb - et} onpointerdown={(e) => partDown(e, p)} />
      </g>
    {/each}

    <!-- terminals: loose ones show as open rings; with an editor every terminal starts a wire -->
    {#each conn.loose as p (key(p))}<circle class="loose" cx={p[0] * S} cy={p[1] * S} r="4.4" />{/each}
    {#if ed}
      {#each c.parts as p (p.id)}
        {#each terminals(p) as t, ti (ti)}
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <circle class="term" cx={t[0] * S} cy={t[1] * S} r="11" onpointerdown={(e) => wireStart(e, t, null)} />
        {/each}
      {/each}
    {/if}

    <!-- labels and meter readouts (never rotated) -->
    {#each c.parts as p (p.id)}
      {@const L = labelAt(p)}
      {@const v = valueOf(p)}
      <text class="lbl" x={L.x} y={L.y} text-anchor={L.anchor} style:font-size="{15 * ts}px"><tspan class="nm">{p.name}</tspan>{#if v}<tspan class="val" dx={6 * ts}>{v}</tspan>{/if}</text>
      {#if isMeter(p)}
        {@const hidden = hide.includes(p.id)}
        {@const w = readW(p)}
        {@const R = readoutAt(p, w)}
        <g class="readout" class:ask={hidden} transform="translate({R.x} {R.y})">
          <rect x={-w / 2} y={-14 * ts} width={w} height={28 * ts} rx={14 * ts} />
          <text style:font-size="{(hidden ? 17 : 15) * ts}px">{readText(p)}</text>
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .board-wrap{overflow:auto;border-radius:var(--r-md);scrollbar-width:thin;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
  .board{display:block;width:calc(100% * var(--z,1));height:auto}
  .bg{fill-opacity:1}
  :global(.gdot){fill:color-mix(in srgb,var(--ink) 22%,transparent)}
  .wire{stroke:var(--ink);stroke-width:3;stroke-linecap:round;fill:none}
  .wire.sel{stroke:var(--accent);stroke-width:4}
  .wire.draft{stroke:var(--accent);stroke-dasharray:7 8;stroke-width:3;stroke-linejoin:round}
  .hit{stroke:transparent;stroke-width:18;stroke-linecap:round;cursor:pointer;touch-action:none}
  .junction{fill:var(--ink)}
  .loose{fill:var(--solid);stroke:var(--bad);stroke-width:2}
  .term{fill:transparent;cursor:crosshair;touch-action:none}
  .term:hover{fill:color-mix(in srgb,var(--accent) 22%,transparent);stroke:var(--accent);stroke-width:1.5}
  .grab{fill:transparent}
  .editable .grab{cursor:grab;touch-action:none}
  .editable .k-switch .grab,.editable .k-switch2 .grab{cursor:pointer}
  .pick .grab{cursor:pointer}
  .ring{fill:var(--accent-soft);stroke:var(--accent);stroke-width:1.6;stroke-dasharray:5 4}
  .focus .ring{stroke-dasharray:none;animation:ringpulse 1.6s ease-in-out infinite}
  @keyframes ringpulse{50%{fill:color-mix(in srgb,var(--accent) 28%,transparent)}}
  .flowdots line{stroke:var(--accent);stroke-width:6.5;stroke-linecap:round;stroke-dasharray:0 22;animation:flowdash linear infinite;pointer-events:none}
  .flowdots.electron line{stroke:var(--cond)}
  @keyframes flowdash{to{stroke-dashoffset:-22}}
  .lbl{font:600 15px var(--f-mono);fill:var(--ink);dominant-baseline:central;pointer-events:none}
  .lbl .val{fill:var(--muted);font-weight:500}
  .readout rect{fill:var(--ink)}
  .readout text{font:700 15px var(--f-mono);fill:var(--bg);text-anchor:middle;dominant-baseline:central;font-variant-numeric:tabular-nums}
  .readout.ask rect{fill:var(--accent)}
  .readout.ask text{fill:var(--accent-ink)}
  @media (prefers-reduced-motion: reduce){ .flowdots line{stroke-dasharray:0 22} }
</style>
