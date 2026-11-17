<script lang="ts">
  /* Every reagent, grouped; tap or drag one into the circle. */
  import { chem } from '../../lib/chem';
  import { RG, RGLIST, RG_GROUPS } from './data';
  import { useCarbon } from './app.svelte';
  const app = useCarbon();
</script>

<div class="rack2">
  {#each RG_GROUPS as [g, name] (g)}
    <div class="rg2"><h3>{name}</h3>
      <div class="items">
        {#each RGLIST.filter((id) => RG[id].g === g) as id (id)}
          <button class="rgc" class:in-slot={app.inSlot('r:' + id)} type="button" data-item="r:{id}" data-g={g}>
            <span class="rf"><i class="gd"></i><span>{@html chem(RG[id].f)}</span></span><span class="rs">{@html chem(RG[id].n)}</span>
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>
