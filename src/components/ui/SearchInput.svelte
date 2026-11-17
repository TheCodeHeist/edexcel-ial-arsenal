<script lang="ts">
  /* A glass search field with a magnifier. size="sm" is the compact one used inside panels. */
  let { value = $bindable(''), placeholder, label, size = 'md', oninput, cls = '' }: {
    value: string; placeholder: string; label: string; size?: 'sm' | 'md'; oninput?: (v: string) => void; cls?: string;
  } = $props();
</script>

<label class="search {size} {cls}">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  <span class="sr-only">{label}</span>
  <input type="search" {placeholder} autocomplete="off" bind:value oninput={() => oninput?.(value)} />
</label>
