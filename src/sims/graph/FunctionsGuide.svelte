<script lang="ts">
  /* Beginner-friendly, searchable GeoGebra Functions & Commands Guide modal for Graph Lab.
     Offers quick-start tips, Edexcel syntax notes, and one-click Insert or Plot buttons. */
  import { onMount } from 'svelte';
  import SearchInput from '../../components/ui/SearchInput.svelte';
  import type { GraphMode } from './engine';
  import { GGB_CATEGORIES, GGB_FUNCTIONS, GGB_QUICKSTART, type GgbCategory, type GgbFunc } from './ggbGuide';

  let { open = $bindable(false), oninsert, onplot }: {
    open: boolean;
    oninsert: (cmd: string) => void;
    onplot: (cmds: string[], mode: GraphMode) => void;
  } = $props();

  let q = $state('');
  let cat = $state<'all' | GgbCategory>('all');

  const shown = $derived.by(() => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return GGB_FUNCTIONS.filter((f) => {
      if (cat !== 'all' && f.cat !== cat) return false;
      if (!terms.length) return true;
      const hay = `${f.title} ${f.syntax} ${f.desc} ${f.example} ${f.tip ?? ''} ${(f.units ?? []).join(' ')} ${f.keywords}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  });

  function close() { open = false; }

  function pickInsert(f: GgbFunc) {
    close();
    oninsert(f.example);
  }

  function pickPlot(f: GgbFunc) {
    close();
    onplot(f.plotCmds ?? [f.example], f.mode ?? '2d');
  }

  onMount(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
</script>

{#if open}
  <div class="modal-bg" role="presentation" onclick={close}>
    <div
      class="modal-box glass gl-guide-modal"
      role="dialog"
      aria-modal="true"
      aria-label="GeoGebra functions and commands guide"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.key === 'Escape' && close()}
    >
      <div class="modal-head">
        <div>
          <span class="eyebrow">Beginner guide · Edexcel IAL syntax</span>
          <h3>GeoGebra Functions &amp; Commands</h3>
        </div>
        <button type="button" class="modal-x" aria-label="Close" onclick={close}>✕</button>
      </div>

      <div class="gl-guide-bar">
        <SearchInput bind:value={q} size="sm" placeholder="Search integral, asymptote, polar, vector, normal…" label="Search GeoGebra functions" />
        <div class="gl-guide-cats" role="group" aria-label="Filter functions by category">
          <button type="button" class="fchip" aria-pressed={cat === 'all'} onclick={() => (cat = 'all')}>All ({GGB_FUNCTIONS.length})</button>
          {#each GGB_CATEGORIES as [id, label] (id)}
            <button type="button" class="fchip" aria-pressed={cat === id} onclick={() => (cat = id)}>{label}</button>
          {/each}
        </div>
      </div>

      <div class="modal-body">
        {#if cat === 'all' && !q.trim()}
          <div class="gl-qs-grid">
            {#each GGB_QUICKSTART as tip (tip.title)}
              <div class="gl-qs-card">
                <b>{tip.title}</b>
                <p>{tip.body}</p>
                <code>{tip.sample}</code>
              </div>
            {/each}
          </div>
        {/if}

        {#if shown.length}
          <div class="gl-guide-grid">
            {#each shown as fn (fn.id)}
              <article class="gl-gcard">
                <div class="gl-gcard-head">
                  <b>{fn.title}</b>
                  <div class="gl-gbadges">
                    {#if fn.mode === '3d'}<span class="gl-3dbadge">3D</span>{/if}
                    {#each fn.units ?? [] as u (u)}<span class="gl-ubadge">{u}</span>{/each}
                  </div>
                </div>
                <code class="gl-gsyntax">{fn.syntax}</code>
                <p class="gl-gdesc">{fn.desc}</p>
                {#if fn.tip}<p class="gl-gtip">{fn.tip}</p>{/if}
                <div class="gl-gfoot">
                  <code class="gl-gex">{fn.example}</code>
                  <div class="gl-gcard-acts">
                    <button type="button" class="btn sm" onclick={() => pickInsert(fn)}>Insert</button>
                    <button type="button" class="btn sm primary" onclick={() => pickPlot(fn)}>Plot</button>
                  </div>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <p class="db-empty">No GeoGebra functions match “{q}”. Try words like derivative, integral, circle, polar or plane.</p>
        {/if}
      </div>
    </div>
  </div>
{/if}
