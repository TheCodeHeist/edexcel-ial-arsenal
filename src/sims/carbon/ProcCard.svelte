<script lang="ts">
  /* A preparation procedure. Self-test: rebuild it by tapping the steps in order. */
  import type { Prep } from './data';
  import { useCarbon } from './app.svelte';
  import Mol from './Mol.svelte';

  let { p, i }: { p: Prep; i: number } = $props();
  const app = useCarbon();
  const q = $derived(app.cx.quiz);
  const st = $derived(q ? app.prep[p.id] ?? null : null);
  const shown = $derived(st ? st.done : p.steps.length);
  const fin = $derived(!!st && st.done >= p.steps.length);
  let just = $state(-1);
  function pick(k: number, e: MouseEvent) {
    if (app.pickStep(p.id, k)) just = k;
    else { const b = e.currentTarget as HTMLElement; b.classList.remove('wrong'); void b.offsetWidth; b.classList.add('wrong'); }
  }
</script>

<article class="proc" class:done={fin} style:--i={i}>
  <div class="proc-h"><div><h4>{p.n}</h4><span class="k">{p.kind}</span></div><div class="pm"><Mol id={p.cid} fmt={app.prefs.fmt === 'structural' ? 'structural' : 'skeletal'} /></div></div>
  <ol class="steps">
    {#each p.steps.slice(0, shown) as s, k (k)}
      <li class:fresh={q && k === shown - 1 && just === k}><span class="sn2">{k + 1}</span><span>{s[0]}<span class="sw2">{s[1]}</span></span></li>
    {/each}
  </ol>
  {#if st && !fin}
    <div class="pool"><p class="ph3">Tap the step that comes next</p>
      {#each st.pool.filter((k) => k >= st.done) as k (k)}<button class="pstep" type="button" onclick={(e) => pick(k, e)}>{p.steps[k][0]}</button>{/each}
    </div>
  {/if}
  {#if fin && st}<p class="pdone">✓ All {p.steps.length} steps in order{st.miss ? ` · ${st.miss} slip${st.miss > 1 ? 's' : ''}` : ' · no slips'}</p>{/if}
</article>
