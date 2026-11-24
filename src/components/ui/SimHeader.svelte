<script lang="ts" generics="T extends string">
  /* The simulation top bar: title | theme pill | mode tabs (design book §2). The eyebrow starts with a link back to
     the subject page on the hub. Tabs are [value, long label, short label for phones?]. */
  import ThemePicker from './ThemePicker.svelte';
  import PerfPicker from './PerfPicker.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import DataBooklet from './DataBooklet.svelte';
  import { indicator } from '../../lib/motion';
  let { title, accent = 1, eyebrow, back, tabs, value, onselect }: {
    title: string; accent?: number; eyebrow: string; back: { href: string; label: string };
    tabs: readonly (readonly [T, string, string?])[]; value: T; onselect: (v: T) => void;
  } = $props();
</script>

<header class="top">
  <div class="brand">
    <p class="eyebrow">
      <a class="home-link" href={back.href}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>{back.label}</a>
      · {eyebrow}
    </p>
    <h1><span class="d">{title.slice(0, accent)}</span>{title.slice(accent)}</h1>
  </div>
  <div class="top-tools">
    <CommandPalette />
    <DataBooklet />
    <ThemePicker />
    <PerfPicker />
  </div>
  <div class="tabs" role="tablist" aria-label="Mode" use:indicator>
    {#each tabs as [v, long, short] (v)}
      <button role="tab" type="button" aria-selected={value === v} aria-label={long} onclick={() => onselect(v)}>
        {#if short}<span class="lg">{long}</span><span class="sm">{short}</span>{:else}{long}{/if}
      </button>
    {/each}
  </div>
</header>
