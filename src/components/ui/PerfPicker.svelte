<script lang="ts">
  /* Settings popover: palette circles + display & performance controls. Shared by the hub and every simulation. */
  import { onMount } from 'svelte';
  import { PALETTES, type PaletteId } from '../../data/palettes';
  import { initTheme, onTheme, getTheme, setTheme, type ThemeState } from '../../lib/theme';
  import { initPerf, onPerf, getPerf, setPerf, setPreset, resetPerf, type PerfState, type ResScale, type FpsCap, type TextScale } from '../../lib/perf';
  import { indicator } from '../../lib/motion';

  let t = $state<ThemeState | null>(null);
  let p = $state<PerfState | null>(null);
  let open = $state(false);
  let host: HTMLElement;

  const ids = Object.keys(PALETTES) as PaletteId[];

  const PRESET_OPTS = [
    ['full', 'Full'],
    ['balanced', 'Balanced'],
    ['eco', 'Eco'],
  ] as const;

  const RES_OPTS: [ResScale, string][] = [
    ['full', 'Full'],
    ['standard', '1.25×'],
    ['eco', '1×'],
  ];

  const FPS_OPTS: [FpsCap, string][] = [
    [60, '60 fps'],
    [30, '30 fps'],
  ];

  const TEXT_OPTS: [TextScale, string][] = [
    ['compact', 'Small'],
    ['default', 'Normal'],
    ['large', 'Large'],
  ];

  const active = $derived(p ? p.preset !== 'full' || p.showFps || p.textScale !== 'default' : false);
  const presetLabel = $derived(
    !p ? '' : p.preset === 'full' ? 'Full' : p.preset === 'balanced' ? 'Balanced' : p.preset === 'eco' ? 'Eco' : 'Custom'
  );

  function toggle(e: MouseEvent) {
    e.stopPropagation();
    open = !open;
    if (open) window.dispatchEvent(new CustomEvent('arsenal-pop', { detail: host }));
  }

  function flip(k: 'glass' | 'aurora' | 'bloom' | 'reducedMotion' | 'showFps') {
    if (p) setPerf({ [k]: !p[k] });
  }

  function resetAll(e: MouseEvent) {
    resetPerf();
    setTheme({ palette: 'catppuccin', mode: 'auto' }, e);
  }

  onMount(() => {
    initTheme();
    initPerf();
    t = getTheme();
    p = getPerf();
    const offT = onTheme((s) => (t = s));
    const offP = onPerf((s) => (p = s));
    const close = (e: Event) => { if (!host.contains(e.target as Node)) open = false; };
    const otherPop = (e: Event) => { if ((e as CustomEvent).detail !== host) open = false; };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') open = false; };
    document.addEventListener('click', close);
    window.addEventListener('arsenal-pop', otherPop);
    document.addEventListener('keydown', esc);
    return () => {
      offT();
      offP();
      document.removeEventListener('click', close);
      window.removeEventListener('arsenal-pop', otherPop);
      document.removeEventListener('keydown', esc);
    };
  });
</script>

<div class="perf-wrap" bind:this={host}>
  <button
    class="perf-btn"
    class:active
    type="button"
    aria-haspopup="true"
    aria-expanded={open}
    aria-label={p ? `Settings (${presetLabel})` : 'Settings'}
    title="Settings & themes"
    onclick={toggle}
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
    {#if active}<i class="perf-dot" aria-hidden="true"></i>{/if}
  </button>

  {#if open && p && t}
    <div class="perf-pop" role="dialog" aria-label="Settings">
      <div class="tp-h">
        <b>Theme</b>
        <b class="tp-note">{t.name} · {t.variant}</b>
      </div>

      <div class="pp-palettes" role="group" aria-label="Colour palette">
        {#each ids as k}
          {@const P = PALETTES[k]}
          {@const c = P[t.effective]}
          {@const selected = t.palette === k}
          <button
            type="button"
            class="pp-pal"
            aria-pressed={selected}
            title={`${P.name} (${c.v})`}
            onclick={(e) => setTheme({ palette: k }, e)}
          >
            <span
              class="pp-orb"
              style:--obg={c.bg}
              style:--oac={c.accent}
              style:--oc2={c.redox}
              style:--oc3={c.acidbase}
            >
              {#if selected}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              {/if}
            </span>
            <span class="pp-pname">{P.name}</span>
          </button>
        {/each}
      </div>

      <div class="pp-sep" aria-hidden="true"></div>

      <div class="tp-h">
        <b>Performance</b>
        <b class="tp-note">{presetLabel}{p.autoTuned ? ' · Auto' : ''}</b>
      </div>

      {#if p.autoTuned}
        <p class="pp-hint">Auto-tuned to Balanced for this device. Pick any preset below to override.</p>
      {/if}

      <div class="pp-presets">
        <div class="seg" role="group" aria-label="Performance preset" use:indicator>
          {#each PRESET_OPTS as [id, label]}
            <button type="button" aria-pressed={p.preset === id} onclick={() => setPreset(id)}>{label}</button>
          {/each}
        </div>
      </div>

      <div class="pp-list">
        <button type="button" class="pp-row" role="switch" aria-checked={p.glass} onclick={() => flip('glass')}>
          <span class="pp-txt">
            <span class="nm">Liquid glass</span>
            <span class="vn">{p.glass ? 'Translucent blur surfaces' : 'Flat solid UI · faster GPU'}</span>
          </span>
          <span class="sw-track" aria-hidden="true"><i></i></span>
        </button>

        <button type="button" class="pp-row" role="switch" aria-checked={p.aurora} onclick={() => flip('aurora')}>
          <span class="pp-txt">
            <span class="nm">Aurora glow</span>
            <span class="vn">{p.aurora ? 'Drifting ambient blobs' : 'Clean static background'}</span>
          </span>
          <span class="sw-track" aria-hidden="true"><i></i></span>
        </button>

        <button type="button" class="pp-row" role="switch" aria-checked={p.bloom} onclick={() => flip('bloom')}>
          <span class="pp-txt">
            <span class="nm">3D bloom</span>
            <span class="vn">{p.bloom ? 'Post-processing glow pass' : 'Direct render · lighter 3D'}</span>
          </span>
          <span class="sw-track" aria-hidden="true"><i></i></span>
        </button>

        <button type="button" class="pp-row" role="switch" aria-checked={p.reducedMotion} onclick={() => flip('reducedMotion')}>
          <span class="pp-txt">
            <span class="nm">Reduced motion</span>
            <span class="vn">{p.reducedMotion ? 'Snappy UI · no spin or glint' : 'Smooth spring animations'}</span>
          </span>
          <span class="sw-track" aria-hidden="true"><i></i></span>
        </button>

        <button type="button" class="pp-row" role="switch" aria-checked={p.showFps} onclick={() => flip('showFps')}>
          <span class="pp-txt">
            <span class="nm">FPS counter</span>
            <span class="vn">{p.showFps ? 'Live badge on 3D views' : 'Hidden'}</span>
          </span>
          <span class="sw-track" aria-hidden="true"><i></i></span>
        </button>
      </div>

      <div class="pp-group">
        <span class="pp-lbl">3D resolution</span>
        <div class="seg pp-seg" role="group" aria-label="3D resolution scale" use:indicator>
          {#each RES_OPTS as [val, label]}
            <button type="button" aria-pressed={p.resolution === val} onclick={() => setPerf({ resolution: val })}>{label}</button>
          {/each}
        </div>
      </div>

      <div class="pp-group">
        <span class="pp-lbl">Frame cap</span>
        <div class="seg pp-seg" role="group" aria-label="Animation frame rate cap" use:indicator>
          {#each FPS_OPTS as [val, label]}
            <button type="button" aria-pressed={p.fps === val} onclick={() => setPerf({ fps: val })}>{label}</button>
          {/each}
        </div>
      </div>

      <div class="pp-group">
        <span class="pp-lbl">Text size</span>
        <div class="seg pp-seg" role="group" aria-label="Text size" use:indicator>
          {#each TEXT_OPTS as [val, label]}
            <button type="button" aria-pressed={p.textScale === val} onclick={() => setPerf({ textScale: val })}>{label}</button>
          {/each}
        </div>
      </div>

      <div class="pp-foot">
        <button type="button" class="pp-reset" onclick={resetAll}>Reset defaults</button>
      </div>
    </div>
  {/if}
</div>
