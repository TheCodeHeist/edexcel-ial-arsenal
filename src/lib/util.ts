/* Small helpers shared by the hub and every simulation. Safe to import on the server: nothing runs at import time
   except the reduced-motion check, which is guarded. */

/** true when the visitor asked for reduced motion (always false on the server). */
export const RM = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Wait; under reduced motion waits are capped so sequences still run but never drag. */
export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, RM ? Math.min(ms, 120) : ms));

/** Fisher–Yates, in place; returns the array. */
export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const unique = <T>(a: Iterable<T>): T[] => [...new Set(a)];

export const hex2rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
export const rgba = (h: string, a: number) => { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; };

/** localStorage under the arsenal- prefix, JSON-encoded, never throws (private windows, blocked storage). */
export const store = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem('arsenal-' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem('arsenal-' + k, JSON.stringify(v)); } catch { /* storage blocked */ } },
};
