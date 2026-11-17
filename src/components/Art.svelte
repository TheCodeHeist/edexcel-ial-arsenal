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
  {:else}
    <!-- benzene hexagon -->
    <path d="M0 -40 L34.6 -20 L34.6 20 L0 40 L-34.6 20 L-34.6 -20 Z" stroke="var(--ligand)" stroke-width="3" />
    <circle r="20" stroke="var(--accent)" stroke-width="2.4" />
  {/if}
</svg>
