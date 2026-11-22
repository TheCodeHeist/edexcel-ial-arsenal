<script lang="ts">
  /* Line-drawn artwork for tool cards and subject cards. Thin round-capped strokes in palette tokens, never photographs.
     viewBox is centred on 0,0 so every drawing scales the same way. */
  import type { ToolArt } from '../data/tools';
  let { name, size = 118 }: { name: ToolArt; size?: number } = $props();
</script>

<svg viewBox="-60 -60 120 120" height={size} width={size} aria-hidden="true" fill="none" stroke-linecap="round" stroke-linejoin="round">
  {#if name === 'tube'}
    <!-- test tube on the white tile, a precipitate settling -->
    <ellipse cx="0" cy="50" rx="44" ry="7" fill="color-mix(in srgb, var(--ink) 8%, transparent)" />
    <path d="M-13 -46 V34 a13 13 0 0 0 26 0 V-46" stroke="var(--ink)" stroke-opacity=".55" stroke-width="2.4" />
    <path d="M-18 -46 H18" stroke="var(--ink)" stroke-opacity=".55" stroke-width="2.4" />
    <path d="M-11 0 V34 a11 11 0 0 0 22 0 V0 Z" fill="color-mix(in srgb, var(--ligand) 55%, transparent)" />
    <path d="M-11 0 h22" stroke="var(--ligand)" stroke-width="2" />
    <path d="M-10 30 q5 -4 10 0 t10 0 V34 a10 10 0 0 1 -20 0 Z" fill="var(--accent)" fill-opacity=".75" />
    <circle cx="-3" cy="14" r="2" fill="var(--surf)" fill-opacity=".8" />
    <circle cx="4" cy="22" r="1.4" fill="var(--surf)" fill-opacity=".8" />
    <path d="M24 -30 l10 -10 M30 -18 h12 M24 -6 l10 6" stroke="var(--amph)" stroke-width="2.2" />
  {:else if name === 'sigil'}
    <!-- transmutation circle with a benzene core -->
    <circle r="52" stroke="var(--cond)" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="2 6" />
    <circle r="44" stroke="var(--ligand)" stroke-width="2" />
    <path d="M0 -44 L38 22 L-38 22 Z M0 44 L38 -22 L-38 -22 Z" stroke="var(--ligand)" stroke-opacity=".45" stroke-width="1.6" />
    <path d="M0 -20 L17.3 -10 L17.3 10 L0 20 L-17.3 10 L-17.3 -10 Z" stroke="var(--accent)" stroke-width="2.6" fill="var(--solid)" />
    <circle r="10" stroke="var(--accent)" stroke-width="2" />
    {#each [0, 60, 120, 180, 240, 300] as a}
      <circle cx={Math.sin((a * Math.PI) / 180) * 44} cy={-Math.cos((a * Math.PI) / 180) * 44} r="3.4" fill="var(--amph)" />
    {/each}
  {:else if name === 'wave'}
    <!-- a travelling wave and an atom-like orbit -->
    <path d="M-52 0 H52 M-52 -30 V30" stroke="var(--ink)" stroke-opacity=".35" stroke-width="1.6" />
    <path d="M-52 0 C-43 -34 -35 -34 -26 0 S-9 34 0 0 S17 -34 26 0 S43 34 52 0" stroke="var(--accent)" stroke-width="2.8" />
    <path d="M-52 0 C-43 -18 -35 -18 -26 0 S-9 18 0 0 S17 -18 26 0 S43 18 52 0" stroke="var(--redox)" stroke-opacity=".7" stroke-width="2" />
    <circle cx="-26" cy="0" r="3.2" fill="var(--amph)" />
    <circle cx="26" cy="0" r="3.2" fill="var(--amph)" />
  {:else if name === 'helix'}
    <!-- DNA double helix -->
    {#each Array.from({ length: 9 }, (_, i) => -48 + i * 12) as y, i}
      {@const x = Math.sin(i * 0.78) * 22}
      <path d="M{-x} {y} H{x}" stroke={i % 2 ? 'var(--amph)' : 'var(--redox)'} stroke-opacity=".6" stroke-width="2" />
    {/each}
    <path d="M0 -54 C30 -42 30 -18 0 -6 S-30 30 0 42 S20 54 14 58" stroke="var(--acidbase)" stroke-width="2.8" />
    <path d="M0 -54 C-30 -42 -30 -18 0 -6 S30 30 0 42 S-20 54 -14 58" stroke="var(--accent)" stroke-width="2.8" />
  {:else if name === 'circuit'}
    <!-- a cell, a glowing lamp and a resistor in a loop, with charge moving round -->
    <circle cx="30" cy="-34" r="20" fill="var(--amph)" fill-opacity=".22" stroke="none" />
    <path d="M-44 -34 H18 M42 -34 H44 V36 H12 M-12 36 H-44 V-34" stroke="var(--ink)" stroke-opacity=".6" stroke-width="2.4" />
    <circle cx="30" cy="-34" r="12" stroke="var(--ink)" stroke-opacity=".75" stroke-width="2.4" fill="color-mix(in srgb, var(--amph) 70%, var(--surf))" />
    <path d="M21.5 -42.5 L38.5 -25.5 M21.5 -25.5 L38.5 -42.5" stroke="var(--ink)" stroke-opacity=".75" stroke-width="2" />
    <rect x="-34" y="-41" width="30" height="14" rx="1.5" stroke="var(--accent)" stroke-width="2.6" fill="var(--solid)" />
    <path d="M-4 22 V50 M4 29 V43" stroke="var(--accent)" stroke-width="2.6" />
    <path d="M-12 36 H-4 M4 36 H12" stroke="var(--ink)" stroke-opacity=".6" stroke-width="2.4" />
    {#each [[-44, 2], [44, -2], [-24, 36], [28, 36]] as [x, y]}
      <circle cx={x} cy={y} r="3.4" fill="var(--redox)" />
    {/each}
  {:else if name === 'projectile'}
    <!-- a launcher on a ledge, a parabola with strobe images and the velocity components at one of them -->
    <path d="M-56 46 H56" stroke="var(--ink)" stroke-opacity=".55" stroke-width="2.4" />
    <path d="M-56 22 H-40 V46" stroke="var(--ink)" stroke-opacity=".55" stroke-width="2.4" />
    <path d="M-40 22 Q-6 -78 44 46" stroke="var(--accent)" stroke-width="2.2" stroke-dasharray="3 5" />
    {#each [[-31, 4], [-21, -11], [-10, -19], [1, -21], [12, -16], [23, -5], [34, 14]] as [x, y], i}
      <circle cx={x} cy={y} r="4" fill="var(--solid)" stroke="var(--accent)" stroke-width="2" stroke-opacity={0.45 + i * 0.07} />
    {/each}
    <path d="M23 -5 H45 M41 -9 L45 -5 L41 -1" stroke="var(--accent)" stroke-width="2.4" />
    <path d="M23 -5 V17 M19 13 L23 17 L27 13" stroke="var(--redox)" stroke-width="2.4" />
    <circle cx="23" cy="-5" r="5" fill="var(--amph)" />
    <path d="M-40 22 l9 -11" stroke="var(--ink)" stroke-opacity=".8" stroke-width="5" />
  {:else if name === 'star'}
    <!-- a glowing star inside a tilted accretion ring (back half behind it), a white dwarf companion, distant stars -->
    <g transform="rotate(-18)"><ellipse rx="50" ry="13" stroke="var(--accent)" stroke-opacity=".45" stroke-width="2.2" /></g>
    <circle r="30" fill="var(--amph)" fill-opacity=".16" stroke="none" />
    <circle r="19" fill="color-mix(in srgb, var(--amph) 70%, var(--surf))" stroke="var(--ink)" stroke-opacity=".7" stroke-width="2.4" />
    <path d="M-8 -5 a5 5 0 0 1 7 -3 M4 7 a3.5 3.5 0 0 0 5 -3" stroke="var(--redox)" stroke-opacity=".7" stroke-width="2" />
    <g transform="rotate(-18)"><path d="M-50 0 A50 13 0 0 0 50 0" stroke="var(--accent)" stroke-width="2.8" /></g>
    <circle cx="40" cy="36" r="4.2" fill="var(--surf)" stroke="var(--accent)" stroke-width="2" />
    {#each [[-46, -38, 2.2], [40, -46, 1.8], [-50, 44, 1.6], [12, 52, 1.4], [52, 6, 1.4], [-20, -52, 1.2]] as [x, y, r]}
      <circle cx={x} cy={y} r={r} fill="var(--ink)" fill-opacity=".55" />
    {/each}
  {:else if name === 'atom'}
    <!-- a cyclotron spiral leaving the dees, with a bubble-chamber pair (e⁺ e⁻) curling apart -->
    <path d="M-44 -6 A44 44 0 0 1 0 -50 H6 M-44 6 A44 44 0 0 0 0 50 H6" stroke="var(--ink)" stroke-opacity=".35" stroke-width="2.2" />
    <path d="M0 0 a4 4 0 0 1 8 0 a8 8 0 0 1 -16 0 a12 12 0 0 1 24 0 a16 16 0 0 1 -32 0 a20 20 0 0 1 40 0 a24 24 0 0 1 -48 0 a28 28 0 0 1 56 0" stroke="var(--accent)" stroke-width="2.4" />
    <path d="M28 0 H54" stroke="var(--accent)" stroke-width="2.4" stroke-dasharray="3 4" />
    <path d="M30 34 q10 -6 18 2 a7 7 0 1 1 -8 6" stroke="var(--redox)" stroke-width="2.2" />
    <path d="M30 34 q10 6 4 15 a6 6 0 1 1 -9 -5" stroke="var(--amph)" stroke-width="2.2" />
    <circle cx="30" cy="34" r="3" fill="var(--ink)" fill-opacity=".7" />
  {:else if name === 'ripple'}
    <!-- two coherent sources in a ripple tank: circular wavefronts crossing, with a refracted ray through a block -->
    {#each [10, 22, 34, 46] as r}
      <circle cx="-16" cy="-14" r={r} stroke="var(--accent)" stroke-opacity={0.75 - r / 90} stroke-width="2" />
      <circle cx="16" cy="-14" r={r} stroke="var(--redox)" stroke-opacity={0.75 - r / 90} stroke-width="2" />
    {/each}
    <circle cx="-16" cy="-14" r="3" fill="var(--accent)" />
    <circle cx="16" cy="-14" r="3" fill="var(--redox)" />
    <rect x="-50" y="22" width="100" height="26" rx="2" stroke="var(--ink)" stroke-opacity=".45" stroke-width="2" fill="color-mix(in srgb, var(--accent) 8%, transparent)" />
    <path d="M-48 2 L-26 22 L-14 48 L-2 58" stroke="var(--amph)" stroke-width="2.6" />
  {:else}
    <!-- benzene hexagon -->
    <path d="M0 -40 L34.6 -20 L34.6 20 L0 40 L-34.6 20 L-34.6 -20 Z" stroke="var(--ligand)" stroke-width="3" />
    <circle r="20" stroke="var(--accent)" stroke-width="2.4" />
  {/if}
</svg>
