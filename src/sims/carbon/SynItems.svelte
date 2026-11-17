<script lang="ts">
  /* What is on the synthesis bench: the starting materials and everything made so far. In the left bay or the drawer. */
  import { useCarbon } from './app.svelte';
  import CompoundCard from './CompoundCard.svelte';
  const app = useCarbon();
</script>

<div class="syn-items">
  <div><p class="sec-h"><span>Starting materials</span></p><div class="mini-grid">{#each app.syn.start as id (id)}<CompoundCard {id} />{/each}</div></div>
  <div><p class="sec-h"><span>Made so far</span><span>{app.syn.made.length || ''}</span></p>
    <div class="mini-grid">
      {#each app.syn.made as id (id)}<CompoundCard {id} target={id === app.syn.target} />{:else}<p class="lockmsg" style="padding:0">Products you make appear here, ready to use.</p>{/each}
    </div>
  </div>
</div>
