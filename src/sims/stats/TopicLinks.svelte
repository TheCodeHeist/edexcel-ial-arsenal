<script lang="ts">
  /* Shared footer links inside Stats Lab side panels: jump straight to real Edexcel past-paper questions
     for the exact S1–S3 spec statements on screen, or pop open Pearson's statistical tables. */
  let { items, showBooklet = true }: {
    items: readonly { id: string; label: string }[];
    showBooklet?: boolean;
  } = $props();
</script>

<div class="st-links">
  <div class="st-links-head">
    <span>Past-paper questions</span>
    {#if showBooklet}
      <button
        type="button"
        class="st-booklet-btn"
        onclick={() => window.dispatchEvent(new CustomEvent('arsenal-booklet', { detail: 'maths' }))}
      >Maths booklet &amp; tables</button>
    {/if}
  </div>
  <div class="st-links-chips">
    {#each items as item (item.id)}
      <a class="fchip" href={`/papers/maths/topics/${item.id}/`}>{item.id} · {item.label}</a>
    {/each}
  </div>
</div>
