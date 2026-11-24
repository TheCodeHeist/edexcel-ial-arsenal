<script lang="ts">
  /* Interactive Edexcel IAL Formula & Data Booklet modal (Alt+B or top-bar button). */
  import { onMount, tick } from 'svelte';
  import { CONSTANTS, PHYS_EQNS, CHEM_DATA, ELEMENTS } from '../../data/databooklet';

  type Tab = 'const' | 'phys' | 'chem' | 'pt';
  let open = $state(false);
  let tab = $state<Tab>('const');
  let q = $state('');
  let copied = $state('');
  let inputEl = $state<HTMLInputElement>();

  const TABS: readonly [Tab, string][] = [
    ['const', 'Constants'],
    ['phys', 'Physics'],
    ['chem', 'Chemistry'],
    ['pt', 'Periodic'],
  ];

  const needle = $derived(q.trim().toLowerCase());

  const fConst = $derived(
    needle ? CONSTANTS.filter((c) => `${c.name} ${c.sym} ${c.val} ${c.unit}`.toLowerCase().includes(needle)) : CONSTANTS
  );
  const fPhys = $derived(
    PHYS_EQNS.map((g) => ({
      ...g,
      items: needle
        ? g.items.filter((i) => `${g.unit} ${g.title} ${i.label} ${i.eq}`.toLowerCase().includes(needle))
        : g.items,
    })).filter((g) => g.items.length > 0)
  );
  const chemGroups = $derived.by(() => {
    const rows = needle
      ? CHEM_DATA.filter((r) => `${r.group} ${r.key} ${r.val} ${r.note ?? ''}`.toLowerCase().includes(needle))
      : CHEM_DATA;
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const list = map.get(r.group) ?? [];
      list.push(r);
      map.set(r.group, list);
    }
    return [...map.entries()];
  });
  const fEl = $derived(
    needle ? ELEMENTS.filter((e) => `${e.z} ${e.sym} ${e.name} ${e.ar}`.toLowerCase().includes(needle)) : ELEMENTS
  );

  async function show() {
    open = true;
    await tick();
    inputEl?.focus();
  }

  function close() { open = false; q = ''; }

  function copyVal(sym: string, val: string, unit: string) {
    navigator.clipboard?.writeText(`${val} ${unit}`).catch(() => {});
    copied = sym;
    setTimeout(() => { if (copied === sym) copied = ''; }, 1100);
  }

  onMount(() => {
    const onOpen = () => { show(); };
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.key.toLowerCase() === 'b') { e.preventDefault(); open ? close() : show(); }
      else if (e.key === 'Escape' && open) close();
    };
    window.addEventListener('arsenal-booklet', onOpen);
    document.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('arsenal-booklet', onOpen);
      document.removeEventListener('keydown', onKey);
    };
  });
</script>

<button
  class="perf-btn tool-icon"
  type="button"
  aria-label="Formula and Data Booklet (Alt+B)"
  title="Formula & Data Booklet (Alt+B)"
  onclick={show}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
  </svg>
</button>

{#if open}
  <div class="modal-bg" role="presentation" onclick={close}>
    <div class="modal-box glass db-modal" role="dialog" aria-modal="true" aria-label="Edexcel IAL Formula and Data Booklet" tabindex="-1" onclick={(e) => e.stopPropagation()} onkeydown={(e) => e.key === 'Escape' && close()}>
      <div class="modal-head">
        <div>
          <span class="eyebrow">Edexcel IAL Reference</span>
          <h3>Formula &amp; Data Booklet</h3>
        </div>
        <button type="button" class="modal-x" aria-label="Close" onclick={close}>✕</button>
      </div>

      <div class="db-bar">
        <div class="seg db-tabs" role="group" aria-label="Booklet section">
          {#each TABS as [id, label]}
            <button type="button" aria-pressed={tab === id} onclick={() => (tab = id)}>{label}</button>
          {/each}
        </div>
        <div class="search sm db-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input bind:this={inputEl} type="search" bind:value={q} placeholder="Filter constants, equations, elements…" aria-label="Filter data booklet" />
        </div>
      </div>

      <div class="modal-body db-body">
        {#if tab === 'const'}
          <div class="db-grid">
            {#each fConst as c}
              <button type="button" class="db-const" onclick={() => copyVal(c.sym, c.val, c.unit)} title="Click to copy value">
                <span class="db-sym">{c.sym}</span>
                <span class="db-cnm">{c.name}</span>
                <span class="db-cval">
                  <b>{copied === c.sym ? 'Copied!' : c.val}</b>
                  {#if copied !== c.sym}<small>{c.unit}</small>{/if}
                </span>
              </button>
            {:else}
              <p class="db-empty">No matching constants.</p>
            {/each}
          </div>
        {:else if tab === 'phys'}
          {#each fPhys as g}
            <div class="db-sec">
              <div class="db-sh"><span class="chip">{g.unit}</span><b>{g.title}</b></div>
              {#each g.items as it}
                <div class="db-eqrow">
                  <span class="db-elbl">{it.label}</span>
                  <code class="db-eq">{it.eq}</code>
                </div>
              {/each}
            </div>
          {:else}
            <p class="db-empty">No matching physics equations.</p>
          {/each}
        {:else if tab === 'chem'}
          {#each chemGroups as [group, rows]}
            <div class="db-sec">
              <div class="db-sh"><b>{group}</b></div>
              {#each rows as r}
                <div class="db-eqrow">
                  <span class="db-elbl">{r.key}{#if r.note} <small>({r.note})</small>{/if}</span>
                  <code class="db-eq">{r.val}</code>
                </div>
              {/each}
            </div>
          {:else}
            <p class="db-empty">No matching chemistry data.</p>
          {/each}
        {:else}
          <div class="pt-grid">
            {#each fEl as el}
              <div class="pt-cell cat-{el.cat}">
                <span class="pt-z">{el.z}</span>
                <b class="pt-sym">{el.sym}</b>
                <span class="pt-nm">{el.name}</span>
                <span class="pt-ar">{el.ar}</span>
              </div>
            {:else}
              <p class="db-empty">No matching elements.</p>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
