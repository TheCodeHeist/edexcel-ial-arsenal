<script lang="ts" generics="T extends string">
  /* Second-level tabs with a sliding underline. Each option is [value, label, count?]. */
  import { indicator } from '../../lib/motion';
  let { options, value = $bindable(), label, onchange }: {
    options: readonly (readonly [T, string, (number | string)?])[]; value: T; label: string; onchange?: (v: T) => void;
  } = $props();
</script>

<div class="subtabs" role="tablist" aria-label={label} use:indicator>
  {#each options as [v, text, n] (v)}
    <button role="tab" type="button" aria-selected={value === v} onclick={() => { if (value !== v) { value = v; onchange?.(v); } }}>
      {text}{#if n !== undefined} <span>{n}</span>{/if}
    </button>
  {/each}
</div>
