<script lang="ts">
  /* The status line under the top bar: bold mode name + one-line hint on the left, stat pills on the right.
     A stat whose value changes bumps; the hint crossfades when the mode changes. */
  import { bump, fadeIn } from '../../lib/motion';
  let { label, hint, stats }: { label: string; hint: string; stats: [string, string | number][] } = $props();

  let left: HTMLElement;
  let shown = '';
  $effect(() => { if (label !== shown) { if (shown) fadeIn(left); shown = label; } });

  // bump a pill when its value changes under the same label (not when the set of stats changes with the mode)
  const prev = new Map<string, string>();
  function watch(el: HTMLElement, v: { key: string; value: string }) {
    prev.set(v.key, v.value);
    return {
      update(n: { key: string; value: string }) {
        if (prev.get(n.key) !== undefined && prev.get(n.key) !== n.value) bump(el);
        prev.set(n.key, n.value);
      },
    };
  }
</script>

<div class="statusbar" aria-live="polite">
  <p class="sb-l" bind:this={left}><b>{label}</b> · {hint}</p>
  <div class="sb-r">
    {#each stats as [k, v] (label + k)}
      <span class="stat"><small>{k}</small><b use:watch={{ key: label + k, value: String(v) }}>{v}</b></span>
    {/each}
  </div>
</div>
