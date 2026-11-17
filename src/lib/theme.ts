/* Theme engine for the whole site (hub and simulations), ported from design-system/js/playground.js.
   Palette and mode are stored under arsenal-palette / arsenal-mode (JSON strings).
   The inline script in the layouts sets data-palette / data-mode before first paint; this module keeps them updated.
   Nothing here touches the DOM until initTheme() runs, so server-rendered components can import it. */

import { PALETTES, type PaletteId } from '../data/palettes';
import { store } from './util';

export type Mode = 'auto' | 'light' | 'dark';
export interface ThemeState { palette: PaletteId; mode: Mode; effective: 'light' | 'dark'; name: string; variant: string }

const state: { palette: PaletteId; mode: Mode } = { palette: 'catppuccin', mode: 'auto' };
const listeners = new Set<(t: ThemeState) => void>();
let started = false;

const mq = () => matchMedia('(prefers-color-scheme: dark)');
const effMode = (): 'light' | 'dark' =>
  state.mode !== 'auto' ? state.mode : (document.documentElement.getAttribute('data-theme') as 'light' | 'dark' | null) || (mq().matches ? 'dark' : 'light');

export function getTheme(): ThemeState {
  const m = effMode(), P = PALETTES[state.palette];
  return { palette: state.palette, mode: state.mode, effective: m, name: P.name, variant: P[m].v };
}

function apply() {
  const root = document.documentElement;
  root.setAttribute('data-palette', state.palette);
  root.setAttribute('data-mode', effMode());
  const t = getTheme();
  listeners.forEach((f) => f(t));
}

function load() {
  const p = store.get<string>('palette', 'catppuccin');
  state.palette = (p in PALETTES ? p : 'catppuccin') as PaletteId;
  const m = store.get<string>('mode', 'auto');
  state.mode = m === 'light' || m === 'dark' ? m : 'auto';
}

/* onTheme — subscribe; returns an unsubscribe function. */
export function onTheme(f: (t: ThemeState) => void) { listeners.add(f); return () => { listeners.delete(f); }; }

/* setTheme — with the click event, plays the circular reveal from the pointer. */
export function setTheme(next: { palette?: PaletteId; mode?: Mode }, ev?: MouseEvent) {
  const go = () => {
    if (next.palette && PALETTES[next.palette]) state.palette = next.palette;
    if (next.mode) state.mode = next.mode;
    apply(); store.set('palette', state.palette); store.set('mode', state.mode);
  };
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!ev || !document.startViewTransition || RM) { go(); return; }
  const root = document.documentElement;
  const x = ev.clientX, y = ev.clientY;
  const rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  root.classList.add('theming'); // drops the page-navigation view-transition names so the whole page reveals as one
  const t = document.startViewTransition(go);
  t.ready.then(() => {
    root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${rad}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(.22,.7,.2,1)', pseudoElement: '::view-transition-new(root)' });
  }).catch(() => {});
  t.finished.finally(() => root.classList.remove('theming'));
}

/* initTheme — safe to call more than once. */
export function initTheme() {
  if (started) return; started = true;
  load();
  mq().addEventListener('change', apply);
  // Another tab, or a page the student came back to, may have changed the theme.
  addEventListener('storage', (e) => { if (e.key?.startsWith('arsenal-')) { load(); apply(); } });
  addEventListener('pageshow', (e) => { if (e.persisted) { load(); apply(); } });
  new MutationObserver(() => { if (state.mode === 'auto') apply(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  apply();
}
