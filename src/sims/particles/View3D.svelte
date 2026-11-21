<script lang="ts" generics="L">
  /* The frame round any 3D view: loads its scene module on demand (three.js is the biggest thing on the page), shows
     a plain message without WebGL, rebuilds on a fresh canvas if the graphics driver drops the context, and adds the
     zoom buttons. HUD chips go in as children. onscene hands the live scene to the parent (for picks and buttons). */
  import { onMount } from 'svelte';
  import type { Stage3D } from './gl';

  let { load, look, label, spin = false, onscene, children }: {
    load: () => Promise<new (canvas: HTMLCanvasElement, small: boolean) => Stage3D<L>>;
    look: L; label: string; spin?: boolean;
    onscene?: (s: Stage3D<L> | null) => void;
    children?: import('svelte').Snippet;
  } = $props();

  let canvas = $state<HTMLCanvasElement>();
  let scene = $state<Stage3D<L> | null>(null);
  let failed = $state(false);
  let lost = $state(false);
  let gen = $state(0);
  let Ctor: (new (canvas: HTMLCanvasElement, small: boolean) => Stage3D<L>) | null = null;

  onMount(() => {
    let dead = false;
    load().then((K) => { if (!dead) { Ctor = K; build(); } }).catch(() => { failed = true; });
    return () => { dead = true; scene?.dispose(); scene = null; onscene?.(null); };
  });
  function build() {
    if (!Ctor || !canvas) return;
    try { scene = new Ctor(canvas, matchMedia('(max-width: 760px)').matches); onscene?.(scene); }
    catch { failed = true; }
  }
  let retry = 0;
  function onLost(e: Event) {
    e.preventDefault();
    lost = true;
    scene?.dispose(); scene = null; onscene?.(null);
    clearTimeout(retry);
    retry = window.setTimeout(restart, 1200);
  }
  function restart() { clearTimeout(retry); if (!lost) return; lost = false; gen++; }
  function watchLoss(el: HTMLCanvasElement) {
    el.addEventListener('webglcontextlost', onLost);
    el.addEventListener('webglcontextrestored', restart);
    return { destroy() { el.removeEventListener('webglcontextlost', onLost); el.removeEventListener('webglcontextrestored', restart); } };
  }
  $effect(() => { void gen; if (canvas && Ctor && !scene && !lost) build(); });
  $effect(() => { scene?.set($state.snapshot(look) as L); });
  $effect(() => { if (scene) scene.autoRotate = spin; });
</script>

<div class="space">
  {#key gen}
    <canvas bind:this={canvas} use:watchLoss aria-label={label}></canvas>
  {/key}
  {#if failed}
    <p class="nogl">This view needs WebGL, which this browser has turned off. Everything else on the page still works.</p>
  {:else if lost}
    <p class="nogl">The graphics card reset the 3D view. Restarting it…</p>
  {/if}
  {@render children?.()}
  {#if scene}
    <div class="zoom" role="group" aria-label="Zoom">
      <button type="button" class="zb" aria-label="Zoom in" onclick={() => scene?.zoomBy(0.8)}>+</button>
      <button type="button" class="zb" aria-label="Zoom out" onclick={() => scene?.zoomBy(1.25)}>−</button>
      <button type="button" class="zb" aria-label="Reset the view" onclick={() => scene?.resetView()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></svg>
      </button>
    </div>
  {/if}
</div>
