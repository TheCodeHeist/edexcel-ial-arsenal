<script lang="ts">
  /* Compact Light / Dark / Auto mode switch in the top bar. Palette selection lives in PerfPicker (Settings). */
  import { onMount } from 'svelte';
  import { initTheme, onTheme, getTheme, setTheme, type ThemeState, type Mode } from '../../lib/theme';
  import { indicator } from '../../lib/motion';

  let t = $state<ThemeState | null>(null);

  const MODES: readonly [Mode, string][] = [
    ['auto', 'Auto (system)'],
    ['light', 'Light mode'],
    ['dark', 'Dark mode'],
  ];

  onMount(() => {
    initTheme();
    t = getTheme();
    return onTheme((s) => (t = s));
  });
</script>

<div class="seg mode-seg" role="group" aria-label="Appearance mode" use:indicator>
  {#each MODES as [m, label]}
    <button
      type="button"
      aria-pressed={t?.mode === m}
      aria-label={label}
      title={label}
      onclick={(e) => setTheme({ mode: m }, e)}
    >
      {#if m === 'auto'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </svg>
      {:else if m === 'light'}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      {:else}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
        </svg>
      {/if}
    </button>
  {/each}
</div>
