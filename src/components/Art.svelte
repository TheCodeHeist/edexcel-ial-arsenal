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
  {:else if name === 'kinetics'}
    <!-- Maxwell–Boltzmann curves at two temperatures, the activation energy and the shaded fast molecules -->
    <path d="M-48 -38 V38 H50" stroke="var(--ink)" stroke-opacity=".45" stroke-width="2" />
    <path d="M14 38 V-6" stroke="var(--amph)" stroke-width="2" stroke-dasharray="3 4" />
    <path d="M-48.0 38.0 L-46.8 14.8 L-45.6 7.2 L-44.4 2.6 L-43.2 -0.4 L-42.0 -2.4 L-40.8 -3.6 L-39.6 -4.2 L-38.4 -4.3 L-37.2 -4.2 L-36.0 -3.8 L-34.8 -3.2 L-33.6 -2.4 L-32.4 -1.5 L-31.2 -0.5 L-30.0 0.6 L-28.8 1.7 L-27.6 2.8 L-26.4 4.0 L-25.2 5.2 L-24.0 6.4 L-22.8 7.6 L-21.6 8.7 L-20.4 9.9 L-19.2 11.0 L-18.0 12.1 L-16.8 13.2 L-15.6 14.3 L-14.4 15.3 L-13.2 16.3 L-12.0 17.3 L-10.8 18.2 L-9.6 19.1 L-8.4 20.0 L-7.2 20.8 L-6.0 21.6 L-4.8 22.4 L-3.6 23.1 L-2.4 23.8 L-1.2 24.5 L0.0 25.2 L1.2 25.8 L2.4 26.4 L3.6 27.0 L4.8 27.5 L6.0 28.1 L7.2 28.6 L8.4 29.0 L9.6 29.5 L10.8 29.9 L12.0 30.3 L13.2 30.7 L14.4 31.1 L15.6 31.5 L16.8 31.8 L18.0 32.1 L19.2 32.4 L20.4 32.7 L21.6 33.0 L22.8 33.3 L24.0 33.5 L25.2 33.7 L26.4 34.0 L27.6 34.2 L28.8 34.4 L30.0 34.6 L31.2 34.8 L32.4 34.9 L33.6 35.1 L34.8 35.3 L36.0 35.4 L37.2 35.5 L38.4 35.7 L39.6 35.8 L40.8 35.9 L42.0 36.0 L43.2 36.1 L44.4 36.2 L45.6 36.3 L46.8 36.4 L48.0 36.5 L48 38 Z" fill="color-mix(in srgb, var(--redox) 10%, transparent)" stroke="none" />
    <path d="M-48.0 38.0 L-46.8 -7.2 L-45.6 -19.8 L-44.4 -26.1 L-43.2 -29.0 L-42.0 -29.8 L-40.8 -29.2 L-39.6 -27.6 L-38.4 -25.5 L-37.2 -22.9 L-36.0 -20.1 L-34.8 -17.2 L-33.6 -14.1 L-32.4 -11.1 L-31.2 -8.1 L-30.0 -5.2 L-28.8 -2.3 L-27.6 0.4 L-26.4 3.0 L-25.2 5.4 L-24.0 7.8 L-22.8 10.0 L-21.6 12.0 L-20.4 14.0 L-19.2 15.8 L-18.0 17.5 L-16.8 19.1 L-15.6 20.6 L-14.4 21.9 L-13.2 23.2 L-12.0 24.4 L-10.8 25.5 L-9.6 26.5 L-8.4 27.4 L-7.2 28.3 L-6.0 29.1 L-4.8 29.8 L-3.6 30.5 L-2.4 31.1 L-1.2 31.7 L0.0 32.2 L1.2 32.7 L2.4 33.1 L3.6 33.6 L4.8 33.9 L6.0 34.3 L7.2 34.6 L8.4 34.9 L9.6 35.2 L10.8 35.4 L12.0 35.6 L13.2 35.8 L14.4 36.0 L15.6 36.2 L16.8 36.3 L18.0 36.5 L19.2 36.6 L20.4 36.7 L21.6 36.8 L22.8 36.9 L24.0 37.0 L25.2 37.1 L26.4 37.2 L27.6 37.3 L28.8 37.3 L30.0 37.4 L31.2 37.4 L32.4 37.5 L33.6 37.5 L34.8 37.6 L36.0 37.6 L37.2 37.7 L38.4 37.7 L39.6 37.7 L40.8 37.7 L42.0 37.8 L43.2 37.8 L44.4 37.8 L45.6 37.8 L46.8 37.8 L48.0 37.9" stroke="var(--accent)" stroke-width="2.6" />
    <path d="M-48.0 38.0 L-46.8 14.8 L-45.6 7.2 L-44.4 2.6 L-43.2 -0.4 L-42.0 -2.4 L-40.8 -3.6 L-39.6 -4.2 L-38.4 -4.3 L-37.2 -4.2 L-36.0 -3.8 L-34.8 -3.2 L-33.6 -2.4 L-32.4 -1.5 L-31.2 -0.5 L-30.0 0.6 L-28.8 1.7 L-27.6 2.8 L-26.4 4.0 L-25.2 5.2 L-24.0 6.4 L-22.8 7.6 L-21.6 8.7 L-20.4 9.9 L-19.2 11.0 L-18.0 12.1 L-16.8 13.2 L-15.6 14.3 L-14.4 15.3 L-13.2 16.3 L-12.0 17.3 L-10.8 18.2 L-9.6 19.1 L-8.4 20.0 L-7.2 20.8 L-6.0 21.6 L-4.8 22.4 L-3.6 23.1 L-2.4 23.8 L-1.2 24.5 L0.0 25.2 L1.2 25.8 L2.4 26.4 L3.6 27.0 L4.8 27.5 L6.0 28.1 L7.2 28.6 L8.4 29.0 L9.6 29.5 L10.8 29.9 L12.0 30.3 L13.2 30.7 L14.4 31.1 L15.6 31.5 L16.8 31.8 L18.0 32.1 L19.2 32.4 L20.4 32.7 L21.6 33.0 L22.8 33.3 L24.0 33.5 L25.2 33.7 L26.4 34.0 L27.6 34.2 L28.8 34.4 L30.0 34.6 L31.2 34.8 L32.4 34.9 L33.6 35.1 L34.8 35.3 L36.0 35.4 L37.2 35.5 L38.4 35.7 L39.6 35.8 L40.8 35.9 L42.0 36.0 L43.2 36.1 L44.4 36.2 L45.6 36.3 L46.8 36.4 L48.0 36.5" stroke="var(--redox)" stroke-width="2.6" />
    <path d="M-30 -48 h22 l-5 -4 M-8 -42 h-22 l5 4" stroke="var(--cond)" stroke-width="2.2" />
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
  {:else if name === 'atoms'}
    <!-- tetrahedral molecule inside crossed orbital ellipses, with lone-pair dots -->
    <g transform="rotate(-24)"><ellipse rx="48" ry="18" stroke="var(--ligand)" stroke-opacity=".45" stroke-width="1.8" /></g>
    <g transform="rotate(24)"><ellipse rx="48" ry="18" stroke="var(--accent)" stroke-opacity=".45" stroke-width="1.8" /></g>
    <path d="M0 -4 L0 -38 M0 -4 L32 20 M0 -4 L-32 20 M0 -4 L-12 34" stroke="var(--ink)" stroke-opacity=".7" stroke-width="2.4" />
    <circle cx="0" cy="-4" r="10" fill="color-mix(in srgb, var(--accent) 70%, var(--surf))" stroke="var(--ink)" stroke-opacity=".75" stroke-width="2.2" />
    <circle cx="0" cy="-38" r="6.5" fill="var(--solid)" stroke="var(--redox)" stroke-width="2.2" />
    <circle cx="32" cy="20" r="6.5" fill="var(--solid)" stroke="var(--acidbase)" stroke-width="2.2" />
    <circle cx="-32" cy="20" r="6.5" fill="var(--solid)" stroke="var(--acidbase)" stroke-width="2.2" />
    <circle cx="-12" cy="34" r="5.5" fill="var(--solid)" stroke="var(--amph)" stroke-width="2.2" />
    <circle cx="22" cy="-28" r="2.6" fill="var(--ligand)" />
    <circle cx="29" cy="-23" r="2.6" fill="var(--ligand)" />
  {:else if name === 'energetics'}
    <!-- Born–Haber energy staircase with rising endothermic and falling exothermic arrows -->
    <path d="M-46 18 H-16 M-24 -6 H6 M-2 -34 H30 M16 40 H48" stroke="var(--ink)" stroke-opacity=".75" stroke-width="2.6" />
    <path d="M-30 14 V-4 M-34 0 L-30 -4 L-26 0" stroke="var(--redox)" stroke-width="2.4" />
    <path d="M-10 -10 V-32 M-14 -28 L-10 -32 L-6 -28" stroke="var(--redox)" stroke-width="2.4" />
    <path d="M24 -30 V36 M20 32 L24 36 L28 32" stroke="var(--accent)" stroke-width="2.6" />
    <path d="M-32 22 V38 H10" stroke="var(--acidbase)" stroke-width="2.2" stroke-dasharray="3 4" />
    <path d="M-40 -26 q8 -14 0 -22 q-8 8 0 22 Z" fill="color-mix(in srgb, var(--amph) 60%, transparent)" stroke="var(--amph)" stroke-width="2" />
  {:else if name === 'fields'}
    <!-- electric dipole field lines curving between + and − charges with dashed equipotentials -->
    <path d="M-26 0 C-26 -38 26 -38 26 0 M-26 0 C-26 -18 26 -18 26 0 M-26 0 C-26 18 26 18 26 0 M-26 0 C-26 38 26 38 26 0 M-26 0 H26" stroke="var(--accent)" stroke-width="2" />
    <circle cx="-26" cy="0" r="18" stroke="var(--amph)" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="3 4" />
    <circle cx="26" cy="0" r="18" stroke="var(--amph)" stroke-opacity=".5" stroke-width="1.6" stroke-dasharray="3 4" />
    <circle cx="-26" cy="0" r="9" fill="color-mix(in srgb, var(--redox) 70%, var(--surf))" stroke="var(--redox)" stroke-width="2.2" />
    <path d="M-30 0 H-22 M-26 -4 V4" stroke="var(--ink)" stroke-width="2" />
    <circle cx="26" cy="0" r="9" fill="color-mix(in srgb, var(--accent) 70%, var(--surf))" stroke="var(--accent)" stroke-width="2.2" />
    <path d="M22 0 H30" stroke="var(--ink)" stroke-width="2" />
  {:else if name === 'graph'}
    <!-- a cubic on axes, the area under one stretch of it shaded, and a tangent touching it at a point -->
    <path d="M-4 30 L-4 -23.1 -2 -20.6 0 -17.7 2 -14.7 4 -11.6 6 -8.4 8 -5.3 10 -2.3 12 0.6 14 3.1 16 5.4 18 7.3 20 8.8 22 9.7 24 10 L24 30 Z" fill="color-mix(in srgb, var(--cond) 28%, transparent)" stroke="none" />
    <path d="M-4 30 V-23.1 M24 30 V10" stroke="var(--cond)" stroke-opacity=".7" stroke-width="1.6" stroke-dasharray="3 4" />
    <path d="M-50 30 H52 M-36 48 V-52 M47 25 L52 30 L47 35 M-41 -47 L-36 -52 L-31 -47" stroke="var(--ink)" stroke-opacity=".5" stroke-width="2" />
    <path d="M-30 -2.8 L-27 -12.8 -24 -20.2 -21 -25.4 -18 -28.6 -15 -29.9 -12 -29.7 -9 -28.1 -6 -25.4 -3 -21.9 0 -17.7 3 -13.1 6 -8.4 9 -3.8 12 0.6 15 4.3 18 7.3 21 9.3 24 10 27 9.2 30 6.7 33 2.2 36 -4.5 39 -13.6 42 -25.4 45 -40.2 46 -45.7" stroke="var(--cond)" stroke-width="2.8" />
    <path d="M24 27 L46 -30.8" stroke="var(--accent)" stroke-width="2.4" />
    <circle cx="36" cy="-4.5" r="4" fill="var(--amph)" />
  {:else if name === 'network'}
    <!-- a weighted network with its minimum spanning tree picked out, one rejected arc dashed -->
    <path d="M-40 -26 L-36 22 M-2 -40 L4 4 M38 -18 L44 30" stroke="var(--ink)" stroke-opacity=".35" stroke-width="2.2" />
    <path d="M-36 22 L4 4" stroke="var(--redox)" stroke-opacity=".7" stroke-width="2.2" stroke-dasharray="4 5" />
    <path d="M-40 -26 L-2 -40 L38 -18 M-2 -40 L-36 22 M4 4 L38 -18 M4 4 L44 30 M-36 22 L2 44" stroke="var(--cond)" stroke-width="3.2" />
    {#each [[-40, -26], [-2, -40], [38, -18], [-36, 22], [4, 4], [44, 30], [2, 44]] as [x, y]}
      <circle cx={x} cy={y} r="6.5" fill="var(--solid)" stroke="var(--ink)" stroke-opacity=".8" stroke-width="2.2" />
    {/each}
    <circle cx="4" cy="4" r="6.5" fill="var(--amph)" stroke="var(--ink)" stroke-opacity=".8" stroke-width="2.2" />
  {:else if name === 'stats'}
    <!-- histogram bars under a normal bell curve with a shaded critical right tail -->
    {#each [[-44, 14, 12], [-28, 30, 12], [-12, 46, 12], [4, 42, 12], [20, 22, 12]] as [x, h, w]}
      <rect x={x} y={34 - h} width={w} height={h} rx="1.5" fill="color-mix(in srgb, var(--accent) 22%, var(--surf))" stroke="var(--accent)" stroke-width="1.6" />
    {/each}
    <path d="M18 34 L18 -4 C24 8 30 22 48 34 Z" fill="color-mix(in srgb, var(--redox) 42%, transparent)" stroke="none" />
    <path d="M-50 34 C-32 34 -18 -34 0 -34 C18 -34 32 34 50 34" stroke="var(--cond)" stroke-width="2.8" />
    <path d="M0 -38 V34" stroke="var(--amph)" stroke-width="1.8" stroke-dasharray="3 4" />
    <path d="M-52 34 H52" stroke="var(--ink)" stroke-opacity=".55" stroke-width="2" />
  {:else if name === 'acidbase'}
    <!-- titration curve with equivalence dot, indicator band and a burette dripping into a flask -->
    <rect x="-48" y="-20" width="56" height="12" rx="2" fill="color-mix(in srgb, var(--cond) 22%, transparent)" stroke="none" />
    <path d="M-48 34 H8 M-48 -36 V34" stroke="var(--ink)" stroke-opacity=".45" stroke-width="1.8" />
    <path d="M-46 24 Q-32 20 -22 14 L-18 -22 Q-8 -28 6 -30" stroke="var(--accent)" stroke-width="2.6" />
    <circle cx="-20" cy="-4" r="3.4" fill="var(--redox)" />
    <path d="M28 -44 V-12 M36 -44 V-12 M26 -20 H38" stroke="var(--ink)" stroke-opacity=".65" stroke-width="2" />
    <circle cx="32" cy="-2" r="2.2" fill="var(--accent)" />
    <path d="M26 8 L16 36 H48 L38 8 Z" stroke="var(--ink)" stroke-opacity=".7" stroke-width="2.2" fill="color-mix(in srgb, var(--cond) 38%, var(--surf))" />
  {:else}
    <!-- benzene hexagon -->
    <path d="M0 -40 L34.6 -20 L34.6 20 L0 40 L-34.6 20 L-34.6 -20 Z" stroke="var(--ligand)" stroke-width="3" />
    <circle r="20" stroke="var(--accent)" stroke-width="2.4" />
  {/if}
</svg>
