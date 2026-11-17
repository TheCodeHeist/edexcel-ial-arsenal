<script lang="ts">
  /* Copies a clean plain-text version of something people will reuse (design book §8). Shows "Copied" briefly. */
  let { text, label = 'Copy as text' }: { text: string | (() => string); label?: string } = $props();
  let state = $state<'idle' | 'ok' | 'fail'>('idle');
  let timer: ReturnType<typeof setTimeout>;

  async function copy(e: MouseEvent) {
    e.stopPropagation();
    const t = typeof text === 'function' ? text() : text;
    let ok = false;
    try { await navigator.clipboard.writeText(t); ok = true; } catch {
      try {
        const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0;left:-9999px';
        document.body.appendChild(ta); ta.select(); ok = document.execCommand('copy'); ta.remove();
      } catch { /* nothing more to try */ }
    }
    state = ok ? 'ok' : 'fail';
    clearTimeout(timer); timer = setTimeout(() => (state = 'idle'), 1600);
  }
</script>

<button class="cpy" class:done={state === 'ok'} type="button" aria-label={label} onclick={copy}>
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2.5" /><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" /></svg>
  <span>{state === 'ok' ? 'Copied' : state === 'fail' ? 'Select the text' : 'Copy'}</span>
</button>
