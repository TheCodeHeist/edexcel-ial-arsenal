/* Theme engine for the hub, ported from design-system/js/playground.js.
   The palette and mode are stored under arsenal-palette / arsenal-mode (JSON strings). The simulations in public/
   read and write the same keys, so one choice follows the student across the whole site.
   The inline script in Base.astro sets data-palette / data-mode before first paint; this module keeps them updated. */

import { PALETTES, type PaletteId } from '../data/palettes';
import { indicators } from './ui';

export type Mode = 'auto' | 'light' | 'dark';
export interface ThemeState { palette: PaletteId; mode: Mode; effective: 'light' | 'dark'; name: string; variant: string }

const root = document.documentElement;
const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mq = matchMedia('(prefers-color-scheme: dark)');

const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('arsenal-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('arsenal-' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};

const state: { palette: PaletteId; mode: Mode } = { palette: 'catppuccin', mode: 'auto' };
const listeners: ((t: ThemeState) => void)[] = [];

const effMode = (): 'light' | 'dark' =>
  state.mode !== 'auto' ? state.mode : (root.getAttribute('data-theme') as 'light' | 'dark' | null) || (mq.matches ? 'dark' : 'light');

export function getTheme(): ThemeState {
  const m = effMode(), P = PALETTES[state.palette];
  return { palette: state.palette, mode: state.mode, effective: m, name: P.name, variant: P[m].v };
}

function apply() {
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

export function onTheme(f: (t: ThemeState) => void) { listeners.push(f); }

/* setTheme — with the click event, plays the circular reveal from the pointer. */
export function setTheme(next: { palette?: PaletteId; mode?: Mode }, ev?: MouseEvent) {
  const go = () => {
    if (next.palette && PALETTES[next.palette]) state.palette = next.palette;
    if (next.mode) state.mode = next.mode;
    apply(); store.set('palette', state.palette); store.set('mode', state.mode);
  };
  if (!ev || !document.startViewTransition || RM) { go(); return; }
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

export function initTheme() {
  load();
  mq.addEventListener('change', apply);
  // Another tab, or a simulation the student came back from, may have changed the theme.
  addEventListener('storage', (e) => { if (e.key?.startsWith('arsenal-')) { load(); apply(); } });
  addEventListener('pageshow', (e) => { if (e.persisted) { load(); apply(); } });
  apply();
}

/* themePicker — wires the markup rendered by ThemePicker.astro. */
export function themePicker(host: HTMLElement) {
  const btn = host.querySelector<HTMLButtonElement>('.theme-btn')!;
  const pop = host.querySelector<HTMLElement>('.theme-pop')!;
  const paint = (t: ThemeState) => {
    const c = PALETTES[t.palette][t.effective];
    host.querySelector('.theme-name')!.innerHTML = `${t.name}<span class="tsep" aria-hidden="true"></span><span class="tvar">${t.variant}</span>`;
    host.querySelector('.dots')!.innerHTML = [c.accent, c.redox, c.ligand, c.acidbase].map((x) => `<i style="background:${x}"></i>`).join('');
    host.querySelector('.tp-note')!.textContent = t.mode === 'auto' ? `Auto · ${t.effective}` : t.mode;
    btn.setAttribute('aria-label', `Theme: ${t.name} ${t.variant}`);
    host.querySelectorAll<HTMLElement>('.tp-row').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.p === t.palette)));
    host.querySelectorAll<HTMLElement>('[data-tm]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tm === t.mode)));
  };
  onTheme(paint); paint(getTheme());
  host.querySelectorAll<HTMLElement>('.tp-row').forEach((b) => (b.onclick = (e) => setTheme({ palette: b.dataset.p as PaletteId }, e)));
  host.querySelectorAll<HTMLElement>('[data-tm]').forEach((b) => (b.onclick = (e) => setTheme({ mode: b.dataset.tm as Mode }, e)));
  const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.onclick = (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; btn.setAttribute('aria-expanded', String(!pop.hidden)); if (!pop.hidden) indicators(host); };
  document.addEventListener('click', (e) => { if (!host.contains(e.target as Node)) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
}
