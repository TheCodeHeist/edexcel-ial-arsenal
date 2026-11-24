/* Performance & display settings engine shared by the hub and every simulation.
   Stored under arsenal-perf in localStorage (JSON). The inline script in Base.astro / Sim.astro
   restores data-glass / data-aurora / data-motion / data-text before first paint so heavy effects never flash.
   Nothing here touches the DOM until initPerf() runs, so server-rendered components can import it. */

import { store } from './util';

export type PerfPreset = 'full' | 'balanced' | 'eco' | 'custom';
export type ResScale = 'full' | 'standard' | 'eco';
export type FpsCap = 60 | 30;
export type TextScale = 'compact' | 'default' | 'large';

export interface PerfSettings {
  glass: boolean;
  aurora: boolean;
  reducedMotion: boolean;
  bloom: boolean;
  resolution: ResScale;
  fps: FpsCap;
  showFps: boolean;
  textScale: TextScale;
}

export interface PerfState extends PerfSettings {
  preset: PerfPreset;
  autoTuned: boolean;
}

type PerfCore = Pick<PerfSettings, 'glass' | 'aurora' | 'reducedMotion' | 'bloom' | 'resolution' | 'fps'>;

export const PRESETS: Record<Exclude<PerfPreset, 'custom'>, PerfCore> = {
  full: { glass: true, aurora: true, reducedMotion: false, bloom: true, resolution: 'full', fps: 60 },
  balanced: { glass: false, aurora: false, reducedMotion: false, bloom: true, resolution: 'standard', fps: 60 },
  eco: { glass: false, aurora: false, reducedMotion: true, bloom: false, resolution: 'eco', fps: 30 },
};

const DEFAULTS: PerfSettings = { ...PRESETS.full, showFps: false, textScale: 'default' };
const state: PerfSettings = { ...DEFAULTS };
const listeners = new Set<(p: PerfState) => void>();
let started = false;
let autoTuned = false;

export function isLowEndDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return true;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4) return true;
  if (typeof nav.hardwareConcurrency === 'number' && nav.hardwareConcurrency <= 4) return true;
  return false;
}

function detectPreset(s: PerfSettings): PerfPreset {
  for (const key of ['full', 'balanced', 'eco'] as const) {
    const p = PRESETS[key];
    if (
      s.glass === p.glass &&
      s.aurora === p.aurora &&
      s.reducedMotion === p.reducedMotion &&
      s.bloom === p.bloom &&
      s.resolution === p.resolution &&
      s.fps === p.fps
    ) return key;
  }
  return 'custom';
}

export function getPerf(): PerfState {
  if (!started && typeof window !== 'undefined') load();
  return { ...state, preset: detectPreset(state), autoTuned };
}

function apply() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (state.glass) root.removeAttribute('data-glass'); else root.setAttribute('data-glass', 'off');
  if (state.aurora) root.removeAttribute('data-aurora'); else root.setAttribute('data-aurora', 'off');
  if (state.reducedMotion) root.setAttribute('data-motion', 'reduced'); else root.removeAttribute('data-motion');
  if (state.textScale === 'default') root.removeAttribute('data-text'); else root.setAttribute('data-text', state.textScale);
  const p = getPerf();
  listeners.forEach((f) => f(p));
}

function load() {
  const saved = store.get<Partial<PerfSettings> | null>('perf', null);
  if (!saved || typeof saved !== 'object') {
    const low = isLowEndDevice();
    autoTuned = low;
    Object.assign(state, DEFAULTS, low ? PRESETS.balanced : PRESETS.full);
    return;
  }
  autoTuned = false;
  state.glass = typeof saved.glass === 'boolean' ? saved.glass : DEFAULTS.glass;
  state.aurora = typeof saved.aurora === 'boolean' ? saved.aurora : DEFAULTS.aurora;
  state.reducedMotion = typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : DEFAULTS.reducedMotion;
  state.bloom = typeof saved.bloom === 'boolean' ? saved.bloom : DEFAULTS.bloom;
  state.resolution = saved.resolution === 'eco' || saved.resolution === 'standard' || saved.resolution === 'full' ? saved.resolution : DEFAULTS.resolution;
  state.fps = saved.fps === 30 ? 30 : 60;
  state.showFps = typeof saved.showFps === 'boolean' ? saved.showFps : DEFAULTS.showFps;
  state.textScale = saved.textScale === 'compact' || saved.textScale === 'large' ? saved.textScale : 'default';
}

export function onPerf(f: (p: PerfState) => void) {
  listeners.add(f);
  return () => { listeners.delete(f); };
}

export function setPerf(patch: Partial<PerfSettings>) {
  autoTuned = false;
  Object.assign(state, patch);
  store.set('perf', state);
  apply();
}

export function setPreset(preset: Exclude<PerfPreset, 'custom'>) {
  setPerf(PRESETS[preset]);
}

export function resetPerf() {
  autoTuned = false;
  Object.assign(state, DEFAULTS);
  store.set('perf', state);
  apply();
}

export function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (!started) load();
  return state.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function getDpr(small = false): number {
  if (typeof window === 'undefined') return 1;
  if (!started) load();
  const dpr = window.devicePixelRatio || 1;
  if (state.resolution === 'eco') return 1;
  if (state.resolution === 'standard') return Math.min(dpr, 1.25);
  return Math.min(dpr, small ? 1.5 : 2);
}

/** Minimum milliseconds between rendered frames (0 = uncapped 60fps+, ~32.2ms = clean 30fps on 60Hz). */
export function getMinFrameMs(): number {
  if (typeof window === 'undefined') return 0;
  if (!started) load();
  return state.fps === 30 ? 1000 / 31 : 0;
}

/** Gate for requestAnimationFrame loops: skips hidden tabs and enforces the 30 fps cap. */
export function frameReady(now: number, last: number): 'go' | 'skip' | 'hidden' {
  if (typeof document !== 'undefined' && document.hidden) return 'hidden';
  const minMs = getMinFrameMs();
  if (minMs > 0 && now - last < minMs) return 'skip';
  return 'go';
}

/** Live FPS badge mounted inside a 3D canvas container when showFps is enabled. */
export class FpsMeter {
  #el: HTMLSpanElement | null = null;
  #frames = 0;
  #winStart = 0;
  #on = false;
  #off: () => void;

  constructor(private host: HTMLElement | null) {
    this.#sync(getPerf().showFps);
    this.#off = onPerf((p) => this.#sync(p.showFps));
  }

  #sync(show: boolean) {
    this.#on = show;
    if (show && this.host && !this.#el) {
      const el = document.createElement('span');
      el.className = 'fps-pill';
      el.setAttribute('aria-hidden', 'true');
      el.textContent = '… fps';
      this.host.appendChild(el);
      this.#el = el;
      this.#frames = 0;
      this.#winStart = performance.now();
    } else if (!show && this.#el) {
      this.#el.remove();
      this.#el = null;
    }
  }

  tick(now: number) {
    if (!this.#on || !this.#el) return;
    this.#frames++;
    const dt = now - this.#winStart;
    if (dt >= 450) {
      const fps = Math.round((this.#frames * 1000) / dt);
      this.#el.textContent = `${fps} fps`;
      this.#frames = 0;
      this.#winStart = now;
    }
  }

  dispose() {
    this.#off();
    this.#el?.remove();
    this.#el = null;
  }
}

export function initPerf() {
  if (started || typeof window === 'undefined') return;
  started = true;
  load();
  addEventListener('storage', (e) => { if (e.key === 'arsenal-perf') { load(); apply(); } });
  addEventListener('pageshow', (e) => { if (e.persisted) { load(); apply(); } });
  apply();
}
