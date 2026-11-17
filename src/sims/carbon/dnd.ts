/* Drag and drop for anything marked data-item="c:<id>" or "r:<id>" (design book §9): a mouse drags at once,
   touch needs a long press (so the page still scrolls), and a tap adds the item to the circle directly.
   Drop on a slot to fill that slot, or anywhere on the circle to let it choose. Any text selection is cleared when a
   drag starts. Installed once by App.svelte; returns a cleanup function. */

import type { Circle } from './circle.svelte';

interface DragState { card: HTMLElement; x: number; y: number; id: number; type: string; started: boolean; moved?: boolean; item: string;
  lp?: ReturnType<typeof setTimeout>; ghost?: HTMLElement; gw?: number; gh?: number }

export function installDnd(o: { active: () => Circle | null; closeDrawer: (fast?: boolean) => void }) {
  let drag: DragState | null = null, suppressClick = false;
  const slots = () => (o.active()?.vessel?.querySelectorAll<HTMLElement>('.slot') ?? []) as Iterable<HTMLElement>;
  const slotAt = (x: number, y: number) => document.elementFromPoint(x, y)?.closest<HTMLElement>('.slot') ?? null;

  function start(st: DragState, x: number, y: number) {
    const C = o.active(); if (!C || C.busy) { drag = null; return; }
    st.started = true; st.card.classList.add('dragging');
    try { getSelection()?.removeAllRanges(); } catch { /* ignore */ }
    if (st.card.closest('.sheet')) o.closeDrawer(true);
    document.body.classList.add('dragging-on');
    const g = st.card.cloneNode(true) as HTMLElement; g.classList.add('ghost'); g.classList.remove('dragging', 'fresh', 'in-slot');
    g.style.width = Math.min(170, st.card.offsetWidth) + 'px';
    document.body.appendChild(g); st.ghost = g; st.gw = g.offsetWidth; st.gh = g.offsetHeight;
    for (const s of slots()) s.classList.add('can');
    move(st, x, y);
  }
  function move(st: DragState, x: number, y: number) {
    st.ghost!.style.transform = `translate(${x - st.gw! / 2}px,${y - st.gh! / 2}px)`;
    const s = slotAt(x, y);
    document.querySelectorAll('.slot.over').forEach((el) => el !== s && el.classList.remove('over'));
    s?.classList.add('over');
  }
  function end(st: DragState, x: number, y: number, cancel = false) {
    st.card.classList.remove('dragging'); document.body.classList.remove('dragging-on');
    st.ghost?.remove();
    document.querySelectorAll('.slot').forEach((s) => s.classList.remove('can', 'over'));
    if (cancel) return;
    const C = o.active(); if (!C?.vessel) return;
    const s = slotAt(x, y);
    if (s && C.vessel.contains(s)) C.add(st.item, Number(s.dataset.slot));
    else { const el = document.elementFromPoint(x, y); if (el && C.vessel.contains(el)) C.add(st.item); }
  }

  const onDown = (e: PointerEvent) => {
    const card = (e.target as Element).closest?.<HTMLElement>('[data-item]');
    if (!card || e.button > 0 || card.closest('.slot') || card.classList.contains('ghost') || !o.active()) return;
    const st: DragState = { card, x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, started: false, item: card.dataset.item! };
    drag = st;
    if (e.pointerType !== 'mouse') st.lp = setTimeout(() => { if (drag === st && !st.moved) { start(st, st.x, st.y); navigator.vibrate?.(8); } }, 260);
  };
  const onMove = (e: PointerEvent) => {
    const st = drag; if (!st || e.pointerId !== st.id) return;
    if (!st.started) {
      if (Math.hypot(e.clientX - st.x, e.clientY - st.y) > 7) {
        if (st.type === 'mouse') start(st, e.clientX, e.clientY);
        else { st.moved = true; clearTimeout(st.lp); drag = null; }
      }
      return;
    }
    move(st, e.clientX, e.clientY);
  };
  const onUp = (e: PointerEvent) => {
    const st = drag; if (!st || e.pointerId !== st.id) return;
    clearTimeout(st.lp); drag = null;
    if (st.started) { suppressClick = true; setTimeout(() => (suppressClick = false), 50); end(st, e.clientX, e.clientY); }
  };
  const onCancel = () => { const st = drag; if (!st) return; clearTimeout(st.lp); drag = null; if (st.started) end(st, 0, 0, true); };
  const onTouchMove = (e: TouchEvent) => { if (drag?.started) e.preventDefault(); };
  const onMenu = (e: Event) => { if ((e.target as Element).closest?.('[data-item]')) e.preventDefault(); };
  const onClick = (e: MouseEvent) => {
    const card = (e.target as Element).closest?.<HTMLElement>('[data-item]');
    if (!card || card.closest('.slot') || suppressClick) return;
    const C = o.active(); if (!C) return;
    C.add(card.dataset.item!);
    if (card.closest('.sheet')) o.closeDrawer();
  };

  document.addEventListener('pointerdown', onDown);
  document.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerup', onUp);
  document.addEventListener('pointercancel', onCancel);
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('contextmenu', onMenu);
  document.addEventListener('click', onClick);
  return () => {
    document.removeEventListener('pointerdown', onDown);
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.removeEventListener('pointercancel', onCancel);
    document.removeEventListener('touchmove', onTouchMove);
    document.removeEventListener('contextmenu', onMenu);
    document.removeEventListener('click', onClick);
  };
}
