<script lang="ts" generics="T extends string">
  /* A labelled row of filter chips; one is selected. Options are [value, label, extra class?, title?];
     the extra class colours the selected chip by reaction family (t-redox, t-ligand …). */
  let { label, options, value = $bindable(), onchange }: {
    label: string; options: readonly (readonly [T, string, string?, string?])[]; value: T; onchange?: (v: T) => void;
  } = $props();
</script>

<div class="frow" role="group" aria-label={label}>
  <b>{label}</b>
  {#each options as [v, text, cls, title] (v)}
    <button type="button" class="fchip {cls ?? ''}" aria-pressed={value === v} {title}
      onclick={() => { if (value !== v) { value = v; onchange?.(v); } }}>{text}</button>
  {/each}
</div>
