<script lang="ts">
  /* One circuit symbol, drawn the way the Edexcel specification draws it, in a local frame: the part's axis runs
     along x and its terminals sit at x = ±40 (one grid unit is 40). The caller rotates the group; text and glows
     that must stay upright are counter-rotated here. bright (0–1) lights lamps and LEDs. */
  import { LEDS, type Kind, type Props, type Rot } from './parts';

  let { kind, p, rot = 0, bright = 0, short = false }: { kind: Kind; p: Props; rot?: Rot; bright?: number; short?: boolean } = $props();
  const up = $derived(`rotate(${-rot * 90})`);
  const lead = (a: number) => `M-40 0H${-a}M${a} 0H40`;
</script>

{#if kind === 'resistor' || kind === 'varres' || kind === 'thermistor' || kind === 'pot'}
  <path class="ln" d={lead(20)} />
  <rect class="body" x="-20" y="-8" width="40" height="16" rx="1.5" />
  {#if kind === 'varres'}
    <path class="ln thin" d="M-17 15L15 -13M15 -13l-8.5 1.2M15 -13l-1.2 8.5" />
  {:else if kind === 'thermistor'}
    <path class="ln thin" d="M-27 15H-18L17 -15" />
  {:else if kind === 'pot'}
    <path class="ln" d="M0 40V11" /><path class="ln thin" d="M-5 17.5L0 10.5L5 17.5" />
  {/if}
{:else if kind === 'ldr'}
  <path class="ln" d={lead(17)} />
  <circle class="body" r="24" />
  <rect class="body" x="-17" y="-6.5" width="34" height="13" rx="1.5" />
  <path class="ln thin" d="M-27 -27L-15 -15M-15 -15l-7.5 -1M-15 -15l-1 -7.5M-15 -33L-3 -21M-3 -21l-7.5 -1M-3 -21l-1 -7.5" />
{:else if kind === 'lamp'}
  {#if bright > 0.01}
    <circle class="halo" r={14 + 20 * bright} style:opacity={0.2 + 0.5 * bright} />
  {/if}
  <path class="ln" d={lead(14)} />
  <circle class="body lampface" r="14" style:--b={bright} />
  <path class="ln thin" d="M-9.9 -9.9L9.9 9.9M-9.9 9.9L9.9 -9.9" />
{:else if kind === 'cell'}
  <path class="ln" class:bad={short} d="M-40 0H-5M5 0H40" />
  <path class="ln" class:bad={short} d="M-5 -17V17" />
  <path class="ln plate" class:bad={short} d="M5 -9V9" />
  <path class="ln thin" d="M-19 16h7M-15.5 12.5v7" />
{:else if kind === 'diode' || kind === 'led'}
  {@const g = kind === 'led' ? LEDS[p.colour ?? 'red'].glow : ''}
  {#if kind === 'led' && bright > 0.01}
    <circle class="halo" r={12 + 18 * bright} style:fill={g} style:opacity={0.2 + 0.55 * bright} />
  {/if}
  <path class="ln" d="M-40 0H-10M10 0H40" />
  <path class="ln tri" d="M-10 -11L10 0L-10 11Z" style:--g={g || 'var(--ink)'} style:--b={kind === 'led' ? 0.2 + 0.8 * bright : 1} />
  <path class="ln" d="M10 -11V11" />
  {#if kind === 'led'}
    <path class="ln thin" d="M2 -14L12 -26M12 -26l-7.5 1.4M12 -26l-1.4 7.5M12 -11L22 -23M22 -23l-7.5 1.4M22 -23l-1.4 7.5" style:stroke={bright > 0.05 ? g : undefined} />
  {/if}
{:else if kind === 'switch'}
  <path class="ln" d="M-40 0H-16M16 0H40" />
  <circle class="ln dotc" cx="-16" cy="0" r="2.8" /><circle class="ln dotc" cx="16" cy="0" r="2.8" />
  <path class="ln lever" class:open={!p.on} d="M-16 0L15 -3" />
{:else if kind === 'ammeter' || kind === 'voltmeter'}
  <path class="ln" d={lead(15)} />
  <circle class="body" r="15" />
  <text class="mlet" transform={up}>{kind === 'ammeter' ? 'A' : 'V'}</text>
{/if}

<style>
  .ln{fill:none;stroke:var(--ink);stroke-width:2.8;stroke-linecap:round;stroke-linejoin:round}
  .ln.thin{stroke-width:2}
  .ln.plate{stroke-width:5}
  .ln.bad{stroke:var(--bad)}
  .body{fill:var(--solid);stroke:var(--ink);stroke-width:2.8}
  .lampface{fill:color-mix(in srgb,var(--amph) calc(var(--b) * 85%),var(--solid))}
  .tri{fill:color-mix(in srgb,var(--g) calc(var(--b) * 100%),var(--solid))}
  .halo{fill:var(--amph);filter:blur(7px);pointer-events:none}
  .dotc{fill:var(--solid);stroke-width:1.8}
  .lever{transform-box:fill-box;transform-origin:0 100%;transition:transform .35s var(--spring)}
  .lever.open{transform:rotate(-30deg)}
  .mlet{font:700 18px var(--f-body);fill:var(--ink);text-anchor:middle;dominant-baseline:central;pointer-events:none}
</style>
