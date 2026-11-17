/* Small UI behaviours from the design system. Nothing here touches the DOM at import time, so Svelte components
   rendered on the server can import it. */

/* indicators — one sliding pill per .seg (aria-pressed). Snaps on first placement, springs after.
   The top-bar tabs don't need this: each page renders its own pill and the page transition morphs it. */
function syncInd(c: HTMLElement, instant = false) {
  let ind = c.querySelector<HTMLElement>(':scope>.ind');
  const sel = c.querySelector<HTMLElement>(':scope>[aria-pressed="true"]');
  if (!ind) { ind = document.createElement('span'); ind.className = 'ind'; c.prepend(ind); c.classList.add('has-ind'); instant = true; }
  if (!sel || !sel.offsetParent) { ind.style.opacity = '0'; ind.dataset.placed = ''; return; }
  if (!ind.dataset.placed) instant = true;
  ind.dataset.placed = '1';
  if (instant) ind.classList.add('no-anim');
  ind.style.opacity = '1';
  Object.assign(ind.style, { left: sel.offsetLeft + 'px', top: sel.offsetTop + 'px', width: sel.offsetWidth + 'px', height: sel.offsetHeight + 'px' });
  if (instant) { void ind.offsetWidth; requestAnimationFrame(() => ind!.classList.remove('no-anim')); }
}
export function indicators(scope: ParentNode = document) {
  const list = [...scope.querySelectorAll<HTMLElement & { _ind?: boolean }>('.seg')];
  for (const c of list) {
    if (c._ind) continue; c._ind = true;
    new MutationObserver(() => syncInd(c)).observe(c, { subtree: true, attributes: true, attributeFilter: ['aria-pressed'] });
    new ResizeObserver(() => syncInd(c)).observe(c);
    syncInd(c, true);
  }
  document.fonts?.ready.then(() => list.forEach((c) => syncInd(c, true)));
}

/* glint — a soft accent light follows a MOUSE pointer across glass cards. */
export function glint(sel: string) {
  document.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    const el = (e.target as Element).closest?.<HTMLElement>(sel); if (!el) return;
    el.classList.add('glint');
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px');
  }, { passive: true });
}
