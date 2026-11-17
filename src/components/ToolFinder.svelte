<script lang="ts">
  /* Search + subject filter over every tool. Server-rendered with all tools showing, then hydrated (client:load). */
  import { tick } from 'svelte';
  import type { Tool } from '../data/tools';
  import { SUBJECTS } from '../data/subjects';
  import ToolCard from './ToolCard.svelte';
  import Seg from './ui/Seg.svelte';
  import SearchInput from './ui/SearchInput.svelte';
  import { enter } from '../lib/motion';

  let { tools }: { tools: Tool[] } = $props();
  let q = $state('');
  let subject = $state<'all' | Tool['subject']>('all');
  let grid: HTMLElement;
  const options = [['all', 'All'] as const, ...SUBJECTS.map((s) => [s.id, s.short] as const)];

  const shown = $derived.by(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return tools.filter((t) => {
      if (subject !== 'all' && t.subject !== subject) return false;
      const hay = [t.title, t.blurb, t.kind, t.subject, ...t.topics, ...t.units].join(' ').toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  });

  // Cards stagger in only when the list is redrawn by a filter change (design book §6).
  async function redraw() { await tick(); enter(grid); }
</script>

<div class="section-h">
  <div>
    <h2>Every tool</h2>
    <p>{shown.length} of {tools.length} {tools.length === 1 ? 'tool' : 'tools'}{q ? ` matching “${q}”` : ''}</p>
  </div>
  <div class="finder">
    <SearchInput bind:value={q} placeholder="Search tools, topics, units…" label="Search tools" oninput={redraw} />
    <Seg label="Subject" {options} bind:value={subject} onchange={redraw} />
  </div>
</div>

<div class="tools" bind:this={grid}>
  {#each shown as tool, i (tool.slug)}
    <ToolCard {tool} {i} />
  {/each}
</div>
{#if shown.length === 0}
  <div class="panel empty-state">
    <h3>Nothing matches yet</h3>
    <p>{subject === 'all' ? 'Try a different word, or clear the search.' : `No ${SUBJECTS.find((s) => s.id === subject)?.name} tool matches. More are on the way.`}</p>
  </div>
{/if}
