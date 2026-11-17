<script lang="ts">
  /* The oscilloscope. Every meter on the board is a probe; pin the ones you want to analyse together (here, or
     from the inspector) and they appear below on one shared time axis:
       Overlay  all pinned voltmeters on one screen, all pinned ammeters on another, each in its own colour;
       Stacked  one lane per pinned probe, lined up in time, each scaled to its own signal.
     Readings are signed: an ammeter reads positive when current enters its + terminal, a voltmeter when its
     + terminal is at the higher potential. */
  import Plot from './Plot.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import { niceMax } from './lab';
  import type { Clock } from './transient.svelte';
  import type { Part } from './parts';

  let { clock, parts, pins = $bindable([]), layout = $bindable('overlay') }: {
    clock: Clock; parts: Part[]; pins?: string[]; layout?: 'overlay' | 'stack';
  } = $props();

  const COLORS = ['var(--accent)', 'var(--redox)', 'var(--acidbase)', 'var(--amph)', 'var(--ligand)', 'var(--cond)'];
  const meters = $derived(parts.filter((p) => p.kind === 'ammeter' || p.kind === 'voltmeter'));
  const pinned = $derived(meters.filter((p) => pins.includes(p.id)));
  const colorOf = (id: string) => COLORS[Math.max(0, pinned.findIndex((p) => p.id === id)) % COLORS.length];
  const BASES = [['1', '1 s'], ['2', '2 s'], ['5', '5 s'], ['10', '10 s'], ['30', '30 s']] as const;

  /** One screen: the given probes, all of one kind (so one unit), auto-scaled with zero kept in view. */
  function screen(ch: Part[]) {
    if (!ch.length) return null;
    const amm = ch[0].kind === 'ammeter';
    const t0 = Math.max(0, clock.t - clock.window), tr = clock.trace;
    const series = ch.map((p) => ({ color: colorOf(p.id), pts: tr.filter((s) => s.m[p.id] !== undefined).map((s) => [s.t, s.m[p.id]] as [number, number]) }));
    const all = series.flatMap((s) => s.pts.map(([, y]) => y));
    const peak = Math.max(1e-9, ...all.map(Math.abs));
    const [k, u] = !amm ? [1, ''] : peak > 1e-9 && peak < 1e-4 ? [1e6, 'µA'] : peak < 0.1 ? [1000, 'mA'] : [1, 'A'];
    const lo = Math.min(0, ...all) * k, hi = Math.max(0, ...all) * k;
    const top = hi > 1e-9 ? niceMax(hi * 1.05) : 0, bot = lo < -1e-9 ? niceMax(-lo * 1.05) : 0;
    return {
      xr: [t0, t0 + clock.window] as [number, number],
      yr: [-(bot || (top ? 0 : 1)), top || (bot ? 0 : 1)] as [number, number],
      series: series.map((s) => ({ ...s, pts: s.pts.map(([x, y]) => [x, y * k] as [number, number]) })),
      y: amm ? `I / ${u}` : 'V / V',
    };
  }
  const screens = $derived.by(() => {
    if (layout === 'stack') return pinned.map((p) => ({ key: p.id, title: p.name, s: screen([p]) }));
    const v = pinned.filter((p) => p.kind === 'voltmeter'), a = pinned.filter((p) => p.kind === 'ammeter');
    return [
      ...(v.length ? [{ key: 'v', title: 'Voltage', s: screen(v) }] : []),
      ...(a.length ? [{ key: 'a', title: 'Current', s: screen(a) }] : []),
    ];
  });
  function toggle(id: string) { pins = pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id]; }
</script>

<div class="osc">
  <div class="osc-head">
    <div class="osc-ch" role="group" aria-label="Pin probes">
      {#each meters as p (p.id)}
        <button type="button" class="chan" aria-pressed={pins.includes(p.id)} style:--cc={colorOf(p.id)} onclick={() => toggle(p.id)}
          title={pins.includes(p.id) ? `Unpin ${p.name}` : `Pin ${p.name} to the oscilloscope`}><i></i>{p.name}</button>
      {/each}
    </div>
    <div class="osc-tb">
      <Seg label="Layout" options={[['overlay', 'Overlay'], ['stack', 'Stacked']]} bind:value={layout} />
      <span>Timebase</span><Seg label="Timebase" options={BASES} value={String(clock.window) as '10'} onchange={(v) => (clock.window = Number(v))} />
    </div>
  </div>
  {#if !meters.length}
    <p class="why osc-empty">Add an ammeter or a voltmeter: every meter is a probe.</p>
  {:else if !pinned.length}
    <p class="why osc-empty">Pin a probe to see it here: tap a meter’s name above, or select the meter and press “Pin to scope”.</p>
  {:else}
    <div class="osc-screens" class:stack={layout === 'stack'}>
      {#each screens as sc (sc.key)}
        {#if sc.s}
          <div class="osc-screen">
            <span class="osc-t" style:--cc={layout === 'stack' ? colorOf(sc.key) : undefined}>{sc.title}</span>
            <Plot h={layout === 'stack' ? 150 : 220} xr={sc.s.xr} yr={sc.s.yr} xLabel="t / s" yLabel={sc.s.y} series={sc.s.series} label="Oscilloscope: {sc.title} against time" />
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
