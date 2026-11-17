<script lang="ts">
  /* A compound you can tap or drag into the circle. */
  import { CP, CLASSN } from './data';
  import { useCarbon } from './app.svelte';
  import Mol from './Mol.svelte';
  let { id, fresh = false, target = false }: { id: string; fresh?: boolean; target?: boolean } = $props();
  const app = useCarbon();
  const C = $derived(CP[id]);
</script>

<button class="cc" class:fresh class:target class:in-slot={app.inSlot('c:' + id)} type="button" data-item="c:{id}" title={C.n}>
  <span class="mv"><Mol {id} /></span><span class="nm">{C.n}</span><span class="cl">{CLASSN[C.cls]}</span>
</button>
