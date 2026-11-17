<script lang="ts">
  /* A round colour swatch: the solution colour, dotted with the precipitate colour when there is one. */
  import { rgba } from '../../lib/util';
  import { liqOf, laOf, type Species } from './data';
  let { S }: { S: Species } = $props();
</script>

{#if S.ppt}
  <span class="sw ppt" style:--c={rgba(liqOf(S), Math.max(laOf(S), 0.35))} style:--p={S.ppt}></span>
{:else}
  <span class="sw" style:--c={rgba(liqOf(S), Math.max(laOf(S), 0.3))}></span>
{/if}
