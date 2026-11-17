<script lang="ts" generics="P extends string">
  /* Phones (≤760px) never make you scroll between items and their drop target (design book §7): a floating dock
     opens a bottom sheet holding the items. Swipe the sheet down, tap outside, press Escape or Done to close.
     panes: [id, label, icon SVG, count?]. nudge: the pane to pulse (what the student needs next). */
  import type { Snippet } from 'svelte';
  import Seg from './Seg.svelte';

  let { panes, open = $bindable(false), pane = $bindable(), nudge = null, tip, content }: {
    panes: readonly (readonly [P, string, string, (string | number)?])[];
    open: boolean; pane: P; nudge?: P | null; tip?: string; content: Snippet<[P]>;
  } = $props();

  let dy = $state(0), dragging = $state(false), away = $state(false);
  let sw: { y: number; id: number; moving: boolean } | null = null;

  export function close(fast = false) { away = fast; open = false; dy = 0; dragging = false; }
  function toggle(p: P) { if (open && pane === p) close(); else { pane = p; away = false; open = true; } }

  function down(e: PointerEvent) { if (open) sw = { y: e.clientY, id: e.pointerId, moving: false }; }
  function move(e: PointerEvent) {
    if (!sw || e.pointerId !== sw.id) return;
    const d = Math.max(0, e.clientY - sw.y);
    if (!sw.moving && d > 6) { sw.moving = true; dragging = true; }
    if (sw.moving) dy = d;
  }
  function up(e: PointerEvent) {
    if (!sw || e.pointerId !== sw.id) return;
    const s = sw; sw = null; dragging = false;
    if (s.moving && dy > 80) close(); else dy = 0;
  }
  $effect(() => { document.documentElement.classList.toggle('sheet-open', open); });
  $effect(() => () => document.documentElement.classList.remove('sheet-open'));
</script>

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={up} onkeydown={(e) => { if (e.key === 'Escape' && open) close(); }} />

<nav class="dock" aria-label="Open a drawer">
  {#each panes as [id, label, icon, count] (id)}
    <button type="button" class:nudge={nudge === id && !open} onclick={() => toggle(id)}>{@html icon}<span>{label}</span>{#if count}<b>{count}</b>{/if}</button>
  {/each}
</nav>
<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="sheet-bg" class:on={open} onclick={() => close()}></div>
<section class="sheet" class:open class:dragging class:away style:--dy="{dy}px" aria-hidden={!open} aria-label="Drawer" inert={!open}>
  <div class="sheet-grab" role="presentation" onpointerdown={down}><i></i></div>
  <div class="sheet-head" role="group" aria-label="Drawer controls" onpointerdown={down}>
    <Seg label="Drawer" options={panes.map(([id, label]) => [id, label] as const)} bind:value={pane} />
    {#if tip}<span class="sheet-tip">{tip}</span>{/if}
    <button class="btn" type="button" onclick={() => close()}>Done</button>
  </div>
  <div class="sheet-body">{@render content(pane)}</div>
</section>
