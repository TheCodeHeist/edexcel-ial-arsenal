<script lang="ts" generics="T extends string">
  /* Segmented control with one sliding pill (design book §6). Options are [value, label, short label for phones?].
     <Seg label="Layout" options={[['cards','Cards'],['flow','Flowchart']]} bind:value={layout} /> */
  import { indicator } from '../../lib/motion';
  let { options, value = $bindable(), label, onchange, cls = '' }: {
    options: readonly (readonly [T, string, string?])[]; value: T; label: string; onchange?: (v: T) => void; cls?: string;
  } = $props();
</script>

<div class="seg {cls}" role="group" aria-label={label} use:indicator>
  {#each options as [v, text, short] (v)}
    <button type="button" aria-pressed={value === v} aria-label={short ? text : undefined}
      onclick={() => { if (value !== v) { value = v; onchange?.(v); } }}>{#if short}<span class="lg">{text}</span><span class="sm">{short}</span>{:else}{text}{/if}</button>
  {/each}
</div>
