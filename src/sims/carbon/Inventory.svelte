<script lang="ts">
  /* The lab's compounds: search, family chips, the discovered compounds, free play and reset. Lives in the left bay,
     or in the phone drawer. */
  import { tick } from 'svelte';
  import { enter } from '../../lib/motion';
  import SearchInput from '../../components/ui/SearchInput.svelte';
  import { CP, CLASSN, GROUPS, LABSET } from './data';
  import { useCarbon } from './app.svelte';
  import CompoundCard from './CompoundCard.svelte';

  const app = useCarbon();
  let group = $state('all'), q = $state('');
  let grid: HTMLElement;
  let armed = $state(false), armTimer: ReturnType<typeof setTimeout>;
  const ORDER = Object.keys(CP);

  const found = $derived(new Set(app.progress.found));
  const list = $derived.by(() => {
    const g = GROUPS.find((x) => x[0] === group)![2], s = q.trim().toLowerCase();
    // free play shows the core set; anything else you have made (rule-made esters, amides, salts…) shows once found
    return ORDER.filter((id) => found.has(id) || (app.prefs.free && LABSET.has(id)))
      .filter((id) => (!g || g.includes(CP[id].cls)) && (!s || CP[id].n.toLowerCase().includes(s) || CP[id].st.toLowerCase().includes(s) || CLASSN[CP[id].cls].toLowerCase().includes(s)));
  });
  const left = $derived(LABSET.size - app.labFound);
  async function redraw() { await tick(); enter(grid, '.cc', '--i', 14); }
  // new discoveries pop into the grid
  $effect(() => { if (app.freshIds.length) redraw(); });

  function reset() {
    if (!armed) { armed = true; clearTimeout(armTimer); armTimer = setTimeout(() => (armed = false), 3000); return; }
    armed = false; app.resetLab();
  }
</script>

<div class="inv-tools">
  <SearchInput size="sm" bind:value={q} placeholder="Search compounds" label="Search compounds" />
  <div class="chiprow" role="group" aria-label="Compound family">
    {#each GROUPS as [k, n] (k)}<button class="fchip" type="button" aria-pressed={group === k} onclick={() => { group = k; redraw(); }}>{n}</button>{/each}
  </div>
</div>
<div class="inv-grid" bind:this={grid}>
  {#each list as id (id)}<CompoundCard {id} fresh={app.freshIds.includes(id)} />{/each}
  {#if !list.length}<p class="lockmsg">Nothing here yet{q ? ` matching “${q}”` : ''}. {app.prefs.free ? '' : 'React compounds to discover more.'}</p>{/if}
  {#if !app.prefs.free && !q && group === 'all' && left > 0}<div class="cc cc-ghost">{left} more<br />to discover</div>{/if}
</div>
<div class="inv-foot">
  <button class="btn" type="button" aria-pressed={app.prefs.free} onclick={() => { app.prefs.free = !app.prefs.free; redraw(); }}>Free play: {app.prefs.free ? 'on' : 'off'}</button>
  <button class="btn" type="button" onclick={reset}>{armed ? 'Tap again to reset' : 'Reset discoveries'}</button>
</div>
