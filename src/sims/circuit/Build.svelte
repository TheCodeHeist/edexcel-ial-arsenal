<script lang="ts">
  /* Build: parts bin | the board with its tools | the inspector. Keyboard: Delete removes the selection, R rotates,
     Ctrl+Z / Ctrl+Shift+Z (or Ctrl+Y) undo and redo, Escape clears the selection. */
  import Board, { type Flow } from './Board.svelte';
  import Tray from './Tray.svelte';
  import Inspector from './Inspector.svelte';
  import Seg from '../../components/ui/Seg.svelte';
  import type { Editor } from './editor.svelte';
  import type { Solution } from './solve';
  import type { Example } from './examples';
  import type { Kind } from './parts';

  let { ed, sol, prefs, hidden: off = false, example = $bindable('') }: {
    ed: Editor; sol: Solution; prefs: { flow: Flow; values: boolean; zoom: number; zoomPhone: number }; hidden?: boolean; example?: string;
  } = $props();

  const ZOOMS = [1, 1.5, 2, 2.5];

  /* phones get their own zoom (the whole board would be too small to edit); the board then scrolls inside its frame */
  let narrow = $state(false);
  $effect(() => {
    const mq = matchMedia('(max-width: 760px)'), set = () => (narrow = mq.matches);
    set(); mq.addEventListener('change', set);
    return () => mq.removeEventListener('change', set);
  });
  const zoom = $derived(narrow ? prefs.zoomPhone : prefs.zoom);
  const setZoom = (z: number) => { if (narrow) prefs.zoomPhone = z; else prefs.zoom = z; };
  const step = (d: number) => { const i = ZOOMS.findIndex((z) => z >= zoom - 1e-9); setZoom(ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + d))]); };

  let board = $state<ReturnType<typeof Board>>();
  const shortNames = $derived(sol.shorts.map((id) => ed.c.parts.find((p) => p.id === id)?.name).filter(Boolean));

  function drop(k: Kind, x: number, y: number) {
    const at = board?.gridAt(x, y);
    if (!at) return false;
    ed.add(k, at); example = '';
    return true;
  }
  function loadExample(ex: Example) { ed.load(ex.data()); example = ex.id; }

  function key(e: KeyboardEvent) {
    if (off) return;
    const t = e.target as HTMLElement;
    if (t.closest('input,select,textarea,[contenteditable]')) return;
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) ed.redo(); else ed.undo(); }
    else if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); ed.redo(); }
    else if (mod || e.altKey) return;
    else if ((e.key === 'Delete' || e.key === 'Backspace') && ed.sel) { e.preventDefault(); ed.remove(); }
    else if (e.key.toLowerCase() === 'r' && ed.sel?.t === 'part') { e.preventDefault(); ed.rotate(); }
    else if (e.key === 'Escape') ed.select(null);
  }
</script>

<svelte:window onkeydown={key} />

<main class="layout build" hidden={off}>
  <section class="panel tray" aria-label="Parts bin">
    <div class="ph"><h2>Parts</h2></div>
    <Tray onadd={(k) => { ed.add(k); example = ''; }} ondrop={drop} onexample={loadExample} current={example} />
  </section>

  <section class="panel stage" aria-label="Circuit board">
    <div class="stage-head">
      <div class="label-chip"><small>Board</small><span>{ed.c.parts.length} {ed.c.parts.length === 1 ? 'part' : 'parts'}</span></div>
      <div class="stage-tools">
        <button class="btn" type="button" disabled={!ed.canUndo} onclick={() => ed.undo()} title="Undo (Ctrl+Z)">Undo</button>
        <button class="btn" type="button" disabled={!ed.canRedo} onclick={() => ed.redo()} title="Redo (Ctrl+Shift+Z)">Redo</button>
        <button class="btn" type="button" disabled={!ed.c.parts.length && !ed.c.wires.length} onclick={() => { ed.clear(); example = ''; }}>Clear</button>
      </div>
    </div>
    <div class="board-box">
      <Board bind:this={board} c={ed.c} {sol} {ed} flow={prefs.flow} values={prefs.values} {zoom} label="Circuit board: {ed.c.parts.map((p) => p.name).join(', ') || 'empty'}" />
      {#if shortNames.length}
        <div class="bwarn" role="alert">Short circuit across {shortNames.join(', ')}</div>
      {:else if !ed.c.parts.length}
        <div class="bempty">Add parts from the bin, or load an example.</div>
      {/if}
    </div>
    <div class="board-foot">
      <Seg label="Moving charge" options={[['conv', 'Conventional current', 'Current'], ['electron', 'Electron flow', 'Electrons'], ['off', 'Off']]} bind:value={prefs.flow} />
      <div class="foot-r">
        <button class="btn" type="button" aria-pressed={prefs.values} onclick={() => (prefs.values = !prefs.values)}>{prefs.values ? 'Hide values' : 'Show values'}</button>
        <div class="zoom" role="group" aria-label="Zoom">
          <button class="btn" type="button" aria-label="Zoom out" disabled={zoom <= ZOOMS[0]} onclick={() => step(-1)}>−</button>
          <span>{Math.round(zoom * 100)}%</span>
          <button class="btn" type="button" aria-label="Zoom in" disabled={zoom >= ZOOMS[ZOOMS.length - 1]} onclick={() => step(1)}>+</button>
        </div>
      </div>
    </div>
  </section>

  <section class="panel inspector" aria-label="Inspector">
    <div class="ph"><h2>Inspector</h2></div>
    <Inspector {ed} {sol} />
  </section>
</main>
