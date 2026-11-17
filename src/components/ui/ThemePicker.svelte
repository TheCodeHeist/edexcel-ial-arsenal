<script lang="ts">
  /* The glass theme pill and its popover (design book §3). Shared by the hub and every simulation. */
  import { onMount } from 'svelte';
  import { PALETTES, type PaletteId, type Variant } from '../../data/palettes';
  import { initTheme, onTheme, getTheme, setTheme, type ThemeState, type Mode } from '../../lib/theme';
  import { indicator } from '../../lib/motion';

  let t = $state<ThemeState | null>(null);
  let open = $state(false);
  let host: HTMLElement;

  const colors = $derived(t ? PALETTES[t.palette][t.effective] : null);
  const ids = Object.keys(PALETTES) as PaletteId[];
  const dots = (c: Variant) => [c.accent, c.redox, c.ligand, c.acidbase];
  const swatch = (c: Variant) => [c.accent, c.redox, c.ligand, c.acidbase, c.amph];
  const MODES: [Mode, string][] = [['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']];

  onMount(() => {
    initTheme();
    t = getTheme();
    const off = onTheme((s) => (t = s));
    const close = (e: Event) => { if (!host.contains(e.target as Node)) open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') open = false; };
    document.addEventListener('click', close);
    document.addEventListener('keydown', esc);
    return () => { off(); document.removeEventListener('click', close); document.removeEventListener('keydown', esc); };
  });
</script>

<div class="theme-wrap" bind:this={host}>
  <button class="theme-btn" type="button" aria-haspopup="true" aria-expanded={open}
    aria-label={t ? `Theme: ${t.name} ${t.variant}` : 'Theme'} onclick={(e) => { e.stopPropagation(); open = !open; }}>
    <span class="dots">{#if colors}{#each dots(colors) as c}<i style:background={c}></i>{/each}{/if}</span>
    <span class="theme-name">{#if t}{t.name}<span class="tsep" aria-hidden="true"></span><span class="tvar">{t.variant}</span>{/if}</span>
  </button>
  {#if open}
    <div class="theme-pop">
      <div class="tp-h"><b>Palette</b><b class="tp-note">{t ? (t.mode === 'auto' ? `Auto · ${t.effective}` : t.mode) : ''}</b></div>
      <div class="tp-list">
        {#each ids as k}
          {@const P = PALETTES[k]}
          <button type="button" class="tp-row" aria-pressed={t?.palette === k} onclick={(e) => setTheme({ palette: k }, e)}>
            <span><span class="nm">{P.name}</span><span class="vn">{P.light.v} · {P.dark.v}</span></span>
            {#each [P.light, P.dark] as c}
              <span class="tp-sw" style:--pb={c.bg} style:background={c.bg}>{#each swatch(c) as x}<i style:background={x}></i>{/each}</span>
            {/each}
          </button>
        {/each}
      </div>
      <div class="tp-mode">
        <div class="seg" role="group" aria-label="Light or dark" use:indicator>
          {#each MODES as [m, label]}
            <button type="button" aria-pressed={t?.mode === m} onclick={(e) => setTheme({ mode: m }, e)}>{label}</button>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>
