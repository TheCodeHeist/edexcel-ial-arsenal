<script lang="ts">
  /* A compound drawn in the chosen formula style: skeletal or displayed SVG, or structural text. */
  import { chem } from '../../lib/chem';
  import { molSVG } from '../../lib/molecule';
  import { CP } from './data';
  import { useCarbon, type Fmt } from './app.svelte';
  let { id, hl = false, scale, fmt }: { id: string; hl?: boolean; scale?: number; fmt?: Fmt } = $props();
  const app = useCarbon();
  const f = $derived(fmt ?? app.prefs.fmt);
</script>

{#if f === 'structural'}<span class="mol-text">{@html chem(CP[id].st)}</span>{:else}{@html molSVG(CP[id].smi, f, { hl, scale }).svg}{/if}
