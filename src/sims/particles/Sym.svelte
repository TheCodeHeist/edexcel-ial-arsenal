<script lang="ts">
  /* A particle symbol drawn properly: Σ̄⁻ with the bar over the letter only, ν with its subscript, both scripts
     stacked when there are two (Λc⁺). */
  import type { Particle } from './data';
  let { s, size }: { s: Particle['sym']; size?: string } = $props();
  const fix = (x?: string) => x?.replace(/\+/g, '+').replace(/-/g, '−');
</script>

<span class="psym" style:font-size={size}><span class="b" class:bar={s.bar}>{s.b}</span>{#if s.sup && s.sub}<span class="ss"><sup>{fix(s.sup)}</sup><sub>{s.sub}</sub></span>{:else if s.sup}<sup>{fix(s.sup)}</sup>{:else if s.sub}<sub>{s.sub}</sub>{/if}</span>
