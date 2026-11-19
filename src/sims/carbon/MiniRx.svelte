<script lang="ts">
  /* A small reaction strip for the notebook: reactants → reagent → products. */
  import { chem } from '../../lib/chem';
  import { CP, RG, needText, type Reaction } from './data';
  import Mol from './Mol.svelte';
  let { r }: { r: Reaction } = $props();
</script>

<div class="e-mini">
  <span class="m"><Mol id={r.a} /></span>
  {#if CP[r.b]}<span class="ar" style="width:auto">+</span><span class="m"><Mol id={r.b} /></span>{/if}
  <span class="ar"><span>{@html RG[r.b] ? chem(RG[r.b].f) : r.need ? needText(r.need) : ''}</span><svg width="58" height="10" viewBox="0 0 58 10" aria-hidden="true"><path d="M1 5h52M48 1l5 4-5 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" /></svg></span>
  {#each r.p as p, i (p)}{#if i}<span class="ar" style="width:auto">+</span>{/if}<span class="m"><Mol id={p} /></span>{/each}
</div>
