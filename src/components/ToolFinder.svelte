<script lang="ts">
  /* Search + subject filter over every tool. Server-rendered with all tools showing, then hydrated (client:load). */
  import { onMount, tick } from 'svelte';
  import type { Tool } from '../data/tools';
  import { SUBJECTS } from '../data/subjects';
  import ToolCard from './ToolCard.svelte';
  import { indicators } from '../scripts/ui';

  let { tools }: { tools: Tool[] } = $props();
  let q = $state('');
  let subject = $state<'all' | Tool['subject']>('all');
  let grid: HTMLElement;
  let seg: HTMLElement;

  const shown = $derived.by(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return tools.filter((t) => {
      if (subject !== 'all' && t.subject !== subject) return false;
      const hay = [t.title, t.blurb, t.kind, t.subject, ...t.topics, ...t.units].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  });

  // Cards stagger in only when the list is redrawn by a filter change (design book §6).
  async function redraw() {
    await tick();
    if (!grid) return;
    grid.classList.remove('enter'); void grid.offsetWidth; grid.classList.add('enter');
    clearTimeout((grid as any)._t); (grid as any)._t = setTimeout(() => grid.classList.remove('enter'), 1200);
  }
  function pick(s: typeof subject) { if (s === subject) return; subject = s; redraw(); }

  onMount(() => indicators(seg.parentElement!));
</script>

<div class="section-h">
  <div>
    <h2>Every tool</h2>
    <p>{shown.length} of {tools.length} {tools.length === 1 ? 'tool' : 'tools'}{q ? ` matching “${q}”` : ''}</p>
  </div>
  <div class="finder">
    <label class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      <span class="sr-only">Search tools</span>
      <input type="search" placeholder="Search tools, topics, units…" bind:value={q} oninput={redraw} />
    </label>
    <div class="seg" role="group" aria-label="Subject" bind:this={seg}>
      <button type="button" aria-pressed={subject === 'all'} onclick={() => pick('all')}>All</button>
      {#each SUBJECTS as s}
        <button type="button" aria-pressed={subject === s.id} onclick={() => pick(s.id)}>{s.short}</button>
      {/each}
    </div>
  </div>
</div>

<div class="tools" bind:this={grid}>
  {#each shown as tool, i (tool.slug)}
    <ToolCard {tool} {i} />
  {/each}
</div>
{#if shown.length === 0}
  <div class="panel empty">
    <h3>Nothing matches yet</h3>
    <p>{subject === 'all' ? 'Try a different word, or clear the search.' : `No ${SUBJECTS.find((s) => s.id === subject)?.name} tool matches. More are on the way.`}</p>
  </div>
{/if}
