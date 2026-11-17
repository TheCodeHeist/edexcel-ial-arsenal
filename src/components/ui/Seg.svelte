<script lang="ts" generics="T extends string">
  /* Segmented control with one sliding pill (design book §6).
     <Seg label="Layout" options={[['cards','Cards'],['flow','Flowchart']]} bind:value={layout} /> */
  import { indicator } from '../../lib/motion';
  let { options, value = $bindable(), label, onchange }: {
    options: readonly (readonly [T, string])[]; value: T; label: string; onchange?: (v: T) => void;
  } = $props();
</script>

<div class="seg" role="group" aria-label={label} use:indicator>
  {#each options as [v, text] (v)}
    <button type="button" aria-pressed={value === v} onclick={() => { if (value !== v) { value = v; onchange?.(v); } }}>{text}</button>
  {/each}
</div>
