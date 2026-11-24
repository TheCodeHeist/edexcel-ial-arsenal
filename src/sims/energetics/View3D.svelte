<script lang="ts" generics="L">
  /* Energetics Lab uses Particle Lab's 3D frame unchanged; this re-export keeps imports short. */
  import Inner from '../particles/View3D.svelte';
  import type { Stage3D } from '../particles/gl';
  let { load, look, label, spin = false, onscene, children }: {
    load: () => Promise<new (canvas: HTMLCanvasElement, small: boolean) => Stage3D<L>>;
    look: L; label: string; spin?: boolean;
    onscene?: (s: Stage3D<L> | null) => void;
    children?: import('svelte').Snippet;
  } = $props();
</script>

<Inner {load} {look} {label} {spin} {onscene}>{@render children?.()}</Inner>
