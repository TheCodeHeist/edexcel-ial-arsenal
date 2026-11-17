<script lang="ts">
  /* The parts bin. Tap (or click) a part to put it on the board in a free spot; with a mouse you can also drag it
     straight to where you want it. Below the parts: the ready-made example circuits. */
  import Symbol from './Symbol.svelte';
  import { BIN, KINDS, type Kind } from './parts';
  import { EXAMPLES, type Example } from './examples';

  let { adv = false, onadd, ondrop, onexample, current = '' }: {
    adv?: boolean;
    onadd: (k: Kind) => void;
    ondrop: (k: Kind, x: number, y: number) => boolean;   // true if it landed on the board
    onexample: (ex: Example) => void;
    current?: string;
  } = $props();

  const VB: Partial<Record<Kind, string>> = { pot: '-58 -22 116 66', ldr: '-56 -34 112 66', switch2: '-62 -46 124 92' };
  let ghost = $state<{ k: Kind; x: number; y: number } | null>(null);
  let press: { k: Kind; x: number; y: number; id: number } | null = null;
  let suppress = false;

  /* the ghost lives on <body>: inside the glass panel (backdrop-filter makes a stacking context) it would slide
     under the board panel however high its z-index */
  function portal(el: HTMLElement) { document.body.appendChild(el); return { destroy() { el.remove(); } }; }

  function down(e: PointerEvent, k: Kind) {
    if (e.pointerType !== 'mouse' || e.button > 0) return;
    press = { k, x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function move(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    if (!ghost && Math.hypot(e.clientX - press.x, e.clientY - press.y) < 6) return;
    ghost = { k: press.k, x: e.clientX, y: e.clientY };
  }
  function up(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) return;
    const g = ghost; press = null; ghost = null;
    if (g) { suppress = true; setTimeout(() => (suppress = false), 60); ondrop(g.k, e.clientX, e.clientY); }
  }
</script>

<svelte:window onpointermove={move} onpointerup={up} onpointercancel={() => { press = null; ghost = null; }} />

<div class="bin">
  {#each BIN.filter((g) => adv || !g.adv) as g (g.g)}
    <div class="bin-g">
      <h3>{g.g}</h3>
      <div class="bin-items">
        {#each g.kinds as k (k)}
          <button type="button" class="pbtn" title={KINDS[k].note} onpointerdown={(e) => down(e, k)} onclick={() => { if (!suppress) onadd(k); }}>
            <svg viewBox={VB[k] ?? '-46 -26 92 52'} aria-hidden="true"><Symbol kind={k} p={KINDS[k].defaults} /></svg>
            <span>{KINDS[k].label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/each}
</div>

<div class="ph"><h2>Examples</h2></div>
<div class="exlist">
  {#each EXAMPLES.filter((ex) => adv || !ex.adv) as ex (ex.id)}
    <button type="button" class="exbtn" aria-pressed={current === ex.id} onclick={() => onexample(ex)}>{ex.name}</button>
  {/each}
</div>

{#if ghost}
  <div class="pghost" use:portal style:transform="translate({ghost.x - 46}px,{ghost.y - 26}px)" aria-hidden="true">
    <svg viewBox="-46 -26 92 52" width="92" height="52"><Symbol kind={ghost.k} p={KINDS[ghost.k].defaults} /></svg>
  </div>
{/if}
