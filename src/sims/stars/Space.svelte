<script lang="ts">
  /* The 3D view. three.js loads on demand (it is the biggest thing on the page), and a browser without WebGL gets a
     plain message instead; the rest of the tab works without it. Drag to turn the view; click it, then use the wheel
     (or pinch) to zoom.
     If the graphics driver resets and the WebGL context is lost, the view rebuilds itself on a fresh canvas (a lost
     context can't always be restored on the old one), so it never needs a page refresh. */
  import { onMount } from 'svelte';
  import type { Cosmos, Look } from './cosmos';
  import { isReducedMotion, onPerf } from '../../lib/perf';

  let { look, spin = true, children }: { look: Look; spin?: boolean; children?: import('svelte').Snippet } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let cosmos = $state<Cosmos | null>(null);
  let failed = $state(false);
  let lost = $state(false);
  let gen = $state(0);            // bumping it swaps in a new canvas
  let Ctor: typeof Cosmos | null = null;
  let lastM = NaN;

  let reduced = $state(isReducedMotion());
  onMount(() => {
    let dead = false;
    const offPerf = onPerf(() => { reduced = isReducedMotion(); });
    import('./cosmos').then((m) => { if (!dead) { Ctor = m.Cosmos; build(); } }).catch(() => { failed = true; });
    return () => { dead = true; offPerf(); cosmos?.dispose(); cosmos = null; };
  });

  function build() {
    if (!Ctor || !canvas) return;
    try {
      cosmos = new Ctor(canvas, matchMedia('(max-width: 760px)').matches);
      lastM = NaN; // the next look snaps
    } catch {
      failed = true;
    }
  }

  // a lost context: stop, then rebuild on a new canvas once the browser lets us (or after a moment anyway)
  let retry = 0;
  function onLost(e: Event) {
    e.preventDefault();
    lost = true;
    cosmos?.dispose();
    cosmos = null;
    clearTimeout(retry);
    retry = window.setTimeout(restart, 1200);
  }
  function restart() {
    clearTimeout(retry);
    if (!lost) return;
    lost = false;
    gen++;
  }
  function watchLoss(el: HTMLCanvasElement) {
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', restart);
    return { destroy() { el.removeEventListener('webglcontextlost', onLost); el.removeEventListener('webglcontextrestored', restart); } };
  }
  // a new canvas element appeared: build on it
  $effect(() => { void gen; if (canvas && Ctor && !cosmos && !lost) build(); });

  // jump straight to a new star (first load, a new mass); glide along the timeline
  $effect(() => {
    if (!cosmos) return;
    const snap = look.M !== lastM;
    lastM = look.M;
    cosmos.set({ ...look }, snap);
  });
  $effect(() => { if (cosmos) cosmos.autoRotate = spin && !reduced; });
</script>

<div class="space">
  {#key gen}
    <canvas bind:this={canvas} use:watchLoss
      aria-label="3D view of the star at this stage of its life. Drag to turn it."></canvas>
  {/key}
  {#if failed}
    <p class="nogl">This view needs WebGL, which this browser has turned off. Everything else on the page still works.</p>
  {:else if lost}
    <p class="nogl">The graphics card reset the 3D view. Restarting it…</p>
  {/if}
  {@render children?.()}
  {#if cosmos}
    <div class="zoom" role="group" aria-label="Zoom">
      <button type="button" class="zb" aria-label="Zoom in" onclick={() => cosmos?.zoomBy(0.8)}>+</button>
      <button type="button" class="zb" aria-label="Zoom out" onclick={() => cosmos?.zoomBy(1.25)}>−</button>
      <button type="button" class="zb" aria-label="Reset view" title="Reset view" onclick={() => cosmos?.resetView()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7" /><path d="M4 4v4h4" /></svg>
      </button>
    </div>
  {/if}
</div>
