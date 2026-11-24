/* Motion from the design book (§6), as Svelte actions and small helpers. Nothing touches the DOM at import time.

   use:indicator   one sliding pill for .tabs / .seg (selected child has aria-selected or aria-pressed = true),
                   or a sliding underline for .subtabs. Snaps on first placement, springs after.
   use:viewIn      the 0.3s view-switch crossfade when an element appears (skipped during the first-load rise-in).
   enter(el)       stagger an element's cards in after a filter change (the CSS reads --i on each child).
   bump(el)        the stat-pill bump when a value changes.
   glint(sel)      a soft accent light follows a MOUSE pointer across matching glass cards. */

import { isReducedMotion } from './perf';

function syncInd(c: HTMLElement, instant = false) {
  let ind = c.querySelector<HTMLElement>(':scope>.ind');
  const sel = c.querySelector<HTMLElement>(':scope>[aria-selected="true"],:scope>[aria-pressed="true"]');
  if (!ind) { ind = document.createElement('span'); ind.className = 'ind'; ind.setAttribute('aria-hidden', 'true'); c.prepend(ind); c.classList.add('has-ind'); instant = true; }
  if (!sel || !sel.offsetParent) { ind.style.opacity = '0'; ind.dataset.placed = ''; return; }
  if (!ind.dataset.placed) instant = true; // first placement (or reappearing) snaps; every later change slides
  ind.dataset.placed = '1';
  if (instant) ind.classList.add('no-anim');
  ind.style.opacity = '1';
  const under = c.classList.contains('subtabs');
  Object.assign(ind.style, {
    left: sel.offsetLeft + 'px', width: sel.offsetWidth + 'px',
    top: (under ? sel.offsetTop + sel.offsetHeight - 2.5 : sel.offsetTop) + 'px',
    height: under ? '2.5px' : sel.offsetHeight + 'px',
  });
  if (instant) { void ind.offsetWidth; requestAnimationFrame(() => ind!.classList.remove('no-anim')); }
}

export function indicator(c: HTMLElement) {
  const sync = () => syncInd(c);
  const mo = new MutationObserver(sync);
  mo.observe(c, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'aria-pressed'] });
  const ro = new ResizeObserver(sync); ro.observe(c);
  // a container that was hidden has zero size; re-measure when anything above it is shown again
  const io = new IntersectionObserver(sync); io.observe(c);
  syncInd(c, true);
  document.fonts?.ready.then(() => syncInd(c, true));
  return { destroy() { mo.disconnect(); ro.disconnect(); io.disconnect(); } };
}

export function fadeIn(el: HTMLElement | null | undefined) {
  if (!el || isReducedMotion()) return;
  el.classList.remove('view-in'); void el.offsetWidth; el.classList.add('view-in');
}
export function viewIn(el: HTMLElement) {
  if (!document.documentElement.classList.contains('booting')) fadeIn(el);
}

export function enter(el: HTMLElement | null | undefined, selector?: string, prop = '--i', cap = 14) {
  if (!el || isReducedMotion()) return;
  if (selector) el.querySelectorAll<HTMLElement>(selector).forEach((c, i) => c.style.setProperty(prop, String(Math.min(i, cap))));
  el.classList.remove('enter'); void el.offsetWidth; el.classList.add('enter');
  clearTimeout((el as any)._et); (el as any)._et = setTimeout(() => el.classList.remove('enter'), 1800);
}

export function bump(el: HTMLElement) { if (isReducedMotion()) return; el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }

let glintSels = new Set<string>();
export function glint(sel: string) {
  if (glintSels.size === 0) {
    document.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || isReducedMotion() || document.documentElement.getAttribute('data-glass') === 'off') return;
      const el = (e.target as Element).closest?.<HTMLElement>([...glintSels].join(','));
      if (!el) return;
      el.classList.add('glint');
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', e.clientX - r.left + 'px'); el.style.setProperty('--my', e.clientY - r.top + 'px');
    }, { passive: true });
  }
  glintSels.add(sel);
}
