<script lang="ts">
  /* The oscilloscope. Pin any part's voltage or current (from the inspector), or tap a meter here; pinned channels
     appear below on one shared time axis. Voltage and current are never mixed on one screen:
       Overlay  every pinned voltage on the voltage screen, every pinned current on the current screen;
       Stacked  one lane per channel, lined up in time, each scaled to its own signal.
     Channels take the trace colours --ch1…--ch8 in the order they were pinned. Values are signed: a part's p.d. is
     terminal 0 relative to terminal 1 and its current flows from terminal 0 to 1 (a meter's 0 is its + terminal).
     Hover or drag across a screen to read every trace at one instant. */
  import Plot from './Plot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import { niceMax } from './lab';
  import type { Clock } from './transient.svelte';
  import type { Part } from './parts';

  let { clock, parts, pins = $bindable([]), layout = $bindable('overlay') }: {
    clock: Clock; parts: Part[]; pins?: string[]; layout?: 'overlay' | 'stack';
  } = $props();

  const BASES = [['1', '1 s'], ['2', '2 s'], ['5', '5 s'], ['10', '10 s'], ['30', '30 s']] as const;
  type Ch = { key: string; part: Part; q: 'v' | 'i'; color: string; name: string };

  // pinned channels whose part is still on the board, in pin order (which fixes their colours)
  const chans = $derived.by((): Ch[] => {
    const out: Ch[] = [];
    for (const key of pins) {
      const [id, q] = key.split(':') as [string, 'v' | 'i'];
      const part = parts.find((p) => p.id === id);
      if (!part || (q !== 'v' && q !== 'i')) continue;
      const meter = part.kind === 'ammeter' || part.kind === 'voltmeter';
      out.push({ key, part, q, color: `var(--ch${(out.length % 8) + 1})`, name: meter ? part.name : `${part.name} ${q === 'v' ? 'V' : 'I'}` });
    }
    return out;
  });
  // meters not yet pinned, offered as one-tap chips
  const spare = $derived(parts.filter((p) => (p.kind === 'ammeter' || p.kind === 'voltmeter') && !pins.includes(p.id + (p.kind === 'ammeter' ? ':i' : ':v'))));

  /** One screen of one quantity, auto-scaled with zero kept in view (currents in A, mA or µA). */
  function screen(list: Ch[], q: 'v' | 'i') {
    if (!list.length) return null;
    const t0 = Math.max(0, clock.t - clock.window), tr = clock.trace;
    const raw = list.map((c) => ({ c, pts: tr.filter((s) => s.m[c.key] !== undefined).map((s) => [s.t, s.m[c.key]] as [number, number]) }));
    const all = raw.flatMap((r) => r.pts.map(([, y]) => y));
    const peak = Math.max(0, ...all.map(Math.abs));
    const [k, u] = q === 'v' ? [1, 'V'] : peak > 0 && peak < 1e-4 ? [1e6, 'µA'] : peak < 0.1 ? [1000, 'mA'] : [1, 'A'];
    const lo = Math.min(0, ...all) * k, hi = Math.max(0, ...all) * k;
    const top = hi > 0 ? niceMax(hi * 1.05) : 0, bot = lo < 0 ? niceMax(-lo * 1.05) : 0;
    return {
      xr: [t0, t0 + clock.window] as [number, number],
      yr: [-(bot || (top ? 0 : 1)), top || (bot ? 0 : 1)] as [number, number],
      series: raw.map((r) => ({ color: r.c.color, name: r.c.name, pts: r.pts.map(([x, y]) => [x, y * k] as [number, number]) })),
      y: `${q === 'v' ? 'V' : 'I'} / ${u}`,
    };
  }
  const screens = $derived.by(() => {
    if (layout === 'stack') return chans.map((c) => ({ key: c.key, title: c.name, color: c.color, s: screen([c], c.q) }));
    const v = chans.filter((c) => c.q === 'v'), i = chans.filter((c) => c.q === 'i');
    return [
      ...(v.length ? [{ key: 'v', title: 'Voltage', color: '', s: screen(v, 'v') }] : []),
      ...(i.length ? [{ key: 'i', title: 'Current', color: '', s: screen(i, 'i') }] : []),
    ];
  });
  const unpin = (key: string) => (pins = pins.filter((x) => x !== key));
  const pinMeter = (p: Part) => (pins = [...pins, p.id + (p.kind === 'ammeter' ? ':i' : ':v')]);
</script>

<div class="osc">
  <div class="osc-head">
    <div class="osc-ch" role="group" aria-label="Channels">
      {#each chans as c (c.key)}
        <button type="button" class="chan" aria-pressed="true" style:--cc={c.color} onclick={() => unpin(c.key)} title="Unpin {c.name}"><i></i>{c.name}<b aria-hidden="true">×</b></button>
      {/each}
      {#each spare as p (p.id)}
        <button type="button" class="chan" aria-pressed="false" onclick={() => pinMeter(p)} title="Pin {p.name}"><i></i>{p.name}</button>
      {/each}
    </div>
    <div class="osc-tb">
      <Seg label="Layout" options={[['overlay', 'Overlay'], ['stack', 'Stacked']]} bind:value={layout} />
      <span>Timebase</span><Seg label="Timebase" options={BASES} value={String(clock.window) as '10'} onchange={(v) => (clock.window = Number(v))} />
    </div>
  </div>
  {#if !chans.length}
    <p class="why osc-empty">Nothing pinned yet. Select any part and press “Pin voltage” or “Pin current”, or tap a meter above.</p>
  {:else}
    <div class="osc-screens" class:stack={layout === 'stack'}>
      {#each screens as sc (sc.key)}
        {#if sc.s}
          <div class="osc-screen">
            <span class="osc-t" style:--cc={sc.color || undefined}>{sc.title}</span>
            <Plot h={layout === 'stack' ? 150 : 220} xr={sc.s.xr} yr={sc.s.yr} xLabel="t / s" yLabel={sc.s.y} series={sc.s.series} probe
              label="Oscilloscope: {sc.title} against time" />
          </div>
        {/if}
      {/each}
    </div>
    <p class="osc-hint">{clock.playing ? 'Pause, then hover or drag across a screen to read every trace at one instant.' : 'Hover or drag across a screen to read every trace at one instant.'}</p>
  {/if}
</div>
