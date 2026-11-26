<script lang="ts">
  /* One tool as a glass card. Rendered to static HTML on subject pages and live inside ToolFinder on the home page. */
  import type { Tool } from '../data/tools';
  import { subjectById } from '../data/subjects';
  import Art from './Art.svelte';
  let { tool, i = 0 }: { tool: Tool; i?: number } = $props();
  const subject = $derived(subjectById(tool.subject)!);
  const unitNs = $derived(tool.units.map((c) => subject.units.find((u) => u.code === c)?.badge).filter(Boolean));
  const unitLabel = $derived(unitNs.length === 1 ? `Unit ${unitNs[0]}` : `Units ${unitNs.slice(0, -1).join(', ')} & ${unitNs.at(-1)}`);
</script>

<a class="card glass" href={tool.href} style="--hue: var({subject.hue}); --i: {i}">
  <div class="art"><Art name={tool.art} /></div>
  <div class="kind"><span>{tool.kind}</span><small>{subject.name} · {unitLabel}</small></div>
  <h3>{tool.title}</h3>
  <p>{tool.blurb}</p>
  <div class="meta">
    {#each tool.topics as t}<span class="chip">{t}</span>{/each}
  </div>
</a>
