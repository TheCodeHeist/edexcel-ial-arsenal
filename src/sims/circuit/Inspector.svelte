<script lang="ts">
  /* The inspector beside the Build board. With a part selected: its settings and what it is doing now
     (p.d., current, power, resistance). With a wire: the current in it. With nothing: every meter reading and
     how to use the board. */
  import Seg from '../../components/ui/Seg.svelte';
  import { KINDS, LAMPS, thermR, ldrR, type Control, type Part, type Props } from './parts';
  import type { Solution } from './solve';
  import type { Editor } from './editor.svelte';
  import { si, num, ohms, meter } from './format';

  let { ed, sol }: { ed: Editor; sol: Solution } = $props();

  const part = $derived(ed.part);
  const wire = $derived(ed.wire);
  const R = $derived(part ? sol.parts[part.id] : null);
  const clean = (x: number) => (Math.abs(x) < 1e-6 ? 0 : x);

  /* log sliders run 0–1000 and snap to 2 significant figures */
  const toLog = (v: number, c: Control) => (1000 * Math.log(v / c.min!)) / Math.log(c.max! / c.min!);
  const fromLog = (t: number, c: Control) => Number((c.min! * Math.pow(c.max! / c.min!, t / 1000)).toPrecision(2));

  function shown(c: Control, v: number) {
    if (c.key === 'wiper') return Math.round(v * 100) + '%';
    if (c.key === 'R' || c.key === 'r') return ohms(v);
    if (c.key === 'lux') return num(v, 2) + ' lx';
    return num(v) + ' ' + c.unit;
  }
  function set(p: Part, k: keyof Props, v: Props[keyof Props]) { ed.setProp(p.id, k, v); }

  const rows = $derived.by((): [string, string][] => {
    if (!part || !R) return [];
    const P = part.p;
    switch (part.kind) {
      case 'cell': {
        const r = P.r ?? 0, I = clean(R.i);
        return [['Terminal p.d.', si(clean(R.v), 'V')], ['Current', si(I, 'A')], ['Lost volts (Ir)', si(clean(I * r), 'V')], ['Power to circuit', si(clean(R.p), 'W')]];
      }
      case 'ammeter': return [['Reading', meter(R.reading ?? 0, 'A')], ['p.d. across it', '0 V (ideal)']];
      case 'voltmeter': return [['Reading', meter(R.reading ?? 0, 'V')], ['Current through it', '0 A (ideal)']];
      case 'switch': return [['State', P.on ? 'Closed' : 'Open'], ['Current', si(clean(R.i), 'A')], ['p.d. across it', si(clean(R.v), 'V')]];
      default: {
        const out: [string, string][] = [['p.d.', si(clean(R.v), 'V')], ['Current', si(clean(R.i), 'A')], ['Power', si(clean(R.p), 'W')]];
        if (part.kind === 'thermistor') out.push(['Resistance', ohms(thermR(P.T ?? 20))]);
        else if (part.kind === 'ldr') out.push(['Resistance', ohms(ldrR(P.lux ?? 100))]);
        else if (part.kind === 'lamp' || part.kind === 'diode' || part.kind === 'led') out.push(['Resistance now (V/I)', Math.abs(R.i) < 1e-6 ? 'very large' : ohms(Math.abs(R.R ?? 0))]);
        if (part.kind === 'lamp') out.push(['Brightness', Math.round((R.bright ?? 0) * 100) + '% of rated power']);
        return out;
      }
    }
  });

  const meters = $derived(ed.c.parts.filter((p) => p.kind === 'ammeter' || p.kind === 'voltmeter'));
  const wireI = $derived(wire ? Math.max(0, ...(sol.flows[wire.id] ?? []).map((f) => Math.abs(f.i))) : 0);
</script>

<div class="insp">
  {#if part && R}
    {@const K = KINDS[part.kind]}
    {#key part.id}
      <div class="ins-head swap">
        <div><div class="ins-name">{part.name}</div><p class="ins-kind">{K.label}{part.kind === 'lamp' ? ` · ${LAMPS[part.p.rating ?? '6V'].label}` : ''}</p></div>
        <div class="ins-acts">
          <button class="btn" type="button" onclick={() => ed.rotate()} aria-label="Rotate (R)">Rotate</button>
          <button class="btn" type="button" onclick={() => ed.remove()} aria-label="Delete (Delete key)">Delete</button>
        </div>
      </div>
    {/key}
    <p class="why ins-note">{K.note}</p>
    {#if R.short}<p class="warn">Short circuit: the terminals are joined by a path with almost no resistance, so a very large current flows.</p>{/if}

    {#each K.controls as c (c.key)}
      <div class="ctl">
        {#if c.type === 'range' || c.type === 'log'}
          {@const v = Number(part.p[c.key] ?? 0)}
          <label class="ctl-l" for="ctl-{part.id}-{c.key}"><span>{c.label}</span><b>{shown(c, v)}</b></label>
          {#if c.type === 'range'}
            <input id="ctl-{part.id}-{c.key}" class="slider" type="range" min={c.min} max={c.max} step={c.step} value={v}
              oninput={(e) => set(part, c.key, Number(e.currentTarget.value))} />
          {:else}
            <input id="ctl-{part.id}-{c.key}" class="slider" type="range" min="0" max="1000" step="1" value={toLog(Math.max(v, c.min!), c)}
              oninput={(e) => set(part, c.key, fromLog(Number(e.currentTarget.value), c))} />
          {/if}
        {:else if c.type === 'toggle'}
          <div class="ctl-l"><span>{c.label}</span></div>
          <Seg label={c.label} options={[['on', 'Closed'], ['off', 'Open']]} value={part.p.on ? 'on' : 'off'} onchange={(v) => set(part, 'on', v === 'on')} />
        {:else if c.type === 'select' && c.options}
          <div class="ctl-l"><span>{c.label}</span></div>
          <div class="chiprow" role="group" aria-label={c.label}>
            {#each c.options as [v, text] (v)}
              <button type="button" class="fchip" aria-pressed={String(part.p[c.key]) === v} onclick={() => set(part, c.key, v as never)}>{text}</button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    <dl class="reads">
      {#each rows as [k, v] (k)}<div><dt>{k}</dt><dd>{v}</dd></div>{/each}
    </dl>
  {:else if wire}
    <div class="ins-head swap">
      <div><div class="ins-name">Wire</div><p class="ins-kind">Connecting lead, zero resistance</p></div>
      <div class="ins-acts"><button class="btn" type="button" onclick={() => ed.remove()}>Delete</button></div>
    </div>
    <dl class="reads"><div><dt>Current</dt><dd>{si(clean(wireI), 'A')}</dd></div></dl>
  {:else}
    <div class="ins-head"><div><div class="ins-name">Circuit</div><p class="ins-kind">Nothing selected</p></div></div>
    {#if meters.length}
      <dl class="reads">
        {#each meters as m (m.id)}
          <div><dt>{m.name}</dt><dd>{meter(sol.parts[m.id]?.reading ?? 0, m.kind === 'ammeter' ? 'A' : 'V')}</dd></div>
        {/each}
      </dl>
    {/if}
    <ul class="tips">
      <li><b>Add</b> a part from the bin; it lands in a free spot.</li>
      <li><b>Wire</b> by dragging from a terminal (or any grid dot, with a mouse) to another point.</li>
      <li><b>Insert</b> a part into a wire by dropping it on the wire.</li>
      <li><b>Select</b> a part to change its value, rotate it (R) or delete it (Delete).</li>
      <li>Red rings mark terminals that are not connected to anything.</li>
    </ul>
  {/if}

  {#if ed.c.parts.length}
    <div class="ph plist-h"><h2>On the board</h2><span class="score">{ed.c.parts.length}</span></div>
    <div class="plist">
      {#each ed.c.parts as p (p.id)}
        <button type="button" class="fchip" aria-pressed={part?.id === p.id} onclick={() => ed.select(part?.id === p.id ? null : { t: 'part', id: p.id })}>{p.name}</button>
      {/each}
    </div>
  {/if}
</div>
